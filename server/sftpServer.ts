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

export function startSftpDaemon() {
  try {
    const hostKey = ensureHostKey();

    const server = new SshServer(
      {
        hostKeys: [hostKey]
      },
      (client) => {
        let authenticatedUser: any = null;
        let targetServerId: string | null = null;

        client
          .on('authentication', async (ctx) => {
            if (ctx.method !== 'password') {
              return ctx.reject(['password']);
            }

            const rawUsername = ctx.username.trim();
            const password = ctx.password;

            let username = rawUsername;
            let serverId = '';

            if (rawUsername.includes('.')) {
              const parts = rawUsername.split('.');
              username = parts[0];
              serverId = parts.slice(1).join('.');
            }

            const db = await getDb();
            let user = db.users.find(
              (u) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()
            );

            if (!user) {
              const srv = db.servers.find((s) => s.id === rawUsername);
              if (srv) {
                user = db.users.find((u) => u.id === srv.userId);
                serverId = srv.id;
              }
            }

            if (!user) {
              return ctx.reject();
            }

            const passwordHash = db.passwords[user.id];
            if (!passwordHash) {
              return ctx.reject();
            }

            const isPasswordValid = await bcrypt.compare(password, passwordHash);
            if (!isPasswordValid) {
              return ctx.reject();
            }

            let userServer = null;
            if (serverId) {
              userServer = db.servers.find(
                (s) => s.id === serverId && (s.userId === user.id || ['admin', 'super_admin'].includes(user.role))
              );
            } else {
              userServer = db.servers.find((s) => s.userId === user.id) || db.servers[0];
            }

            if (!userServer && user.role !== 'super_admin') {
              return ctx.reject();
            }

            authenticatedUser = user;
            targetServerId = userServer ? userServer.id : db.servers[0]?.id || 'default';
            ctx.accept();
          })
          .on('ready', () => {
            client.on('session', (accept) => {
              const session = accept();

              session.on('sftp', (acceptSftp) => {
                const sftp = acceptSftp();
                if (!targetServerId) {
                  return session.end();
                }

                const baseDir = getServerDir(targetServerId);
                const openHandles: Map<number, { fd?: number; dirEntries?: string[]; dirPath?: string }> = new Map();
                let nextHandle = 1;

                function safePath(reqPath: string): string {
                  const cleaned = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
                  const resolved = path.resolve(baseDir, '.' + (cleaned.startsWith('/') ? cleaned : '/' + cleaned));
                  if (!resolved.startsWith(baseDir)) {
                    return baseDir;
                  }
                  return resolved;
                }

                sftp.on('REALPATH', (reqid, reqPath) => {
                  const resolved = safePath(reqPath || '/');
                  const rel = '/' + path.relative(baseDir, resolved).replace(/\\/g, '/');
                  sftp.name(reqid, [{ filename: rel === '//' ? '/' : rel, longname: rel, attrs: {} as any }]);
                });

                sftp.on('STAT', (reqid, reqPath) => {
                  const target = safePath(reqPath);
                  fs.stat(target, (err, stats) => {
                    if (err) return sftp.status(reqid, 2); // SSH_FX_NO_SUCH_FILE
                    sftp.attrs(reqid, stats as any);
                  });
                });

                sftp.on('LSTAT', (reqid, reqPath) => {
                  const target = safePath(reqPath);
                  fs.lstat(target, (err, stats) => {
                    if (err) return sftp.status(reqid, 2);
                    sftp.attrs(reqid, stats as any);
                  });
                });

                sftp.on('OPEN', (reqid, filename, flags, attrs) => {
                  const target = safePath(filename);
                  let openFlags = 'r';
                  if (flags & 0x0002) openFlags = 'w+';
                  else if (flags & 0x0008) openFlags = 'a';
                  else if (flags & 0x0002 || flags & 0x0004) openFlags = 'w';

                  fs.open(target, openFlags, (err, fd) => {
                    if (err) return sftp.status(reqid, 2);
                    const handle = Buffer.alloc(4);
                    const hId = nextHandle++;
                    handle.writeUInt32BE(hId, 0);
                    openHandles.set(hId, { fd });
                    sftp.handle(reqid, handle);
                  });
                });

                sftp.on('READ', (reqid, handle, offset, length) => {
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

                sftp.on('WRITE', (reqid, handle, offset, data) => {
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || entry.fd === undefined) return sftp.status(reqid, 4);

                  fs.write(entry.fd, data, 0, data.length, offset, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0); // SSH_FX_OK
                  });
                });

                sftp.on('OPENDIR', (reqid, dirPath) => {
                  const target = safePath(dirPath);
                  fs.readdir(target, (err, files) => {
                    if (err) return sftp.status(reqid, 2);
                    const handle = Buffer.alloc(4);
                    const hId = nextHandle++;
                    handle.writeUInt32BE(hId, 0);
                    openHandles.set(hId, { dirEntries: files, dirPath: target });
                    sftp.handle(reqid, handle);
                  });
                });

                sftp.on('READDIR', (reqid, handle) => {
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

                sftp.on('CLOSE', (reqid, handle) => {
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

                sftp.on('MKDIR', (reqid, dirPath) => {
                  const target = safePath(dirPath);
                  fs.mkdir(target, { recursive: true }, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('RMDIR', (reqid, dirPath) => {
                  const target = safePath(dirPath);
                  fs.rm(target, { recursive: true, force: true }, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('REMOVE', (reqid, filePath) => {
                  const target = safePath(filePath);
                  fs.unlink(target, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('RENAME', (reqid, oldPath, newPath) => {
                  const oldTarget = safePath(oldPath);
                  const newTarget = safePath(newPath);
                  fs.rename(oldTarget, newTarget, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
                });
              });
            });
          });
      }
    );

    // Register error handler before listening to prevent uncaught error events
    server.on('error', (err: any) => {
      console.warn(`[AetherPanel] SFTP daemon non-fatal listener notice: ${err.message || err.code}`);
    });

    server.listen(SFTP_PORT, '0.0.0.0', () => {
      console.log(`[AetherPanel] SFTP Daemon active and listening on port ${SFTP_PORT}`);
    });

    return server;
  } catch (err) {
    console.error('[AetherPanel] Could not start SFTP daemon:', err);
  }
}
