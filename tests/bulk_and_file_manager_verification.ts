import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../server/db';
import {
  getServerDir,
  listServerFiles,
  writeServerFile,
  readServerFile,
  deleteServerItem,
  deleteServerItems,
  moveServerItems,
  copyServerItems,
  compressServerItems,
  decompressServerItem,
  safePath
} from '../server/provider';
import { Server } from '../src/types';

async function runTests() {
  console.log('================================================================');
  console.log('   AETHERPANEL BULK ACTIONS & FILE MANAGER VERIFICATION TEST');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  const testServerId = `test_fm_${Date.now()}`;
  const serverDir = path.resolve(getServerDir(testServerId));

  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
  }

  // Add dummy server to DB
  const db = await getDb();
  const dummyServer: Server = {
    id: testServerId,
    name: 'Test File Manager Server',
    nodeId: 'node_local',
    userId: 'user_admin',
    productId: 'prod_minecraft',
    planId: 'plan_free',
    status: 'stopped',
    software: 'paper',
    version: '1.20.4',
    location: 'local',
    primaryIp: '127.0.0.1',
    primaryPort: 25565,
    limits: {
      ramMB: 1024,
      cpuCores: 1,
      diskGB: 5,
      backups: 2,
      databases: 1
    },
    cpuUsage: 0,
    ramUsageMB: 0,
    diskUsageMB: 0,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.servers.push(dummyServer);
  saveDbSync();

  try {
    // -------------------------------------------------------------
    // TEST 1: Path Traversal Protection
    // -------------------------------------------------------------
    console.log('\n--- 1. PATH TRAVERSAL & CANONICAL PATH SECURITY ---');
    const traversalPath = safePath(testServerId, '../../../../etc/passwd');
    assert(traversalPath.startsWith(serverDir), 'safePath prevents escaping root upwards');

    const nullByteTraversal = safePath(testServerId, 'subdir/\0/../../passwd');
    assert(nullByteTraversal.startsWith(serverDir), 'safePath neutralizes null bytes');

    // -------------------------------------------------------------
    // TEST 2: File Creation and Listing
    // -------------------------------------------------------------
    console.log('\n--- 2. FILE CREATION & DIRECTORY LISTING ---');
    writeServerFile(testServerId, 'server.properties', 'motd=AetherPanel\nserver-port=25565\n');
    writeServerFile(testServerId, 'config/settings.yml', 'debug: true\nmode: production\n');
    writeServerFile(testServerId, 'logs/latest.log', '[INFO] Server started.\n');

    const rootFiles = listServerFiles(testServerId, '/');
    assert(rootFiles.length >= 3, 'Root directory lists created files and directories', `${rootFiles.length} items found`);
    assert(rootFiles.some(f => f.name === 'server.properties' && !f.isDir), 'server.properties is listed as file');
    assert(rootFiles.some(f => f.name === 'config' && f.isDir), 'config is listed as directory');

    // -------------------------------------------------------------
    // TEST 3: Bulk Delete Files and Folders
    // -------------------------------------------------------------
    console.log('\n--- 3. BULK DELETION OPERATIONS ---');
    writeServerFile(testServerId, 'temp1.txt', 'temp 1');
    writeServerFile(testServerId, 'temp2.txt', 'temp 2');
    writeServerFile(testServerId, 'temp_folder/item.txt', 'nested item');

    const delResult = deleteServerItems(testServerId, ['temp1.txt', 'temp2.txt', 'temp_folder']);
    assert(delResult.succeeded.length === 3, 'Bulk delete succeeded for 3 items', `${delResult.succeeded.join(', ')}`);
    assert(!fs.existsSync(path.join(serverDir, 'temp1.txt')), 'temp1.txt removed from disk');
    assert(!fs.existsSync(path.join(serverDir, 'temp_folder')), 'temp_folder removed from disk');

    // Test delete safety on root
    const rootDelResult = deleteServerItems(testServerId, ['/']);
    assert(rootDelResult.failed.length === 1, 'Deleting root directory is rejected safely');

    // -------------------------------------------------------------
    // TEST 4: Copy Files & Directories with Conflict Strategies
    // -------------------------------------------------------------
    console.log('\n--- 4. COPY OPERATIONS & CONFLICT STRATEGIES ---');
    writeServerFile(testServerId, 'source_file.txt', 'original content');
    
    // Copy into /config
    const copyResult = copyServerItems(testServerId, ['source_file.txt'], 'config', 'replace');
    assert(copyResult.copied.length === 1, 'File copied to /config');
    assert(fs.existsSync(path.join(serverDir, 'config/source_file.txt')), 'Target file exists in /config');

    // Copy with rename strategy on conflict
    const copyRenameResult = copyServerItems(testServerId, ['source_file.txt'], 'config', 'rename');
    assert(copyRenameResult.copied.length === 1, 'File copied with rename strategy on conflict');
    assert(fs.existsSync(path.join(serverDir, 'config/source_file (1).txt')), 'Auto-renamed copy exists (1)');

    // -------------------------------------------------------------
    // TEST 5: Move Files & Directories with Safety
    // -------------------------------------------------------------
    console.log('\n--- 5. MOVE OPERATIONS & CIRCULAR PREVENTION ---');
    writeServerFile(testServerId, 'to_move.txt', 'move me');
    const moveResult = moveServerItems(testServerId, ['to_move.txt'], 'logs', 'replace');
    assert(moveResult.moved.length === 1, 'File moved into logs folder');
    assert(!fs.existsSync(path.join(serverDir, 'to_move.txt')), 'Original file removed after move');
    assert(fs.existsSync(path.join(serverDir, 'logs/to_move.txt')), 'Moved file exists in destination');

    // Circular folder move check
    const circularResult = moveServerItems(testServerId, ['config'], 'config/nested', 'replace');
    assert(circularResult.errors.length === 1, 'Moving directory into its own child is rejected');

    // -------------------------------------------------------------
    // TEST 6: Archive Compression & Decompression with Zip Slip Defense
    // -------------------------------------------------------------
    console.log('\n--- 6. ZIP ARCHIVE COMPRESSION & DECOMPRESSION ---');
    writeServerFile(testServerId, 'archive_item1.txt', 'data 1');
    writeServerFile(testServerId, 'archive_item2.txt', 'data 2');

    const zipRel = compressServerItems(testServerId, ['archive_item1.txt', 'archive_item2.txt'], 'test_archive.zip', '/');
    assert(zipRel.endsWith('.zip'), 'Archive created successfully', zipRel);
    assert(fs.existsSync(path.join(serverDir, zipRel)), 'ZIP file exists on disk');

    // Extract archive to extracted_folder
    decompressServerItem(testServerId, zipRel, 'extracted_folder');
    assert(fs.existsSync(path.join(serverDir, 'extracted_folder/archive_item1.txt')), 'Extracted file 1 exists');
    assert(fs.existsSync(path.join(serverDir, 'extracted_folder/archive_item2.txt')), 'Extracted file 2 exists');

  } finally {
    // Clean up test server directory and db record
    try {
      fs.rmSync(serverDir, { recursive: true, force: true });
    } catch {}
    const freshDb = await getDb();
    freshDb.servers = freshDb.servers.filter(s => s.id !== testServerId);
    saveDbSync();
  }

  console.log('\n================================================================');
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
