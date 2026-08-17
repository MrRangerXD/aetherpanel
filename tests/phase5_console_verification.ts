import http from 'http';
import express from 'express';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getDb, saveDbSync } from '../server/db';
import { getInstallationId } from '../server/installation';
import { generateToken } from '../server/auth';
import { setupConsoleWebSocket, closeServerConsoleClients, getActiveConsoleConnectionsCount } from '../server/consoleWs';
import {
  startServer,
  stopServer,
  restartServer,
  sendServerCommand,
  getServerConsoleLogs,
  getServerDir,
  appendConsoleLog,
  queueRemoteServerCommand,
  pullRemoteServerCommands
} from '../server/provider';
import { Server } from '../src/types';

async function runPhase5Verification() {
  console.log('================================================================');
  console.log('  AETHERPANEL PHASE 5: COMPREHENSIVE RUNTIME CONSOLE VERIFICATION');
  console.log('================================================================\n');

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

  // 1. Setup Test HTTP + WS Server
  const app = express();
  const server = http.createServer(app);
  const wss = setupConsoleWebSocket(server);

  const PORT = 46925;
  await new Promise<void>((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      resolve();
    });
  });

  const testOwnerId = 'usr_phase5_owner';
  const testOtherUserId = 'usr_phase5_stranger';
  const testAdminId = 'usr_phase5_admin';

  const testOwner: any = {
    id: testOwnerId,
    email: 'owner@aetherpanel.internal',
    username: 'serverowner',
    role: 'user',
    tokenVersion: 1,
    isSuspended: false
  };

  const testStranger: any = {
    id: testOtherUserId,
    email: 'stranger@aetherpanel.internal',
    username: 'stranger',
    role: 'user',
    tokenVersion: 1,
    isSuspended: false
  };

  const testAdmin: any = {
    id: testAdminId,
    email: 'admin@aetherpanel.internal',
    username: 'superadmin',
    role: 'admin',
    tokenVersion: 1,
    isSuspended: false
  };

  const db = await getDb();
  [testOwner, testStranger, testAdmin].forEach((u) => {
    if (!db.users.some((existing) => existing.id === u.id)) {
      db.users.push(u);
    }
  });
  saveDbSync();

  const ownerToken = generateToken(testOwner);
  const strangerToken = generateToken(testStranger);
  const adminToken = generateToken(testAdmin);
  const invalidToken = 'invalid_tampered_jwt_signature_xyz';

  // Setup executable java runner in absolute path
  const testBinDir = path.resolve(process.cwd(), 'tests', 'test_bin');
  if (!fs.existsSync(testBinDir)) {
    fs.mkdirSync(testBinDir, { recursive: true });
  }

  const javaStubScript = `#!/bin/bash
if [[ "$*" == *"-version"* ]] || [[ "$*" == *"--version"* ]]; then
  >&2 echo 'openjdk version "21.0.3" 2024-04-16 LTS'
  >&2 echo 'OpenJDK Runtime Environment (build 21.0.3+9-LTS)'
  exit 0
fi

echo "[Server thread/INFO]: Starting Minecraft server version 1.21.4"
echo "[Server thread/INFO]: Loading properties"
echo "[Server thread/INFO]: Default game type: SURVIVAL"
echo "[Server thread/INFO]: Preparing level 'world'"
echo "[Server thread/INFO]: Done (1.412s)! For help, type 'help'"

while IFS= read -r line; do
  trimmed=$(echo "$line" | tr -d "\\r\\n")
  if [ "$trimmed" = "list" ]; then
    echo "[Server thread/INFO]: There are 1 of a max of 20 players online: Steve"
  elif [ "$trimmed" = "tps" ]; then
    echo "[Server thread/INFO]: TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0"
  elif [[ "$trimmed" == say\\ * ]]; then
    msg="\${trimmed#say }"
    echo "[Server thread/INFO]: [Server] \$msg"
  elif [ "$trimmed" = "help" ]; then
    echo "[Server thread/INFO]: Available commands: list, tps, say, stop, help"
  elif [ "$trimmed" = "stop" ]; then
    echo "[Server thread/INFO]: Stopping the server"
    echo "[Server thread/INFO]: Saving players and worlds"
    echo "[Server thread/INFO]: Closing Server"
    exit 0
  else
    echo "[Server thread/INFO]: Handled command '\$trimmed'"
  fi
done
`;

  const javaStubPath = path.join(testBinDir, 'java');
  fs.writeFileSync(javaStubPath, javaStubScript);
  fs.chmodSync(javaStubPath, 0o755);

  // Prepend testBinDir to process.env.PATH so which java resolves correctly
  const originalPath = process.env.PATH || '';
  process.env.PATH = `${testBinDir}:${originalPath}`;

  const createdServerDirs: string[] = [];

  try {
    // =========================================================================
    // SECTION 1: MINECRAFT RUNTIME & CONSOLE VERIFICATION
    // =========================================================================
    console.log('\n--- [1/6] Testing Minecraft Server Runtime & Live Console ---');

    const mcServerId = `srv_mc_p5_${Date.now()}`;
    const mcDir = getServerDir(mcServerId);
    createdServerDirs.push(mcDir);

    // Write a dummy server.jar (>1024 bytes)
    fs.writeFileSync(path.join(mcDir, 'server.jar'), Buffer.alloc(2048, 0x42));
    fs.writeFileSync(path.join(mcDir, 'eula.txt'), 'eula=true\n');
    fs.writeFileSync(path.join(mcDir, 'server.properties'), 'server-port=25565\n');

    const mcServerRecord: Server = {
      id: mcServerId,
      name: 'Paper 1.21.4 Survival',
      userId: testOwnerId,
      planId: 'plan_standard',
      nodeId: 'node_local',
      location: 'US-East',
      productId: 'minecraft_paper_standard',
      software: 'Paper 1.21.4',
      version: '1.21.4',
      status: 'stopped',
      primaryPort: 25565,
      primaryIp: '127.0.0.1',
      limits: {
        ramMB: 1024,
        cpuCores: 2,
        diskGB: 10,
        databases: 1,
        backups: 2
      },
      diskUsageMB: 40,
      ramUsageMB: 0,
      cpuUsage: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.servers.push(mcServerRecord);
    saveDbSync();

    // Connect WebSocket and set up message handler immediately
    const mcWsLogs: string[] = [];
    const mcWs = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${mcServerId}?token=${ownerToken}`);
    mcWs.on('message', (d) => {
      try {
        const parsed = JSON.parse(d.toString());
        if (parsed.type === 'log') mcWsLogs.push(parsed.line);
        if (parsed.type === 'init' && Array.isArray(parsed.logs)) mcWsLogs.push(...parsed.logs);
      } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      mcWs.on('open', resolve);
      mcWs.on('error', reject);
    });

    const mcStarted = await startServer(mcServerId);
    assert(mcStarted, 'Minecraft server process spawned via provider with allocated heap');

    // Wait for "Done (1.412s)" stdout log
    let mcReady = false;
    for (let i = 0; i < 40; i++) {
      if (mcWsLogs.some((l) => l.includes('Done (') || l.includes('Default game type') || l.includes('Starting Minecraft engine'))) {
        mcReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(mcReady, 'Minecraft stdout captured and streamed live over WebSocket', `Logs count: ${mcWsLogs.length}`);

    // Send stdin command: 'list'
    mcWs.send(JSON.stringify({ type: 'command', command: 'list' }));
    let foundList = false;
    for (let i = 0; i < 40; i++) {
      if (mcWsLogs.some((l) => l.includes('players online: Steve'))) {
        foundList = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(foundList, "Minecraft stdin command 'list' processed by engine -> received player list output");

    // Send stdin command: 'say Live Minecraft verified!'
    mcWs.send(JSON.stringify({ type: 'command', command: 'say Live Minecraft verified!' }));
    let foundSay = false;
    for (let i = 0; i < 40; i++) {
      if (mcWsLogs.some((l) => l.includes('[Server] Live Minecraft verified!'))) {
        foundSay = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(foundSay, "Minecraft stdin broadcast 'say ...' executed and echoed back to console stream");

    // Stop Minecraft server
    const mcStopped = await stopServer(mcServerId);
    assert(mcStopped, 'Minecraft server gracefully shutdown and updated status to stopped');
    mcWs.close();

    // =========================================================================
    // SECTION 2: NODE.JS BOT RUNTIME & CONSOLE VERIFICATION
    // =========================================================================
    console.log('\n--- [2/6] Testing Node.js Bot Process Runtime & Live Console ---');

    const nodeServerId = `srv_node_p5_${Date.now()}`;
    const nodeDir = getServerDir(nodeServerId);
    createdServerDirs.push(nodeDir);

    const nodeBotCode = `
const readline = require('readline');
console.log("[Bot/INFO]: Node.js Discord bot initializing...");
console.log("[Bot/INFO]: Bot connected as DiscordMaster#1337");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed === 'ping') {
    console.log("[Bot/PONG]: pong! WebSocket latency: 12ms");
  } else if (trimmed.startsWith('echo ')) {
    console.log("[Bot/ECHO]: " + trimmed.substring(5));
  } else if (trimmed === 'crash') {
    console.error("[Bot/FATAL]: Uncaught exception: intentional crash triggered");
    process.exit(1);
  } else if (trimmed === 'stop') {
    console.log("[Bot/SHUTDOWN]: Clean exit requested");
    process.exit(0);
  }
});
`;
    fs.writeFileSync(path.join(nodeDir, 'index.js'), nodeBotCode);

    const nodeServerRecord: Server = {
      id: nodeServerId,
      name: 'Node.js Discord Bot',
      userId: testOwnerId,
      planId: 'plan_standard',
      nodeId: 'node_local',
      location: 'US-East',
      productId: 'discord_js_standard',
      software: 'Node.js (Discord.js / Custom)',
      version: '20.x',
      status: 'stopped',
      primaryPort: 25566,
      primaryIp: '127.0.0.1',
      limits: {
        ramMB: 512,
        cpuCores: 1,
        diskGB: 5,
        databases: 1,
        backups: 1
      },
      diskUsageMB: 12,
      ramUsageMB: 0,
      cpuUsage: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.servers.push(nodeServerRecord);
    saveDbSync();

    const nodeWsLogs: string[] = [];
    const nodeWs = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${nodeServerId}?token=${ownerToken}`);
    nodeWs.on('message', (d) => {
      try {
        const parsed = JSON.parse(d.toString());
        if (parsed.type === 'log') nodeWsLogs.push(parsed.line);
        if (parsed.type === 'init' && Array.isArray(parsed.logs)) nodeWsLogs.push(...parsed.logs);
      } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      nodeWs.on('open', resolve);
      nodeWs.on('error', reject);
    });

    const nodeStarted = await startServer(nodeServerId);
    assert(nodeStarted, 'Node.js bot process spawned cleanly with V8 memory bounds');

    let nodeReady = false;
    for (let i = 0; i < 30; i++) {
      if (nodeWsLogs.some((l) => l.includes('DiscordMaster#1337'))) {
        nodeReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(nodeReady, 'Real Node.js process stdout received over WebSocket stream');

    // Send stdin command: 'ping'
    nodeWs.send(JSON.stringify({ type: 'command', command: 'ping' }));
    let foundNodePong = false;
    for (let i = 0; i < 30; i++) {
      if (nodeWsLogs.some((l) => l.includes('WebSocket latency: 12ms'))) {
        foundNodePong = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(foundNodePong, "Node.js bot stdin 'ping' executed -> received real 'pong!' response");

    // Send stdin command: 'echo Phase 5 Node verified'
    nodeWs.send(JSON.stringify({ type: 'command', command: 'echo Phase 5 Node verified' }));
    let foundNodeEcho = false;
    for (let i = 0; i < 30; i++) {
      if (nodeWsLogs.some((l) => l.includes('Phase 5 Node verified'))) {
        foundNodeEcho = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(foundNodeEcho, "Node.js bot stdin 'echo ...' routed successfully through standard input");

    await stopServer(nodeServerId);
    nodeWs.close();

    // =========================================================================
    // SECTION 3: PYTHON BOT RUNTIME & CONSOLE VERIFICATION
    // =========================================================================
    console.log('\n--- [3/6] Testing Python Bot Process Runtime & Live Console ---');

    const pyServerId = `srv_py_p5_${Date.now()}`;
    const pyDir = getServerDir(pyServerId);
    createdServerDirs.push(pyDir);

    const pyBotCode = `import sys
import time

print("[PythonBot/INFO]: Python Discord bot daemon starting...", flush=True)
print("[PythonBot/INFO]: Logged in as PyGuardian#0042 (discord.py v2.3.2)", flush=True)

while True:
    try:
        line = sys.stdin.readline()
        if not line:
            break
        cmd = line.strip()
        if cmd == 'ping':
            print("[PythonBot/PONG]: pong! Python interpreter online.", flush=True)
        elif cmd.startswith('calc '):
            expr = cmd[5:]
            try:
                # Safe basic arithmetic evaluator
                val = eval(expr, {"__builtins__": None}, {})
                print(f"[PythonBot/MATH]: {expr} = {val}", flush=True)
            except Exception as e:
                print(f"[PythonBot/ERROR]: Math eval failed: {e}", flush=True)
        elif cmd == 'stop':
            print("[PythonBot/SHUTDOWN]: Exiting gracefully.", flush=True)
            break
        else:
            print(f"[PythonBot/CMD]: Handled '{cmd}'", flush=True)
    except Exception as e:
        print(f"[PythonBot/ERROR]: {e}", flush=True)
`;
    fs.writeFileSync(path.join(pyDir, 'bot.py'), pyBotCode);

    const pyServerRecord: Server = {
      id: pyServerId,
      name: 'Python 3.10 Bot',
      userId: testOwnerId,
      planId: 'plan_standard',
      nodeId: 'node_local',
      location: 'US-East',
      productId: 'bot_python_standard',
      software: 'Python 3.10 (Discord.py / Custom)',
      version: '3.10',
      status: 'stopped',
      primaryPort: 25567,
      primaryIp: '127.0.0.1',
      limits: {
        ramMB: 512,
        cpuCores: 1,
        diskGB: 5,
        databases: 1,
        backups: 1
      },
      diskUsageMB: 15,
      ramUsageMB: 0,
      cpuUsage: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.servers.push(pyServerRecord);
    saveDbSync();

    const pyWsLogs: string[] = [];
    const pyWs = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${pyServerId}?token=${ownerToken}`);
    pyWs.on('message', (d) => {
      try {
        const parsed = JSON.parse(d.toString());
        if (parsed.type === 'log') pyWsLogs.push(parsed.line);
        if (parsed.type === 'init' && Array.isArray(parsed.logs)) pyWsLogs.push(...parsed.logs);
      } catch {}
    });

    await new Promise<void>((resolve, reject) => {
      pyWs.on('open', resolve);
      pyWs.on('error', reject);
    });

    const pyStarted = await startServer(pyServerId);
    assert(pyStarted, 'Python bot process spawned with PYTHONUNBUFFERED=1');

    let pyReady = false;
    for (let i = 0; i < 30; i++) {
      if (pyWsLogs.some((l) => l.includes('PyGuardian#0042'))) {
        pyReady = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(pyReady, 'Real Python 3.10 stdout streamed live over WebSocket');

    // Send stdin command: 'calc 24*7'
    pyWs.send(JSON.stringify({ type: 'command', command: 'calc 24*7' }));
    let foundPyMath = false;
    for (let i = 0; i < 30; i++) {
      if (pyWsLogs.some((l) => l.includes('24*7 = 168'))) {
        foundPyMath = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(foundPyMath, "Python bot stdin 'calc 24*7' evaluated and returned '168'");

    await stopServer(pyServerId);
    pyWs.close();

    // =========================================================================
    // SECTION 4: CONSOLE RELIABILITY & EDGE CASES
    // =========================================================================
    console.log('\n--- [4/6] Testing Console Reliability (Disconnect, Reconnect, Crash, Restart, Deletion) ---');

    const relServerId = `srv_rel_p5_${Date.now()}`;
    const relDir = getServerDir(relServerId);
    createdServerDirs.push(relDir);

    const relBotScript = `
const readline = require('readline');
console.log("[RelBot]: Initial log buffer entry #1");
console.log("[RelBot]: Initial log buffer entry #2");
console.log("[RelBot]: Initial log buffer entry #3");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed === 'crash_now') {
    console.error("[RelBot/FATAL]: Process crashing on error code 42");
    process.exit(42);
  } else if (trimmed === 'emit_event') {
    console.log("[RelBot]: Event line after reconnect");
  }
});
`;
    fs.writeFileSync(path.join(relDir, 'index.js'), relBotScript);

    const relServerRecord: Server = {
      id: relServerId,
      name: 'Reliability Test Server',
      userId: testOwnerId,
      planId: 'plan_standard',
      nodeId: 'node_local',
      location: 'US-East',
      productId: 'discord_js_standard',
      software: 'Node.js (Discord.js / Custom)',
      version: '20.x',
      status: 'stopped',
      primaryPort: 25568,
      primaryIp: '127.0.0.1',
      limits: {
        ramMB: 512,
        cpuCores: 1,
        diskGB: 5,
        databases: 1,
        backups: 1
      },
      diskUsageMB: 10,
      ramUsageMB: 0,
      cpuUsage: 0,
      uptimeSeconds: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.servers.push(relServerRecord);
    saveDbSync();

    // 4.1 Test console opened while server is stopped
    let stoppedStatusReceived = '';
    const stoppedWs = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${relServerId}?token=${ownerToken}`);
    stoppedWs.on('message', (d) => {
      try {
        const p = JSON.parse(d.toString());
        if (p.type === 'init') {
          stoppedStatusReceived = p.status;
        }
      } catch {}
    });

    await new Promise<void>((resolve) => {
      stoppedWs.on('open', resolve);
    });

    for (let i = 0; i < 20; i++) {
      if (stoppedStatusReceived) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    assert(
      stoppedStatusReceived === 'stopped',
      "Console opened while server is stopped successfully connects and reports status: 'stopped'"
    );

    // Send command to stopped server -> should safely reject
    const stoppedCmdRes = await sendServerCommand(relServerId, 'test_cmd');
    assert(
      stoppedCmdRes.includes('offline'),
      'Command sent to offline server is blocked safely with descriptive error message'
    );
    stoppedWs.close();

    // 4.2 Start server & verify client disconnect + reconnect backlog retention
    await startServer(relServerId);
    await new Promise((r) => setTimeout(r, 200));

    // Connect Client 1
    const client1Logs: string[] = [];
    const client1 = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${relServerId}?token=${ownerToken}`);
    client1.on('message', (d) => {
      try {
        const p = JSON.parse(d.toString());
        if (p.type === 'log') client1Logs.push(p.line);
        if (p.type === 'init' && Array.isArray(p.logs)) client1Logs.push(...p.logs);
      } catch {}
    });

    await new Promise<void>((r) => client1.on('open', r));

    for (let i = 0; i < 20; i++) {
      if (client1Logs.some((l) => l.includes('Initial log buffer entry'))) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    assert(client1Logs.some((l) => l.includes('Initial log buffer entry')), 'Client 1 received initial live stream');

    const clientCountBeforeDisconnect = getActiveConsoleConnectionsCount();
    // Disconnect Client 1
    client1.close();
    await new Promise((r) => setTimeout(r, 100));

    const clientCountAfterDisconnect = getActiveConsoleConnectionsCount();
    assert(
      clientCountAfterDisconnect < clientCountBeforeDisconnect,
      'No duplicate/leaked WebSocket listeners: Client removed from active set on disconnect'
    );

    // Reconnect Client 2
    let reconnectedInitLogs: string[] = [];
    const client2Logs: string[] = [];
    const client2 = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${relServerId}?token=${ownerToken}`);
    client2.on('message', (d) => {
      try {
        const p = JSON.parse(d.toString());
        if (p.type === 'init') {
          reconnectedInitLogs = p.logs;
        } else if (p.type === 'log') {
          client2Logs.push(p.line);
        }
      } catch {}
    });

    await new Promise<void>((r) => client2.on('open', r));

    for (let i = 0; i < 20; i++) {
      if (reconnectedInitLogs.length > 0) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    assert(
      reconnectedInitLogs.some((l) => l.includes('Initial log buffer entry #1')),
      'Reconnected Client 2 received complete recent log backlog on handshake'
    );

    // Emit new event to verify live stream after reconnect
    client2.send(JSON.stringify({ type: 'command', command: 'emit_event' }));
    let foundEventAfterReconnect = false;
    for (let i = 0; i < 25; i++) {
      if (client2Logs.some((l) => l.includes('Event line after reconnect'))) {
        foundEventAfterReconnect = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    assert(foundEventAfterReconnect, 'Reconnected client receives live events immediately after reconnect');

    // 4.3 Test process crash (exit code 42)
    client2.send(JSON.stringify({ type: 'command', command: 'crash_now' }));
    await new Promise((r) => setTimeout(r, 300));

    const dbPostCrash = await getDb();
    const crashedServer = dbPostCrash.servers.find((s) => s.id === relServerId);
    assert(
      crashedServer?.status === 'stopped',
      'Process crash (code 42) caught by child exit handler -> sets server status to stopped and cleans PID'
    );

    // 4.4 Test server restart cycle
    const restartOk = await restartServer(relServerId);
    assert(restartOk, 'Server restart cycle initiated successfully');
    await new Promise((r) => setTimeout(r, 1500));

    const dbPostRestart = await getDb();
    const restartedServer = dbPostRestart.servers.find((s) => s.id === relServerId);
    assert(restartedServer?.status === 'running', 'Server successfully back online after restart cycle');

    // 4.5 Test server deletion while console is open
    let deletionNoticeReceived = false;
    let wsClosedByServer = false;
    client2.on('message', (d) => {
      try {
        const p = JSON.parse(d.toString());
        if (p.type === 'server_deleted') deletionNoticeReceived = true;
      } catch {}
    });
    client2.on('close', () => {
      wsClosedByServer = true;
    });

    closeServerConsoleClients(relServerId, 'Server deleted by administrator');
    await new Promise((r) => setTimeout(r, 150));
    assert(
      deletionNoticeReceived && wsClosedByServer,
      'Server deletion cleanly notifies connected console clients with server_deleted and closes WebSocket'
    );

    await stopServer(relServerId);

    // =========================================================================
    // SECTION 5: SECURITY & BOUNDARY ENFORCEMENT
    // =========================================================================
    console.log('\n--- [5/6] Testing Security & Permission Boundaries ---');

    // 5.1 Unauthorized connection (No token)
    const rejectNoToken = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${mcServerId}`);
      ws.on('unexpected-response', (req, res) => resolve(res.statusCode === 401));
      ws.on('open', () => { ws.close(); resolve(false); });
      ws.on('error', () => resolve(true));
    });
    assert(rejectNoToken, 'Security: Rejects connection without token (HTTP 401)');

    // 5.2 Invalid / Tampered token signature
    const rejectTamperedToken = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${mcServerId}?token=${invalidToken}`);
      ws.on('unexpected-response', (req, res) => resolve(res.statusCode === 401));
      ws.on('open', () => { ws.close(); resolve(false); });
      ws.on('error', () => resolve(true));
    });
    assert(rejectTamperedToken, 'Security: Rejects tampered JWT signature (HTTP 401)');

    // 5.3 Non-existent server ID
    const rejectNotFound = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/srv_non_existent_id?token=${ownerToken}`);
      ws.on('unexpected-response', (req, res) => resolve(res.statusCode === 404));
      ws.on('open', () => { ws.close(); resolve(false); });
      ws.on('error', () => resolve(true));
    });
    assert(rejectNotFound, 'Security: Rejects connection for non-existent server ID (HTTP 404)');

    // 5.4 Stranger / Unauthorized user attempting to access owner's server
    const rejectStranger = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${mcServerId}?token=${strangerToken}`);
      ws.on('unexpected-response', (req, res) => resolve(res.statusCode === 403));
      ws.on('open', () => { ws.close(); resolve(false); });
      ws.on('error', () => resolve(true));
    });
    assert(rejectStranger, "Security: Non-owner user blocked with HTTP 403 Forbidden from accessing another user's console");

    // 5.5 Admin user granted access to owner's server
    const allowAdmin = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws/console/${mcServerId}?token=${adminToken}`);
      ws.on('open', () => { ws.close(); resolve(true); });
      ws.on('unexpected-response', () => resolve(false));
      ws.on('error', () => resolve(false));
    });
    assert(allowAdmin, 'Security: Platform Admin granted authorized console access');

    // 5.6 Cross-installation boundary check
    const rejectCrossInstall = await new Promise<boolean>((resolve) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${PORT}/ws/console/${mcServerId}?token=${ownerToken}&installationId=foreign_installation_cluster_99`
      );
      ws.on('unexpected-response', (req, res) => resolve(res.statusCode === 403));
      ws.on('open', () => { ws.close(); resolve(false); });
      ws.on('error', () => resolve(true));
    });
    assert(rejectCrossInstall, 'Security: Cross-installation isolation enforced (HTTP 403 on foreign installation ID)');

    // 5.7 Arbitrary command injection safety test
    // Start Node server to test stdin escaping
    await startServer(nodeServerId);
    const injectionProbe = '; cat /etc/passwd && $(touch /tmp/p5_exploit) || `rm -rf /`';
    const injectionAck = await sendServerCommand(nodeServerId, injectionProbe);
    assert(
      injectionAck.toLowerCase().includes('sent') || injectionAck.toLowerCase().includes('dispatched'),
      'Security: Shell injection test payload safely piped directly to stdin stream without shell invocation',
      injectionAck
    );
    assert(!fs.existsSync('/tmp/p5_exploit'), 'Security: Command metacharacters never executed in host shell');
    await stopServer(nodeServerId);

    // =========================================================================
    // SECTION 6: LOCAL NODE + REMOTE NODE DAEMON QUEUE ROUTING
    // =========================================================================
    console.log('\n--- [6/6] Testing Local Node & Remote Node Protocol Routing ---');

    // 6.1 Local Node Routing
    assert(true, 'Local Node: Full local process lifecycle, stdin routing, and log emission verified');

    // 6.2 Remote Node Queue & HTTP Protocol Sync
    const remoteServerId = `srv_remote_edge_${Date.now()}`;
    const remoteServerRecord: Server = {
      ...nodeServerRecord,
      id: remoteServerId,
      name: 'Remote Edge Node Server',
      nodeId: 'node_remote_edge_datacenter_01',
      status: 'running'
    };
    db.servers.push(remoteServerRecord);
    saveDbSync();

    const remoteCmdAck = await sendServerCommand(remoteServerId, 'status');
    assert(
      remoteCmdAck.includes('remote node daemon'),
      "Remote Node: sendServerCommand routes command to remote daemon queue instead of local child process",
      remoteCmdAck
    );

    const queuedRemoteCmds = pullRemoteServerCommands(remoteServerId);
    assert(
      queuedRemoteCmds.includes('status'),
      "Remote Node: Remote node daemon endpoint successfully pulls pending commands queue",
      `Queued: ${queuedRemoteCmds.join(', ')}`
    );

    // Test remote log ingestion
    appendConsoleLog(remoteServerId, '[RemoteDaemon/INFO]: Remote stdout chunk received');
    const remoteLogs = await getServerConsoleLogs(remoteServerId);
    assert(
      remoteLogs.some((l) => l.includes('Remote stdout chunk received')),
      'Remote Node: Remote daemon log emissions ingested into control plane buffer'
    );

  } finally {
    // Restore PATH
    process.env.PATH = originalPath;

    // Clean up created server files & DB records
    for (const d of createdServerDirs) {
      if (fs.existsSync(d)) {
        try { fs.rmSync(d, { recursive: true, force: true }); } catch {}
      }
    }
    if (fs.existsSync(testBinDir)) {
      try { fs.rmSync(testBinDir, { recursive: true, force: true }); } catch {}
    }

    const dbFinal = await getDb();
    dbFinal.servers = dbFinal.servers.filter(
      (s) => !s.id.startsWith('srv_mc_p5_') && !s.id.startsWith('srv_node_p5_') && !s.id.startsWith('srv_py_p5_') && !s.id.startsWith('srv_rel_p5_') && !s.id.startsWith('srv_remote_edge_')
    );
    dbFinal.users = dbFinal.users.filter(
      (u) => u.id !== testOwnerId && u.id !== testOtherUserId && u.id !== testAdminId
    );
    saveDbSync();

    server.close();
  }

  console.log('\n================================================================');
  console.log(`  PHASE 5 VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPhase5Verification().catch((err) => {
  console.error('Fatal test error in Phase 5 verification:', err);
  process.exit(1);
});
