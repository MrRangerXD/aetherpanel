import { getDb, saveDbSync } from '../db';
import { resolveServerResources } from '../services/resourceResolverService';
import { formatMemory } from '../../src/lib/serverNormalize';
import { getServerResourceLimits } from '../services/allocationService';
import { Plan, Server } from '../../src/types';

async function runDynamicPlanAuthorityTests() {
  console.log('================================================================');
  console.log('  AETHERPANEL DYNAMIC PLAN RESOURCE AUTHORITY TEST SUITE        ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${testName}${detail ? ` - ${detail}` : ''}`);
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      throw new Error(`Test failed: ${testName} (${detail})`);
    }
  }

  const db = await getDb();

  // ----------------------------------------------------------------
  // TEST 1: Free Bot Plan Deployment Resolution
  // ----------------------------------------------------------------
  console.log('--- TEST 1: Free Bot Plan Resolution ---');
  const botFreePlan = db.plans.find(p => p.id === 'plan_bot_free');
  assert(!!botFreePlan, 'Test 1: plan_bot_free exists in database');

  const botFreeRes = resolveServerResources({
    db,
    planId: 'plan_bot_free',
    serverCategory: 'bot',
    provisionSource: 'self_service'
  });

  assert(botFreeRes.ramMB === 512, 'Test 1: Free Bot RAM is exactly 512 MB', `${botFreeRes.ramMB} MB`);
  assert(botFreeRes.cpuCores === 0.5, 'Test 1: Free Bot CPU is exactly 0.5 vCPU', `${botFreeRes.cpuCores} vCPU`);
  assert(botFreeRes.diskGB === 5, 'Test 1: Free Bot Disk is exactly 5 GB', `${botFreeRes.diskGB} GB`);
  assert(botFreeRes.isFreePlan === true, 'Test 1: Marked as Free Plan');

  // ----------------------------------------------------------------
  // TEST 2: Free Minecraft Plan Deployment Resolution
  // ----------------------------------------------------------------
  console.log('\n--- TEST 2: Free Minecraft Plan Resolution ---');
  const mcFreePlan = db.plans.find(p => p.id === 'plan_mc_free');
  assert(!!mcFreePlan, 'Test 2: plan_mc_free exists in database');

  const mcFreeRes = resolveServerResources({
    db,
    planId: 'plan_mc_free',
    serverCategory: 'minecraft',
    provisionSource: 'self_service'
  });

  assert(mcFreeRes.ramMB === 1024, 'Test 2: Free Minecraft RAM is exactly 1024 MB', `${mcFreeRes.ramMB} MB`);
  assert(mcFreeRes.cpuCores === 1.0, 'Test 2: Free Minecraft CPU is exactly 1.0 vCPU', `${mcFreeRes.cpuCores} vCPU`);
  assert(mcFreeRes.diskGB === 10, 'Test 2: Free Minecraft Disk is exactly 10 GB', `${mcFreeRes.diskGB} GB`);
  assert(mcFreeRes.isFreePlan === true, 'Test 2: Marked as Free Plan');

  // ----------------------------------------------------------------
  // TEST 3: Paid 1 GB Plan Resolution (Must NOT be reduced to Free Bot 512 MB limits)
  // ----------------------------------------------------------------
  console.log('\n--- TEST 3: Paid 1 GB Plan Resolution ---');
  const botStarterPlan = db.plans.find(p => p.id === 'plan_bot_starter');
  assert(!!botStarterPlan, 'Test 3: plan_bot_starter exists in database');

  const botStarterRes = resolveServerResources({
    db,
    planId: 'plan_bot_starter',
    serverCategory: 'bot',
    provisionSource: 'self_service'
  });

  assert(botStarterRes.ramMB === 1024, 'Test 3: Paid Bot Starter RAM is exactly 1024 MB', `${botStarterRes.ramMB} MB`);
  assert(botStarterRes.cpuCores === 0.75, 'Test 3: Paid Bot Starter CPU is exactly 0.75 vCPU', `${botStarterRes.cpuCores} vCPU`);
  assert(botStarterRes.diskGB === 10, 'Test 3: Paid Bot Starter Disk is 10 GB', `${botStarterRes.diskGB} GB`);
  assert(botStarterRes.isFreePlan === false, 'Test 3: Marked as Paid Plan');

  // ----------------------------------------------------------------
  // TEST 4: Paid 2 GB Plan Resolution
  // ----------------------------------------------------------------
  console.log('\n--- TEST 4: Paid 2 GB Plan Resolution ---');
  const botBasicPlan = db.plans.find(p => p.id === 'plan_bot_basic');
  assert(!!botBasicPlan, 'Test 4: plan_bot_basic exists in database');

  const botBasicRes = resolveServerResources({
    db,
    planId: 'plan_bot_basic',
    serverCategory: 'bot',
    provisionSource: 'self_service'
  });

  assert(botBasicRes.ramMB === 2048, 'Test 4: Paid Bot Basic RAM is exactly 2048 MB (2 GB)', `${botBasicRes.ramMB} MB`);
  assert(botBasicRes.cpuCores === 1.0, 'Test 4: Paid Bot Basic CPU is exactly 1.0 vCPU (100%)', `${botBasicRes.cpuCores} vCPU`);
  assert(botBasicRes.diskGB === 20, 'Test 4: Paid Bot Basic Disk is 20 GB', `${botBasicRes.diskGB} GB`);

  // ----------------------------------------------------------------
  // TEST 5: Future Admin-Created Plan Resolution (No Code Changes Required)
  // ----------------------------------------------------------------
  console.log('\n--- TEST 5: Future Admin Created Plan Resolution ---');
  const futurePlanId = `plan_future_${Date.now()}`;
  const futurePlan: Plan = {
    id: futurePlanId,
    productId: 'prod_bot',
    name: 'Future Extreme Bot Plan',
    description: 'Dynamic admin created plan',
    priceMonthly: 89.00,
    priceYearly: 890.00,
    ramMB: 6144,
    cpuCores: 4.0,
    diskGB: 60,
    backupLimit: 5,
    databaseLimit: 3,
    serverLimit: 4,
    networkMbps: 5000,
    features: ['6GB RAM', '4 vCPUs'],
    locations: ['local'],
    isActive: true
  };

  db.plans.push(futurePlan);
  saveDbSync();

  const futureRes = resolveServerResources({
    db,
    planId: futurePlanId,
    serverCategory: 'bot',
    provisionSource: 'self_service'
  });

  assert(futureRes.ramMB === 6144, 'Test 5: Future Admin Plan RAM is exactly 6144 MB', `${futureRes.ramMB} MB`);
  assert(futureRes.cpuCores === 4.0, 'Test 5: Future Admin Plan CPU is exactly 4.0 vCPU', `${futureRes.cpuCores} vCPU`);
  assert(futureRes.diskGB === 60, 'Test 5: Future Admin Plan Disk is exactly 60 GB', `${futureRes.diskGB} GB`);
  assert(futureRes.allocationsLimit === 4, 'Test 5: Future Admin Plan allocation limit is 4', `${futureRes.allocationsLimit}`);

  // ----------------------------------------------------------------
  // TEST 6: Edit Existing Plan & Resource Snapshot Retention
  // ----------------------------------------------------------------
  console.log('\n--- TEST 6: Edit Plan & Snapshot Retention ---');
  const editablePlanId = `plan_editable_${Date.now()}`;
  const editablePlan: Plan = {
    id: editablePlanId,
    productId: 'prod_minecraft',
    name: 'Editable Minecraft Tier',
    description: 'Tier to be edited by admin',
    priceMonthly: 29.00,
    priceYearly: 290.00,
    ramMB: 2048,
    cpuCores: 1.5,
    diskGB: 20,
    backupLimit: 2,
    databaseLimit: 1,
    serverLimit: 2,
    networkMbps: 1000,
    features: ['2GB RAM'],
    locations: ['local'],
    isActive: true
  };
  db.plans.push(editablePlan);
  saveDbSync();

  // Server created BEFORE plan edit
  const serverInitialRes = resolveServerResources({
    db,
    planId: editablePlanId,
    serverCategory: 'minecraft'
  });
  const snapshotServer: Server = {
    id: `srv_test_snapshot_${Date.now()}`,
    name: 'Existing Server Snapshot Test',
    userId: 'user_regular',
    productId: 'prod_minecraft',
    planId: editablePlanId,
    nodeId: 'node_local',
    software: 'Paper',
    version: '1.20.4',
    deploymentState: 'READY',
    status: 'running',
    primaryIp: '127.0.0.1',
    primaryPort: 25575,
    location: 'local',
    limits: {
      ramMB: serverInitialRes.ramMB,
      cpuCores: serverInitialRes.cpuCores,
      diskGB: serverInitialRes.diskGB,
      backups: serverInitialRes.backups,
      databases: serverInitialRes.databases
    },
    resources: {
      memoryMb: serverInitialRes.ramMB,
      cpuPercent: serverInitialRes.cpuPercent,
      diskGb: serverInitialRes.diskGB
    },
    provisionSource: 'self_service',
    isAdminCreated: false,
    createdByAdmin: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    cpuUsage: 10.0,
    ramUsageMB: 500,
    diskUsageMB: 200,
    uptimeSeconds: 0
  };
  db.servers.push(snapshotServer);
  saveDbSync();

  // Admin edits plan: 2 GB -> 4 GB, 1.5 CPU -> 3 CPU, 20 GB Disk -> 40 GB Disk
  const planInDb = db.plans.find(p => p.id === editablePlanId)!;
  planInDb.ramMB = 4096;
  planInDb.cpuCores = 3.0;
  planInDb.diskGB = 40;
  saveDbSync();

  // NEW deployment using updated plan
  const newDeploymentRes = resolveServerResources({
    db,
    planId: editablePlanId,
    serverCategory: 'minecraft'
  });
  assert(newDeploymentRes.ramMB === 4096, 'Test 6: New deployment receives updated 4096 MB RAM', `${newDeploymentRes.ramMB} MB`);

  // EXISTING server retains snapshot
  assert(snapshotServer.resources?.memoryMb === 2048, 'Test 6: Existing server retains original 2048 MB RAM snapshot', `${snapshotServer.resources?.memoryMb} MB`);
  assert(snapshotServer.limits.ramMB === 2048, 'Test 6: Existing server limits retain 2048 MB', `${snapshotServer.limits.ramMB} MB`);

  // ----------------------------------------------------------------
  // TEST 7: Admin Custom Server (No Free or Plan Cap Overwriting)
  // ----------------------------------------------------------------
  console.log('\n--- TEST 7: Admin Custom Server ---');
  const adminCustomRes = resolveServerResources({
    db,
    provisionSource: 'admin_assigned',
    customResources: {
      ramMB: 8192,
      cpuCores: 6.0,
      diskGB: 100,
      backups: 5,
      databases: 3
    }
  });

  assert(adminCustomRes.ramMB === 8192, 'Test 7: Admin custom server RAM is strictly 8192 MB', `${adminCustomRes.ramMB} MB`);
  assert(adminCustomRes.cpuCores === 6.0, 'Test 7: Admin custom server CPU is strictly 6.0 vCPU', `${adminCustomRes.cpuCores} vCPU`);
  assert(adminCustomRes.diskGB === 100, 'Test 7: Admin custom server Disk is strictly 100 GB', `${adminCustomRes.diskGB} GB`);

  // ----------------------------------------------------------------
  // TEST 8: Frontend Memory Accuracy Formatter
  // ----------------------------------------------------------------
  console.log('\n--- TEST 8: Frontend Accuracy Formatter ---');
  assert(formatMemory(512) === '512 MB', 'Test 8: 512 MB formats as "512 MB"', formatMemory(512));
  assert(formatMemory(1024) === '1 GB', 'Test 8: 1024 MB formats as "1 GB"', formatMemory(1024));
  assert(formatMemory(2048) === '2 GB', 'Test 8: 2048 MB formats as "2 GB"', formatMemory(2048));
  assert(formatMemory(6144) === '6 GB', 'Test 8: 6144 MB formats as "6 GB"', formatMemory(6144));
  assert(formatMemory(8192) === '8 GB', 'Test 8: 8192 MB formats as "8 GB"', formatMemory(8192));

  // ----------------------------------------------------------------
  // TEST 9: Restart Persistence Verification
  // ----------------------------------------------------------------
  console.log('\n--- TEST 9: Restart Persistence Verification ---');
  saveDbSync();
  const freshDb = await getDb();
  const reloadedPlan = freshDb.plans.find(p => p.id === futurePlanId);
  assert(!!reloadedPlan, 'Test 9: Future plan persisted across restart');
  assert(reloadedPlan?.ramMB === 6144, 'Test 9: Future plan RAM persisted as 6144 MB');

  const reloadedServer = freshDb.servers.find(s => s.id === snapshotServer.id);
  assert(!!reloadedServer, 'Test 9: Snapshot server persisted across restart');
  assert(reloadedServer?.resources?.memoryMb === 2048, 'Test 9: Server snapshot memoryMb persisted as 2048 MB');

  // Clean up test items from DB
  const futureIdx = freshDb.plans.findIndex(p => p.id === futurePlanId);
  if (futureIdx !== -1) freshDb.plans.splice(futureIdx, 1);

  const editIdx = freshDb.plans.findIndex(p => p.id === editablePlanId);
  if (editIdx !== -1) freshDb.plans.splice(editIdx, 1);

  const serverIdx = freshDb.servers.findIndex(s => s.id === snapshotServer.id);
  if (serverIdx !== -1) freshDb.servers.splice(serverIdx, 1);

  saveDbSync();

  console.log('\n================================================================');
  console.log(`  ALL ${passed}/${total} DYNAMIC PLAN RESOURCE AUTHORITY TESTS PASSED GREEN!  `);
  console.log('================================================================');
}

runDynamicPlanAuthorityTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
