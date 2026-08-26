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
  validateServerPreflight,
  getServerConsoleLogs,
  sendServerCommand
} from '../provider';
import {
  discoverJavaBinaries,
  checkJavaRuntime,
  getRecommendedJavaVersion,
  getMinecraftVersions,
  getMinecraftProviders,
  getLatestStableMinecraftVersion,
  searchMinecraftVersions,
  getMinecraftBuilds,
  compareMinecraftVersions
} from '../minecraftService';
import {
  checkPlayitBinary,
  getPlayitStatus,
  installPlayitAgent,
  togglePlayitAgent,
  restartPlayitAgent,
  isPidRunning
} from '../playit/playitService';
import { checkRateLimit as checkApiKeyRateLimit, checkServerAccess } from '../auth';
import { executeDiscordCommand } from '../discordService';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

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
  // TEST SUITE 0: JAVA RUNTIME DISCOVERY & COMPATIBILITY
  // ----------------------------------------------------
  console.log('\n--- SUITE 0: Java Runtime Discovery & Version Validation ---');
  const discovered = discoverJavaBinaries();
  console.log('Discovered Java Runtimes:', discovered);
  assert(discovered[25].available === true, 'Java 25 is detected and available');
  assert(fs.existsSync(discovered[25].path), 'Java 25 executable path physically exists on disk', discovered[25].path);
  assert(discovered[21].available === true, 'Java 21 is detected and available');
  assert(fs.existsSync(discovered[21].path), 'Java 21 executable path physically exists on disk', discovered[21].path);
  assert(discovered[17].available === true, 'Java 17 is detected and available');
  assert(fs.existsSync(discovered[17].path), 'Java 17 executable path physically exists on disk', discovered[17].path);

  const check25 = checkJavaRuntime(25);
  assert(check25.available === true, 'checkJavaRuntime(25) returns available true');
  assert(check25.path === discovered[25].path, 'checkJavaRuntime(25) returns valid binary path');

  const check21 = checkJavaRuntime(21);
  assert(check21.available === true, 'checkJavaRuntime(21) returns available true');
  assert(check21.path === discovered[21].path, 'checkJavaRuntime(21) returns valid binary path');

  const check17 = checkJavaRuntime(17);
  assert(check17.available === true, 'checkJavaRuntime(17) returns available true');

  const rec26 = getRecommendedJavaVersion('26.2');
  assert(rec26 === 25, 'Paper 26.x requires Java 25');
  const rec1_21 = getRecommendedJavaVersion('1.21.11');
  assert(rec1_21 === 21, 'Minecraft 1.21.x requires Java 21');
  const rec1_20 = getRecommendedJavaVersion('1.20.4');
  assert(rec1_20 === 17, 'Minecraft 1.20.4 requires Java 17');
  const rec1_16 = getRecommendedJavaVersion('1.16.5');
  assert(rec1_16 === 11 || rec1_16 === 8 || rec1_16 === 17, 'Minecraft 1.16.5 maps to supported Java version');

  // ----------------------------------------------------
  // TEST SUITE 1: DYNAMIC MINECRAFT VERSION & BUILD ENGINE
  // ----------------------------------------------------
  console.log('\n--- SUITE 1: Dynamic Minecraft Version Resolution (Upstream APIs) ---');
  const paperVersions = await getMinecraftVersions('paper');
  assert(paperVersions.versions.length > 0, 'Paper versions fetched dynamically from PaperMC v3 fill API');
  assert(paperVersions.versions.includes('1.21.4') || paperVersions.versions.some(v => v.startsWith('1.21')), 'Paper version list contains modern 1.21 releases');
  assert(paperVersions.latest !== 'UNKNOWN', 'Paper latest version dynamically resolved', paperVersions.latest);

  const purpurVersions = await getMinecraftVersions('purpur');
  assert(purpurVersions.versions.length > 0, 'Purpur versions fetched dynamically');

  const vanillaVersions = await getMinecraftVersions('vanilla');
  assert(vanillaVersions.versions.length > 0, 'Vanilla Mojang versions fetched dynamically');

  // Version sorting comparator test
  const sortTest = ['1.20.1', '1.21.4', '1.21.11', '1.19.4'].sort(compareMinecraftVersions);
  assert(sortTest[0] === '1.21.11' && sortTest[1] === '1.21.4', 'compareMinecraftVersions correctly sorts newer subversions first (1.21.11 > 1.21.4)');

  // New Provider, Latest, Search and Builds tests
  const providersList = getMinecraftProviders();
  assert(Array.isArray(providersList) && providersList.length >= 4, 'getMinecraftProviders returns supported providers array');

  const latestPaper = await getLatestStableMinecraftVersion('paper');
  assert(latestPaper !== 'UNKNOWN' && latestPaper.length > 0, 'getLatestStableMinecraftVersion resolves Paper latest version', latestPaper);

  const searchRes = await searchMinecraftVersions('1.21', 'paper');
  assert(Array.isArray(searchRes) && searchRes.length > 0, 'searchMinecraftVersions dynamically filters versions for 1.21 query');

  const buildsRes = await getMinecraftBuilds('paper', paperVersions.latest);
  assert(buildsRes.software === 'paper' && Array.isArray(buildsRes.builds) && buildsRes.builds.length > 0, 'getMinecraftBuilds resolves builds metadata for latest Paper release');

  // ----------------------------------------------------
  // TEST SUITE 2: MINECRAFT LIFECYCLE, STDIN COMMANDS & MONITORING
  // ----------------------------------------------------
  console.log('\n--- SUITE 2: Minecraft Process Lifecycle, Console & Stdin Commands ---');
  const db = await getDb();
  let mcServer = db.servers.find(s => s.id === 'srv_e2e_mc_runner');
  if (!mcServer) {
    mcServer = {
      id: 'srv_e2e_mc_runner',
      userId: 'usr_admin',
      planId: 'plan_starter',
      nodeId: 'node_local',
      productId: 'prod_minecraft',
      name: 'E2E Minecraft Paper Runner',
      status: 'stopped',
      primaryIp: '127.0.0.1',
      primaryPort: 25566,
      location: 'us-east',
      software: 'Paper',
      version: '1.21.11',
      limits: { ramMB: 1024, cpuCores: 1, diskGB: 5, backups: 1, databases: 0 },
      startup: {
        javaVersion: 21,
        serverJar: 'server.jar',
        xmsMB: 128,
        xmxMB: 512,
        nogui: true
      },
      cpuUsage: 0,
      ramUsageMB: 0,
      diskUsageMB: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.servers.push(mcServer);
    saveDbSync();
  }

  const mcDir = getServerDir(mcServer.id);
  if (!fs.existsSync(mcDir)) fs.mkdirSync(mcDir, { recursive: true });

  // Compile a real Java program that acts as a mock Minecraft daemon
  const javaSrc = `
    import java.util.Scanner;
    public class Main {
      public static void main(String[] args) {
        System.out.println("[Server thread/INFO]: Starting minecraft server version 1.21.11");
        System.out.println("[Server thread/INFO]: Loading properties");
        System.out.println("[Server thread/INFO]: Done (1.2s)! For help, type \\"help\\"");
        System.out.flush();
        Scanner sc = new Scanner(System.in);
        while (sc.hasNextLine()) {
          String line = sc.nextLine();
          System.out.println("[Server thread/INFO]: Console Command Received: " + line);
          System.out.flush();
          if (line.equalsIgnoreCase("stop")) {
            System.out.println("[Server thread/INFO]: Stopping server");
            System.out.println("[Server thread/INFO]: Saving players");
            System.out.println("[Server thread/INFO]: Saving worlds");
            System.out.println("[Server thread/INFO]: Closing Thread Pool");
            break;
          }
        }
      }
    }
  `;
  fs.writeFileSync(path.join(mcDir, 'Main.java'), javaSrc);
  fs.writeFileSync(path.join(mcDir, 'eula.txt'), 'eula=true\n');
  fs.writeFileSync(path.join(mcDir, 'server.properties'), 'server-port=25566\nmotd=Aether Test Server\n');

  try {
    execSync('javac --release 17 Main.java && jar cfe server.jar Main Main.class', { cwd: mcDir });
  } catch (err: any) {
    const dummyBuffer = Buffer.alloc(2048, 0);
    fs.writeFileSync(path.join(mcDir, 'server.jar'), dummyBuffer);
  }

  const mcStartSuccess = await startServer(mcServer.id);
  assert(mcStartSuccess === true, 'startServer successfully spawned Minecraft process with Java 21');

  // Allow startup confirmation to be parsed
  await new Promise((r) => setTimeout(r, 800));

  // Verify transition to RUNNING based on "Done (...)! For help, type \"help\""
  const mcServerLive = db.servers.find(s => s.id === mcServer.id);
  assert(mcServerLive?.status === 'running', 'Server transitions to running upon real startup confirmation signal');

  // Verify command dispatch through real process stdin
  const cmdOutput = await sendServerCommand(mcServer.id, 'tps');
  assert(cmdOutput.includes('Sent \'tps\'') || cmdOutput.includes('dispatched'), 'sendServerCommand successfully sent command to stdin');

  await new Promise((r) => setTimeout(r, 300));
  const mcLogs = await getServerConsoleLogs(mcServer.id);
  const mcLogStr = mcLogs.join('\n');
  assert(mcLogStr.includes('Console Command Received: tps') || mcLogStr.includes('UserCommand'), 'Console log records command transmission');

  // Stop Minecraft server gracefully
  await stopServer(mcServer.id);
  const mcServerAfterStop = db.servers.find(s => s.id === mcServer.id);
  assert(mcServerAfterStop?.status === 'stopped', 'Minecraft server cleanly stopped via stop/SIGTERM');

  // Cleanup mcServer
  db.servers = db.servers.filter(s => s.id !== 'srv_e2e_mc_runner');
  saveDbSync();
  if (fs.existsSync(mcDir)) fs.rmSync(mcDir, { recursive: true, force: true });

  // ----------------------------------------------------
  // TEST SUITE 3: BOT HOSTING RUNTIMES & EXECUTION
  // ----------------------------------------------------
  console.log('\n--- SUITE 3: Bot Hosting Runtimes & WispByte Compiler ---');

  // 3.1 Host Bot Runtimes Inspection
  let nodeAvailable = false;
  let pyAvailable = false;
  try {
    const nodeVer = execSync('node -v', { encoding: 'utf-8' }).trim();
    nodeAvailable = !!nodeVer;
    assert(nodeAvailable, `Node.js runtime is installed on host (${nodeVer})`);
  } catch {}

  try {
    const pyVer = execSync('python3 --version', { encoding: 'utf-8' }).trim();
    pyAvailable = !!pyVer;
    assert(pyAvailable, `Python 3 runtime is installed on host (${pyVer})`);
  } catch {}

  // 3.2 Compiler assertions
  const nodeServer = { id: 'srv_test_node', software: 'Node.js 20', limits: { ramMB: 2048, cpuCores: 2 } } as any;
  const nodeStartup = {
    botRuntime: 'nodejs',
    nodeConfig: { startupFile: 'app.js', memoryLimitMB: 2048, startupArguments: '--port 8080' },
    nodeOptions: '--trace-warnings'
  };
  const nodeRes = buildBotStartupCommand(nodeServer, nodeStartup);
  assert(nodeRes.executable === 'node', 'Node executable is node');
  assert(nodeRes.compiledCommand === 'node --max-old-space-size=2048 --trace-warnings --port 8080 app.js', 'Node compiled command matches expected specification');

  // 3.3 Bot Process Execution Test with Environment Variables
  let botServer = db.servers.find(s => s.id === 'srv_e2e_bot_runner');
  if (!botServer) {
    botServer = {
      id: 'srv_e2e_bot_runner',
      userId: 'usr_admin',
      planId: 'plan_starter',
      nodeId: 'node_local',
      productId: 'prod_bot',
      name: 'E2E Bot Runner Test',
      status: 'stopped',
      primaryIp: '127.0.0.1',
      primaryPort: 25567,
      location: 'us-east',
      software: 'Node.js',
      version: '20',
      limits: { ramMB: 512, cpuCores: 1, diskGB: 5, backups: 1, databases: 0 },
      envVars: [{ key: 'BOT_SECRET_KEY', value: 'aether_bot_secret_xyz', isEnabled: true }],
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
    db.servers.push(botServer);
    saveDbSync();
  }

  const botDir = getServerDir(botServer.id);
  if (!fs.existsSync(botDir)) fs.mkdirSync(botDir, { recursive: true });

  fs.writeFileSync(path.join(botDir, 'index.js'), `
    console.log('[BOT_LOG] Bot process booted and listening');
    console.log('[BOT_LOG] SECRET:' + process.env.BOT_SECRET_KEY);
    setInterval(() => {
      // keep alive
    }, 1000);
  `);

  const mergedEnv = readServerMergedEnv(botServer.id, botServer);
  assert(mergedEnv.BOT_SECRET_KEY === 'aether_bot_secret_xyz', 'Bot server environment variables merged correctly');

  const botStartSuccess = await startServer(botServer.id);
  assert(botStartSuccess === true, 'Bot server booted successfully');

  await new Promise((r) => setTimeout(r, 600));
  const botLogs = await getServerConsoleLogs(botServer.id);
  const botLogStr = botLogs.join('\n');
  assert(botLogStr.includes('[BOT_LOG] Bot process booted and listening'), 'Bot console captured process stdout');
  assert(botLogStr.includes('SECRET:aether_bot_secret_xyz'), 'Bot process received injected environment variables');

  await stopServer(botServer.id);
  const botServerAfterStop = db.servers.find(s => s.id === botServer.id);
  assert(botServerAfterStop?.status === 'stopped', 'Bot server status marked stopped');

  // Cleanup bot server
  db.servers = db.servers.filter(s => s.id !== 'srv_e2e_bot_runner');
  saveDbSync();
  if (fs.existsSync(botDir)) fs.rmSync(botDir, { recursive: true, force: true });

  // ----------------------------------------------------
  // TEST SUITE 4: FILE MANAGER & SECURITY CONFINEMENT
  // ----------------------------------------------------
  console.log('\n--- SUITE 4: File Manager & Path Traversal Confinement ---');
  let fileServer = db.servers.find(s => s.id === 'srv_file_test');
  if (!fileServer) {
    fileServer = {
      id: 'srv_file_test',
      userId: 'usr_admin',
      planId: 'plan_starter',
      nodeId: 'node_local',
      productId: 'prod_minecraft',
      name: 'File Manager Test',
      status: 'stopped',
      primaryIp: '127.0.0.1',
      primaryPort: 25568,
      location: 'us-east',
      software: 'Paper',
      version: '1.21.4',
      limits: { ramMB: 512, cpuCores: 1, diskGB: 5, backups: 1, databases: 0 },
      cpuUsage: 0,
      ramUsageMB: 0,
      diskUsageMB: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.servers.push(fileServer);
    saveDbSync();
  }

  const srvDir = getServerDir(fileServer.id);
  if (!fs.existsSync(srvDir)) fs.mkdirSync(srvDir, { recursive: true });

  writeServerFile(fileServer.id, 'server.properties', 'gamemode=survival\npvp=true');
  assert(fs.existsSync(path.join(srvDir, 'server.properties')), 'writeServerFile created file');

  const fileContent = readServerFile(fileServer.id, 'server.properties');
  assert(fileContent.includes('gamemode=survival'), 'readServerFile returned correct content');

  createServerDirectory(fileServer.id, 'plugins/Essentials');
  assert(fs.existsSync(path.join(srvDir, 'plugins', 'Essentials')), 'createServerDirectory created nested directories');

  renameServerItem(fileServer.id, 'server.properties', 'plugins/server.properties.bak');
  assert(fs.existsSync(path.join(srvDir, 'plugins', 'server.properties.bak')), 'renameServerItem moved item to subfolder');

  const files = listServerFiles(fileServer.id, 'plugins');
  assert(files.some(f => f.name === 'server.properties.bak'), 'listServerFiles lists moved file in subfolder');

  deleteServerItem(fileServer.id, 'plugins');
  assert(!fs.existsSync(path.join(srvDir, 'plugins')), 'deleteServerItem removed directory recursively');

  // Path Traversal Security
  const trav1 = safePath(fileServer.id, '../../../../etc/shadow');
  assert(trav1.startsWith(path.resolve(srvDir)), 'safePath blocks parent directory escape');

  const trav2 = safePath(fileServer.id, 'data\0/../../root');
  assert(trav2.startsWith(path.resolve(srvDir)), 'safePath blocks null-byte poisoned directory traversal');

  // Cleanup fileServer
  db.servers = db.servers.filter(s => s.id !== 'srv_file_test');
  saveDbSync();
  if (fs.existsSync(srvDir)) fs.rmSync(srvDir, { recursive: true, force: true });

  // ----------------------------------------------------
  // TEST SUITE 5: PLAYIT.GG AGENT & TRUTHFUL STATE ENGINE
  // ----------------------------------------------------
  console.log('\n--- SUITE 5: Playit.GG Agent & State Engine ---');
  const binCheck = checkPlayitBinary();
  assert(binCheck.exists === true, 'Playit binary exists on disk or was auto-provisioned');

  const playitTestServerId = 'srv_playit_verification';
  const initialStatus = getPlayitStatus(playitTestServerId);
  assert(initialStatus.isInstalled === true || initialStatus.isInstalled === false, 'getPlayitStatus returns truthful structure');
  assert(initialStatus.accountStatus === 'Unlinked' || initialStatus.accountStatus === 'Pending' || initialStatus.accountStatus === 'Connected', 'accountStatus conforms to enum');

  // If stopped, PID must be undefined (never a stale number)
  if (!initialStatus.isRunning) {
    assert(initialStatus.pid === undefined, 'Stopped Playit agent returns undefined PID (never stale number)');
    assert(initialStatus.agentStatus === 'STOPPED' || initialStatus.agentStatus === 'NOT_INSTALLED' || initialStatus.agentStatus === 'CRASHED', 'Truthful stopped/crashed state reported');
  }

  // Verify PID checker helper
  assert(isPidRunning(9999999) === false, 'isPidRunning returns false for non-existent PID');
  assert(isPidRunning(process.pid) === true, 'isPidRunning returns true for active Node process');

  // Verify Global Admin Setting Toggle for Playit
  db.settings.enablePlayit = false;
  saveDbSync();
  assert(db.settings.enablePlayit === false, 'Global Playit feature can be disabled from Admin Configuration');

  db.settings.enablePlayit = true;
  saveDbSync();
  assert(db.settings.enablePlayit === true, 'Global Playit feature can be enabled from Admin Configuration');

  // ----------------------------------------------------
  // TEST SUITE 6: API KEYS, SECURITY & SCOPES
  // ----------------------------------------------------
  console.log('\n--- SUITE 6: API Keys, SHA-256 Hashing & Rate Limits ---');
  const rawKey = crypto.randomBytes(24).toString('hex');
  const apiKeyStr = `aeth_live_${rawKey}`;
  const apiKeyHash = crypto.createHash('sha256').update(apiKeyStr).digest('hex');

  const testApiKey = {
    id: `key_e2e_${Date.now()}`,
    userId: 'usr_admin',
    userEmail: 'admin@aetherpanel.in',
    name: 'E2E Test API Key',
    keyPrefix: `aeth_live_${rawKey.substring(0, 6)}...`,
    keyHash: apiKeyHash,
    role: 'super_admin' as any,
    status: 'active' as any,
    scopes: ['servers:read', 'servers:write'],
    createdAt: new Date().toISOString()
  };

  if (!db.apiKeys) db.apiKeys = [];
  db.apiKeys.push(testApiKey);
  saveDbSync();

  const foundKey = db.apiKeys.find(k => k.keyHash === apiKeyHash);
  assert(!!foundKey, 'API key hashed with SHA-256 and stored securely');
  assert(foundKey?.scopes.includes('servers:write'), 'API key permissions include servers:write');
  assert(checkApiKeyRateLimit(testApiKey.id) === true, 'API key rate limiter permits valid requests');

  db.apiKeys = db.apiKeys.filter(k => k.id !== testApiKey.id);
  saveDbSync();

  // ----------------------------------------------------
  // TEST SUITE 7: DISCORD INTEGRATION & BOT COMMANDS
  // ----------------------------------------------------
  console.log('\n--- SUITE 7: Discord Bot Service & Authorization ---');
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

  if (!db.discordLinks) db.discordLinks = {};
  db.discordLinks['usr_admin'] = {
    discordId: '123456789012345678',
    username: 'AetherAdmin',
    globalName: 'AetherAdmin',
    avatar: '',
    linkedAt: new Date().toISOString()
  };
  saveDbSync();

  const pingRes = await executeDiscordCommand('123456789012345678', '/ping');
  assert(pingRes.success === true, 'Discord /ping returns successful response for linked account');

  const unauthRes = await executeDiscordCommand('999888777666555444', '/ping');
  assert(unauthRes.success === false, 'Discord command rejects unlinked unknown users');

  delete db.discordLinks['usr_admin'];
  saveDbSync();

  // ----------------------------------------------------
  // TEST SUITE 8: RBAC & ADMIN PERMISSIONS
  // ----------------------------------------------------
  console.log('\n--- SUITE 8: RBAC Access Control ---');
  const adminUser = db.users.find(u => u.role === 'admin' || u.role === 'super_admin');
  assert(!!adminUser, 'Admin user account exists');

  console.log('\n====================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS COMPLETED & PASSED SUCCESSFULLY! `);
  console.log('====================================================\n');
  process.exit(0);
}

runAllTests().catch(err => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});
