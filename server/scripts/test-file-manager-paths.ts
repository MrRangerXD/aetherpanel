import { safePath, listServerFiles } from '../provider';
import { getDb } from '../db';
import fs from 'fs';
import path from 'path';

async function testFileManagerPaths() {
  console.log('--- Testing File Manager safePath Navigation & Traversal Prevention ---');
  const db = await getDb();
  let server = db.servers[0];

  if (!server) {
    console.error('No servers found in DB to test.');
    process.exit(1);
  }

  const serverId = server.id;
  const serverDir = path.resolve(`./data/servers/${serverId}`);

  // Ensure server dir exists and create test folder structure
  fs.mkdirSync(path.join(serverDir, 'plugins', 'config'), { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'plugins', 'config', 'settings.yml'), 'key: val');
  fs.writeFileSync(path.join(serverDir, 'server.properties'), 'motd=test');

  const tests = [
    { input: '', expectedSubstr: serverDir },
    { input: '/', expectedSubstr: serverDir },
    { input: 'plugins', expectedSubstr: path.join(serverDir, 'plugins') },
    { input: '/plugins', expectedSubstr: path.join(serverDir, 'plugins') },
    { input: '/plugins/config', expectedSubstr: path.join(serverDir, 'plugins', 'config') },
    { input: '/plugins/config/settings.yml', expectedSubstr: path.join(serverDir, 'plugins', 'config', 'settings.yml') },
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      const res = safePath(serverId, t.input);
      if (res === t.expectedSubstr) {
        console.log(`[PASS] safePath("${t.input}") -> ${res}`);
        passed++;
      } else {
        console.error(`[FAIL] safePath("${t.input}") expected ${t.expectedSubstr}, got ${res}`);
      }
    } catch (err: any) {
      console.error(`[FAIL] safePath("${t.input}") threw error: ${err.message}`);
    }
  }

  const traversalTests = [
    '../../etc/passwd',
    '../',
    'plugins/../../etc/passwd',
    '/../',
    '..\\..\\windows\\system32'
  ];

  for (const t of traversalTests) {
    try {
      safePath(serverId, t);
      console.error(`[FAIL] safePath("${t}") should have thrown Access Denied, but returned path`);
    } catch (err: any) {
      if (err.message.includes('Access denied')) {
        console.log(`[PASS] safePath("${t}") correctly threw: ${err.message}`);
        passed++;
      } else {
        console.error(`[FAIL] safePath("${t}") threw unexpected error: ${err.message}`);
      }
    }
  }

  // Test listing files in subfolder
  try {
    const rootFiles = listServerFiles(serverId, '/');
    const pluginFiles = listServerFiles(serverId, '/plugins');
    console.log(`Root files count: ${rootFiles.length}, Plugin subfolder files count: ${pluginFiles.length}`);
    if (pluginFiles.some(f => f.name === 'config')) {
      console.log('[PASS] listServerFiles("/plugins") listed child folder "config" successfully');
      passed++;
    } else {
      console.error('[FAIL] listServerFiles("/plugins") did not list child folder "config"');
    }
  } catch (err: any) {
    console.error(`[FAIL] listServerFiles failed: ${err.message}`);
  }

  console.log(`Summary: ${passed}/${tests.length + traversalTests.length + 1} passed.`);
  if (passed === tests.length + traversalTests.length + 1) {
    console.log('✅ ALL FILE MANAGER PATH TESTS PASSED!');
  } else {
    process.exit(1);
  }
}

testFileManagerPaths().catch(err => {
  console.error(err);
  process.exit(1);
});
