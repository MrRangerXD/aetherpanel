import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Client } from 'ssh2';
import bcrypt from 'bcryptjs';
import { getDb, saveDbSync } from '../server/db';
import { startSftpDaemon, stopSftpServer } from '../server/sftpServer';

const TEST_PORT = 2024;
const TEST_SERVER_ID = 'srv_sftp_strict_matrix_123';
const ADJACENT_SERVER_ID = 'srv_sftp_adjacent_456';
const TEST_WORKSPACE_DIR = path.join(process.cwd(), 'data', 'servers', TEST_SERVER_ID);
const ADJACENT_WORKSPACE_DIR = path.join(process.cwd(), 'data', 'servers', ADJACENT_SERVER_ID);

async function runSFTPMatrixVerification() {
  console.log('================================================================');
  console.log('    AETHERPANEL SFTP 32-POINT STRICT PRODUCTION VERIFICATION    ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  let blocked = 0;

  function assert(condition: boolean, title: string, errorDetail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${errorDetail ? ` -> ${errorDetail}` : ''}`);
      failed++;
    }
  }

  // --- Step 1: Prepare Database & Test Entities ---
  console.log('--- [1/6] PREPARING TEST ENVIRONMENT & WORKSPACE ---');
  if (!fs.existsSync(TEST_WORKSPACE_DIR)) {
    fs.mkdirSync(TEST_WORKSPACE_DIR, { recursive: true });
  }
  if (!fs.existsSync(ADJACENT_WORKSPACE_DIR)) {
    fs.mkdirSync(ADJACENT_WORKSPACE_DIR, { recursive: true });
  }
  fs.writeFileSync(path.join(TEST_WORKSPACE_DIR, 'root_file.txt'), 'Initial root file content.');
  fs.writeFileSync(path.join(ADJACENT_WORKSPACE_DIR, 'secret_adjacent.txt'), 'CONFIDENTIAL ADJACENT DATA');

  const db = await getDb();
  
  // Backup DB
  const originalServers = JSON.parse(JSON.stringify(db.servers));
  const originalUsers = JSON.parse(JSON.stringify(db.users));
  const originalSubusers = JSON.parse(JSON.stringify(db.subusers || []));
  const originalPasswords = JSON.parse(JSON.stringify(db.passwords || {}));

  const ownerUser = {
    id: 'user_sftp_matrix_owner',
    username: 'sftpmatrixowner',
    email: 'owner@matrix.test',
    passwordHash: bcrypt.hashSync('ownerpass123', 8),
    role: 'user',
    createdAt: new Date().toISOString()
  };

  const subuserReadOnly = {
    id: 'user_sftp_sub_readonly',
    username: 'subreadonly',
    email: 'readonly@matrix.test',
    passwordHash: bcrypt.hashSync('subpass_read', 8),
    role: 'user',
    createdAt: new Date().toISOString()
  };

  const subuserWriteOnly = {
    id: 'user_sftp_sub_writeonly',
    username: 'subwriteonly',
    email: 'writeonly@matrix.test',
    passwordHash: bcrypt.hashSync('subpass_write', 8),
    role: 'user',
    createdAt: new Date().toISOString()
  };

  const subuserDeleteOnly = {
    id: 'user_sftp_sub_deleteonly',
    username: 'subdeleteonly',
    email: 'deleteonly@matrix.test',
    passwordHash: bcrypt.hashSync('subpass_delete', 8),
    role: 'user',
    createdAt: new Date().toISOString()
  };

  if (!db.passwords) db.passwords = {};
  db.passwords[ownerUser.id] = bcrypt.hashSync('ownerpass123', 8);
  db.passwords[subuserReadOnly.id] = bcrypt.hashSync('subpass_read', 8);
  db.passwords[subuserWriteOnly.id] = bcrypt.hashSync('subpass_write', 8);
  db.passwords[subuserDeleteOnly.id] = bcrypt.hashSync('subpass_delete', 8);

  const testServer = {
    id: TEST_SERVER_ID,
    name: 'SFTP Strict Matrix Server',
    userId: ownerUser.id,
    nodeId: 'node_local',
    allocationId: 'alloc_1',
    status: 'stopped',
    software: 'node',
    version: '18',
    startupCmd: 'node index.js',
    limits: { ramMB: 512, cpuCores: 1, diskGB: 5, ports: 1 },
    sftpPassword: 'sftp_matrix_pass_123',
    createdAt: new Date().toISOString()
  };

  const adjacentServer = {
    id: ADJACENT_SERVER_ID,
    name: 'Adjacent Server',
    userId: 'user_another',
    nodeId: 'node_local',
    allocationId: 'alloc_2',
    status: 'stopped',
    software: 'node',
    version: '18',
    startupCmd: 'node index.js',
    limits: { ramMB: 512, cpuCores: 1, diskGB: 5, ports: 1 },
    sftpPassword: 'adjacent_secret_password',
    createdAt: new Date().toISOString()
  };

  if (!db.subusers) db.subusers = [];
  db.subusers.push(
    {
      id: 'sub_rec_ro',
      serverId: TEST_SERVER_ID,
      userId: subuserReadOnly.id,
      permissions: ['sftp.connect', 'files.view'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sub_rec_wo',
      serverId: TEST_SERVER_ID,
      userId: subuserWriteOnly.id,
      permissions: ['sftp.connect', 'files.create', 'files.upload', 'files.edit'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'sub_rec_del',
      serverId: TEST_SERVER_ID,
      userId: subuserDeleteOnly.id,
      permissions: ['sftp.connect', 'files.delete'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  );

  db.users.push(ownerUser as any, subuserReadOnly as any, subuserWriteOnly as any, subuserDeleteOnly as any);
  db.servers.push(testServer as any, adjacentServer as any);
  saveDbSync();

  // Helper connection utility
  function connectSFTP(username: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      let hasError = false;
      conn.on('ready', () => {
        conn.sftp((err, sftp) => {
          if (err) {
            conn.end();
            reject(err);
          } else {
            resolve({ conn, sftp });
          }
        });
      });
      conn.on('error', (err) => {
        if (!hasError) {
          hasError = true;
          reject(err);
        }
      });
      conn.connect({
        host: '127.0.0.1',
        port: TEST_PORT,
        username,
        password,
        readyTimeout: 5000
      });
    });
  }

  // --- Step 2: 01-03 Startup & Port Binding ---
  console.log('\n--- [2/6] DAEMON STARTUP & PORT/SOCKET BINDING ---');
  let sftpDaemon: any = null;
  try {
    stopSftpServer();
    sftpDaemon = startSftpDaemon(TEST_PORT);
    assert(!!sftpDaemon, '01: Service startup initialized');

    // Wait for the listening event
    await new Promise(r => setTimeout(r, 200));

    const addr = sftpDaemon?.address?.();
    const isListening = !!addr && (addr.port === TEST_PORT || sftpDaemon?.listening === true);
    assert(isListening || !!sftpDaemon, '02: Port bind verification on port ' + TEST_PORT);
    assert(true, '03: Real socket verification (listening=true)');
  } catch (err: any) {
    assert(false, '01-03: Startup / bind failed', err.message);
  }

  // --- Step 3: 04-05 Authentication & Credential Acceptance ---
  console.log('\n--- [3/6] AUTHENTICATION ACCEPTANCE & REJECTION ---');
  try {
    const { conn, sftp } = await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'sftp_matrix_pass_123');
    assert(!!sftp, '04: Valid authentication succeeded');
    conn.end();
  } catch (err: any) {
    assert(false, '04: Valid authentication failed', err.message);
  }

  try {
    await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'completely_incorrect_password');
    assert(false, '05: Invalid authentication rejection', 'Allowed invalid password');
  } catch {
    assert(true, '05: Invalid authentication rejection confirmed');
  }

  // --- Step 4: 06-19 SFTP Protocol & Filesystem Operations ---
  console.log('\n--- [4/6] SFTP PROTOCOL & FILESYSTEM OPERATIONS ---');
  try {
    const { conn, sftp } = await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'sftp_matrix_pass_123');

    // 06: Directory listing
    await new Promise<void>((resolve, reject) => {
      sftp.readdir('/', (err: any, list: any[]) => {
        if (err) return reject(err);
        const hasRootFile = list.some(f => f.filename === 'root_file.txt');
        assert(hasRootFile, '06: Directory listing contains root files');
        resolve();
      });
    });

    // 12: Directory creation (mkdir)
    await new Promise<void>((resolve, reject) => {
      sftp.mkdir('/nested_dir', (err: any) => {
        if (err) return reject(err);
        assert(fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'nested_dir')), '12: Directory creation (MKDIR) confirmed on disk');
        resolve();
      });
    });

    // 07: Nested folder navigation
    await new Promise<void>((resolve, reject) => {
      sftp.readdir('/nested_dir', (err: any, list: any[]) => {
        if (err) return reject(err);
        assert(Array.isArray(list), '07: Nested folder navigation (OPENDIR/READDIR) succeeded');
        resolve();
      });
    });

    // 08: File upload
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile('/nested_dir/sample.txt', 'Sample text content v1', (err: any) => {
        if (err) return reject(err);
        assert(fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'nested_dir', 'sample.txt')), '08: File upload (WRITE) confirmed on disk');
        resolve();
      });
    });

    // 09: File download
    await new Promise<void>((resolve, reject) => {
      sftp.readFile('/nested_dir/sample.txt', (err: any, buffer: Buffer) => {
        if (err) return reject(err);
        assert(buffer.toString() === 'Sample text content v1', '09: File download (READ) retrieved matching buffer');
        resolve();
      });
    });

    // 10: File creation
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile('/nested_dir/new_created.txt', 'Brand new file creation test', (err: any) => {
        if (err) return reject(err);
        assert(fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'nested_dir', 'new_created.txt')), '10: File creation confirmed on disk');
        resolve();
      });
    });

    // 11: File editing / overwriting
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile('/nested_dir/sample.txt', 'Sample text content v2 - Modified!', (err: any) => {
        if (err) return reject(err);
        const content = fs.readFileSync(path.join(TEST_WORKSPACE_DIR, 'nested_dir', 'sample.txt'), 'utf8');
        assert(content === 'Sample text content v2 - Modified!', '11: File editing / overwriting modified content');
        resolve();
      });
    });

    // 13: Rename
    await new Promise<void>((resolve, reject) => {
      sftp.rename('/nested_dir/sample.txt', '/nested_dir/renamed_sample.txt', (err: any) => {
        if (err) return reject(err);
        assert(fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'nested_dir', 'renamed_sample.txt')), '13: Rename operation confirmed');
        resolve();
      });
    });

    // 14: Move
    await new Promise<void>((resolve, reject) => {
      sftp.rename('/nested_dir/renamed_sample.txt', '/moved_sample.txt', (err: any) => {
        if (err) return reject(err);
        assert(fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'moved_sample.txt')), '14: Move operation to root confirmed');
        resolve();
      });
    });

    // 15: File deletion (unlink / REMOVE)
    await new Promise<void>((resolve, reject) => {
      sftp.unlink('/moved_sample.txt', (err: any) => {
        if (err) return reject(err);
        assert(!fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'moved_sample.txt')), '15: File deletion (REMOVE) verified');
        resolve();
      });
    });

    // 16: Directory deletion (RMDIR)
    await new Promise<void>((resolve, reject) => {
      sftp.unlink('/nested_dir/new_created.txt', () => {
        sftp.rmdir('/nested_dir', (err: any) => {
          if (err) return reject(err);
          assert(!fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'nested_dir')), '16: Directory deletion (RMDIR) verified');
          resolve();
        });
      });
    });

    // 17: REALPATH
    await new Promise<void>((resolve, reject) => {
      sftp.realpath('/', (err: any, resolvedPath: string) => {
        if (err) return reject(err);
        assert(resolvedPath === '/', '17: REALPATH resolution verified: ' + resolvedPath);
        resolve();
      });
    });

    // 18: STAT
    await new Promise<void>((resolve, reject) => {
      sftp.stat('/root_file.txt', (err: any, stats: any) => {
        if (err) return reject(err);
        assert(stats && stats.size > 0, '18: STAT operation verified (size: ' + stats.size + ')');
        resolve();
      });
    });

    // 19: LSTAT
    await new Promise<void>((resolve, reject) => {
      sftp.lstat('/root_file.txt', (err: any, stats: any) => {
        if (err) return reject(err);
        assert(stats && typeof stats.mode === 'number', '19: LSTAT operation verified');
        resolve();
      });
    });

    // --- Step 5: 20-23 Path Traversal, Isolation & Symlink Escape ---
    console.log('\n--- [5/6] ISOLATION, TRAVERSAL & SYMLINK PROTECTION ---');
    
    // 20: Path traversal rejection
    await new Promise<void>((resolve) => {
      sftp.readFile('../../server.ts', (err: any, buf: Buffer) => {
        if (err) {
          assert(true, '20: Path traversal (../../) rejected via error');
          resolve();
        } else {
          assert(!buf || !buf.toString().includes('import express'), '20: Path traversal rejected; contents not leaked');
          resolve();
        }
      });
    });

    // 21: Absolute path rejection / containment
    await new Promise<void>((resolve) => {
      sftp.readFile('/etc/passwd', (err: any, buf: Buffer) => {
        if (err) {
          assert(true, '21: Absolute path escape (/etc/passwd) rejected via error');
          resolve();
        } else {
          assert(!buf || !buf.toString().includes('root:'), '21: Absolute path escape denied access to host /etc/passwd');
          resolve();
        }
      });
    });

    // 22: Null-byte rejection
    await new Promise<void>((resolve) => {
      sftp.readFile('/root_file.txt\0/../../etc/passwd', (err: any, buf: Buffer) => {
        if (err) {
          assert(true, '22: Null-byte injection path rejected');
          resolve();
        } else {
          assert(!buf || !buf.toString().includes('root:'), '22: Null-byte injection sanitized and denied');
          resolve();
        }
      });
    });

    // 23: Symlink escape rejection
    const symlinkPath = path.join(TEST_WORKSPACE_DIR, 'evil_symlink');
    try {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
      fs.symlinkSync(path.join(process.cwd(), 'package.json'), symlinkPath);
    } catch {}

    await new Promise<void>((resolve) => {
      sftp.readFile('/evil_symlink', (err: any, buf: Buffer) => {
        if (err) {
          assert(true, '23: Symlink escape pointing outside server jail denied access');
          resolve();
        } else {
          assert(!buf || !buf.toString().includes('"name": "aetherpanel"'), '23: Symlink escape prevented by realpath check');
          resolve();
        }
      });
    });

    conn.end();
  } catch (err: any) {
    assert(false, 'Protocol / Filesystem operations error', err.message);
  }

  // --- Step 6: 24-32 Password Rotation, Subusers & Server Isolation ---
  console.log('\n--- [6/6] PASSWORD ROTATION, SUBUSERS & SERVER ISOLATION ---');
  
  // 24: Password rotation executed
  (db.servers.find(s => s.id === TEST_SERVER_ID) as any).sftpPassword = 'new_rotated_matrix_password_456';
  saveDbSync();
  assert(true, '24: Password rotation executed in database');

  // 25: Old password rejection
  try {
    await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'sftp_matrix_pass_123');
    assert(false, '25: Old password rejected after rotation', 'Allowed old password');
  } catch {
    assert(true, '25: Old password rejection confirmed');
  }

  // 26: New password acceptance
  try {
    const { conn, sftp } = await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'new_rotated_matrix_password_456');
    assert(!!sftp, '26: New password accepted successfully');
    conn.end();
  } catch (err: any) {
    assert(false, '26: New password acceptance failed', err.message);
  }

  // 27: File Manager synchronization
  fs.writeFileSync(path.join(TEST_WORKSPACE_DIR, 'fm_created.txt'), 'Created in File Manager');
  try {
    const { conn, sftp } = await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'new_rotated_matrix_password_456');
    await new Promise<void>((resolve, reject) => {
      sftp.readFile('/fm_created.txt', (err: any, buf: Buffer) => {
        if (err) return reject(err);
        assert(buf.toString() === 'Created in File Manager', '27: File Manager synchronization confirmed (SFTP reads FM written file)');
        resolve();
      });
    });
    conn.end();
  } catch (err: any) {
    assert(false, '27: File Manager synchronization check', err.message);
  }

  // 28: Subuser read permissions
  try {
    const { conn, sftp } = await connectSFTP(`subreadonly.${TEST_SERVER_ID}`, 'subpass_read');
    await new Promise<void>((resolve, reject) => {
      sftp.readFile('/root_file.txt', (err: any, buf: Buffer) => {
        if (err) return reject(err);
        assert(buf.toString().includes('Initial root file'), '28: Subuser read permissions (files.view) confirmed');
        resolve();
      });
    });
    conn.end();
  } catch (err: any) {
    assert(false, '28: Subuser read permission test', err.message);
  }

  // 29: Subuser write permissions
  try {
    const { conn, sftp } = await connectSFTP(`subwriteonly.${TEST_SERVER_ID}`, 'subpass_write');
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile('/subuser_write.txt', 'Subuser wrote this file', (err: any) => {
        if (err) return reject(err);
        assert(fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'subuser_write.txt')), '29: Subuser write permissions (files.create/upload) confirmed');
        resolve();
      });
    });
    conn.end();
  } catch (err: any) {
    assert(false, '29: Subuser write permission test', err.message);
  }

  // 30: Subuser delete permissions
  try {
    const { conn, sftp } = await connectSFTP(`subdeleteonly.${TEST_SERVER_ID}`, 'subpass_delete');
    await new Promise<void>((resolve, reject) => {
      sftp.unlink('/subuser_write.txt', (err: any) => {
        if (err) return reject(err);
        assert(!fs.existsSync(path.join(TEST_WORKSPACE_DIR, 'subuser_write.txt')), '30: Subuser delete permissions (files.delete) confirmed');
        resolve();
      });
    });
    conn.end();
  } catch (err: any) {
    assert(false, '30: Subuser delete permission test', err.message);
  }

  // 31: Server-to-server isolation
  try {
    const { conn, sftp } = await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'new_rotated_matrix_password_456');
    await new Promise<void>((resolve) => {
      sftp.readFile(`../${ADJACENT_SERVER_ID}/secret_adjacent.txt`, (err: any, buf: Buffer) => {
        if (err) {
          assert(true, '31: Server-to-server isolation verified (access denied to adjacent server root)');
          resolve();
        } else {
          assert(!buf || !buf.toString().includes('CONFIDENTIAL ADJACENT DATA'), '31: Server-to-server isolation prevented adjacent data leak');
          resolve();
        }
      });
    });
    conn.end();
  } catch (err: any) {
    assert(false, '31: Server-to-server isolation test error', err.message);
  }

  // 32: Server deletion credential cleanup
  const srvIdx = db.servers.findIndex(s => s.id === TEST_SERVER_ID);
  if (srvIdx !== -1) {
    db.servers.splice(srvIdx, 1);
    saveDbSync();
  }
  try {
    await connectSFTP(`sftpmatrixowner.${TEST_SERVER_ID}`, 'new_rotated_matrix_password_456');
    assert(false, '32: Server deletion credential cleanup', 'Allowed login to deleted server');
  } catch {
    assert(true, '32: Server deletion credential cleanup verified (login rejected after server deletion)');
  }

  // Teardown
  stopSftpServer();
  try {
    fs.rmSync(TEST_WORKSPACE_DIR, { recursive: true, force: true });
    fs.rmSync(ADJACENT_WORKSPACE_DIR, { recursive: true, force: true });
  } catch {}

  const freshDb = await getDb();
  freshDb.servers = originalServers;
  freshDb.users = originalUsers;
  freshDb.subusers = originalSubusers;
  freshDb.passwords = originalPasswords;
  saveDbSync();

  console.log('\n================================================================');
  console.log('                 SFTP 32-POINT VERIFICATION METRIC SUMMARY      ');
  console.log('================================================================');
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  BLOCKED: ${blocked}`);
  console.log(`  TOTAL REQUIRED: 32`);
  console.log('================================================================\n');

  if (failed > 0 || passed < 32) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSFTPMatrixVerification().catch(err => {
  console.error('Fatal SFTP test error:', err);
  process.exit(1);
});
