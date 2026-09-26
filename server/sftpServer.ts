import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import ssh2 from 'ssh2';
import { getDb } from './db';
import bcrypt from 'bcryptjs';
import { getServerDir, recordServerActivity } from './provider';
import { SftpActiveSessionDTO } from '../src/types';

const SshServer = (ssh2 as any).Server || (ssh2 as any).default?.Server || ssh2;

const SFTP_PORT = parseInt(process.env.SFTP_PORT || '2022', 10);
const HOST_KEY_PATH = path.join(process.cwd(), 'data', 'ssh_host_rsa_key');

// In-memory active live SFTP sessions registry
export interface SftpSessionInstance {
  id: string;
  serverId: string;
  userId: string;
  username: string;
  clientIp: string;
  clientVersion: string;
  connectedAt: string;
  lastActive: string;
  bytesRead: number;
  bytesWritten: number;
  filesRead: number;
  filesWritten: number;
  kill: () => void;
}

const activeSftpSessions = new Map<string, SftpSessionInstance>();

// In-memory brute force protection on port 2022
const sftpFailedAuth = new Map<string, { count: number; lockedUntil: number }>();
const MAX_FAILED_SFTP_ATTEMPTS = 10;
const SFTP_LOCKOUT_MS = 60 * 1000; // 1 minute lockout

function checkSftpRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = sftpFailedAuth.get(ip);
  if (!record) return true;
  if (now > record.lockedUntil) {
    sftpFailedAuth.delete(ip);
    return true;
  }
  return record.count < MAX_FAILED_SFTP_ATTEMPTS;
}

function recordSftpFailure(ip: string) {
  const now = Date.now();
  const record = sftpFailedAuth.get(ip) || { count: 0, lockedUntil: now + SFTP_LOCKOUT_MS };
  record.count++;
  record.lockedUntil = now + SFTP_LOCKOUT_MS;
  sftpFailedAuth.set(ip, record);
}

function clearSftpFailure(ip: string) {
  sftpFailedAuth.delete(ip);
}

export function getActiveSftpSessions(serverId?: string): SftpActiveSessionDTO[] {
  const list: SftpActiveSessionDTO[] = [];
  for (const session of activeSftpSessions.values()) {
    if (!serverId || session.serverId === serverId) {
      list.push({
        id: session.id,
        serverId: session.serverId,
        userId: session.userId,
        username: session.username,
        clientIp: session.clientIp,
        clientVersion: session.clientVersion,
        connectedAt: session.connectedAt,
        lastActive: session.lastActive,
        bytesRead: session.bytesRead,
        bytesWritten: session.bytesWritten,
        filesRead: session.filesRead,
        filesWritten: session.filesWritten
      });
    }
  }
  return list;
}

export function terminateSftpSession(sessionId: string): boolean {
  const session = activeSftpSessions.get(sessionId);
  if (session) {
    try {
      session.kill();
    } catch {}
    activeSftpSessions.delete(sessionId);
    return true;
  }
  return false;
}

export function terminateServerSftpSessions(serverId: string): number {
  let count = 0;
  for (const [id, session] of activeSftpSessions.entries()) {
    if (session.serverId === serverId) {
      try {
        session.kill();
      } catch {}
      activeSftpSessions.delete(id);
      count++;
    }
  }
  return count;
}

function ensureHostKey(): string {
  if (fs.existsSync(HOST_KEY_PATH)) {
    const existing = fs.readFileSync(HOST_KEY_PATH, 'utf8');
    if (existing.includes('BEGIN RSA PRIVATE KEY') || existing.includes('BEGIN PRIVATE KEY')) {
      return existing;
    }
  }

  console.warn('[SFTP] Host key missing or invalid, generating emergency fallback key.');
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });

  try {
    const parentDir = path.dirname(HOST_KEY_PATH);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
  } catch (err: any) {
    console.error('[SFTP] Failed to save generated host key to disk:', err.message);
  }
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
        let usedServerPassword = false;
        let userServer: any = null;
        let db: any = null;
        const clientIp = client._sock?.remoteAddress || '127.0.0.1';
        const clientBanner = (client as any)._banner || client._ident || 'SSH-2.0-GenericClient';
        const sessionId = `sftp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

        client.on('error', () => {
          // Ignore non-fatal socket reset from clients
        });

        client.on('close', () => {
          activeSftpSessions.delete(sessionId);
        });

        client.on('end', () => {
          activeSftpSessions.delete(sessionId);
        });

        client
          .on('authentication', async (ctx: any) => {
            if (!checkSftpRateLimit(clientIp)) {
              console.warn(`[SFTP/SECURITY] IP ${clientIp} temporarily locked out due to too many failed attempts.`);
              return ctx.reject(['password', 'publickey']);
            }

            const rawUsername = (ctx.username || '').trim();
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

            db = await getDb();
            let user = db.users.find(
              (u: any) => u.username.toLowerCase() === username.toLowerCase() || u.email.toLowerCase() === username.toLowerCase()
            );

            // If username wasn't matched directly, check if server was specified
            userServer = null;
            if (serverId) {
              userServer = db.servers.find(
                (s: any) => s.id === serverId || s.id.startsWith(serverId) || s.id.substring(0, 10) === serverId
              );
            }

            // If user logged in as srv_<id>, resolve user from server owner if not found
            if (!user && userServer) {
              user = db.users.find((u: any) => u.id === userServer.userId);
            }

            if (!user && !userServer) {
              // Try finding first server for rawUsername
              const srv = db.servers.find((s: any) => s.id === rawUsername || s.id.startsWith(rawUsername));
              if (srv) {
                user = db.users.find((u: any) => u.id === srv.userId);
                userServer = srv;
              }
            }

            if (!user && !userServer) {
              recordSftpFailure(clientIp);
              return ctx.reject(['password', 'publickey']);
            }

            let isAuthenticated = false;

            // Method 1: Password Authentication
            if (ctx.method === 'password') {
              const password = ctx.password;

              if (userServer && (userServer as any).sftpPassword) {
                if (password === (userServer as any).sftpPassword) {
                  isAuthenticated = true;
                  usedServerPassword = true;
                  if (!user) {
                    user = db.users.find((u: any) => u.id === userServer.userId) || db.users[0];
                  }
                }
              }

              if (!isAuthenticated && user) {
                const passwordHash = db.passwords[user.id];
                if (passwordHash) {
                  try {
                    isAuthenticated = await bcrypt.compare(password, passwordHash);
                  } catch {}
                } else if (
                  (user.role === 'super_admin' || user.role === 'admin' || user.username === 'admin') &&
                  password === (process.env.AETHER_ADMIN_PASSWORD || 'adminopp')
                ) {
                  isAuthenticated = true;
                }
              }
            } 
            // Method 2: Public Key Authentication
            else if (ctx.method === 'publickey') {
              if (user) {
                const userKeys: any[] = user.sshKeys || [];
                const incomingBuffer = ctx.key.data;
                const incomingBase64 = incomingBuffer ? incomingBuffer.toString('base64') : '';

                const matchedKey = userKeys.find((k: any) => {
                  const pubKeyStr = typeof k === 'string' ? k : (k.publicKey || k.key || '');
                  return pubKeyStr && incomingBase64 && pubKeyStr.includes(incomingBase64);
                });

                if (matchedKey) {
                  if (ctx.signature) {
                    // Signature present - complete handshake
                    isAuthenticated = true;
                  } else {
                    // Pre-auth key query
                    return ctx.accept();
                  }
                }
              }
            } else {
              return ctx.reject(['password', 'publickey']);
            }

            if (!isAuthenticated) {
              recordSftpFailure(clientIp);
              return ctx.reject(['password', 'publickey']);
            }

            clearSftpFailure(clientIp);

            // Determine target server with subuser permissions
            if (!userServer) {
              if (serverId) {
                userServer = db.servers.find((s: any) => {
                  const isMatch = s.id === serverId || s.id.startsWith(serverId) || s.id.substring(0, 10) === serverId;
                  if (!isMatch) return false;

                  const isOwner = s.userId === user.id;
                  const isAdmin = ['admin', 'super_admin'].includes(user.role);
                  const subuser = db.subusers?.find((sub: any) => sub.serverId === s.id && sub.userId === user.id);
                  const hasSubuserAccess = subuser && (subuser.permissions.includes('sftp.connect') || subuser.permissions.includes('files.view'));

                  return isOwner || isAdmin || hasSubuserAccess;
                });
              } else {
                // Find first server user owns
                userServer = db.servers.find((s: any) => s.userId === user.id);
                // If not found, find first server user is a subuser of with permission
                if (!userServer) {
                  userServer = db.servers.find((s: any) => {
                    const subuser = db.subusers?.find((sub: any) => sub.serverId === s.id && sub.userId === user.id);
                    return subuser && (subuser.permissions.includes('sftp.connect') || subuser.permissions.includes('files.view'));
                  });
                }
              }
            }

            if (!userServer && user.role !== 'super_admin') {
              return ctx.reject(['password', 'publickey']);
            }

            // Verify explicit subuser access/permission block
            if (userServer && userServer.userId !== user.id && !['admin', 'super_admin'].includes(user.role) && !usedServerPassword) {
              const subuser = db.subusers?.find((sub: any) => sub.serverId === userServer.id && sub.userId === user.id);
              const hasSubuserAccess = subuser && (subuser.permissions.includes('sftp.connect') || subuser.permissions.includes('files.view'));
              if (!hasSubuserAccess) {
                return ctx.reject(['password', 'publickey']);
              }
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

                const isOwner = userServer ? userServer.userId === authenticatedUser.id : false;
                const isAdmin = ['admin', 'super_admin'].includes(authenticatedUser.role);
                const subuser = db.subusers?.find((sub: any) => sub.serverId === targetServerId && sub.userId === authenticatedUser.id);

                // Register live SFTP active session instance
                const liveSession: SftpSessionInstance = {
                  id: sessionId,
                  serverId: targetServerId,
                  userId: authenticatedUser.id,
                  username: authenticatedUser.username || authenticatedUser.displayName || 'user',
                  clientIp,
                  clientVersion: String(clientBanner),
                  connectedAt: new Date().toISOString(),
                  lastActive: new Date().toISOString(),
                  bytesRead: 0,
                  bytesWritten: 0,
                  filesRead: 0,
                  filesWritten: 0,
                  kill: () => {
                    try {
                      session.end();
                      client.end();
                    } catch {}
                  }
                };

                activeSftpSessions.set(sessionId, liveSession);

                function checkPerm(perm: string): boolean {
                  if (isAdmin) return true;
                  if (usedServerPassword) return true;
                  if (isOwner) return true;
                  if (!subuser) return false;
                  return subuser.permissions.includes(perm);
                }

                function safePath(reqPath: string): string | null {
                  if (!reqPath) return baseDir;
                  // Strip null bytes and normalize
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
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view')) {
                    return sftp.status(reqid, 3); // SSH_FX_PERMISSION_DENIED
                  }
                  const resolved = safePath(reqPath || '/');
                  if (!resolved) return sftp.status(reqid, 3);
                  const rel = '/' + path.relative(baseDir, resolved).replace(/\\/g, '/');
                  sftp.name(reqid, [{ filename: rel === '//' ? '/' : rel, longname: rel, attrs: {} as any }]);
                });

                sftp.on('STAT', (reqid: number, reqPath: string) => {
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view')) {
                    return sftp.status(reqid, 3);
                  }
                  const target = safePath(reqPath);
                  if (!target) return sftp.status(reqid, 3);
                  fs.stat(target, (err, stats) => {
                    if (err) return sftp.status(reqid, 2); // SSH_FX_NO_SUCH_FILE
                    sftp.attrs(reqid, stats as any);
                  });
                });

                sftp.on('LSTAT', (reqid: number, reqPath: string) => {
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view')) {
                    return sftp.status(reqid, 3);
                  }
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

                  // Verify specific granular permission based on file exists/non-exists or read/write
                  if (openFlags === 'r') {
                    if (!checkPerm('sftp.connect') && !checkPerm('files.view') && !checkPerm('files.download')) {
                      return sftp.status(reqid, 3);
                    }
                  } else {
                    const exists = fs.existsSync(target);
                    if (exists) {
                      if (!checkPerm('files.edit') && !checkPerm('files.upload')) {
                        return sftp.status(reqid, 3);
                      }
                    } else {
                      if (!checkPerm('files.create') && !checkPerm('files.upload')) {
                        return sftp.status(reqid, 3);
                      }
                    }
                  }

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
                    liveSession.lastActive = new Date().toISOString();
                    sftp.handle(reqid, handle);
                  });
                });

                sftp.on('READ', (reqid: number, handle: Buffer, offset: number, length: number) => {
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view') && !checkPerm('files.download')) {
                    return sftp.status(reqid, 3);
                  }
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || entry.fd === undefined) return sftp.status(reqid, 4); // SSH_FX_FAILURE

                  const buf = Buffer.alloc(length);
                  fs.read(entry.fd, buf, 0, length, offset, (err, bytesRead) => {
                    if (err) return sftp.status(reqid, 4);
                    if (bytesRead === 0) return sftp.status(reqid, 1); // SSH_FX_EOF
                    liveSession.bytesRead += bytesRead;
                    liveSession.filesRead++;
                    liveSession.lastActive = new Date().toISOString();
                    sftp.data(reqid, buf.subarray(0, bytesRead));
                  });
                });

                sftp.on('WRITE', (reqid: number, handle: Buffer, offset: number, data: Buffer) => {
                  if (!checkPerm('files.edit') && !checkPerm('files.upload')) {
                    return sftp.status(reqid, 3);
                  }
                  const hId = handle.readUInt32BE(0);
                  const entry = openHandles.get(hId);
                  if (!entry || entry.fd === undefined) return sftp.status(reqid, 4);

                  fs.write(entry.fd, data, 0, data.length, offset, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    liveSession.bytesWritten += data.length;
                    liveSession.filesWritten++;
                    liveSession.lastActive = new Date().toISOString();
                    sftp.status(reqid, 0); // SSH_FX_OK
                  });
                });

                sftp.on('OPENDIR', (reqid: number, dirPath: string) => {
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view')) {
                    return sftp.status(reqid, 3);
                  }
                  const target = safePath(dirPath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.readdir(target, (err, files) => {
                    if (err) return sftp.status(reqid, 2);
                    const handle = Buffer.alloc(4);
                    const hId = nextHandle++;
                    handle.writeUInt32BE(hId, 0);
                    openHandles.set(hId, { dirEntries: files, dirPath: target });
                    liveSession.lastActive = new Date().toISOString();
                    sftp.handle(reqid, handle);
                  });
                });

                sftp.on('READDIR', (reqid: number, handle: Buffer) => {
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view')) {
                    return sftp.status(reqid, 3);
                  }
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
                  if (!checkPerm('files.create') && !checkPerm('files.upload')) {
                    return sftp.status(reqid, 3);
                  }
                  const target = safePath(dirPath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.mkdir(target, { recursive: true }, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    const rel = path.relative(baseDir, target);
                    recordServerActivity(targetServerId!, authenticatedUser.id, authenticatedUser.username, 'SFTP_MKDIR', `Created directory: ${rel || '/'}`);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('RMDIR', (reqid: number, dirPath: string) => {
                  if (!checkPerm('files.delete')) {
                    return sftp.status(reqid, 3);
                  }
                  const target = safePath(dirPath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.rm(target, { recursive: true, force: true }, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    const rel = path.relative(baseDir, target);
                    recordServerActivity(targetServerId!, authenticatedUser.id, authenticatedUser.username, 'SFTP_DELETE', `Deleted directory: ${rel || '/'}`);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('REMOVE', (reqid: number, filePath: string) => {
                  if (!checkPerm('files.delete')) {
                    return sftp.status(reqid, 3);
                  }
                  const target = safePath(filePath);
                  if (!target) return sftp.status(reqid, 3);

                  fs.unlink(target, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    const rel = path.relative(baseDir, target);
                    recordServerActivity(targetServerId!, authenticatedUser.id, authenticatedUser.username, 'SFTP_DELETE', `Deleted file: ${rel}`);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('RENAME', (reqid: number, oldPath: string, newPath: string) => {
                  if (!checkPerm('files.rename')) {
                    return sftp.status(reqid, 3);
                  }
                  const oldTarget = safePath(oldPath);
                  const newTarget = safePath(newPath);
                  if (!oldTarget || !newTarget) return sftp.status(reqid, 3);

                  const parent = path.dirname(newTarget);
                  if (!fs.existsSync(parent)) {
                    fs.mkdirSync(parent, { recursive: true });
                  }

                  fs.rename(oldTarget, newTarget, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    const relOld = path.relative(baseDir, oldTarget);
                    const relNew = path.relative(baseDir, newTarget);
                    recordServerActivity(targetServerId!, authenticatedUser.id, authenticatedUser.username, 'SFTP_RENAME', `Renamed file: ${relOld} -> ${relNew}`);
                    sftp.status(reqid, 0);
                  });
                });

                sftp.on('SETSTAT', (reqid: number, reqPath: string, attrs: any) => {
                  if (!checkPerm('files.edit')) {
                    return sftp.status(reqid, 3);
                  }
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
                  if (!checkPerm('files.edit')) {
                    return sftp.status(reqid, 3);
                  }
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

                sftp.on('READLINK', (reqid: number, linkPath: string) => {
                  if (!checkPerm('sftp.connect') && !checkPerm('files.view')) {
                    return sftp.status(reqid, 3);
                  }
                  const target = safePath(linkPath);
                  if (!target) return sftp.status(reqid, 3);
                  fs.readlink(target, (err, linkString) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.name(reqid, [{ filename: linkString, longname: linkString, attrs: {} as any }]);
                  });
                });

                sftp.on('SYMLINK', (reqid: number, linkPath: string, targetPath: string) => {
                  if (!checkPerm('files.create') && !checkPerm('files.upload')) {
                    return sftp.status(reqid, 3);
                  }
                  const resolvedLink = safePath(linkPath);
                  if (!resolvedLink) return sftp.status(reqid, 3);

                  // Validate target does not point outside baseDir
                  const resolvedTarget = path.isAbsolute(targetPath)
                    ? safePath(targetPath)
                    : path.resolve(path.dirname(resolvedLink), targetPath);

                  if (!resolvedTarget || (resolvedTarget !== baseDir && !resolvedTarget.startsWith(baseDir + path.sep))) {
                    return sftp.status(reqid, 3); // Block symlinks pointing outside jail
                  }

                  fs.symlink(targetPath, resolvedLink, (err) => {
                    if (err) return sftp.status(reqid, 4);
                    sftp.status(reqid, 0);
                  });
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
  activeSftpSessions.clear();
}
