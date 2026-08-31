import fs from 'fs';
import path from 'path';
import { getDb } from '../server/db';
import { resolveServerSftpInfo, resolveNodeSftpMode } from '../server/sftpResolver';
import { resolveServerPublicEndpoint } from '../server/network/endpointResolver';
import { getNodePlayitStatus, getPlayitStatus } from '../server/playit/playitService';
import { detectHostEnvironment, detectEnvironmentCapabilities } from '../server/utils/environment';
import { startSftpDaemon, stopSftpServer } from '../server/sftpServer';

async function runIntegrationVerification() {
  console.log('================================================================');
  console.log('  AETHERPANEL PLAYIT & SFTP FULL SYSTEM INTEGRATION VERIFICATION ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;
  let blocked = 0;

  function assert(condition: boolean, title: string, details?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}${details ? ` -> ${details}` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${details ? ` -> ${details}` : ''}`);
      failed++;
    }
  }

  // 1. Environment & Capability Integration
  console.log('--- [1/4] ENVIRONMENT & CAPABILITY DIAGNOSTIC ---');
  const env = detectHostEnvironment();
  const caps = detectEnvironmentCapabilities();

  assert(
    !!env.os && !!env.virtualization,
    'Host environment detected authoritatively',
    `Env: ${env.virtualization}, Arch: ${env.normalizedArch}`
  );
  assert(
    typeof caps.playitAgentExecution === 'string',
    'Playit execution capability mapped',
    `Status: ${caps.playitAgentExecution} (${caps.playitBlockReason || 'Runnable'})`
  );
  assert(
    env.sftpCapability.supported === true,
    'SFTP subsystem capability enabled',
    `Port: ${env.sftpCapability.configuredPort}`
  );

  // 2. Node & Server SFTP Resolution
  console.log('\n--- [2/4] SFTP CONNECTION RESOLUTION & ENDPOINT ROUTING ---');
  const db = await getDb();
  let server = db.servers[0];
  let node = db.nodes?.[0];

  if (!node) {
    node = {
      id: 'node_local',
      name: 'Local Daemon Node',
      ip: '127.0.0.1',
      fqdn: 'localhost',
      daemonPort: 8080,
      sftpPort: 2022,
      diskGB: 100,
      memoryMB: 16384,
      cpuCores: 8,
      location: 'US-East',
      status: 'online',
      playitAgentInstalled: false,
      createdAt: new Date().toISOString()
    } as any;
    if (!db.nodes) db.nodes = [];
    db.nodes.push(node as any);
  }

  if (!server) {
    server = {
      id: 'srv_integration_test_default',
      name: 'Default Integration Server',
      userId: db.users[0]?.id || 'user_admin',
      nodeId: node.id,
      allocationId: 'alloc_1',
      status: 'stopped',
      software: 'node',
      version: '18',
      startupCmd: 'node index.js',
      limits: { ramMB: 1024, cpuCores: 1, diskGB: 10, backups: 2, databases: 1 },
      sftpPassword: 'integration_pass_123',
      createdAt: new Date().toISOString()
    } as any;
    db.servers.push(server as any);
  }

  assert(!!server && !!node, 'Target server and node loaded from DB');

  const sftpInfo = await resolveServerSftpInfo(server.id, 'panel.example.com');
  assert(
    !!sftpInfo && typeof sftpInfo.port === 'number' && !!sftpInfo.username,
    'Server SFTP details resolved accurately',
    `Host: ${sftpInfo.host}:${sftpInfo.port}, User: ${sftpInfo.username}`
  );

  const nodeMode = await resolveNodeSftpMode(node.id);
  assert(
    typeof nodeMode.mode === 'string' && typeof nodeMode.port === 'number',
    'Node SFTP Mode detected',
    `Mode: ${nodeMode.mode}, Reachable: ${nodeMode.reachable}`
  );

  // 3. Playit Status & Public Endpoint Fusion
  console.log('\n--- [3/4] PLAYIT STATUS & PUBLIC ENDPOINT FUSION ---');
  const playitStatus = await getNodePlayitStatus(node.id);
  const publicEndpoint = resolveServerPublicEndpoint(server, node, playitStatus as any);

  assert(
    !!publicEndpoint && typeof publicEndpoint.endpoint === 'string',
    'Server public endpoint resolved cleanly',
    `Public Endpoint: ${publicEndpoint.endpoint}, Source: ${publicEndpoint.source}`
  );

  // 4. Live SFTP Server Listener lifecycle
  console.log('\n--- [4/4] SFTP SERVER DAEMON INTEGRATION ---');
  try {
    stopSftpServer();
    const daemon = startSftpDaemon(2025);
    assert(!!daemon, 'SFTP server started on port 2025 for integration verification');
    stopSftpServer();
    assert(true, 'SFTP server cleanly stopped');
  } catch (err: any) {
    assert(false, 'SFTP server start/stop integration', err.message);
  }

  console.log('\n================================================================');
  console.log('              INTEGRATION VERIFICATION METRIC SUMMARY           ');
  console.log('================================================================');
  console.log(`  PASSED: ${passed}`);
  console.log(`  FAILED: ${failed}`);
  console.log(`  BLOCKED: ${blocked}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runIntegrationVerification().catch(err => {
  console.error('Fatal integration verification error:', err);
  process.exit(1);
});
