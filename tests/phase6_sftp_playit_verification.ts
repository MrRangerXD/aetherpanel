import fs from 'fs';
import path from 'path';
import { Client } from 'ssh2';
import { getDb, saveDbSync } from '../server/db';
import { resolveServerSftpInfo, isInternalLoopback } from '../server/sftpResolver';
import {
  writeServerFile, readServerFile, listServerFiles,
  renameServerItem, deleteServerItem, createServerDirectory,
  getServerDir, safePath
} from '../server/provider';
import {
  installPlayitAgent, getPlayitStatus, togglePlayitAgent,
  installNodePlayitAgent, getNodePlayitStatus
} from '../server/playitService';
import { startSftpServer, stopSftpServer } from '../server/sftpServer';

async function runPhase6Verification() {
  console.log('====================================================');
  console.log('🚀 AETHERPANEL — PHASE 6 SFTP & FILE MANAGER VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, details?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ [FAIL] ${testName}`);
      if (details) console.error(`     Details: ${details}`);
    }
  }

  // --- STEP 1: TEST DATA SETUP ---
  console.log('📦 Step 1: Setting up isolated test server & node in DB...');
  const db = await getDb(true);

  const testNodeId = `node_p6_${Date.now()}`;
  const testServerId = `p6s_${Date.now()}`;
  const testServer2Id = `p6s2_${Date.now()}`;
  const testPassword = 'test_sftp_secure_pwd_123';

  db.nodes.push({
    id: testNodeId,
    name: 'Phase 6 Test Node',
    hostname: 'node-eu1.aetherpanel.internal',
    ip: '192.168.1.100',
    fqdn: 'node-eu1.aetherpanel.com',
    sftpFqdn: 'sftp.node-eu1.aetherpanel.com',
    daemonPort: 8080,
    sftpPort: 2022,
    location: 'eu-west',
    locationName: 'Frankfurt, Germany',
    flagCode: 'DE',
    totalRamMB: 32768,
    usedRamMB: 4096,
    totalCpuCores: 8,
    usedCpuCores: 1,
    totalDiskGB: 500,
    usedDiskGB: 20,
    ramOverallocatePercent: 0,
    cpuOverallocatePercent: 0,
    diskOverallocatePercent: 0,
    maxServers: 10,
    allowedProducts: ['prod_minecraft', 'prod_bot'],
    status: 'online',
    isMaintenanceMode: false,
    serverCount: 2,
    lastHeartbeatAt: new Date().toISOString()
  });

  db.servers.push({
    id: testServerId,
    name: 'Phase 6 SFTP Minecraft',
    userId: 'usr_admin',
    nodeId: testNodeId,
    productId: 'prod_minecraft',
    planId: 'plan_mc_starter',
    status: 'running',
    primaryIp: '192.168.1.100',
    primaryPort: 25565,
    location: 'eu-west',
    software: 'Paper',
    version: '1.20.4',
    limits: { ramMB: 4096, cpuCores: 2, diskGB: 20 },
    cpuUsage: 5,
    ramUsageMB: 1024,
    diskUsageMB: 250,
    uptimeSeconds: 3600,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    sftpPassword: testPassword
  } as any);

  db.servers.push({
    id: testServer2Id,
    name: 'Phase 6 Target Server B',
    userId: 'usr_admin',
    nodeId: testNodeId,
    productId: 'prod_minecraft',
    planId: 'plan_mc_starter',
    status: 'running',
    primaryIp: '192.168.1.100',
    primaryPort: 25566,
    location: 'eu-west',
    software: 'Paper',
    version: '1.20.4',
    limits: { ramMB: 4096, cpuCores: 2, diskGB: 20 },
    cpuUsage: 0,
    ramUsageMB: 0,
    diskUsageMB: 0,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  } as any);

  saveDbSync();
  console.log(`  ✓ Created test node '${testNodeId}' and servers '${testServerId}', '${testServer2Id}'.\n`);

  // --- STEP 2: SFTP RESOLVER & FQDN SANITIZATION ---
  console.log('🌐 Step 2: Verifying SFTP Resolver & Anti-Loopback Guarantees...');

  assert(isInternalLoopback('127.0.0.1') === true, 'Detects 127.0.0.1 as internal loopback');
  assert(isInternalLoopback('localhost') === true, 'Detects localhost as internal loopback');
  assert(isInternalLoopback('0.0.0.0') === true, 'Detects 0.0.0.0 as internal loopback');
  assert(isInternalLoopback('sftp.mygamehost.com') === false, 'Recognizes public FQDN as valid external endpoint');

  // Case A: Node has configured sftpFqdn
  const resolvedA = await resolveServerSftpInfo(testServerId);
  assert(resolvedA.host === 'sftp.node-eu1.aetherpanel.com', 'SFTP Resolver picks node.sftpFqdn', `Got: ${resolvedA.host}`);
  assert(resolvedA.port === 2022, 'SFTP Resolver picks node.sftpPort', `Got: ${resolvedA.port}`);
  assert(resolvedA.tunnelType === 'fqdn', 'Endpoint mode correctly labeled as fqdn');
  assert(!resolvedA.uri.includes('127.0.0.1'), 'Connection URI NEVER contains loopback');

  // Case B: Node has Playit SFTP Tunnel configured
  const nodeRec = db.nodes.find(n => n.id === testNodeId)!;
  nodeRec.sftpFqdn = undefined;
  nodeRec.fqdn = undefined;
  nodeRec.playitSftpAddress = 'sftp-eu1.auto.playit.gg';
  nodeRec.playitSftpPort = 2022;
  saveDbSync();

  const resolvedB = await resolveServerSftpInfo(testServerId);
  assert(resolvedB.host === 'sftp-eu1.auto.playit.gg', 'SFTP Resolver picks Playit SFTP tunnel domain', `Got: ${resolvedB.host}`);
  assert(resolvedB.port === 2022, 'SFTP Resolver picks Playit SFTP tunnel port', `Got: ${resolvedB.port}`);
  assert(resolvedB.tunnelType === 'playit', 'Endpoint mode correctly labeled as playit');

  // Case C: Fallback to Panel host header when node addresses are loopback
  nodeRec.playitSftpAddress = undefined;
  nodeRec.playitAgentInstalled = false;
  nodeRec.sftpFqdn = undefined;
  nodeRec.fqdn = undefined;
  nodeRec.hostname = 'localhost';
  nodeRec.ip = '127.0.0.1';
  saveDbSync();
  const resolvedC = await resolveServerSftpInfo(testServerId, 'mypanel.hosting.net:3000');
  assert(resolvedC.host === 'sftp.mypanel.hosting.net', 'SFTP Resolver falls back to sftp.<hostHeader> without port 3000', `Got: ${resolvedC.host}`);
  assert(resolvedC.port === 2022, 'SFTP Resolver maintains node sftpPort on fallback', `Got: ${resolvedC.port}`);

  console.log('\n');

  // --- STEP 3: STRICT FILESYSTEM ISOLATION & PATH TRAVERSAL DEFENSE ---
  console.log('🔒 Step 3: Verifying Filesystem Sandbox & Path Isolation...');

  const serverADir = getServerDir(testServerId);
  const serverBDir = getServerDir(testServer2Id);

  // Write a secret file to Server B
  fs.writeFileSync(path.join(serverBDir, 'server_b_secret.txt'), 'SUPER_SECRET_KEY_B', 'utf-8');

  // Verify safePath confinement
  const normalPath = safePath(testServerId, 'plugins/config.yml');
  assert(normalPath.startsWith(serverADir), 'Normal relative path resolves cleanly inside server root');

  const attack1 = safePath(testServerId, '../' + testServer2Id + '/server_b_secret.txt');
  assert(attack1.startsWith(serverADir), 'Parent traversal ../ is sanitized and locked within server A root');
  assert(!attack1.includes(serverBDir), 'Server A cannot reach Server B directory via safePath');

  const attack2 = safePath(testServerId, '/../../../../etc/passwd');
  assert(attack2.startsWith(serverADir), 'Absolute root traversal /../../etc/passwd is confined to server root');

  console.log('\n');

  // --- STEP 4: REAL FILE MANAGER CRUD OPERATIONS ---
  console.log('📁 Step 4: Testing Real File Manager CRUD Operations on Disk...');

  // Create subfolder
  createServerDirectory(testServerId, 'configs');
  const dirExists = fs.existsSync(path.join(serverADir, 'configs'));
  assert(dirExists === true, 'Created directory configs/ on disk');

  // Write file
  const testContent = 'server-port=25565\nmotd=AetherPanel Phase 6 Verified\npvp=true\n';
  writeServerFile(testServerId, 'configs/server.properties', testContent);
  const fileExists = fs.existsSync(path.join(serverADir, 'configs', 'server.properties'));
  assert(fileExists === true, 'writeServerFile successfully wrote configs/server.properties');

  // Read file
  const readContent = readServerFile(testServerId, 'configs/server.properties');
  assert(readContent === testContent, 'readServerFile returned identical content from disk');

  // List files in subdirectory
  const listing = listServerFiles(testServerId, 'configs');
  const foundFile = listing.find(f => f.name === 'server.properties');
  assert(!!foundFile, 'listServerFiles returned created file in configs/ directory');
  assert(foundFile?.isDir === false, 'File metadata correctly flags isDir: false');
  assert((foundFile?.size || 0) > 0, 'File metadata accurately reports byte size');

  // Rename file
  renameServerItem(testServerId, 'configs/server.properties', 'configs/server_renamed.properties');
  const checkOld = fs.existsSync(path.join(serverADir, 'configs', 'server.properties'));
  const checkNew = fs.existsSync(path.join(serverADir, 'configs', 'server_renamed.properties'));
  assert(!checkOld && checkNew, 'renameServerItem renamed file successfully');

  // Delete file
  deleteServerItem(testServerId, 'configs/server_renamed.properties');
  const deletedOk = !fs.existsSync(path.join(serverADir, 'configs', 'server_renamed.properties'));
  assert(deletedOk === true, 'deleteServerItem removed file from disk');

  console.log('\n');

  // --- STEP 5: REAL PLAYIT INTEGRATION & TUNNEL LIFECYCLE ---
  console.log('⚡ Step 5: Testing Real Playit.gg Agent & Node Tunnel Lifecycle...');

  // Install Playit on Server
  const playitInst = await installPlayitAgent(testServerId);
  assert(playitInst.isInstalled === true, 'Playit agent installed on server');
  assert(playitInst.isRunning === true, 'Playit tunnel status is running/connected');
  assert(playitInst.claimUrl?.startsWith('https://playit.gg/claim/'), 'Valid claim URL generated');
  assert(playitInst.tunnelAddress?.endsWith('.auto.playit.gg'), 'Public tunnel address generated');

  // Toggle Playit off
  const playitPaused = await togglePlayitAgent(testServerId, false);
  assert(playitPaused.isRunning === false, 'Playit tunnel paused successfully');

  // Toggle Playit on
  const playitResumed = await togglePlayitAgent(testServerId, true);
  assert(playitResumed.isRunning === true, 'Playit tunnel resumed successfully');

  // Node-level Playit SFTP tunnel
  const nodePlayit = await installNodePlayitAgent(testNodeId);
  assert(nodePlayit.isInstalled === true, 'Node-level Playit tunnel installed');
  assert(nodePlayit.sftpTunnelAddress?.includes('sftp-'), 'Node-level SFTP tunnel address assigned');

  console.log('\n');

  // --- STEP 6: REAL SSH2 SFTP SERVER PROTOCOL VERIFICATION ---
  console.log('🔐 Step 6: Testing Real SSH2 SFTP Protocol Over Live Socket (Port 2024)...');

  // Start isolated test SFTP server on port 2024
  const sftpServerInstance = startSftpServer(2024);
  await new Promise(r => setTimeout(r, 600));

  // Connect real SSH2 client to SFTP server
  const clientUsername = `srv_${testServerId}`;
  const sftpClient = new Client();

  const sftpTestSuccess = await new Promise<boolean>((resolve) => {
    sftpClient.on('ready', () => {
      sftpClient.sftp((err, sftp) => {
        if (err) {
          console.error('SFTP Subsystem Error:', err);
          return resolve(false);
        }

        // Test writing file over SFTP protocol
        const testRemoteFilePath = 'sftp_protocol_test.txt';
        const writeStream = sftp.createWriteStream(testRemoteFilePath);
        writeStream.write('VERIFIED_SFTP_PAYLOAD_PHASE6');
        writeStream.end();

        writeStream.on('close', () => {
          // Test reading file back over SFTP protocol
          const readStream = sftp.createReadStream(testRemoteFilePath);
          let received = '';
          readStream.on('data', chunk => { received += chunk.toString(); });
          readStream.on('end', () => {
            const matches = received === 'VERIFIED_SFTP_PAYLOAD_PHASE6';
            // Verify file exists on local disk in server directory
            const diskExists = fs.existsSync(path.join(serverADir, testRemoteFilePath));
            sftpClient.end();
            resolve(matches && diskExists);
          });
          readStream.on('error', (rErr) => {
            console.error('SFTP Read Error:', rErr);
            sftpClient.end();
            resolve(false);
          });
        });

        writeStream.on('error', (wErr) => {
          console.error('SFTP Write Error:', wErr);
          sftpClient.end();
          resolve(false);
        });
      });
    });

    sftpClient.on('error', (cErr) => {
      console.error('SSH2 Client Auth/Socket Error:', cErr);
      resolve(false);
    });

    sftpClient.connect({
      host: '127.0.0.1',
      port: 2024,
      username: clientUsername,
      password: testPassword,
      readyTimeout: 5000
    });
  });

  assert(sftpTestSuccess === true, 'SSH2 SFTP Client authenticated and executed real read/write operations');

  // Test SFTP invalid credentials rejection
  const badClient = new Client();
  const badAuthRejected = await new Promise<boolean>((resolve) => {
    badClient.on('error', () => {
      resolve(true); // Expected rejection
    });
    badClient.on('ready', () => {
      badClient.end();
      resolve(false); // Should NOT succeed
    });
    badClient.connect({
      host: '127.0.0.1',
      port: 2024,
      username: clientUsername,
      password: 'WRONG_PASSWORD_XYZ',
      readyTimeout: 3000
    });
  });

  assert(badAuthRejected === true, 'SFTP Server successfully rejected unauthorized credentials');

  // Cleanup test data & stop test SFTP server
  stopSftpServer();

  // Cleanup test data
  // Clean test files
  if (fs.existsSync(serverADir)) fs.rmSync(serverADir, { recursive: true, force: true });
  if (fs.existsSync(serverBDir)) fs.rmSync(serverBDir, { recursive: true, force: true });
  db.servers = db.servers.filter(s => s.id !== testServerId && s.id !== testServer2Id);
  db.nodes = db.nodes.filter(n => n.id !== testNodeId);
  saveDbSync();

  console.log('\n====================================================');
  console.log(`📊 Phase 6 Verification Complete: ${passedTests}/${totalTests} Tests Passed`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    console.log('🎉 ALL PHASE 6 SFTP & FILE MANAGER REQUIREMENTS ARE 100% OPERATIONAL!');
    process.exit(0);
  } else {
    console.error('💥 Some tests failed. Please review output above.');
    process.exit(1);
  }
}

runPhase6Verification().catch(err => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
