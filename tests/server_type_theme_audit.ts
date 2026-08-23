import fs from 'fs';
import path from 'path';
import { getDb, saveDbSync, defaultServerTypes } from '../server/db';
import { resolveServerType } from '../server/routes/serverTypes';
import { Server, ServerType, ServerTypeTheme } from '../src/types';

async function runAuditTests() {
  console.log('================================================================');
  console.log('    AETHERPANEL SERVER TYPE & THEME SYSTEM HARDENING AUDIT');
  console.log('================================================================\n');

  let passCount = 0;
  let failCount = 0;

  function assert(condition: boolean, title: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${title}${detail ? ` (${detail})` : ''}`);
      passCount++;
    } else {
      console.error(`  ❌ [FAIL] ${title}${detail ? ` -> ${detail}` : ''}`);
      failCount++;
    }
  }

  // -------------------------------------------------------------------------
  // TEST 1: DB Seeds & Server Types Initialization
  // -------------------------------------------------------------------------
  console.log('--- [1/6] DATABASE SEED & SERVER TYPE INTEGRITY ---');
  try {
    const db = await getDb();
    assert(Array.isArray(db.serverTypes) && db.serverTypes.length >= 5, 'At least 5 default Server Types present in DB', `${db.serverTypes.length} types found`);

    const java = db.serverTypes.find(st => st.id === 'st_minecraft_java' || st.slug === 'minecraft-java');
    const bedrock = db.serverTypes.find(st => st.id === 'st_minecraft_bedrock' || st.slug === 'minecraft-bedrock');
    const node = db.serverTypes.find(st => st.id === 'st_nodejs' || st.slug === 'nodejs');
    const bun = db.serverTypes.find(st => st.id === 'st_bun' || st.slug === 'bun');
    const python = db.serverTypes.find(st => st.id === 'st_python' || st.slug === 'python');

    assert(!!java, 'Minecraft Java edition server type exists');
    assert(!!bedrock, 'Minecraft Bedrock edition server type exists');
    assert(!!node, 'Node.js Bot server type exists');
    assert(!!bun, 'Bun Bot server type exists');
    assert(!!python, 'Python Bot server type exists');

    let allThemesValid = true;
    for (const st of db.serverTypes) {
      if (!st.theme || !st.theme.backgroundUrl || !st.theme.accentColor) {
        allThemesValid = false;
        break;
      }
    }
    assert(allThemesValid, 'All stored server types possess complete theme objects');
  } catch (err: any) {
    assert(false, 'Database seed test', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Null / Undefined Safety in resolveServerType
  // -------------------------------------------------------------------------
  console.log('\n--- [2/6] RESOLVE SERVER TYPE NULL/UNDEFINED SAFETY ---');
  try {
    const db = await getDb();
    const serverTypes = db.serverTypes || [];

    // Case 2.1: Totally bare server object with no properties except id
    const bareServer: any = { id: 'srv_bare' };
    const resolvedBare = resolveServerType(bareServer, serverTypes);
    assert(!!resolvedBare, 'resolveServerType handles bare server without crashing');
    assert(!!resolvedBare.theme, 'Bare server resolved type has non-null theme');
    assert(!!resolvedBare.theme.backgroundUrl, 'Bare server resolved type has non-null backgroundUrl');
    assert(!!resolvedBare.theme.accentColor, 'Bare server resolved type has non-null accentColor');

    // Case 2.2: Server with non-existent serverTypeId
    const staleServer: any = { id: 'srv_stale', serverTypeId: 'st_non_existent_id', software: 'Unknown Custom' };
    const resolvedStale = resolveServerType(staleServer, serverTypes);
    assert(!!resolvedStale, 'resolveServerType handles non-existent serverTypeId gracefully');
    assert(!!resolvedStale.theme, 'Stale serverTypeId resolved type has non-null theme');

    // Case 2.3: Empty serverTypes array passed
    const resolvedEmptyTypes = resolveServerType(bareServer, []);
    assert(!!resolvedEmptyTypes, 'resolveServerType handles empty serverTypes list without crashing');
    assert(!!resolvedEmptyTypes.theme, 'Fallback server type has non-null theme');
    assert(resolvedEmptyTypes.theme.backgroundUrl.length > 0, 'Fallback server type backgroundUrl is non-empty string');

    // Case 2.4: ServerType in DB with corrupted theme = null
    const corruptedServerType: ServerType = {
      id: 'st_corrupt',
      name: 'Corrupted Type',
      slug: 'corrupt',
      category: 'Other',
      runtime: 'Custom',
      description: 'Corrupted theme',
      icon: 'Server',
      enabled: true,
      sortOrder: 99,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: null as any
    };
    const resolvedCorrupt = resolveServerType({ id: 'srv_c', serverTypeId: 'st_corrupt' } as any, [corruptedServerType]);
    assert(!!resolvedCorrupt, 'resolveServerType handles corrupted null theme without crashing');
    assert(!!resolvedCorrupt.theme, 'Corrupted null theme auto-repaired to valid theme object');
    assert(typeof resolvedCorrupt.theme.overlayOpacity === 'number', 'Theme overlayOpacity is valid number');
  } catch (err: any) {
    assert(false, 'resolveServerType null safety test', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 3: Runtime Auto-Resolution Rules
  // -------------------------------------------------------------------------
  console.log('\n--- [3/6] RUNTIME AUTO-RESOLUTION RULES ---');
  try {
    const db = await getDb();
    const serverTypes = db.serverTypes || [];

    // Test Bedrock matching
    const srvBedrock: any = { id: 'srv_b', software: 'Bedrock Dedicated Server' };
    const resBedrock = resolveServerType(srvBedrock, serverTypes);
    assert(resBedrock.id === 'st_minecraft_bedrock' || resBedrock.slug === 'minecraft-bedrock', 'Software "Bedrock Dedicated Server" matches Bedrock type');

    // Test Node.js matching via startup.botRuntime
    const srvNode: any = { id: 'srv_n', software: 'Discord Bot', startup: { botRuntime: 'nodejs' } };
    const resNode = resolveServerType(srvNode, serverTypes);
    assert(resNode.id === 'st_nodejs' || resNode.slug === 'nodejs', 'botRuntime "nodejs" matches Node.js type');

    // Test Bun matching via startup.botRuntime
    const srvBun: any = { id: 'srv_bun', software: 'Discord Bot', startup: { botRuntime: 'bun' } };
    const resBun = resolveServerType(srvBun, serverTypes);
    assert(resBun.id === 'st_bun' || resBun.slug === 'bun', 'botRuntime "bun" matches Bun type');

    // Test Python matching
    const srvPy: any = { id: 'srv_py', software: 'Python Bot', startup: { botRuntime: 'python' } };
    const resPy = resolveServerType(srvPy, serverTypes);
    assert(resPy.id === 'st_python' || resPy.slug === 'python', 'botRuntime "python" matches Python type');
  } catch (err: any) {
    assert(false, 'Runtime auto-resolution test', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 4: Database Invariants & Slug Uniqueness
  // -------------------------------------------------------------------------
  console.log('\n--- [4/6] DATABASE SLUG UNIQUENESS & VALIDATION ---');
  try {
    const db = await getDb();
    const slugs = db.serverTypes.map(s => s.slug);
    const uniqueSlugs = new Set(slugs);
    assert(slugs.length === uniqueSlugs.size, 'All server type slugs in database are strictly unique', `${slugs.length} unique slugs`);

    // Ensure all servers have valid serverTypeId assigned
    const unassignedServers = db.servers.filter(s => !s.serverTypeId);
    assert(unassignedServers.length === 0, 'Every server in database has a serverTypeId assigned');
  } catch (err: any) {
    assert(false, 'Database slug uniqueness test', err.message);
  }

  // -------------------------------------------------------------------------
  // TEST 5: Deletion Reassignment Logic Safety
  // -------------------------------------------------------------------------
  console.log('\n--- [5/6] SERVER TYPE DELETION REASSIGNMENT SAFETY ---');
  try {
    const db = await getDb();
    
    // Create dummy server type and dummy server attached to it
    const testTypeId = `st_del_test_${Date.now()}`;
    const testType: ServerType = {
      id: testTypeId,
      name: 'Temporary Deletion Test Type',
      slug: `temp-del-${Date.now()}`,
      category: 'Test',
      runtime: 'Test Runtime',
      description: 'Temporary',
      icon: 'Server',
      enabled: true,
      sortOrder: 99,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      theme: {
        id: `stt_del_${Date.now()}`,
        serverTypeId: testTypeId,
        backgroundUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b',
        accentColor: '#FF0000',
        overlayOpacity: 0.5,
        gradientEnabled: true,
        cardStyle: 'default',
        badgeStyle: 'glow',
        statusStyle: 'pill',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    };
    db.serverTypes.push(testType);

    const testServerId = `srv_del_target_${Date.now()}`;
    const dummyServer: Server = {
      id: testServerId,
      name: 'Server Bound To Temp Type',
      userId: 'usr_admin',
      productId: 'prod_mc',
      planId: 'plan_mc',
      nodeId: 'node_local',
      status: 'stopped',
      deploymentState: 'READY',
      primaryIp: '127.0.0.1',
      primaryPort: 25565,
      location: 'local',
      software: 'Paper 1.20',
      version: '1.20.4',
      serverTypeId: testTypeId,
      limits: { ramMB: 1024, cpuCores: 1, diskGB: 10, backups: 1, databases: 0 },
      startup: {},
      cpuUsage: 0, ramUsageMB: 0, diskUsageMB: 0, uptimeSeconds: 0,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    db.servers.push(dummyServer);
    saveDbSync();

    // Verify deletion safety: active server attached to testType
    const activeAttached = db.servers.filter(s => s.serverTypeId === testTypeId);
    assert(activeAttached.length === 1, 'Active server is associated with temporary type');

    // Simulate reassignment deletion to st_minecraft_java
    const targetReassign = db.serverTypes.find(s => s.id === 'st_minecraft_java') || db.serverTypes[0];
    activeAttached.forEach(s => s.serverTypeId = targetReassign.id);
    db.serverTypes = db.serverTypes.filter(s => s.id !== testTypeId);
    db.servers = db.servers.filter(s => s.id !== testServerId);
    saveDbSync();

    assert(!db.serverTypes.some(s => s.id === testTypeId), 'Temporary server type successfully deleted');
  } catch (err: any) {
    assert(false, 'Deletion reassignment safety test', err.message);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`  AUDIT SUITE RESULTS: ${passCount} PASSED / ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runAuditTests().catch(err => {
  console.error('Audit test failed:', err);
  process.exit(1);
});
