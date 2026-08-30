import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, saveDbSync, getDbSync } from '../server/db';
import { startServer, stopServer, getServerConsoleLogs, getServerDir, deleteServerItem } from '../server/provider';
import { RuntimeSupervisor } from '../server/utils/runtimeSupervisor';
import { Server } from '../src/types';

async function runSupervisorPersistenceTest() {
  console.log('================================================================');
  console.log('   AETHERPANEL RUNTIME SUPERVISOR PROCESS PERSISTENCE VERIFIER');
  console.log('================================================================\n');

  const testServerId = `srv_persist_test_${Date.now()}`;
  const srvDir = getServerDir(testServerId);
  const db = await getDb();

  try {
    // 1. Create a robust background process that writes distinct lines and runs indefinitely
    const scriptPath = path.join(srvDir, 'index.js');
    fs.mkdirSync(srvDir, { recursive: true });
    fs.writeFileSync(scriptPath, [
      'console.log("[PERSISTENCE_TEST] WORKLOAD_STARTED");',
      'let tick = 0;',
      'setInterval(() => {',
      '  tick++;',
      '  console.log(`[PERSISTENCE_TEST] TICK_${tick}`);',
      '  if (tick === 50) {',
      '    console.log("[PERSISTENCE_TEST] TIMED_OUT_AUTOEXIT");',
      '    process.exit(0);',
      '  }',
      '}, 1000);'
    ].join('\n'));

    const testServer: Server = {
      id: testServerId,
      name: 'Supervisor Persistence Test',
      userId: 'usr_admin',
      productId: 'prod_bot',
      planId: 'plan_bot_standard',
      nodeId: 'node_local',
      status: 'stopped',
      deploymentState: 'READY',
      primaryIp: '127.0.0.1',
      primaryPort: 29998,
      location: 'local',
      software: 'Node.js Bot',
      version: 'Node 20',
      limits: {
        ramMB: 128,
        cpuCores: 0.2,
        diskGB: 1,
        backups: 0,
        databases: 0
      },
      startup: {
        entryFile: 'index.js'
      },
      cpuUsage: 0,
      ramUsageMB: 0,
      diskUsageMB: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.servers.push(testServer);
    saveDbSync();

    console.log('--- STEP 1: DETACHED PROCESS SPAWNING ---');
    const startOk = await startServer(testServerId);
    if (!startOk) throw new Error('Failed to start server');

    console.log('Server started successfully. Checking state JSON...');
    const paths = (RuntimeSupervisor as any).getRuntimePaths(testServerId);
    if (!fs.existsSync(paths.stateJson)) {
      throw new Error(`Runtime state JSON not found at ${paths.stateJson}`);
    }

    const state = JSON.parse(fs.readFileSync(paths.stateJson, 'utf-8'));
    console.log(`  Spawning Process PID: ${state.pid}`);
    console.log(`  State File Path: ${paths.stateJson}`);

    // Wait for the workload to print its start message and first tick
    await new Promise(r => setTimeout(r, 2200));

    let logs = await getServerConsoleLogs(testServerId);
    console.log('  Initial logs retrieved:');
    logs.forEach(l => console.log(`    > ${l}`));

    const hasStartSignal = logs.some(l => l.includes('WORKLOAD_STARTED'));
    const hasTickSignal = logs.some(l => l.includes('TICK_1'));
    if (!hasStartSignal || !hasTickSignal) {
      throw new Error('Workload signals not found in logs!');
    }
    console.log('  ✅ Detached execution & log streaming verified.');

    console.log('\n--- STEP 2: SIMULATING PANEL RESTART / RECONCILIATION ---');
    console.log('  Tearing down log tailers to simulate panel stopping...');
    (RuntimeSupervisor as any).stopTailers(testServerId);

    console.log('  Checking if background process still survives in the OS...');
    let isAliveBefore = false;
    try {
      process.kill(state.pid, 0);
      isAliveBefore = true;
    } catch {}
    console.log(`  PID ${state.pid} alive status check: ${isAliveBefore ? 'ALIVE (PASSED)' : 'DEAD (FAILED)'}`);
    if (!isAliveBefore) throw new Error('Workload process did not survive panel logging disconnection.');

    console.log('  Triggering RuntimeSupervisor reconciliation...');
    await RuntimeSupervisor.reconcile();

    console.log('  Verifying duplicate process prevention...');
    const currentProcesses = await getServerConsoleLogs(testServerId);
    
    // Check if the PID is still the original PID
    const refreshedServer = (await getDb()).servers.find(s => s.id === testServerId);
    console.log(`  Post-reconciliation Server Status: ${refreshedServer?.status}`);
    console.log(`  Post-reconciliation Server PID: ${refreshedServer?.startup?.pid}`);
    
    if (refreshedServer?.startup?.pid !== state.pid) {
      throw new Error(`PID mutated during reconciliation! Original: ${state.pid}, New: ${refreshedServer?.startup?.pid}`);
    }
    if (refreshedServer?.status !== 'running') {
      throw new Error(`Server status not reconciled to running! Status is ${refreshedServer?.status}`);
    }
    console.log('  ✅ No duplicate process created and existing PID successfully reclaimed.');

    console.log('\n--- STEP 3: VERIFYING CONTINUOUS LOG ACCUMULATION ---');
    console.log('  Waiting 1.5s to verify new ticks continue appending to the stream...');
    await new Promise(r => setTimeout(r, 1500));

    const postRestartLogs = await getServerConsoleLogs(testServerId);
    console.log('  Appended logs retrieved:');
    postRestartLogs.slice(-5).forEach(l => console.log(`    > ${l}`));

    const hasNewTickSignal = postRestartLogs.some(l => l.includes('TICK_3'));
    if (!hasNewTickSignal) {
      throw new Error('Logs failed to accumulate post-reconciliation! Tailer re-attach failed.');
    }
    console.log('  ✅ Continuous log stream verified.');

    console.log('\n--- STEP 4: CLEAN DISPATCHED STOP ---');
    console.log(`  Requesting graceful stop for server ${testServerId}...`);
    const stopOk = await stopServer(testServerId);
    if (!stopOk) throw new Error('Graceful stop request returned false');

    await new Promise(r => setTimeout(r, 1000));
    let isAliveAfter = true;
    try {
      process.kill(state.pid, 0);
    } catch {
      isAliveAfter = false;
    }
    console.log(`  PID ${state.pid} alive status check post-termination: ${isAliveAfter ? 'ALIVE (FAILED)' : 'DEAD (PASSED)'}`);
    if (isAliveAfter) throw new Error('Process survived after Stop command!');

    console.log('  ✅ Process termination verified.');
    console.log('\n================================================================');
    console.log('  🎉 SUPERVISOR PERSISTENCE VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================\n');

  } finally {
    // Cleanup
    db.servers = db.servers.filter(s => s.id !== testServerId);
    saveDbSync();
    if (fs.existsSync(srvDir)) {
      fs.rmSync(srvDir, { recursive: true, force: true });
    }
  }
}

runSupervisorPersistenceTest().catch(err => {
  console.error('Persistence verification failed:', err);
  process.exit(1);
});
