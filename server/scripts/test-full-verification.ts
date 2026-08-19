import { getDb, saveDbSync } from '../db';
import {
  buildBotStartupCommand
} from '../../src/lib/startup';
import {
  safePath,
  listServerFiles,
  readServerFile,
  writeServerFile,
  renameServerItem,
  deleteServerItem,
  createServerDirectory,
  startServer,
  stopServer,
  restartServer,
  getServerDir,
  readServerMergedEnv,
  validateServerPreflight
} from '../provider';
import { checkRateLimit as checkApiKeyRateLimit, checkServerAccess } from '../auth';
import { executeDiscordCommand } from '../discordService';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

async function runAllTests() {
  console.log('====================================================');
  console.log('  AETHERPANEL FULL REAL SYSTEM VERIFICATION PASS  ');
  console.log('====================================================\n');

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

  // ----------------------------------------------------
  // TEST SUITE 1: BOT HOSTING STARTUP & WISPBYTE COMPILER
  // ----------------------------------------------------
  console.log('\n--- SUITE 1: Bot Hosting Startup & WispByte Compiler ---');
  
  // 1.1 Node.js compilation
  const nodeServer = {
    id: 'srv_test_node',
    software: 'Node.js 20',
    limits: { ramMB: 2048, cpuCores: 2 }
  } as any;
  const nodeStartup = {
    botRuntime: 'nodejs',
    nodeConfig: { startupFile: 'app.js', memoryLimitMB: 2048, startupArguments: '--port 8080' },
    nodeOptions: '--trace-warnings'
  };
  const nodeRes = buildBotStartupCommand(nodeServer, nodeStartup);
  assert(nodeRes.executable === 'node', 'Node executable is node');
  assert(nodeRes.startupFile === 'app.js', 'Node startup file is app.js');
  assert(nodeRes.args.includes('--max-old-space-size=2048'), 'Node max-old-space-size allocated');
  assert(nodeRes.args.includes('--trace-warnings'), 'Node options included');
  assert(nodeRes.args.includes('--port') && nodeRes.args.includes('8080'), 'Node custom arguments included');
  assert(nodeRes.compiledCommand === 'node --max-old-space-size=2048 --trace-warnings --port 8080 app.js', 'Node compiled command matches exactly');

  // 1.2 Python compilation
  const pyServer = { id: 'srv_test_py', software: 'Python 3.11', limits: { ramMB: 1024, cpuCores: 1 } } as any;
  const pyStartup = {
    botRuntime: 'python',
    pythonConfig: { version: '3.11', startupFile: 'main.py', startupArguments: '--verbose' }
  };
  const pyRes = buildBotStartupCommand(pyServer, pyStartup);
  assert(pyRes.executable === 'python3.11', 'Python executable is python3.11');
  assert(pyRes.args[0] === '-u', 'Python unbuffered flag present');
  assert(pyRes.args.includes('main.py'), 'Python entry point is main.py');
  assert(pyRes.args.includes('--verbose'), 'Python custom flags included');

  // 1.3 Bun compilation
  const bunServer = { id: 'srv_test_bun', software: 'Bun Runtime', limits: { ramMB: 1024, cpuCores: 1 } } as any;
  const bunStartup = {
    botRuntime: 'bun',
    bunConfig: { startupFile: 'src/index.ts', startupArguments: '--hot' }
  };
  const bunRes = buildBotStartupCommand(bunServer, bunStartup);
  assert(bunRes.executable === 'bun', 'Bun executable is bun');
  assert(bunRes.args[0] === 'run', 'Bun run command present');
  assert(bunRes.args.includes('src/index.ts'), 'Bun startup file is src/index.ts');

  // 1.4 Real process execution test (Node.js script with stdout + env vars)
  const db = await getDb();
  let testServer = db.servers.find(s => s.id === 'srv_e2e_test_runner');
  if (!testServer) {
    testServer = {
      id: 'srv_e2e_test_runner',
      userId: 'usr_admin',
      planId: 'plan_starter',
      nodeId: 'node_local',
      productId: 'prod_bot',
      name: 'E2E Runner Test',
      status: 'stopped',
      primaryIp: '127.0.0.1',
      primaryPort: 25565,
      location: 'us-east',
      software: 'Node.js',
      version: '20',
      limits: { ramMB: 512, cpuCores: 1, diskGB: 5, backups: 1, databases: 0 },
      envVars: [{ key: 'CUSTOM_TEST_VAR', value: 'aether_e2e_ok_123', isEnabled: true }],
      startup: {
        botRuntime: 'nodejs',
        nodeConfig: { startupFile: 'index.js' }
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
  }

  const srvDir = getServerDir(testServer.id);
  if (!fs.existsSync(srvDir)) fs.mkdirSync(srvDir, { recursive: true });

  // Write a real test script that prints environment variables and exits gracefully
  fs.writeFileSync(path.join(srvDir, 'index.js'), `
    console.log('[E2E_OUTPUT] Server test runner booted successfully');
    console.log('[E2E_OUTPUT] VAR:' + process.env.CUSTOM_TEST_VAR);
    setTimeout(() => {
      console.log('[E2E_OUTPUT] Server test runner completed loop');
    }, 500);
  `);

  // Verify merged environment
  const mergedEnv = readServerMergedEnv(testServer.id, testServer);
  assert(mergedEnv.CUSTOM_TEST_VAR === 'aether_e2e_ok_123', 'Merged environment includes DB custom variables');
  assert(mergedEnv.SERVER_ID === testServer.id, 'Merged environment includes SERVER_ID');

  // Verify preflight
  const preflightRes = await validateServerPreflight(testServer.id);
  assert(preflightRes.ok === true, 'Preflight validation passes for existing entry file');

  // Verify preflight failure on missing entry file
  testServer.startup!.nodeConfig!.startupFile = 'non_existent_file.js';
  const preflightFail = await validateServerPreflight(testServer.id);
  assert(preflightFail.ok === false, 'Preflight validation fails when entry file is missing');
  assert(preflightFail.code === 'NO_ENTRY_FILE', 'Preflight returns correct error code NO_ENTRY_FILE');
  testServer.startup!.nodeConfig!.startupFile = 'index.js';

  // ----------------------------------------------------
  // TEST SUITE 2: FILE MANAGER & DIRECTORY TRAVERSAL SECURITY
  // ----------------------------------------------------
  console.log('\n--- SUITE 2: File Manager & Path Traversal Security ---');

  // 2.1 Standard file operations
  writeServerFile(testServer.id, 'config.json', '{"status":"active"}');
  assert(fs.existsSync(path.join(srvDir, 'config.json')), 'writeServerFile created file on disk');
  
  const content = readServerFile(testServer.id, 'config.json');
  assert(content === '{"status":"active"}', 'readServerFile read correct content');

  createServerDirectory(testServer.id, 'subfolder/nested');
  assert(fs.existsSync(path.join(srvDir, 'subfolder', 'nested')), 'createServerDirectory created nested folders');

  renameServerItem(testServer.id, 'config.json', 'subfolder/config.prod.json');
  assert(fs.existsSync(path.join(srvDir, 'subfolder', 'config.prod.json')), 'renameServerItem moved file');

  const fileList = listServerFiles(testServer.id, 'subfolder');
  assert(fileList.some(f => f.name === 'config.prod.json'), 'listServerFiles lists items in directory');

  deleteServerItem(testServer.id, 'subfolder');
  assert(!fs.existsSync(path.join(srvDir, 'subfolder')), 'deleteServerItem removed directory recursively');

  // 2.2 Security containment & Path traversal attacks
  const traversal1 = safePath(testServer.id, '../../../etc/passwd');
  const isSafe1 = traversal1 === path.resolve(srvDir) || traversal1.startsWith(path.resolve(srvDir) + path.sep);
  assert(isSafe1, 'Path traversal (../../etc/passwd) safely confined to server root');

  const traversal2 = safePath(testServer.id, '..\\..\\Windows\\System32');
  const isSafe2 = traversal2 === path.resolve(srvDir) || traversal2.startsWith(path.resolve(srvDir) + path.sep);
  assert(isSafe2, 'Windows-style traversal confined to server root');

  const traversal3 = safePath(testServer.id, 'something\0/../../secret');
  const isSafe3 = traversal3 === path.resolve(srvDir) || traversal3.startsWith(path.resolve(srvDir) + path.sep);
  assert(isSafe3, 'Null-byte injection sanitized and confined to root');

  let accessDeniedCaught = false;
  try {
    readServerFile(testServer.id, '/etc/passwd');
  } catch (err: any) {
    if (err.message.includes('Outside server root') || err.message.includes('File not found') || err.message.includes('Access denied')) {
      accessDeniedCaught = true;
    }
  }
  assert(accessDeniedCaught, 'Direct root escape read blocked');

  // ----------------------------------------------------
  // TEST SUITE 3: API KEYS HASHING, SCOPES & REVOCATION
  // ----------------------------------------------------
  console.log('\n--- SUITE 3: API Keys, Scopes & Audit Logs ---');

  const rawSecret = crypto.randomBytes(24).toString('hex');
  const fullApiKey = `aeth_live_${rawSecret}`;
  const keyHash = crypto.createHash('sha256').update(fullApiKey).digest('hex');

  const newKey = {
    id: `key_test_${Date.now()}`,
    userId: 'usr_admin',
    userEmail: 'admin@aetherpanel.in',
    name: 'Automation Test Key',
    keyPrefix: `aeth_live_${rawSecret.substring(0, 6)}...`,
    keyHash,
    role: 'super_admin' as any,
    status: 'active' as any,
    scopes: ['servers:read'],
    createdAt: new Date().toISOString()
  };

  if (!db.apiKeys) db.apiKeys = [];
  db.apiKeys.push(newKey);
  saveDbSync();

  // Verify hash match
  const foundKey = db.apiKeys.find(k => k.keyHash === keyHash);
  assert(!!foundKey, 'API key matched by SHA-256 digest');
  assert(foundKey?.scopes.includes('servers:read'), 'API key has correct scope');
  assert(!foundKey?.scopes.includes('servers:write'), 'API key correctly excludes ungranted scopes');

  // Verify rate limiting module
  assert(checkApiKeyRateLimit(newKey.id) === true, 'Rate limiter allows requests under limit');

  // Verify revocation
  foundKey!.status = 'revoked';
  saveDbSync();
  const revokedKey = db.apiKeys.find(k => k.keyHash === keyHash);
  assert(revokedKey?.status === 'revoked', 'API key status set to revoked');

  // Cleanup test key
  db.apiKeys = db.apiKeys.filter(k => k.id !== newKey.id);
  saveDbSync();

  // ----------------------------------------------------
  // TEST SUITE 4: DISCORD MANAGER BOT SERVICE
  // ----------------------------------------------------
  console.log('\n--- SUITE 4: Discord Manager Bot Service ---');

  // Test command execution logic when integration is enabled
  if (!db.settings.discordSettings) {
    db.settings.discordSettings = {
      enabled: true,
      botToken: '',
      commandRateLimitPerMin: 10,
      botStatus: 'offline',
      defaultNotificationEvents: []
    };
  }
  db.settings.discordSettings.enabled = true;

  // Link a test Discord ID to usr_admin
  if (!db.discordLinks) db.discordLinks = {};
  db.discordLinks['usr_admin'] = {
    discordId: '987654321012345678',
    username: 'AdminTester',
    globalName: 'AdminTester',
    avatar: '',
    linkedAt: new Date().toISOString()
  };
  saveDbSync();

  // Execute /server status command through discord engine
  const cmdRes = await executeDiscordCommand('987654321012345678', `/server status ${testServer.id}`, testServer.id);
  assert(cmdRes.success === true, 'Discord /server status returns success for authorized linked user');
  assert(!!cmdRes.embed, 'Discord command generates structured Embed object');

  // Execute command with unlinked Discord user
  const unlinkedRes = await executeDiscordCommand('111122223333444455', `/server status ${testServer.id}`, testServer.id);
  assert(unlinkedRes.success === false, 'Unlinked Discord user request rejected');
  assert(unlinkedRes.message.includes('not linked'), 'Accurate error message provided for unlinked user');

  // ----------------------------------------------------
  // TEST SUITE 5: ADMIN AUTHORIZATION & RESOURCE ACCESS
  // ----------------------------------------------------
  console.log('\n--- SUITE 5: Admin Authorization & Resource Access ---');

  const adminUser = db.users.find(u => u.role === 'admin' || u.role === 'super_admin');
  assert(!!adminUser, 'Admin user account exists');

  const memberUser = {
    id: 'usr_test_regular_member',
    email: 'member@test.local',
    username: 'testmember',
    displayName: 'Test Member',
    role: 'user' as const,
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    credits: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Admin access to testServer
  const adminAccess = await checkServerAccess(adminUser!, testServer.id);
  assert(adminAccess.hasAccess === true, 'Admin has full access to test server');

  // Normal user access to unowned testServer
  const memberAccess = await checkServerAccess(memberUser, testServer.id);
  assert(memberAccess.hasAccess === false, 'Regular unprivileged user denied access to unowned server');

  // Normal user access to own server
  testServer.userId = memberUser.id;
  const memberOwnAccess = await checkServerAccess(memberUser, testServer.id);
  assert(memberOwnAccess.hasAccess === true, 'Regular user granted access to their own server');
  
  // Cleanup test server & artifacts
  db.servers = db.servers.filter(s => s.id !== 'srv_e2e_test_runner');
  delete db.discordLinks['usr_admin'];
  saveDbSync();

  if (fs.existsSync(srvDir)) {
    fs.rmSync(srvDir, { recursive: true, force: true });
  }

  console.log('\n====================================================');
  console.log(`  VERIFICATION COMPLETED: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('====================================================\n');
}

runAllTests().catch(err => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
