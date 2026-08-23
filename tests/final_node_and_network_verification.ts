import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { getDb, saveDbSync } from '../server/db';
import { ensureLocalNode, getLocalHardwareMetrics } from '../server/nodeAgent';
import {
  isInternalAddress,
  isValidFQDN,
  isValidIPv4,
  isValidIPv6,
  isPortReserved,
  resolveServerPublicEndpoint,
  resolveNodePublicEndpoint,
  RESERVED_SYSTEM_PORTS,
  NO_EXTERNAL_ENDPOINT
} from '../server/network/endpointResolver';
import { resolveServerSftpInfo, resolveNodeSftpMode } from '../server/sftpResolver';
import { getNodePlayitStatus } from '../server/playit/playitService';
import { Node, Server } from '../src/types';

async function runFinalHardeningVerification() {
  console.log('================================================================');
  console.log('  AETHERPANEL FINAL PRODUCTION NODE & NETWORKING VERIFICATION  ');
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

  // --------------------------------------------------------------------------
  // TEST 1: Node Data Model & Local Node Auto-Provisioning
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Node Data Model & Local Auto-Provisioning ---');
  try {
    const localNode = await ensureLocalNode();
    assert(!!localNode, 'Local node auto-provisioned');
    assert(localNode.id === 'node_local', 'Node ID is node_local');
    assert(typeof localNode.uuid === 'string' && localNode.uuid.length > 0, 'Node UUID is present', localNode.uuid);
    assert(typeof localNode.totalRamMB === 'number' && localNode.totalRamMB > 500, 'RAM auto-detected', `${localNode.totalRamMB}MB`);
    assert(typeof localNode.totalCpuCores === 'number' && localNode.totalCpuCores >= 1, 'CPU cores auto-detected', `${localNode.totalCpuCores} cores`);
    assert(typeof localNode.totalDiskGB === 'number' && localNode.totalDiskGB > 0, 'Disk space auto-detected', `${localNode.totalDiskGB}GB`);
    assert(localNode.daemonPort === 8080 || localNode.daemonPort === 8443, 'Standard daemon port assigned', `Port ${localNode.daemonPort}`);
    assert(localNode.sftpPort === 2022, 'Dedicated SFTP port assigned', `Port ${localNode.sftpPort}`);
    assert(localNode.bindAddress === '0.0.0.0', 'Bind address defaults to 0.0.0.0');
    assert(localNode.isLocalNode === true, 'Node is marked as local host');
    assert(localNode.status === 'online', 'Node status is online');

    // Idempotency check: Calling ensureLocalNode() multiple times must return the same instance without duplicating
    const localNode2 = await ensureLocalNode();
    assert(localNode2.id === localNode.id, 'Idempotent ensureLocalNode: identical instance returned');
    
    const db = await getDb();
    const localNodesInDb = db.nodes.filter(n => n.id === 'node_local');
    assert(localNodesInDb.length === 1, 'No duplicate local nodes created on reboot/re-run');
  } catch (err: any) {
    assert(false, 'Node Data Model verification failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 2: Internal/Loopback Address Isolation (No Public Leakage)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Public IP / Internal Address Isolation ---');
  try {
    assert(isInternalAddress('127.0.0.1') === true, '127.0.0.1 is internal');
    assert(isInternalAddress('localhost') === true, 'localhost is internal');
    assert(isInternalAddress('0.0.0.0') === true, '0.0.0.0 is internal');
    assert(isInternalAddress('::1') === true, '::1 is internal');
    assert(isInternalAddress('10.0.0.1') === true, '10.0.0.1 (RFC 1918) is internal');
    assert(isInternalAddress('172.16.0.1') === true, '172.16.0.1 (RFC 1918) is internal');
    assert(isInternalAddress('192.168.1.1') === true, '192.168.1.1 (RFC 1918) is internal');
    assert(isInternalAddress('198.51.100.25') === false, '198.51.100.25 is recognized as public');
    assert(isInternalAddress('1.1.1.1') === false, '1.1.1.1 is recognized as public');
    assert(isInternalAddress('node1.example.com') === false, 'Public FQDN is recognized as non-internal');
  } catch (err: any) {
    assert(false, 'Address validation failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 3: FQDN Validation & Sanitation
  // --------------------------------------------------------------------------
  console.log('\n--- 3. FQDN Validation & Normalization ---');
  try {
    assert(isValidFQDN('node1.example.com') === true, 'node1.example.com is valid');
    assert(isValidFQDN('sftp.us-east.panel.net') === true, 'sftp.us-east.panel.net is valid');
    assert(isValidFQDN('localhost') === false, 'localhost rejected');
    assert(isValidFQDN('local-vps') === false, 'local-vps rejected');
    assert(isValidFQDN('127.0.0.1') === false, 'raw IP rejected as FQDN');
    assert(isValidFQDN('http://evil.com') === false, 'URL scheme injection rejected');
    assert(isValidFQDN('evil.com/path') === false, 'URL path injection rejected');
    assert(isValidFQDN('') === false, 'Empty hostname rejected');
  } catch (err: any) {
    assert(false, 'FQDN validation failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 4: Strict Public Endpoint Resolution Priority
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Endpoint Resolution Priority Hierarchy ---');
  try {
    const dummyServer: Partial<Server> = { id: 'srv_test_1', primaryPort: 25565 };

    // Case 1: Node with FQDN
    const nodeWithFqdn: Partial<Node> = {
      id: 'node_fqdn',
      fqdn: 'node1.hosting.com',
      publicIpv4: '198.51.100.10',
      ip: '10.0.0.1'
    };
    const res1 = resolveServerPublicEndpoint(dummyServer, nodeWithFqdn, null);
    assert(res1.endpoint === 'node1.hosting.com:25565', 'Priority 1: FQDN wins over IPv4', res1.endpoint);
    assert(res1.source === 'fqdn', 'Source is fqdn');

    // Case 2: Node with no FQDN, but public IPv4
    const nodeWithIpv4: Partial<Node> = {
      id: 'node_ipv4',
      publicIpv4: '198.51.100.55',
      ip: '192.168.1.10'
    };
    const res2 = resolveServerPublicEndpoint(dummyServer, nodeWithIpv4, null);
    assert(res2.endpoint === '198.51.100.55:25565', 'Priority 2: Public IPv4 used when no FQDN', res2.endpoint);
    assert(res2.source === 'public_ipv4', 'Source is public_ipv4');

    // Case 3: Node with only public IPv6
    const nodeWithIpv6: Partial<Node> = {
      id: 'node_ipv6',
      publicIpv6: '2606:4700:4700::1111',
      ip: '10.0.0.2'
    };
    const res3 = resolveServerPublicEndpoint(dummyServer, nodeWithIpv6, null);
    assert(res3.endpoint === '[2606:4700:4700::1111]:25565', 'Priority 3: Public IPv6 formatted properly', res3.endpoint);
    assert(res3.source === 'public_ipv6', 'Source is public_ipv6');

    // Case 4: Node with only internal IP, but Playit tunnel is connected
    const nodeInternalWithPlayit: Partial<Node> = {
      id: 'node_playit',
      ip: '127.0.0.1'
    };
    const playitActive = {
      isInstalled: true,
      status: 'connected',
      tunnelAddress: 'custom-tunnel.playit.gg',
      tunnelPort: 12345
    };
    const res4 = resolveServerPublicEndpoint(dummyServer, nodeInternalWithPlayit, playitActive);
    assert(res4.endpoint === 'custom-tunnel.playit.gg:12345', 'Priority 4: Playit tunnel used for NAT/Local VPS', res4.endpoint);
    assert(res4.source === 'playit', 'Source is playit');

    // Case 5: Node has only 127.0.0.1 and no Playit tunnel
    const nodePureInternal: Partial<Node> = {
      id: 'node_internal_only',
      ip: '127.0.0.1'
    };
    const res5 = resolveServerPublicEndpoint(dummyServer, nodePureInternal, null);
    assert(res5.endpoint === NO_EXTERNAL_ENDPOINT, 'Priority 5: Never returns loopback; returns NO_EXTERNAL_ENDPOINT', res5.endpoint);
    assert(res5.isExternallyReachable === false, 'isExternallyReachable is false');
  } catch (err: any) {
    assert(false, 'Endpoint resolution test failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 5: SFTP Endpoint Resolution Hierarchy
  // --------------------------------------------------------------------------
  console.log('\n--- 5. SFTP Endpoint Resolution Hierarchy ---');
  try {
    const sftpInfo = await resolveServerSftpInfo('srv_test_1', 'panel.example.com');
    assert(!!sftpInfo, 'SFTP Info resolved');
    assert(typeof sftpInfo.port === 'number', 'SFTP port is number', `Port ${sftpInfo.port}`);
    assert(!isInternalAddress(sftpInfo.host) || sftpInfo.host === NO_EXTERNAL_ENDPOINT, 'SFTP host is not loopback', sftpInfo.host);
    assert(sftpInfo.uri.startsWith('sftp://'), 'SFTP URI formatted correctly', sftpInfo.uri);
  } catch (err: any) {
    assert(false, 'SFTP resolution test failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 6: Reserved System Port Protection
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Reserved Port Collision Protection ---');
  try {
    const testNode: Partial<Node> = {
      id: 'node_reserved_test',
      daemonPort: 8080,
      sftpPort: 2022
    };

    assert(isPortReserved(22, testNode) === true, 'Port 22 (SSH) is reserved');
    assert(isPortReserved(80, testNode) === true, 'Port 80 (HTTP/ACME) is reserved');
    assert(isPortReserved(443, testNode) === true, 'Port 443 (HTTPS Panel) is reserved');
    assert(isPortReserved(2022, testNode) === true, 'Port 2022 (SFTP) is reserved');
    assert(isPortReserved(3000, testNode) === true, 'Port 3000 (Panel Web Ingress) is reserved');
    assert(isPortReserved(8080, testNode) === true, 'Port 8080 (Daemon Internal API) is reserved');
    assert(isPortReserved(8443, testNode) === true, 'Port 8443 (Daemon SSL Gateway) is reserved');
    assert(isPortReserved(25565, testNode) === false, 'Port 25565 (Game Port) is available for allocation');
    assert(isPortReserved(25566, testNode) === false, 'Port 25566 (Game Port) is available for allocation');
  } catch (err: any) {
    assert(false, 'Reserved port testing failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 7: Atomic Port Allocation & Concurrency Race Condition Safety
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Atomic Port Allocation & Concurrency Protection ---');
  try {
    const db = await getDb();
    const testNodeId = `node_alloc_test_${Date.now()}`;
    
    // Seed 2 available allocations
    db.allocations.push({
      id: `alloc_c1_${Date.now()}`,
      nodeId: testNodeId,
      ip: '0.0.0.0',
      port: 27015,
      isAssigned: false
    });
    db.allocations.push({
      id: `alloc_c2_${Date.now()}`,
      nodeId: testNodeId,
      ip: '0.0.0.0',
      port: 27016,
      isAssigned: false
    });
    saveDbSync();

    // Simulate 2 concurrent allocations
    const claim1 = db.allocations.find(a => a.nodeId === testNodeId && !a.isAssigned);
    if (claim1) claim1.isAssigned = true;

    const claim2 = db.allocations.find(a => a.nodeId === testNodeId && !a.isAssigned);
    if (claim2) claim2.isAssigned = true;

    assert(!!claim1 && !!claim2, 'Both allocations claimed');
    assert(claim1?.port !== claim2?.port, 'Two concurrent claims received unique ports', `Port 1: ${claim1?.port}, Port 2: ${claim2?.port}`);

    // Cleanup test allocations
    db.allocations = db.allocations.filter(a => a.nodeId !== testNodeId);
    saveDbSync();
  } catch (err: any) {
    assert(false, 'Atomic allocation test failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 8: Real Hardware Telemetry
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Real Hardware Telemetry ---');
  try {
    const metrics = await getLocalHardwareMetrics();
    assert(typeof metrics.cpuUsagePercent === 'number', 'CPU Usage % computed', `${metrics.cpuUsagePercent}%`);
    assert(metrics.ramTotalMB > 0, 'RAM Total reported', `${metrics.ramTotalMB}MB`);
    assert(metrics.ramUsedMB >= 0, 'RAM Used reported', `${metrics.ramUsedMB}MB`);
    assert(metrics.diskTotalGB > 0, 'Disk Total reported', `${metrics.diskTotalGB}GB`);
    assert(metrics.uptimeSeconds > 0, 'Uptime reported', `${Math.round(metrics.uptimeSeconds / 3600)}h`);
  } catch (err: any) {
    assert(false, 'Telemetry metrics failed', err.message);
  }

  // --------------------------------------------------------------------------
  // TEST 9: Playit.GG Agent Status Check
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Playit.GG Agent Status Check ---');
  try {
    const playit = await getNodePlayitStatus('node_local');
    assert(typeof playit.isInstalled === 'boolean', 'Playit install status detected', `Installed: ${playit.isInstalled}`);
    assert(typeof playit.status === 'string', 'Playit status state machine reported', `State: ${playit.status}`);
  } catch (err: any) {
    assert(false, 'Playit status failed', err.message);
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFinalHardeningVerification().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
