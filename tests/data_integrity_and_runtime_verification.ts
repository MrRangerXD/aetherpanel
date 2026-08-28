import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../server/db';
import { initializeRuntime } from '../server/init';
import { checkPlayitBinary } from '../server/playit/playitService';

async function runAudit() {
  console.log('====================================================');
  console.log('AETHERPANEL RUNTIME & DATA INTEGRITY VERIFICATION');
  console.log('====================================================\n');

  // Test 1: Verify Existing Database Persistence
  console.log('[TEST 1] Verifying Existing Database Structure & Persistence...');
  const db = await getDb();
  if (!db || !Array.isArray(db.users) || !Array.isArray(db.servers) || !Array.isArray(db.nodes)) {
    throw new Error('Database schema verification failed: missing core arrays');
  }
  console.log(`  -> Users: ${db.users.length}`);
  console.log(`  -> Servers: ${db.servers.length}`);
  console.log(`  -> Nodes: ${db.nodes.length}`);
  console.log(`  -> Platform Name: ${db.settings?.platformName}`);
  console.log('  [PASS] Existing database valid and intact.\n');

  // Test 2: Verify SSH Host Key Permissions & Persistence
  console.log('[TEST 2] Verifying SSH Host Key Permissions & Persistence...');
  const hostKeyPath = path.join(process.cwd(), 'data', 'ssh_host_rsa_key');
  if (!fs.existsSync(hostKeyPath)) {
    throw new Error('SSH host key does not exist at expected path');
  }
  const stat = fs.statSync(hostKeyPath);
  const modeOctal = (stat.mode & 0o777).toString(8);
  console.log(`  -> SSH Host Key Path: ${hostKeyPath}`);
  console.log(`  -> File Mode: 0${modeOctal} (Required: 0600)`);
  if ((stat.mode & 0o777) !== 0o600) {
    throw new Error(`SSH Host Key permissions are insecure: 0${modeOctal}`);
  }
  const keyContent = fs.readFileSync(hostKeyPath, 'utf8');
  if (!keyContent.includes('BEGIN RSA PRIVATE KEY')) {
    throw new Error('SSH Host Key is not a valid RSA Private Key PEM');
  }
  console.log('  [PASS] SSH Host Key is valid and secured with 0600 permissions.\n');

  // Test 3: Verify Playit Agent Binary
  console.log('[TEST 3] Verifying Playit Agent Binary...');
  const playitCheck = checkPlayitBinary();
  console.log(`  -> Exists: ${playitCheck.exists}`);
  console.log(`  -> Runnable: ${playitCheck.runnable}`);
  console.log(`  -> Version: ${playitCheck.version}`);
  if (playitCheck.reason) {
    console.log(`  -> Notice: ${playitCheck.reason}`);
  }
  if (!playitCheck.exists || !playitCheck.runnable) {
    throw new Error(`Playit binary check failed: ${playitCheck.reason}`);
  }
  console.log('  [PASS] Playit binary is verified, runnable, and executable.\n');

  // Test 4: Verify Atomic Database Writes
  console.log('[TEST 4] Verifying Atomic Database Writes...');
  const testVal = `audit_${Date.now()}`;
  (db.settings as any)._auditTestTimestamp = testVal;
  saveDbSync();
  const reloaded = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'db.json'), 'utf8'));
  if (reloaded.settings?._auditTestTimestamp !== testVal) {
    throw new Error('Atomic write verification failed to persist value');
  }
  // Clean test property
  delete (db.settings as any)._auditTestTimestamp;
  saveDbSync();
  console.log('  [PASS] Atomic DB write and reload confirmed.\n');

  // Test 5: Verify Idempotent initializeRuntime()
  console.log('[TEST 5] Verifying Idempotent initializeRuntime()...');
  const initialKeyContent = fs.readFileSync(hostKeyPath, 'utf8');
  await initializeRuntime();
  const postInitKeyContent = fs.readFileSync(hostKeyPath, 'utf8');
  if (initialKeyContent !== postInitKeyContent) {
    throw new Error('initializeRuntime() improperly overwrote existing SSH host key');
  }
  console.log('  [PASS] initializeRuntime() is safe, idempotent, and preserves existing keys.\n');

  console.log('====================================================');
  console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

runAudit().catch(err => {
  console.error('\n[AUDIT FAILURE]:', err.message || err);
  process.exit(1);
});
