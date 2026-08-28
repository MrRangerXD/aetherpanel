import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getDb } from './db';

const DATA_DIR = path.join(process.cwd(), 'data');
const BIN_DIR = path.join(process.cwd(), 'bin');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const HOST_KEY_PATH = path.join(DATA_DIR, 'ssh_host_rsa_key');

/**
 * Ensures the runtime filesystem and database integrity are healthy before any service starts.
 */
export async function initializeRuntime() {
  console.log('[Init] Starting runtime filesystem & data integrity verification...');

  // 1. Ensure core directories exist
  const directories = [
    DATA_DIR,
    BIN_DIR,
    path.join(DATA_DIR, 'runtimes'),
    path.join(DATA_DIR, 'servers'),
    path.join(DATA_DIR, 'backups'),
    path.join(DATA_DIR, 'nodes'),
    path.join(DATA_DIR, 'node_storage'),
    path.join(DATA_DIR, 'object_storage'),
  ];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      console.log(`[Init] Creating directory: ${dir}`);
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // 2. Validate & Safely Initialize Database
  if (fs.existsSync(DB_FILE)) {
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      if (content.trim()) {
        JSON.parse(content);
        console.log('[Init] Existing database JSON integrity verified.');
      } else {
        throw new Error('Database file is empty');
      }
    } catch (err: any) {
      console.error(`[Init] CRITICAL: Database JSON is corrupted or unreadable: ${err.message}`);
      const backupPath = `${DB_FILE}.corrupted.${Date.now()}`;
      try {
        fs.renameSync(DB_FILE, backupPath);
        console.warn(`[Init] Corrupted database moved to ${backupPath}.`);
      } catch (renameErr) {
        console.error('[Init] Could not move corrupted database file:', renameErr);
      }
    }
  }

  // Safely initialize or load database via authoritative getDb engine
  try {
    await getDb();
    console.log('[Init] Database loaded and verified successfully.');
  } catch (dbInitErr: any) {
    console.error(`[Init] CRITICAL: Database initialization failed: ${dbInitErr.message || dbInitErr}`);
  }

  // 3. Ensure SSH Host Keys
  if (!fs.existsSync(HOST_KEY_PATH)) {
    console.log('[Init] Generating missing SSH host keys...');
    try {
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
      });
      fs.writeFileSync(HOST_KEY_PATH, privateKey, { mode: 0o600 });
      console.log('[Init] SSH host key generated successfully with 0600 permissions.');
    } catch (err) {
      console.error('[Init] Failed to generate SSH host key:', err);
    }
  } else {
    // Verify permissions
    try {
      const stat = fs.statSync(HOST_KEY_PATH);
      if ((stat.mode & 0o777) !== 0o600) {
        fs.chmodSync(HOST_KEY_PATH, 0o600);
        console.log('[Init] Corrected SSH host key permissions to 0600.');
      }
    } catch (err) {
      console.warn('[Init] Could not verify SSH host key permissions:', err);
    }
  }

  // 4. Verify Playit Binary
  const playitPath = path.join(BIN_DIR, 'playit');
  if (fs.existsSync(playitPath)) {
    try {
      fs.accessSync(playitPath, fs.constants.X_OK);
      console.log('[Init] Playit binary detected and executable permission confirmed.');
    } catch {
      console.log('[Init] Setting executable permission on playit binary...');
      try {
        fs.chmodSync(playitPath, 0o755);
      } catch (err) {
        console.error('[Init] Failed to set executable permission on playit binary:', err);
      }
    }
  }

  console.log('[Init] Runtime filesystem and data integrity check complete.');
}
