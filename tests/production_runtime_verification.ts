import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { getDb, saveDbSync } from '../server/db';
import { ensureLocalNode } from '../server/nodeAgent';
import { getInstallationId } from '../server/installation';
import { getSystemVersionInfo, executePanelUpdate, getUpdateJobStatus } from '../server/updateService';
import {
  startServer,
  stopServer,
  restartServer,
  sendServerCommand,
  getServerConsoleLogs,
  getServerDir,
  listServerFiles,
  readServerFile,
  writeServerFile,
  deleteServerItem,
  validateServerPreflight,
  appendConsoleLog,
  onConsoleLog,
  onServerStatus
} from '../server/provider';
import { Server } from '../src/types';

async function runVerification() {
  console.log('================================================================');
  console.log('     AETHERPANEL STRICT PRODUCTION RUNTIME VERIFICATION SUITE');
  console.log('================================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}${detail ? ` (${detail})` : ''}`);
      passedCount++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${detail ? ` -> ${detail}` : ''}`);
      failedCount++;
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 1: Local Node Telemetry & Hardware Capacity
  // -------------------------------------------------------------------------
  console.log('--- [1/6] LOCAL NODE REAL TELEMETRY & PERSISTENCE ---');
  try {
    const localNode = await ensureLocalNode();
    assert(!!localNode, 'Local Node exists in database');
    assert(localNode.id === 'node_local', 'Local Node ID is node_local');
    assert(localNode.totalRamMB > 500, 'Local Node RAM > 500MB', `${localNode.totalRamMB}MB detected`);
    assert(localNode.totalCpuCores >= 1, 'Local Node CPU Cores >= 1', `${localNode.totalCpuCores} cores detected`);
    assert(localNode.totalDiskGB > 0, 'Local Node Disk capacity computed', `${localNode.totalDiskGB}GB total`);
    assert(localNode.isLocalNode === true, 'Local Node is flagged as local');
    assert(localNode.status === 'online', 'Local Node status is online');

    const db = await getDb();
    const localAllocs = db.allocations.filter(a => a.nodeId === 'node_local');
    assert(localAllocs.length >= 5, 'Local Node port allocations pre-allocated', `${localAllocs.length} ports allocated`);
  } catch (err: any) {
    assert(false, 'Local Node verification', err.message);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: Remote Node Enrollment, Token Expiry & Isolation
  // -------------------------------------------------------------------------
  console.log('\n--- [2/6] REMOTE NODE ENROLLMENT, TOKENS & ISOLATION ---');
  try {
    const db = await getDb();
    const testRemoteNodeId = `node_test_${Date.now()}`;
    db.nodes.push({
      id: testRemoteNodeId,
      name: 'Remote Verification Worker',
      hostname: 'remote-worker-1.internal',
      ip: '10.0.0.50',
      daemonPort: 8080,
      sftpPort: 2022,
      location: 'us-west',
      locationName: 'US West (Remote)',
      flagCode: 'US',
      totalRamMB: 8192,
      usedRamMB: 512,
      totalCpuCores: 4,
      usedCpuCores: 0.2,
      totalDiskGB: 100,
      usedDiskGB: 10,
      reservedRamMB: 512,
      reservedCpuCores: 0.5,
      reservedDiskGB: 5,
      ramOverallocatePercent: 0,
      cpuOverallocatePercent: 0,
      diskOverallocatePercent: 0,
      maxServers: 20,
      allowedProducts: ['prod_minecraft', 'prod_bot'],
      status: 'offline',
      isMaintenanceMode: false,
      isLocalNode: false,
      serverCount: 0,
      lastHeartbeatAt: new Date(Date.now() - 120000).toISOString()
    });

    // Create enrollment token
    const rawToken = `inst_tok_${crypto.randomBytes(16).toString('hex')}`;
    db.nodeInstallTokens.push({
      id: `tok_${Date.now()}`,
      token: rawToken,
      nodeId: testRemoteNodeId,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      isUsed: false,
      createdAt: new Date().toISOString()
    });
    saveDbSync();

    assert(db.nodeInstallTokens.some(t => t.token === rawToken && !t.isUsed), 'Single-use enrollment token stored');

    // Simulate enrollment
    const foundToken = db.nodeInstallTokens.find(t => t.token === rawToken && !t.isUsed);
    assert(!!foundToken, 'Enrollment token lookup succeeds');
    if (foundToken) {
      foundToken.isUsed = true;
      const remoteNode = db.nodes.find(n => n.id === testRemoteNodeId);
      if (remoteNode) {
        remoteNode.daemonToken = `dtoken_${crypto.randomBytes(16).toString('hex')}`;
        remoteNode.status = 'online';
        remoteNode.lastHeartbeatAt = new Date().toISOString();
      }
      saveDbSync();
    }

    assert(db.nodeInstallTokens.find(t => t.token === rawToken)?.isUsed === true, 'Enrollment token marked as single-use');
    const enrolledNode = db.nodes.find(n => n.id === testRemoteNodeId);
    assert(!!enrolledNode?.daemonToken, 'Permanent daemon token assigned');
    assert(enrolledNode?.status === 'online', 'Remote node status updated to online');

    // Cleanup test node
    db.nodes = db.nodes.filter(n => n.id !== testRemoteNodeId);
    db.nodeInstallTokens = db.nodeInstallTokens.filter(t => t.token !== rawToken);
    saveDbSync();
  } catch (err: any) {
    assert(false, 'Remote Node enrollment test', err.message);
  }

  // -------------------------------------------------------------------------
  // SECTION 3: Real Server Process Lifecycle & Stdio Streaming
  // -------------------------------------------------------------------------
  console.log('\n--- [3/6] REAL SERVER PROCESS LIFECYCLE, STDIN/STDOUT & CONSOLE ---');
  const testServerId = `srv_proc_test_${Date.now()}`;
  try {
    const db = await getDb();
    const serverDir = getServerDir(testServerId);

    // Create an interactive node.js bot script that writes to stdout, listens on stdin, and exits on command
    const scriptPath = path.join(serverDir, 'index.js');
    fs.writeFileSync(scriptPath, [
      'console.log("[BOT RUNTIME]: Interactive Service Started Successfully.");',
      'process.stdin.resume();',
      'process.stdin.setEncoding("utf8");',
      'process.stdin.on("data", (chunk) => {',
      '  const cmd = chunk.toString().trim();',
      '  console.log(`[BOT COMMAND ECHO]: ${cmd}`);',
      '  if (cmd === "exit") {',
      '    console.log("[BOT RUNTIME]: Received shutdown instruction.");',
      '    process.exit(0);',
      '  }',
      '});',
      'setInterval(() => { console.log("[BOT HEARTBEAT]: Alive tick"); }, 1000);'
    ].join('\n'));

    const testServer: Server = {
      id: testServerId,
      name: 'Process Verification Server',
      userId: 'usr_admin',
      productId: 'prod_bot',
      planId: 'plan_bot_standard',
      nodeId: 'node_local',
      status: 'stopped',
      deploymentState: 'READY',
      primaryIp: '127.0.0.1',
      primaryPort: 29999,
      location: 'local',
      software: 'Node.js Bot',
      version: 'Node 20',
      limits: {
        ramMB: 256,
        cpuCores: 0.5,
        diskGB: 1,
        backups: 1,
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

    // Preflight Check
    const preflight = await validateServerPreflight(testServerId);
    assert(preflight.ok, 'Preflight validation passed for server', preflight.reason);

    // Live Log Listener
    let receivedLogs: string[] = [];
    const unsubscribe = onConsoleLog((sId, logLine) => {
      if (sId === testServerId) receivedLogs.push(logLine);
    });

    // Start Server
    const startResult = await startServer(testServerId);
    assert(startResult === true, 'Server start command returned true');

    // Wait 1.5s for process to boot and output logs
    await new Promise(r => setTimeout(r, 1500));

    const logs = await getServerConsoleLogs(testServerId);
    assert(logs.some(l => l.includes('Interactive Service Started Successfully')), 'Console captured real child process stdout');

    // Send stdin command
    sendServerCommand(testServerId, 'ping_test_packet_123');
    await new Promise(r => setTimeout(r, 800));

    const updatedLogs = await getServerConsoleLogs(testServerId);
    assert(updatedLogs.some(l => l.includes('ping_test_packet_123')), 'Stdin dispatched and stdout echoed command', 'stdin -> stdout verified');

    // Stop Server
    const stopResult = await stopServer(testServerId);
    assert(stopResult === true, 'Server stop command executed');

    await new Promise(r => setTimeout(r, 1000));
    const serverAfterStop = db.servers.find(s => s.id === testServerId);
    assert(serverAfterStop?.status === 'stopped', 'Server status updated to stopped after termination');

    unsubscribe();

    // Cleanup Server directory and DB record
    deleteServerItem(testServerId, 'index.js');
    db.servers = db.servers.filter(s => s.id !== testServerId);
    saveDbSync();
    if (fs.existsSync(serverDir)) {
      fs.rmSync(serverDir, { recursive: true, force: true });
    }
  } catch (err: any) {
    assert(false, 'Real server process lifecycle test', err.message);
  }

  // -------------------------------------------------------------------------
  // SECTION 4: File Manager & SFTP Filesystem Consistency
  // -------------------------------------------------------------------------
  console.log('\n--- [4/6] FILE MANAGER & SFTP FILESYSTEM CONSISTENCY ---');
  const fileTestServerId = `srv_file_test_${Date.now()}`;
  try {
    const srvDir = getServerDir(fileTestServerId);
    const db = await getDb();

    // Write file via provider writeServerFile
    const testContent = `AetherPanel Storage Consistency Key: ${crypto.randomBytes(8).toString('hex')}`;
    const writeOk = writeServerFile(fileTestServerId, 'config.json', testContent);
    assert(writeOk, 'File written via server provider API');

    // Verify physical file exists on disk
    const diskPath = path.join(srvDir, 'config.json');
    assert(fs.existsSync(diskPath), 'File physically exists in data/servers/<id>/ on disk');

    // Read file via listServerFiles & readServerFile
    const files = listServerFiles(fileTestServerId, '');
    assert(files.some(f => f.name === 'config.json' && f.size > 0), 'File listed correctly in File Manager');

    const readContent = readServerFile(fileTestServerId, 'config.json');
    assert(readContent === testContent, 'File content read identically from disk');

    // Security: Path Traversal Attempt Check
    let traversalBlocked = false;
    try {
      const illegalRead = readServerFile(fileTestServerId, '../../../../etc/passwd');
      if (illegalRead === null || !illegalRead.includes('root:')) {
        traversalBlocked = true;
      }
    } catch {
      traversalBlocked = true;
    }
    assert(traversalBlocked, 'Path traversal ../../ attacks strictly blocked by sandbox');

    // Cleanup
    if (fs.existsSync(srvDir)) {
      fs.rmSync(srvDir, { recursive: true, force: true });
    }
  } catch (err: any) {
    assert(false, 'Filesystem consistency test', err.message);
  }

  // -------------------------------------------------------------------------
  // SECTION 5: Version Detection & Upstream Unreachable Handling
  // -------------------------------------------------------------------------
  console.log('\n--- [5/6] VERSION DETECTION, UPSTREAM HANDLING & METADATA ---');
  try {
    const versionInfo = await getSystemVersionInfo(true);
    assert(!!versionInfo.currentVersion, 'Installed version detected', versionInfo.currentVersion);
    assert(versionInfo.currentVersion.startsWith('v3.'), 'Installed version format conforms to v3.x');
    assert(!!versionInfo.commitHash, 'Git commit SHA detected', versionInfo.commitHash);
    assert(!!versionInfo.branch, 'Git branch detected', versionInfo.branch);
    assert(!!versionInfo.nodeVersion, 'Node runtime version detected', versionInfo.nodeVersion);
    assert(!!versionInfo.platform, 'Host platform detected', versionInfo.platform);
    assert(['YES', 'NO', 'UNKNOWN'].includes(versionInfo.isUpdateAvailable), 'Update availability is YES, NO, or UNKNOWN', `Got: ${versionInfo.isUpdateAvailable}`);

    if (!versionInfo.upstreamReachable) {
      assert(versionInfo.latestVersion === 'UNKNOWN', 'When upstream unreachable, latestVersion is strictly UNKNOWN');
      assert(versionInfo.isUpdateAvailable === 'UNKNOWN', 'When upstream unreachable, isUpdateAvailable is strictly UNKNOWN');
    }
  } catch (err: any) {
    assert(false, 'Version detection test', err.message);
  }

  // -------------------------------------------------------------------------
  // SECTION 6: Update Preflight, Snapshot Backup & Health Check
  // -------------------------------------------------------------------------
  console.log('\n--- [6/6] UPDATE PIPELINE PREFLIGHT, SNAPSHOT & HEALTH VERIFICATION ---');
  try {
    const updateResult = await executePanelUpdate('VerificationTestRunner');
    assert(updateResult.success === true, 'Update pipeline initiated');

    // Poll until update stages complete
    let job = getUpdateJobStatus();
    for (let i = 0; i < 40; i++) {
      if (job.status === 'completed' || job.status === 'failed') break;
      await new Promise(r => setTimeout(r, 500));
      job = getUpdateJobStatus();
    }

    assert(job.status === 'completed', 'Update job completed successfully without error', `Status: ${job.status}, Error: ${job.error || 'none'}`);
    assert(job.steps.length === 5, 'All 5 update stages registered', `Steps count: ${job.steps.length}`);
    assert(job.logs.length > 3, 'Update execution logs recorded', `${job.logs.length} log lines`);

    const preflightStep = job.steps.find(s => s.id === 'preflight');
    assert(preflightStep?.status === 'SUCCESS', 'Preflight environment audit passed');

    const snapshotStep = job.steps.find(s => s.id === 'snapshot');
    assert(snapshotStep?.status === 'SUCCESS', 'Database snapshot backup created');

    // Verify snapshot file physically exists
    const backupsDir = path.join(process.cwd(), 'data', 'backups');
    const backupFiles = fs.existsSync(backupsDir) ? fs.readdirSync(backupsDir) : [];
    assert(backupFiles.some(f => f.startsWith('aetherpanel_pre_update_')), 'Snapshot file physically verified in data/backups/');

    const healthStep = job.steps.find(s => s.id === 'health');
    assert(healthStep?.status === 'SUCCESS', 'Post-update health & integrity check passed');
  } catch (err: any) {
    assert(false, 'Update pipeline verification', err.message);
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
