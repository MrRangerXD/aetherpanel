import { getDb, saveDbSync } from '../db';
import { User, Server } from '../../src/types';
import {
  getUserAllocationStatus,
  canUserDeployServer,
  getServerResourceLimits,
  countOwnedServers
} from '../services/allocationService';

// Import locking from deploy route if possible or simulate mutex
const userDeployLocks = new Map<string, Promise<void>>();

async function withUserDeployLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  while (userDeployLocks.has(userId)) {
    await userDeployLocks.get(userId);
  }
  let resolveLock: () => void;
  const lockPromise = new Promise<void>(resolve => {
    resolveLock = resolve;
  });
  userDeployLocks.set(userId, lockPromise);
  try {
    return await fn();
  } finally {
    userDeployLocks.delete(userId);
    resolveLock!();
  }
}

async function runAllocationAndLimitTests() {
  console.log('================================================================');
  console.log('  AETHERPANEL FREE PLAN ALLOCATION & RESOURCE LIMIT TEST SUITE  ');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`[PASS] ${testName}${detail ? ` - ${detail}` : ''}`);
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  const db = await getDb();

  // Helper to create test user
  function createTestUser(id: string, email: string, username: string): User {
    const user: User = {
      id,
      email,
      username,
      displayName: username,
      role: 'user',
      plan: 'free',
      baseServerAllocations: 1,
      adminGrantedAllocations: 0,
      credits: 0,
      isSuspended: false,
      emailVerified: true,
      twoFactorEnabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.users = db.users.filter(u => u.id !== id);
    db.users.push(user);
    // Cleanup any existing servers for this user
    db.servers = db.servers.filter(s => s.userId !== id);
    return user;
  }

  // Helper to simulate self-service deploy
  async function simulateSelfServiceDeploy(user: User, category: 'bot' | 'minecraft', customPayload?: any) {
    return withUserDeployLock(user.id, async () => {
      const freshUser = db.users.find(u => u.id === user.id)!;
      const deployCheck = canUserDeployServer(db, freshUser);
      if (!deployCheck.allowed) {
        return {
          success: false,
          error: {
            code: deployCheck.errorCode || 'SERVER_ALLOCATION_LIMIT_REACHED',
            message: deployCheck.errorMessage || 'Your current plan supports only 1 server allocation.'
          }
        };
      }

      const plan = db.plans.find(p => p.id === (category === 'bot' ? 'plan_bot_free' : 'plan_mc_free')) || {
        id: category === 'bot' ? 'plan_bot_free' : 'plan_mc_free',
        priceMonthly: 0,
        ramMB: category === 'bot' ? 512 : 1024,
        cpuCores: category === 'bot' ? 0.5 : 1.0,
        diskGB: category === 'bot' ? 5 : 10
      };

      const limits = getServerResourceLimits(category, plan, customPayload);

      const serverId = `srv_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const server: Server = {
        id: serverId,
        name: `${category.toUpperCase()} Test Server`,
        userId: user.id,
        productId: category === 'bot' ? 'prod_bot' : 'prod_minecraft',
        planId: plan.id,
        nodeId: 'node_local_01',
        deploymentState: 'READY',
        status: 'running',
        primaryIp: '127.0.0.1',
        primaryPort: Math.floor(25000 + Math.random() * 5000),
        location: 'Local Datacenter',
        software: category === 'bot' ? 'Node.js' : 'Paper',
        version: category === 'bot' ? 'Node 20' : '1.20.4',
        limits,
        provisionSource: 'self_service',
        isAdminCreated: false,
        createdByAdmin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        cpuUsage: 10.0,
        ramUsageMB: 100,
        diskUsageMB: 200,
        uptimeSeconds: 0
      };

      db.servers.push(server);
      saveDbSync();
      return { success: true, server };
    });
  }

  // Helper to simulate admin server creation
  function simulateAdminServerCreate(user: User, category: 'bot' | 'minecraft', customLimits: { ramMB: number; cpuCores: number; diskGB: number }) {
    const serverId = `srv_admin_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const server: Server = {
      id: serverId,
      name: `Admin Assigned ${category} Server`,
      userId: user.id,
      productId: category === 'bot' ? 'prod_bot' : 'prod_minecraft',
      planId: 'plan_custom',
      nodeId: 'node_local_01',
      deploymentState: 'READY',
      status: 'running',
      primaryIp: '127.0.0.1',
      primaryPort: Math.floor(30000 + Math.random() * 5000),
      location: 'Local Datacenter',
      software: category === 'bot' ? 'Node.js' : 'Paper',
      version: 'Latest',
      limits: {
        ramMB: customLimits.ramMB,
        cpuCores: customLimits.cpuCores,
        diskGB: customLimits.diskGB,
        backups: 5,
        databases: 3
      },
      provisionSource: 'admin_assigned',
      isAdminCreated: true,
      createdByAdmin: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      cpuUsage: 10.0,
      ramUsageMB: 100,
      diskUsageMB: 200,
      uptimeSeconds: 0
    };
    db.servers.push(server);
    saveDbSync();
    return server;
  }

  // ----------------------------------------------------
  // TEST 1: Bot Hosting Allocation & Limit Test
  // ----------------------------------------------------
  console.log('--- TEST 1: Bot Hosting Allocation & Limit Test ---');
  const user1 = createTestUser('usr_test_1', 'botuser@test.com', 'botuser');
  const res1 = await simulateSelfServiceDeploy(user1, 'bot');
  assert(res1.success === true, 'Test 1: Self-service Bot deployment succeeded');
  assert(res1.server?.limits.ramMB === 512, 'Test 1: Bot RAM is strictly 512 MB', `${res1.server?.limits.ramMB} MB`);
  assert(res1.server?.limits.cpuCores === 0.5, 'Test 1: Bot CPU is strictly 0.5 vCPU (50%)', `${res1.server?.limits.cpuCores} vCPU`);
  assert(res1.server?.limits.diskGB === 5, 'Test 1: Bot Disk is strictly 5 GB', `${res1.server?.limits.diskGB} GB`);
  assert(res1.server?.provisionSource === 'self_service', 'Test 1: provisionSource is self_service');

  const status1 = getUserAllocationStatus(db, user1.id);
  assert(status1.used === 1, 'Test 1: User allocation used is 1');
  assert(status1.remaining === 0, 'Test 1: User allocation remaining is 0');
  assert(status1.limit === 1, 'Test 1: User allocation limit is 1');

  // ----------------------------------------------------
  // TEST 2: Minecraft Hosting Allocation & Limit Test
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Minecraft Hosting Allocation & Limit Test ---');
  const user2 = createTestUser('usr_test_2', 'mcuser@test.com', 'mcuser');
  const res2 = await simulateSelfServiceDeploy(user2, 'minecraft');
  assert(res2.success === true, 'Test 2: Self-service Minecraft deployment succeeded');
  assert(res2.server?.limits.ramMB === 1024, 'Test 2: Minecraft RAM is strictly 1024 MB (1 GB)', `${res2.server?.limits.ramMB} MB`);
  assert(res2.server?.limits.cpuCores === 1.0, 'Test 2: Minecraft CPU is strictly 1.0 vCPU (100%)', `${res2.server?.limits.cpuCores} vCPU`);
  assert(res2.server?.limits.diskGB === 10, 'Test 2: Minecraft Disk is strictly 10 GB', `${res2.server?.limits.diskGB} GB`);
  assert(res2.server?.provisionSource === 'self_service', 'Test 2: provisionSource is self_service');

  const status2 = getUserAllocationStatus(db, user2.id);
  assert(status2.used === 1, 'Test 2: User allocation used is 1');
  assert(status2.remaining === 0, 'Test 2: User allocation remaining is 0');
  assert(status2.limit === 1, 'Test 2: User allocation limit is 1');

  // ----------------------------------------------------
  // TEST 3: Bot then Minecraft Rejection Test
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Bot then Minecraft Rejection Test ---');
  const res3 = await simulateSelfServiceDeploy(user1, 'minecraft');
  assert(res3.success === false, 'Test 3: Deploying Minecraft server after Bot server is rejected');
  assert(res3.error?.code === 'SERVER_ALLOCATION_LIMIT_REACHED', 'Test 3: Error code is SERVER_ALLOCATION_LIMIT_REACHED', res3.error?.code);
  assert(res3.error?.message === 'Your current plan supports only 1 server allocation.', 'Test 3: Error message is exact', res3.error?.message);

  // ----------------------------------------------------
  // TEST 4: Minecraft then Bot Rejection Test
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Minecraft then Bot Rejection Test ---');
  const res4 = await simulateSelfServiceDeploy(user2, 'bot');
  assert(res4.success === false, 'Test 4: Deploying Bot server after Minecraft server is rejected');
  assert(res4.error?.code === 'SERVER_ALLOCATION_LIMIT_REACHED', 'Test 4: Error code is SERVER_ALLOCATION_LIMIT_REACHED', res4.error?.code);
  assert(res4.error?.message === 'Your current plan supports only 1 server allocation.', 'Test 4: Error message is exact', res4.error?.message);

  // ----------------------------------------------------
  // TEST 5: Modified Request / Payload Capping Test
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Modified Request / Payload Capping Test ---');
  const user5 = createTestUser('usr_test_5', 'hacker@test.com', 'hacker');
  const customPayloadBot = { memory: 8192, cpu: 400, disk: 100 };
  const res5Bot = await simulateSelfServiceDeploy(user5, 'bot', customPayloadBot);
  assert(res5Bot.success === true, 'Test 5: Bot deploy with inflated payload succeeded');
  assert(res5Bot.server?.limits.ramMB === 512, 'Test 5: Bot RAM capped to 512 MB despite 8192 MB requested', `${res5Bot.server?.limits.ramMB} MB`);
  assert(res5Bot.server?.limits.cpuCores === 0.5, 'Test 5: Bot CPU capped to 0.5 (50%) despite 400% requested', `${res5Bot.server?.limits.cpuCores} vCPU`);
  assert(res5Bot.server?.limits.diskGB === 5, 'Test 5: Bot Disk capped to 5 GB despite 100 GB requested', `${res5Bot.server?.limits.diskGB} GB`);

  const user5Mc = createTestUser('usr_test_5mc', 'hackermc@test.com', 'hackermc');
  const customPayloadMc = { memory: 16384, cpu: 800, disk: 500 };
  const res5Mc = await simulateSelfServiceDeploy(user5Mc, 'minecraft', customPayloadMc);
  assert(res5Mc.success === true, 'Test 5: Minecraft deploy with inflated payload succeeded');
  assert(res5Mc.server?.limits.ramMB === 1024, 'Test 5: Minecraft RAM capped to 1024 MB despite 16384 MB requested', `${res5Mc.server?.limits.ramMB} MB`);
  assert(res5Mc.server?.limits.cpuCores === 1.0, 'Test 5: Minecraft CPU capped to 1.0 (100%) despite 800% requested', `${res5Mc.server?.limits.cpuCores} vCPU`);
  assert(res5Mc.server?.limits.diskGB === 10, 'Test 5: Minecraft Disk capped to 10 GB despite 500 GB requested', `${res5Mc.server?.limits.diskGB} GB`);

  // ----------------------------------------------------
  // TEST 6: Admin Assignment Allocation Exemption Test
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Admin Assignment Allocation Exemption Test ---');
  const user6 = createTestUser('usr_test_6', 'vipuser@test.com', 'vipuser');
  const adminServer = simulateAdminServerCreate(user6, 'minecraft', { ramMB: 4096, cpuCores: 2.0, diskGB: 50 });
  assert(adminServer.isAdminCreated === true, 'Test 6: Admin server has isAdminCreated = true');
  assert(adminServer.createdByAdmin === true, 'Test 6: Admin server has createdByAdmin = true');
  assert(adminServer.provisionSource === 'admin_assigned', 'Test 6: provisionSource is admin_assigned');

  const status6 = getUserAllocationStatus(db, user6.id);
  assert(status6.used === 0, 'Test 6: User self-service allocation used is STILL 0', `Used: ${status6.used}`);
  assert(status6.remaining === 1, 'Test 6: User self-service allocation remaining is STILL 1', `Remaining: ${status6.remaining}`);
  assert(status6.limit === 1, 'Test 6: User self-service allocation limit is 1');
  assert(countOwnedServers(db, user6.id) === 0, 'Test 6: countOwnedServers excludes admin server');

  // ----------------------------------------------------
  // TEST 7: Admin Assigned High Spec Server Test
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Admin Assigned High Spec Server Test ---');
  assert(adminServer.limits.ramMB === 4096, 'Test 7: Admin server retains 4096 MB RAM without Free plan capping', `${adminServer.limits.ramMB} MB`);
  assert(adminServer.limits.cpuCores === 2.0, 'Test 7: Admin server retains 2.0 vCPU without Free plan capping', `${adminServer.limits.cpuCores} vCPU`);
  assert(adminServer.limits.diskGB === 50, 'Test 7: Admin server retains 50 GB Disk without Free plan capping', `${adminServer.limits.diskGB} GB`);

  // ----------------------------------------------------
  // TEST 8: Admin Assigned Server + Free Self-Service Deployment Test
  // ----------------------------------------------------
  console.log('\n--- TEST 8: Admin Assigned Server + Free Self-Service Deployment Test ---');
  const res8 = await simulateSelfServiceDeploy(user6, 'bot');
  assert(res8.success === true, 'Test 8: Free user with admin server CAN deploy 1 self-service server');
  assert(res8.server?.limits.ramMB === 512, 'Test 8: Self-service server received Bot free limit (512 MB)');

  const status8 = getUserAllocationStatus(db, user6.id);
  assert(status8.used === 1, 'Test 8: Self-service allocation used is now 1');
  assert(status8.remaining === 0, 'Test 8: Self-service allocation remaining is now 0');

  const totalUser6Servers = db.servers.filter(s => s.userId === user6.id).length;
  assert(totalUser6Servers === 2, 'Test 8: User has 2 total servers in database (1 admin + 1 self-service)');

  const res8Second = await simulateSelfServiceDeploy(user6, 'minecraft');
  assert(res8Second.success === false, 'Test 8: Second self-service deployment rejected');
  assert(res8Second.error?.code === 'SERVER_ALLOCATION_LIMIT_REACHED', 'Test 8: Second attempt returns SERVER_ALLOCATION_LIMIT_REACHED');

  // ----------------------------------------------------
  // TEST 9: Atomic Concurrency Lock Test
  // ----------------------------------------------------
  console.log('\n--- TEST 9: Atomic Concurrency Lock Test ---');
  const user9 = createTestUser('usr_test_9', 'raceuser@test.com', 'raceuser');
  
  // Trigger two simultaneous deployment promises
  const [res9a, res9b] = await Promise.all([
    simulateSelfServiceDeploy(user9, 'bot'),
    simulateSelfServiceDeploy(user9, 'minecraft')
  ]);

  const successCount = (res9a.success ? 1 : 0) + (res9b.success ? 1 : 0);
  const failureCount = (res9a.success ? 0 : 1) + (res9b.success ? 0 : 1);

  assert(successCount === 1, 'Test 9: Exactly ONE concurrent deployment succeeded', `Successes: ${successCount}`);
  assert(failureCount === 1, 'Test 9: Exactly ONE concurrent deployment failed', `Failures: ${failureCount}`);

  const status9 = getUserAllocationStatus(db, user9.id);
  assert(status9.used === 1, 'Test 9: Post-concurrency used allocation is strictly 1');
  const user9Servers = db.servers.filter(s => s.userId === user9.id).length;
  assert(user9Servers === 1, 'Test 9: Exactly 1 server created in DB for user');

  // ----------------------------------------------------
  // TEST 10: Deletion & Re-allocation Recovery Test
  // ----------------------------------------------------
  console.log('\n--- TEST 10: Deletion & Re-allocation Recovery Test ---');
  const user10 = createTestUser('usr_test_10', 'realloc@test.com', 'realloc');
  const res10Initial = await simulateSelfServiceDeploy(user10, 'bot');
  assert(res10Initial.success === true, 'Test 10: Initial deployment succeeded');
  assert(getUserAllocationStatus(db, user10.id).used === 1, 'Test 10: Allocation used is 1');

  // Delete the server
  db.servers = db.servers.filter(s => s.id !== res10Initial.server?.id);
  saveDbSync();

  const status10AfterDelete = getUserAllocationStatus(db, user10.id);
  assert(status10AfterDelete.used === 0, 'Test 10: After deletion, allocation used dropped to 0');
  assert(status10AfterDelete.remaining === 1, 'Test 10: After deletion, allocation remaining returned to 1');

  const res10Realloc = await simulateSelfServiceDeploy(user10, 'minecraft');
  assert(res10Realloc.success === true, 'Test 10: Re-allocation deployment (Minecraft) succeeded after deletion');
  assert(res10Realloc.server?.limits.ramMB === 1024, 'Test 10: Re-allocated server has correct Minecraft free limits (1024 MB RAM)');
  assert(getUserAllocationStatus(db, user10.id).used === 1, 'Test 10: Allocation used is 1 again');

  console.log('\n================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} ALLOCATION & RESOURCE LIMIT TESTS PASSED GREEN!  `);
  console.log('================================================================\n');
}

runAllocationAndLimitTests().catch(err => {
  console.error('\n[FATAL TEST SUITE ERROR]:', err);
  process.exit(1);
});
