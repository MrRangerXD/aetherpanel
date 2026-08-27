import { checkJavaRuntime, discoverJavaBinaries, provisionJavaRuntime } from '../server/minecraftService';
import { validateServerPreflight } from '../server/provider';
import { getDb, saveDbSync } from '../server/db';
import fs from 'fs';
import path from 'path';

async function testJavaAutoProvisioning() {
  console.log('================================================================');
  console.log('       JAVA RUNTIME AUTO-PROVISIONING & PREFLIGHT VERIFICATION');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, title: string, detail?: string) {
    if (cond) {
      console.log(`  ✅ [PASS] ${title}${detail ? ` (${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Discover existing Java runtimes
  console.log('--- [1] Centralized Java Discovery ---');
  const initialRuntimes = discoverJavaBinaries();
  console.log('Initial detected runtimes:', JSON.stringify(initialRuntimes, null, 2));
  assert(typeof initialRuntimes === 'object', 'discoverJavaBinaries returns runtime map');
  assert(initialRuntimes[8] !== undefined, 'Java 8 slot exists');
  assert(initialRuntimes[17] !== undefined, 'Java 17 slot exists');
  assert(initialRuntimes[21] !== undefined, 'Java 21 slot exists');
  assert(initialRuntimes[25] !== undefined, 'Java 25 slot exists');

  // 2. Check Java Runtime checker for Java 21 & 25
  console.log('\n--- [2] Java Runtime Preflight Checkers ---');
  const check21 = checkJavaRuntime(21);
  console.log('Check Java 21:', check21);
  assert(check21.available === true, 'Java 21 is available', check21.path);

  // 3. Test Java 25 Auto-Provisioning
  console.log('\n--- [3] Java 25 Auto-Provisioning Trigger ---');
  console.log('Provisioning Java 25 (with lock & download fallback)...');
  const prov25 = await provisionJavaRuntime(25, {
    nodeId: 'node_local',
    onLog: (line) => console.log('  [LOG]', line)
  });
  console.log('Provision result:', prov25);
  assert(prov25.success === true, 'Java 25 provision succeeded', prov25.path);
  assert(!!prov25.path && fs.existsSync(prov25.path), 'Java 25 binary executable exists on filesystem');

  // 4. Verify Java 25 Detection after Provisioning
  console.log('\n--- [4] Post-Provisioning Runtime Discovery & Checker ---');
  const postRuntimes = discoverJavaBinaries();
  console.log('Post detected runtimes:', JSON.stringify(postRuntimes, null, 2));
  assert(postRuntimes[25].available === true, 'Java 25 is detected as available', postRuntimes[25].path);

  const check25 = checkJavaRuntime(25);
  console.log('Check Java 25:', check25);
  assert(check25.available === true, 'checkJavaRuntime(25) returns available: true', check25.path);

  // 5. Minecraft Preflight Validation for Paper 26.2 (Requires Java 25)
  console.log('\n--- [5] Minecraft Preflight Auto-Provisioning Integration ---');
  const db = await getDb();
  const testServerId = `srv_paper26_${Date.now()}`;
  const serverDir = path.join(process.cwd(), 'data', 'servers', testServerId);
  fs.mkdirSync(serverDir, { recursive: true });
  fs.writeFileSync(path.join(serverDir, 'paper.jar'), Buffer.alloc(2048)); // dummy server jar > 1KB

  db.servers.push({
    id: testServerId,
    name: 'Paper 26.2 Test Server',
    userId: 'usr_admin',
    nodeId: 'node_local',
    productId: 'prod_minecraft',
    planId: 'plan_standard',
    status: 'stopped',
    primaryIp: '127.0.0.1',
    primaryPort: 25575,
    location: 'us-west',
    software: 'Paper',
    version: 'Paper 26.2',
    limits: {
      ramMB: 2048,
      cpuCores: 2,
      diskGB: 10,
      backups: 3,
      databases: 2
    },
    cpuUsage: 0,
    ramUsageMB: 0,
    diskUsageMB: 0,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startup: {
      javaVersion: 25,
      serverJar: 'paper.jar',
      startupCommand: 'java -jar {{SERVER_JARFILE}}'
    }
  });
  saveDbSync();

  const preflightRes = await validateServerPreflight(testServerId);
  console.log('Validate preflight Paper 26.2:', preflightRes);
  assert(preflightRes.ok === true, 'Preflight validation for Paper 26.2 succeeded with Java 25');

  // Summary
  console.log('\n================================================================');
  console.log(`TOTAL PASSED: ${passed}`);
  console.log(`TOTAL FAILED: ${failed}`);
  console.log('================================================================');

  if (failed > 0) process.exit(1);
}

testJavaAutoProvisioning().catch((err) => {
  console.error('Test threw unexpected error:', err);
  process.exit(1);
});
