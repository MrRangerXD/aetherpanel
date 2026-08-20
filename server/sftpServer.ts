import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ssh2 from 'ssh2';
import { getDb } from './db';
import bcrypt from 'bcryptjs';
import { getServerDir } from './provider';

const SshServer = (ssh2 as any).Server || (ssh2 as any).default?.Server || ssh2;

const SFTP_PORT = parseInt(process.env.SFTP_PORT || '2022', 10);
const HOST_KEY_PATH = path.join(process.cwd(), 'data', 'ssh_host_rsa_key');

function ensureHostKey(): string {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(HOST_KEY_PATH)) {
    const existing = fs.readFileSync(HOST_KEY_PATH, 'utf8');
    if (existing.includes('BEGIN RSA PRIVATE KEY')) {
      return existing;
    }
  }

  // Generate 2048-bit RSA private key in PKCS#1 PEM format for ssh2
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });

  fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  return privateKey;
}

export function startSftpDaemon(port: number = SFTP_PORT) {
  try {
    const hostKey = ensureHostKey();

    const server = new SshServer(
      {
        hostKeys: [hostKey]
      },
      (client: any) => {
        let authenticatedUser: any = null;
        let targetServerId: string | null = null;

        client.on('error', (err: any) => {
          // Ignore socket hangup/reset from clients
        });

        client
          .on('authentication', async (ctx: any) => {
            if (ctx.method !== 'password') {
              return ctx.reject(['password']);
            }

            const rawUsername = (ctx.username || '').trim();
            const password = ctx.password;

            let username = rawUsername;
            let serverId = '';

            // Handle formats: "username.serverId" or "srv_serverId" or "serverId" or "username"
            if (rawUsername.includes('.')) {
              const parts = rawUsername.split('.');
              username = parts[0];
              serverId = parts.slice(1).join('.');
            } else if (rawUsername.startsWith('srv_')) {
              serverId = rawUsername.substring(4);
            }

            const db = await getDb();
            let user = db.users.find(
              (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()
            );

            // If username wasn't matched directly, check if server was specified
            let userServer = null;
            if (serverId) {
              userServer = db.servers.find(
                (s) => s.id === serverId || s.id.startsWith(serverId) || s.id.substring(0, 10) === serverId
              );
            }

            // If user logged in as srv_<id>, resolve user from server owner if not found
            if (!user && userServer) {
              user = db.users.find((u) => u.id === userServer.userId);
            }

            if (!user && !userServer) {
              // Try finding first server for rawUsername
              const srv = db.servers.find((s) => s.id === rawUsername || s.id.startsWith(rawUsername));
              if (srv) {
                user = db.users.find((u) => u.id === srv.userId);
                userServer = srv;
              }
            }

            if (!user && !userServer) {
              return ctx.reject();
            }

            // Check authentication: prioritize server's sftpPassword for srv_ connection, then user password hash
            let isAuthenticated = false;

            if (userServer && (userServer as any).sftpPassword) {
              if (password === (userServer as any).sftpPassword) {
                isAuthenticated = true;
                if (!user) {
                  user = db.users.find((u) => u.id === userServer.userId) || db.users[0];
                }
              }
            }

            if (!isAuthenticated && user) {
              const passwordHash = db.passwords[user.id];
              if (passwordHash) {
                try {
                  isAuthenticated = await bcrypt.compare(password, passwordHash);
                } catch {}
              }
            }

            if (!isAuthenticated) {
              return ctx.reject();
            }

            // Determine target server
            if (!userServer) {
              if (serverId) {
                userServer = db.servers.find(
                  (s) => (s.id === serverId || s.id.startsWith(serverId)) &&
                         (s.userId === user.id || ['admin', 'super_admin'].includes(user.role))
                );
              } else {
                userServer = db.servers.find((s) => s.userId === user.id) || db.servers[0];
              }
            }

            if (!userServer && user.role !== 'super_admin') {
              return ctx.reject();
            }

            authenticatedUser = user;
            targetServerId = userServer ? userServer.id : db.servers[0]?.id || 'default';
            ctx.accept();
          })
          .on('ready', () => {
            client.on('session', (accept: any) => {
              const session = accept();

              session.on('sftp', (acceptSftp: any) => {
                const sftp = acceptSftp();
                if (!targetServerId) {
                  return session.end();
                }

                const baseDir = path.resolve(getServerDir(targetServerId));
                const openHandles: Map<number, { fd?: number; dirEntries?: string[]; dirPath?: string }> = new Map();
                let nextHandle = 1;

                function safePath(reqPath: string): string | null {
                  if (!reqPath) return baseDir;
                  // Strip out null bytes and normalize
                  const sanitized = reqPath.replace(/\0/g, '');
                  const cleaned = path.normalize(sanitized).replace(/^(\.\.[\/\\])+/, '');
                  const resolved = path.resolve(baseDir, '.' + (cleaned.startsWith('/') ? cleaned : '/' + cleaned));

                  // Strict containment check: cannot escape baseDir
                  if (resolved !== baseDir && !resolved.startsWith(baseDir + path.sep)) {
                    return null;
                  }

                  // Symlink traversal protection: verify realpath stays inside baseDir
                  if (fs.existsSync(resolved)) {
                    try {
                      const realResolved = fs.realpathSync(resolved);
                      if (realResolved !== baseDir && !realResolved.startsWith(baseDir + path.sep)) {
                        return null; // Block symlink escaping sandbox!
                      }
                    } catch {}
                  }

                  return resolved;
                }

                sftp.on('REALPATH', (reqid: number, reqPath: string) => {
                  const resolved = safePath(reqPath || '/');
                  if (!resolved) return sftp.status(reqid, 3); // SSH_FX_PERMISSION_DENIED
                  const rel = '/' + path.relative(baseDir, resolved).replace(/\\/g, '/');
                  sftp.name(reqid, [{ filename: rel === '//' ? '/' : rel, longname: rel, attrs: {} as any }]);
                });

                sftp.on('STAT', (reqid: number, reqPath: string) => {
                  const target = safePath(reqPath);
                  if (!target) return sftp.status(reqid, 3);
                  fs.stat(target, (err, stats) => {
                    if (err) return sftp.status(reqid, 2); // SSH_FX_NO_SUCH_FILE
                    sftp.attrs(reqid, stats as any);
                  });
                });

                sftp.on('LSTAT', (reqid: number, reqPath: string) => {
                  const target = safePath(reqPath);
                  if (!target) return sftp.status(reqid, 3);
                  fs.lstat(target, (err, stats) => {
                    if (err) return sftp.status(reqid, 2);
                    sftp.attrs(reqid, stats as any);
                  });
                });

                sftp.on('OPEN', (reqid: number, filename: string, flags: number, attrs: any) => {
                  const target = safePath(filename);
                  if (!target) return sftp.status(reqid, 3);

                  let openFlags = 'r';
                  if (flags & 0x0002) openFlags = 'w+';
                  else if (flags & 0x0008) openFlags = 'a';
                  else if (flags & 0x0002 || flags & 0x0004) openFlags = 'w';

                  // Ensure parent dir exists if opening for write
                  if (openFlags !== 'r') {
                    const parent = path.dirname(target);
                    if (!fs.existsSync(parent)) {
                      fs.mkdirSync(parent, { recursive: true });
                    }
                  }

                  fs.open(target, openFlags, (err, fd) => {
                    if (err) return sftp.status(reqid, 2);
                    const handle = Buffer.alloc(4);
                    const hId = nextHandle++;
                    handle.writeUInt32BE(hId, 0);
                    openHandles.set(hId, { fd });
                    sftp.handle(reqid, handle);
                  });
                });

                sftp.on('READ', (reqid: number, handle: Buffer, offset: number, length: number) => {
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || entry.fd === undefined) return sftp.status(reqid, 4); // SSH_FX_FAILURE

                  const buf = Buffer.alloc(length);
                  fs.read(entry.fd, buf, 0, length, offset, (err, bytesRead) => {
                    if (err) return sftp.status(reqid, 4);
                    if (bytesRead === 0) return sftp.status(reqid, 1); // SSH_FX_EOF
                    sftp.data(reqid, buf.subarray(0, bytesRead));
                  });
                });

                sftp.on('WRITE', (reqid: number, handle: Buffer, offset: number, data: Buffer) => {
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || entry.fd === undefined) return sftp.status(reqid, 4);

                  fs.write(entry.fd, data, 0, data.length, offset, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0); // SSH_FX_OK
                  });
                });

                sftp.on('OPENDIR', (reqid: number, dirPath: string) => {
                  const target = safePath(dirPath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.readdir(target, (err, files) => {
                    if (err) return sftp.status(reqid, 2);
                    const handle = Buffer.alloc(4);
                    const hId = nextHandle++;
                    handle.writeUInt32BE(hId, 0);
                    openHandles.set(hId, { dirEntries: files, dirPath: target });
                    sftp.handle(reqid, handle);
                  });
                });

                sftp.on('READDIR', (reqid: number, handle: Buffer) => {
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || !entry.dirEntries || !entry.dirPath) return sftp.status(reqid, 4);

                  if (entry.dirEntries.length === 0) {
                    return sftp.status(reqid, 1); // SSH_FX_EOF
                  }

                  const batch = entry.dirEntries.splice(0, 32);
                  const names = batch.map((name) => {
                    let statAttrs: any = {};
                    try {
                      statAttrs = fs.statSync(path.join(entry.dirPath!, name));
                    } catch {}
                    return {
                      filename: name,
                      longname: name,
                      attrs: statAttrs
                    };
                  });

                  sftp.name(reqid, names);
                });

                sftp.on('CLOSE', (reqid: number, handle: Buffer) => {
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (entry) {
                    if (entry.fd !== undefined) {
                      try {
                        fs.closeSync(entry.fd);
                      } catch {}
                    }
                    openHandles.delete(hId);
                  }
                  sftp.status(reqid, 0);
                });

                sftp.on('MKDIR', (reqid: number, dirPath: string) => {
                  const target = safePath(dirPath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.mkdir(target, { recursive: true }, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('RMDIR', (reqid: number, dirPath: string) => {
                  const target = safePath(dirPath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.rm(target, { recursive: true, force: true }, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('REMOVE', (reqid: number, filePath: string) => {
                  const target = safePath(filePath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.unlink(target, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('RENAME', (reqid: number, oldPath: string, newPath: string) => {
                  const oldTarget = safePath(oldPath);
                  const newTarget = safePath(newPath);
                  if (!oldTarget || !newTarget) return sftp.status(reqid, 3);

                  const parent = path.dirname(newTarget);
                  if (!fs.existsSync(parent)) {
                    fs.mkdirSync(parent, { recursive: true });
                  }

                  fs.rename(oldTarget, newTarget, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('SETSTAT', (reqid: number, reqPath: string, attrs: any) => {
                  const target = safePath(reqPath);
                  if (!target) return sftp.status(reqid, 3);

                  if (attrs.mode !== undefined) {
                    try {
                      fs.chmodSync(target, attrs.mode);
                    } catch {}
                  }
                  sftp.status(reqid, 0);
                });

                sftp.on('FSETSTAT', (reqid: number, handle: Buffer, attrs: any) => {
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || entry.fd === undefined) return sftp.status(reqid, 4);

                  if (attrs.mode !== undefined) {
                    try {
                      fs.fchmodSync(entry.fd, attrs.mode);
                    } catch {}
                  }
                  sftp.status(reqid, 0);
                });
              });
            });
          });
      }
    );

    server.on('error', (err: any) => {
      console.warn(`[AetherPanel] SFTP daemon non-fatal listener notice: ${err.message || err.code}`);
    });

    server.listen(port, '0.0.0.0', () => {
      console.log(`[AetherPanel] SFTP Daemon active and listening on port ${port}`);
    });

    activeSftpServer = server;
    return server;
  } catch (err) {
    console.error('[AetherPanel] Could not start SFTP daemon:', err);
  }
}

let activeSftpServer: any = null;

export const startSftpServer = startSftpDaemon;

export function stopSftpServer(): void {
  if (activeSftpServer) {
    try {
      activeSftpServer.close();
    } catch {}
    activeSftpServer = null;
  }
}
