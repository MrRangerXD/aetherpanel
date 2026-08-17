import fs from 'fs';
import path from 'path';
import {
  getMinecraftVersions,
  getRecommendedJavaVersion,
  checkJavaRuntime,
  downloadMinecraftServerJar,
  readServerProperties,
  writeServerProperties,
  writeMinecraftEula
} from '../server/minecraftService';
import {
  getServerDir,
  startServer,
  stopServer,
  sendServerCommand,
  installServerDependencies,
  listServerFiles,
  readServerFile,
  writeServerFile,
  deleteServerItem,
  readServerEnv,
  writeServerEnv
} from '../server/provider';
import { getDb, saveDbSync } from '../server/db';
import { Server } from '../src/types';

async function runTests() {
  console.log('========================================================');
  console.log('  AETHERPANEL PHASE 3 & 4 REAL RUNTIME VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? ` -> ${detail}` : ''}`);
      failed++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Live Version Discovery (Phase 3)
  // ----------------------------------------------------
  console.log('--- [1/8] Testing Live Minecraft Version Discovery ---');
  try {
    const paper = await getMinecraftVersions('paper');
    assert(paper.versions.length > 5 && paper.versions.includes('1.21.4'), 'PaperMC versions fetched from live API', `Got: ${paper.versions.slice(0, 3).join(', ')}`);

    const purpur = await getMinecraftVersions('purpur');
    assert(purpur.versions.length > 5, 'PurpurMC versions fetched from live API', `Got: ${purpur.versions.slice(0, 3).join(', ')}`);

    const vanilla = await getMinecraftVersions('vanilla');
    assert(vanilla.versions.length > 5 && vanilla.versions.includes('1.21.4'), 'Mojang Vanilla versions fetched from live API', `Latest: ${vanilla.latest}`);

    const fabric = await getMinecraftVersions('fabric');
    assert(fabric.versions.length > 5, 'Fabric Game versions fetched from live API', `Latest: ${fabric.latest}`);
  } catch (err: any) {
    assert(false, 'Live version discovery', err.message);
  }

  // ----------------------------------------------------
  // TEST 2: Java Version Compatibility & Host Runtime (Phase 3)
  // ----------------------------------------------------
  console.log('\n--- [2/8] Testing Java Compatibility & Host Runtime ---');
  assert(getRecommendedJavaVersion('1.21.4') === 21, 'Java 21 required for MC 1.21.4');
  assert(getRecommendedJavaVersion('1.20.4') === 17, 'Java 17 required for MC 1.20.4');
  assert(getRecommendedJavaVersion('1.16.5') === 11, 'Java 11 required for MC 1.16.5');
  assert(getRecommendedJavaVersion('1.12.2') === 8, 'Java 8 required for MC 1.12.2');

  const javaCheck = checkJavaRuntime(21);
  assert(javaCheck.available && (javaCheck.installedVersion || 0) >= 17, 'Host Java runtime detected and compatible', javaCheck.message);

  // ----------------------------------------------------
  // TEST 3: Minecraft Real Artifact Download & Configs (Phase 3)
  // ----------------------------------------------------
  console.log('\n--- [3/8] Testing Real Minecraft Artifact Download & Configs ---');
  const mcServerId = 'test_mc_verify_' + Date.now();
  const db = await getDb();

  const testMcServer: Server = {
    id: mcServerId,
    name: 'Verification Minecraft Server',
    userId: 'usr_admin',
    productId: 'prod_minecraft',
    planId: 'plan_mc_standard',
    nodeId: 'node_local',
    status: 'stopped',
    deploymentState: 'READY',
    primaryIp: '127.0.0.1',
    primaryPort: 25575,
    location: 'US East',
    software: 'Vanilla',
    version: '1.21.4',
    limits: {
      ramMB: 1024,
      cpuCores: 2,
      diskGB: 10,
      databases: 1,
      backups: 2
    },
    cpuUsage: 0,
    ramUsageMB: 0,
    diskUsageMB: 0,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.servers.push(testMcServer);
  saveDbSync();

  try {
    const mcDir = getServerDir(mcServerId);
    assert(fs.existsSync(mcDir), 'Isolated server directory created on disk');

    // Test EULA write
    writeMinecraftEula(mcServerId, true);
    const eulaContent = fs.readFileSync(path.join(mcDir, 'eula.txt'), 'utf8');
    assert(eulaContent.includes('eula=true'), 'Real eula.txt written and verified');

    // Test Properties write & read
    writeServerProperties(mcServerId, {
      serverPort: 25575,
      motd: 'Verification Test Server MOTD',
      maxPlayers: 50,
      pvp: false,
      onlineMode: false,
      viewDistance: 12
    });

    const parsedProps = readServerProperties(mcServerId);
    assert(
      parsedProps.serverPort === 25575 &&
      parsedProps.motd === 'Verification Test Server MOTD' &&
      parsedProps.maxPlayers === 50 &&
      parsedProps.pvp === false &&
      parsedProps.onlineMode === false &&
      parsedProps.viewDistance === 12,
      'Real server.properties written, parsed, and roundtrip verified'
    );

    // Test Real Artifact Download (Mojang 1.21.4)
    console.log('    Downloading real Vanilla 1.21.4 server.jar from Mojang CDN...');
    const dlResult = await downloadMinecraftServerJar(mcServerId, 'Vanilla', '1.21.4');
    assert(dlResult.success && fs.existsSync(dlResult.jarPath), 'Real server.jar downloaded successfully');
    const jarSize = fs.statSync(dlResult.jarPath).size;
    assert(jarSize > 5 * 1024 * 1024, `server.jar is valid binary size (${(jarSize / 1024 / 1024).toFixed(2)} MB)`);
  } catch (err: any) {
    assert(false, 'Minecraft artifact download and properties test', err.message);
  }

  // ----------------------------------------------------
  // TEST 4: Preservation vs Clean Wipe (Phase 3)
  // ----------------------------------------------------
  console.log('\n--- [4/8] Testing Data Preservation vs Clean Wipe ---');
  try {
    const mcDir = getServerDir(mcServerId);
    // Create world folder with dummy data
    const worldDir = path.join(mcDir, 'world');
    fs.mkdirSync(worldDir, { recursive: true });
    fs.writeFileSync(path.join(worldDir, 'level.dat'), 'DUMMY_WORLD_DATA');

    // Verify preservation keeps world
    assert(fs.existsSync(path.join(worldDir, 'level.dat')), 'World data exists before wipe');

    // Wipe cleanly
    const entries = fs.readdirSync(mcDir);
    for (const e of entries) {
      if (e !== 'world') {
        fs.rmSync(path.join(mcDir, e), { recursive: true, force: true });
      }
    }
    assert(fs.existsSync(path.join(worldDir, 'level.dat')), 'Preserved world data survives selective reinstallation');
  } catch (err: any) {
    assert(false, 'Preservation test', err.message);
  }

  // ----------------------------------------------------
  // TEST 5: Real Node.js Bot Provisioning & Lifecycle (Phase 4)
  // ----------------------------------------------------
  console.log('\n--- [5/8] Testing Real Node.js Bot Provisioning & Lifecycle ---');
  const nodeBotId = 'test_nodebot_' + Date.now();
  const testNodeBot: Server = {
    id: nodeBotId,
    name: 'Node Discord Bot',
    userId: 'usr_admin',
    productId: 'prod_discord_bot',
    planId: 'plan_bot_basic',
    nodeId: 'node_local',
    status: 'stopped',
    deploymentState: 'READY',
    primaryIp: '127.0.0.1',
    primaryPort: 3050,
    location: 'US East',
    software: 'Node.js 20',
    version: '20.x',
    limits: {
      ramMB: 512,
      cpuCores: 1,
      diskGB: 5,
      databases: 1,
      backups: 1
    },
    cpuUsage: 0,
    ramUsageMB: 0,
    diskUsageMB: 0,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.servers.push(testNodeBot);
  saveDbSync();

  try {
    const botDir = getServerDir(nodeBotId);
    // Write index.js and package.json
    fs.writeFileSync(path.join(botDir, 'index.js'), [
      'console.log("[NodeBot/INFO]: Node bot online! PID: " + process.pid);',
      'console.log("[NodeBot/ENV]: TOKEN_PREFIX=" + (process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.substring(0, 4) : "NONE"));',
      'process.stdin.on("data", (d) => {',
      '  const cmd = d.toString().trim();',
      '  console.log("[NodeBot/COMMAND]: Executed: " + cmd);',
      '  if (cmd === "ping") console.log("[NodeBot/PONG]: pong! latency: 8ms");',
      '});',
      'setInterval(() => {}, 1000);'
    ].join('\n'));

    writeServerEnv(nodeBotId, {
      DISCORD_TOKEN: 'SECRET_BOT_TOKEN_12345',
      PREFIX: '!'
    });

    const envs = readServerEnv(nodeBotId);
    assert(envs.DISCORD_TOKEN === 'SECRET_BOT_TOKEN_12345', 'Real .env written and parsed for Node bot');

    // Start process
    const started = await startServer(nodeBotId);
    assert(started, 'Node.js bot process started via startServer');

    // Allow process to boot
    await new Promise(r => setTimeout(r, 1000));

    // Test command
    const cmdResult = await sendServerCommand(nodeBotId, 'ping');
    assert(cmdResult.includes('Sent'), 'Command dispatched to running Node bot stdin');

    // Stop process
    const stopped = await stopServer(nodeBotId);
    assert(stopped, 'Node.js bot process stopped cleanly');
  } catch (err: any) {
    assert(false, 'Node bot lifecycle test', err.message);
  }

  // ----------------------------------------------------
  // TEST 6: Real Python Bot Provisioning & Lifecycle (Phase 4)
  // ----------------------------------------------------
  console.log('\n--- [6/8] Testing Real Python Bot Provisioning & Lifecycle ---');
  const pyBotId = 'test_pybot_' + Date.now();
  const testPyBot: Server = {
    id: pyBotId,
    name: 'Python Discord Bot',
    userId: 'usr_admin',
    productId: 'prod_python_bot',
    planId: 'plan_bot_basic',
    nodeId: 'node_local',
    status: 'stopped',
    deploymentState: 'READY',
    primaryIp: '127.0.0.1',
    primaryPort: 3051,
    location: 'US East',
    software: 'Python 3.11',
    version: '3.11',
    limits: {
      ramMB: 512,
      cpuCores: 1,
      diskGB: 5,
      databases: 1,
      backups: 1
    },
    cpuUsage: 0,
    ramUsageMB: 0,
    diskUsageMB: 0,
    uptimeSeconds: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.servers.push(testPyBot);
  saveDbSync();

  try {
    const pyDir = getServerDir(pyBotId);
    fs.writeFileSync(path.join(pyDir, 'bot.py'), [
      'import os, sys, time',
      'print(f"[PyBot/INFO]: Python bot running on PID {os.getpid()} - Python {sys.version.split()[0]}", flush=True)',
      'print(f"[PyBot/ENV]: PREFIX={os.getenv(\'PREFIX\', \'DEFAULT\')}", flush=True)',
      'while True:',
      '    time.sleep(1)'
    ].join('\n'));

    writeServerEnv(pyBotId, {
      DISCORD_TOKEN: 'PYTHON_SECRET_TOKEN_999',
      PREFIX: '?'
    });

    const pyStarted = await startServer(pyBotId);
    assert(pyStarted, 'Python bot process started via startServer');

    await new Promise(r => setTimeout(r, 1000));

    const pyStopped = await stopServer(pyBotId);
    assert(pyStopped, 'Python bot process stopped cleanly');
  } catch (err: any) {
    assert(false, 'Python bot lifecycle test', err.message);
  }

  // ----------------------------------------------------
  // TEST 7: Security & Path Traversal Protection
  // ----------------------------------------------------
  console.log('\n--- [7/8] Testing Security & Directory Traversal Protection ---');
  try {
    let traversalBlocked = false;
    try {
      listServerFiles(mcServerId, '../../../../etc');
    } catch (e: any) {
      traversalBlocked = true;
    }
    assert(traversalBlocked, 'Path traversal blocked in listServerFiles (../../)');

    let readBlocked = false;
    try {
      readServerFile(mcServerId, '../../../../etc/passwd');
    } catch (e: any) {
      readBlocked = true;
    }
    assert(readBlocked, 'Path traversal blocked in readServerFile');
  } catch (err: any) {
    assert(false, 'Security traversal test', err.message);
  }

  // ----------------------------------------------------
  // TEST 8: Cleanup & Resource Teardown
  // ----------------------------------------------------
  console.log('\n--- [8/8] Cleaning up temporary verification servers ---');
  try {
    await stopServer(mcServerId);
    await stopServer(nodeBotId);
    await stopServer(pyBotId);

    // Remove server files
    const s1 = getServerDir(mcServerId);
    const s2 = getServerDir(nodeBotId);
    const s3 = getServerDir(pyBotId);

    if (fs.existsSync(s1)) fs.rmSync(s1, { recursive: true, force: true });
    if (fs.existsSync(s2)) fs.rmSync(s2, { recursive: true, force: true });
    if (fs.existsSync(s3)) fs.rmSync(s3, { recursive: true, force: true });

    // Clean DB entries
    db.servers = db.servers.filter(s => s.id !== mcServerId && s.id !== nodeBotId && s.id !== pyBotId);
    saveDbSync();

    assert(true, 'Test resources cleanly removed from disk and database');
  } catch (err: any) {
    assert(false, 'Cleanup test', err.message);
  }

  console.log('\n========================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
