// ============================================================
// Atyro Panel - Remote Node Agent
// ============================================================
// Polls the panel for commands, executes them, and reports back.
// Also serves read-only HTTP endpoints used directly by the panel.
// ============================================================

'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const net = require('net');
const crypto = require('crypto');
const dns = require('dns');
const zlib = require('zlib');
const { spawn, exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);
const axios = require('axios');
// Shared keep-alive agents: reuse TCP/TLS connections across downloads
// instead of a fresh handshake per request (big win for consecutive installs)
const https = require('https');
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 4 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 4 });
let archiver;
try { archiver = require('archiver'); } catch { archiver = null; }
let unzipper;
try { unzipper = require('unzipper'); } catch { unzipper = null; }
let pidusage;
try { pidusage = require('pidusage'); } catch { pidusage = null; }
let sanitize;
try { sanitize = require('sanitize-filename'); } catch { sanitize = (s) => String(s || '').replace(/[^a-zA-Z0-9_.-]/g, '_'); }
let AdmZip;
try { AdmZip = require('adm-zip'); } catch { AdmZip = null; }
let yaml;
try { yaml = require('js-yaml'); } catch { yaml = null; }
let NBT;
try { NBT = require('prismarine-nbt'); } catch { NBT = null; }

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------
const ROOT = __dirname;
const SERVERS_ROOT = path.join(ROOT, 'servers');
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB — matches panel upload limit
const LOG_DIR = path.join(ROOT, 'logs');
const CONFIG_FILE = path.join(ROOT, 'config.json');

let config = {
  panelUrl: process.env.PANEL_URL || 'http://localhost:3000',
  nodeId: process.env.NODE_ID || 'local',
  token: process.env.NODE_TOKEN || '',
  port: Number(process.env.DAEMON_PORT || 9666),
  bindHost: process.env.BIND_HOST || '0.0.0.0',
  heartbeatIntervalMs: 15000,
  commandPollIntervalMs: 1000,
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const fileCfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...fileCfg };
  } catch (e) {
    console.error('[config] Failed to parse config.json:', e.message);
  }
}

// Normalize aliases so both token / daemonToken and port / daemonPort work seamlessly
config.token = config.token || config.daemonToken || process.env.NODE_TOKEN || '';
config.port = Number(config.port || config.daemonPort || process.env.DAEMON_PORT || 9666);
if (config.nodeId === undefined || config.nodeId === null || config.nodeId === '') {
  config.nodeId = process.env.NODE_ID || 'local';
}

if (!config.token) {
  console.error('[config] FATAL: No node token configured. Set NODE_TOKEN or config.json token/daemonToken.');
  process.exit(1);
}

// ------------------------------------------------------------
// Logging
// ------------------------------------------------------------
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const agentLogPath = path.join(LOG_DIR, 'agent.log');

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(agentLogPath, line + '\n'); } catch {}
}

// ------------------------------------------------------------
// Runtime state
// ------------------------------------------------------------
const serverProcesses = new Map(); // serverId -> ChildProcess
const consoleOutputBuffers = new Map(); // ANSI-preserving live stdout/stderr, never written to latest.log
const serverStartTimes = new Map(); // serverId -> ms timestamp
const serverStopFlags = new Map(); // serverId -> boolean (true = user requested stop)
const serverCpuHistory = new Map(); // serverId -> array of recent CPU samples for averaging
const logWriteStreams = new Map(); // Reserved for compatibility; latest.log is owned by Minecraft.

// ------------------------------------------------------------
// Panel API helpers
// ------------------------------------------------------------
function panelHeaders() {
  return {
    'Authorization': `Bearer ${config.token}`,
    'x-daemon-token': config.token,
    'Content-Type': 'application/json',
    'User-Agent': `MinecraftPanelAgent/1.0`,
  };
}

async function panelFetch(method, route, body = undefined, timeoutMs = 15000) {
  const url = `${config.panelUrl.replace(/\/$/, '')}${route}`;
  try {
    const res = await axios({
      method,
      url,
      data: body,
      headers: panelHeaders(),
      timeout: timeoutMs,
      validateStatus: () => true,
    });
    return { status: res.status, data: res.data };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  }
}

async function sendHeartbeat() {
  const cpu = os.cpus().length;
  const totalMem = Math.floor(os.totalmem() / (1024 * 1024));
  const freeMem = Math.floor(os.freemem() / (1024 * 1024));
  const body = {
    daemonVersion: '1.0.0',
    nodeVersion: process.version,
    os: `${os.platform()} ${os.release()} ${os.arch()}`,
    cpu,
    memory: { totalMb: totalMem, freeMb: freeMem, usedMb: totalMem - freeMem },
    disk: await getDiskSpace(),
    uptime: os.uptime(),
  };
  const r = await panelFetch('POST', `/api/nodes/${config.nodeId}/heartbeat`, body, 10000);
  if (r.status !== 200) {
    log(`[heartbeat] failed (status ${r.status}):`, JSON.stringify(r.data).slice(0, 200));
  } else {
    log(`[heartbeat] ok`);
  }
}

async function getDiskSpace() {
  const bytes = await getDiskBytes();
  if (!bytes) return { totalMb: 0, freeMb: 0 };
  return {
    totalMb: Math.floor(bytes.total / 1048576),
    freeMb: Math.floor(bytes.free / 1048576),
  };
}

// fs.statfs returns real filesystem counters on every platform, so neither the
// heartbeat nor /health needs a shell-out or a guessed "1 TB default".
// null means "not measurable", never an estimate.
async function getDiskBytes() {
  const probe = fs.existsSync(SERVERS_ROOT) ? SERVERS_ROOT : ROOT;
  try {
    const s = await fs.promises.statfs(probe);
    const total = s.bsize * s.blocks;
    const free = s.bsize * s.bavail;
    if (!Number.isFinite(total) || total <= 0) return null;
    return { total, free, used: Math.max(0, total - free) };
  } catch {
    return null;
  }
}

// System-wide CPU utilisation from os.cpus() tick deltas. os.loadavg() is
// [0,0,0] on Windows and pidusage(process.pid) only covers this daemon
// process, so the delta sampler is the only real system figure available.
let cpuTickSample = null;
let cpuUsagePercent = null;

function sampleCpuUsage() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    const t = c.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle +
      (t.irq || 0) + (t.softirq || 0) + (t.dpc || 0) + (t.interrupt || 0);
  }
  const prev = cpuTickSample;
  cpuTickSample = { idle, total };
  if (!prev || total <= prev.total) return;
  const deltaTotal = total - prev.total;
  if (deltaTotal <= 0) return;
  cpuUsagePercent = Math.max(0, Math.min(100, Math.round((1 - (idle - prev.idle) / deltaTotal) * 1000) / 10));
}
sampleCpuUsage();
setInterval(sampleCpuUsage, 2000).unref();

// ------------------------------------------------------------
// Command poll loop
// ------------------------------------------------------------
let polling = false;
let stopping = false;

async function pollCommands() {
  if (polling || stopping) return;
  polling = true;
  try {
    const r = await panelFetch('GET', `/api/nodes/${config.nodeId}/commands/next`, undefined, 10000);
    if (r.status !== 200 || !r.data || !r.data.command) {
      return;
    }
    const cmd = r.data.command;
    log(`[command] received #${cmd.id} action=${cmd.action} server=${cmd.serverId || '-'}`);
    let result = { ok: true, result: {} };
    let lastProgressAt = 0;
    const reportProgress = (percent, current, total, message) => {
      const now = Date.now();
      if (percent < 100 && now - lastProgressAt < 300) return;
      lastProgressAt = now;
      panelFetch(
        'POST',
        `/api/nodes/${config.nodeId}/commands/${cmd.id}/progress`,
        { percent: Math.round(percent), current, total, message: String(message || '') },
        5000
      ).catch(() => {});
    };
    try {
      result = await executeCommand(cmd, reportProgress);
    } catch (err) {
      log(`[command] #${cmd.id} FAILED:`, err.message);
      result = { ok: false, error: err.message };
    }
    await panelFetch(
      'POST',
      `/api/nodes/${config.nodeId}/commands/${cmd.id}/result`,
      { ok: result.ok, result: result.result || {}, error: result.error || null },
      15000
    );
    log(`[command] #${cmd.id} reported ok=${result.ok}`);
  } catch (err) {
    log(`[poll] error:`, err.message);
  } finally {
    polling = false;
  }
}

// ------------------------------------------------------------
// Command dispatch
// ------------------------------------------------------------
async function executeCommand(cmd, onProgress) {
  const { action, serverId, payload } = cmd;
  switch (action) {
    case 'create':             return await cmdCreate(serverId, payload);
    case 'start':              return await cmdStart(serverId, payload);
    case 'stop':               return await cmdStop(serverId, payload);
    case 'restart':            return await cmdRestart(serverId, payload);
    case 'reinstall':          return await cmdReinstall(serverId, payload);
    case 'delete':             return await cmdDelete(serverId, payload);
    case 'stats':              return await cmdStats(serverId);
    case 'logs':               return await cmdLogs(serverId, payload);
    case 'player-list':        return await cmdPlayerList(serverId);
    case 'player-action':      return await cmdPlayerAction(serverId, payload);
    case 'plugin-list':        return await cmdPluginList(serverId);
    case 'plugin-install':     return await cmdPluginInstall(serverId, payload);
    case 'plugin-delete':      return await cmdPluginDelete(serverId, payload);
    case 'plugin-upload':      return await cmdPluginUpload(serverId, payload);
    case 'file-list':          return await cmdFileList(serverId, payload);
    case 'file-read':          return await cmdFileRead(serverId, payload);
    case 'file-write':         return await cmdFileWrite(serverId, payload);
    case 'file-delete':        return await cmdFileDelete(serverId, payload, onProgress);
    case 'file-upload':        return await cmdFileUpload(serverId, payload);
    case 'file-pull':          return await cmdFilePull(serverId, payload, onProgress);
    case 'file-create':        return await cmdFileCreate(serverId, payload);
    case 'file-rename':        return await cmdFileRename(serverId, payload);
    case 'file-zip':           return await cmdFileZip(serverId, payload);
    case 'file-unzip':         return await cmdFileUnzip(serverId, payload);
    case 'file-bulk-zip':      return await cmdFileBulkZip(serverId, payload);
    case 'file-extract':       return await cmdFileExtract(serverId, payload, onProgress);
    case 'file-download':      return await cmdFileDownload(serverId, payload);
    case 'console-command':    return await cmdConsoleCommand(serverId, payload);
    case 'lifetime-players':   return await cmdLifetimePlayers(serverId);
    case 'player-data':        return await cmdPlayerData(serverId, payload.uuid);
    case 'world-list':         return await cmdWorldList(serverId);
    case 'world-delete':       return await cmdWorldDelete(serverId, payload);
    case 'world-upload':       return await cmdWorldUpload(serverId, payload);
    case 'world-install':      return await cmdWorldInstall(serverId, payload);
    case 'world-rename':       return await cmdWorldRename(serverId, payload);
    case 'world-switch':       return await cmdWorldSwitch(serverId, payload);
    case 'backup-create':      return await cmdBackupCreate(serverId, payload);
    case 'backup-delete':      return await cmdBackupDelete(serverId, payload);
    case 'restore-backup':     return await cmdRestoreBackup(serverId, payload);
    case 'server-backup-delete': return await cmdServerBackupDelete(serverId, payload);
    case 'properties-read':    return await cmdPropertiesRead(serverId);
    case 'properties-save':    return await cmdPropertiesSave(serverId, payload);
    case 'properties-reset':   return await cmdPropertiesReset(serverId, payload);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ------------------------------------------------------------
// Path safety
// ------------------------------------------------------------
function isPathInside(base, full) {
  const rel = path.relative(base, full);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function serverDir(serverId) {
  const dir = path.resolve(SERVERS_ROOT, String(serverId));
  if (!isPathInside(SERVERS_ROOT, dir)) throw new Error('Invalid server path');
  return dir;
}

function safeJoin(serverId, relPath = '') {
  const raw = String(relPath || '');
  if (raw.includes('\0')) throw new Error('Invalid path');
  const base = serverDir(serverId);
  const full = path.resolve(base, raw.replace(/^[/\\]+/, ''));
  if (!isPathInside(base, full)) throw new Error('Path escapes server directory');
  return full;
}

// Returns a free folder name inside the server dir: name, name-2, name-3, ...
function uniqueTarget(serverId, name) {
  let candidate = name;
  let i = 2;
  while (fs.existsSync(safeJoin(serverId, candidate))) {
    candidate = `${name}-${i}`;
    i++;
  }
  return { name: candidate, target: safeJoin(serverId, candidate) };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Recursively find a file by name under root
function findFile(root, filename) {
  let found = null;
  const stack = [root];
  while (stack.length && !found) {
    const dir = stack.pop();
    let items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const it of items) {
      const p = path.join(dir, it.name);
      if (it.isDirectory()) stack.push(p);
      else if (it.name === filename) { found = p; break; }
    }
  }
  return found;
}

// Post-extraction normalization:
//  - Reject archives that contain no level.dat anywhere (not a real Minecraft world)
//  - Flatten wrapper folder(s) so the world files (level.dat, region, ...) sit directly in the target
function normalizeWorldExtraction(target) {
  if (!findFile(target, 'level.dat')) {
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error('Not a valid Minecraft world: no level.dat found inside the archive');
  }
  let guard = 0;
  while (guard++ < 10 && !fs.existsSync(path.join(target, 'level.dat'))) {
    const lvl = findFile(target, 'level.dat');
    if (!lvl) break;
    const parts = path.relative(target, lvl).split(path.sep);
    if (parts.length <= 1) break;
    const wrapper = path.join(target, parts[0]);
    for (const item of fs.readdirSync(wrapper)) {
      try { fs.renameSync(path.join(wrapper, item), path.join(target, item)); } catch (e) {}
    }
    try { fs.rmdirSync(wrapper); } catch (e) {}
  }
  if (!fs.existsSync(path.join(target, 'level.dat'))) {
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error('Not a valid Minecraft world: level.dat must be at the archive root or inside a single folder');
  }
}

// ------------------------------------------------------------
// SSRF protection for URL downloads (plugins, worlds, file pull)
// ------------------------------------------------------------
function isPrivateIpv4(ip) {
  const parts = String(ip).split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 127 || a === 0 || a === 10) return true;          // loopback/self, "this" net, private
  if (a === 172 && b >= 16 && b <= 31) return true;           // private
  if (a === 192 && b === 168) return true;                    // private
  if (a === 169 && b === 254) return true;                    // link-local
  if (a === 100 && b >= 64 && b <= 127) return true;          // CGNAT
  if (a >= 224) return true;                                  // multicast/reserved
  return false;
}

function isPrivateIpv6(ip) {
  const lower = String(ip).toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;      // ULA
  if (/^fe[89ab]/.test(lower)) return true;                               // link-local
  if (lower.startsWith('::ffff:')) return isPrivateIpv4(lower.slice(7));  // mapped v4
  return false;
}

async function assertSafeDownloadUrl(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl || '').trim());
  } catch (e) {
    throw new Error('Invalid URL format');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  const host = String(u.hostname || '').replace(/^\[|\]$/g, '');
  if (!host) throw new Error('Invalid URL host');
  const results = await dns.promises.lookup(host, { all: true });
  for (const r of results) {
    const privateAddr = r.family === 4 ? isPrivateIpv4(r.address) : isPrivateIpv6(r.address);
    if (privateAddr) throw new Error('Private or internal addresses are not allowed');
  }
  return u.toString();
}

// ------------------------------------------------------------
// SERVER LIFECYCLE
// ------------------------------------------------------------
const SERVER_DOWNLOADERS = {
  vanilla: async (version) => {
    const manifest = (await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json')).data;
    const v = version === 'latest' ? manifest.latest.release : version;
    const entry = manifest.versions.find(x => x.id === v);
    if (!entry) throw new Error(`Vanilla version ${v} not found`);
    const meta = (await axios.get(entry.url)).data;
    return { url: meta.downloads.server.url, version: v, filename: 'server.jar' };
  },
  paper: async (version) => {
    try {
      const userAgent = 'MinecraftPanel/1.0.0 (https://github.com/your-repo)';
      
      // Parse version and optional build number (e.g., "1.21.4-150" or "1.21.4")
      let targetVersion = version;
      let targetBuild = null;
      
      if (version && version.includes('-')) {
        const parts = version.split('-');
        targetVersion = parts[0];
        targetBuild = parseInt(parts[1], 10);
      }
      
      if (version === 'latest' || !version) {
        // Fetch all available Paper versions using new v3 API
        const projects = (await axios.get('https://fill.papermc.io/v3/projects/paper', { 
          timeout: 10000,
          headers: { 'User-Agent': userAgent }
        })).data;
        
        if (!projects.versions) {
          throw new Error('No Paper versions available from API');
        }
        
        // Get latest version (versions is an object with version groups)
        const allVersions = [];
        Object.values(projects.versions).forEach(group => {
          if (Array.isArray(group)) {
            allVersions.push(...group);
          }
        });
        
        if (allVersions.length === 0) {
          throw new Error('No Paper versions available');
        }
        
        targetVersion = allVersions[0]; // Latest version
      }
      
      // Fetch builds for this version using new v3 API
      const builds = (await axios.get(`https://fill.papermc.io/v3/projects/paper/versions/${targetVersion}/builds`, {
        timeout: 10000,
        headers: { 'User-Agent': userAgent }
      })).data;
      
      if (!Array.isArray(builds) || builds.length === 0) {
        throw new Error(`No Paper builds found for version ${targetVersion}`);
      }
      
      // Get the build to use (latest or specified)
      let build;
      if (targetBuild) {
        build = builds.find(b => b.id === targetBuild);
        if (!build) {
          console.error(`[download] Paper build ${targetBuild} not found, using latest`);
          build = builds[0]; // Latest build first in new API
        }
      } else {
        build = builds[0]; // Latest build
      }
      
      // Extract download URL from new v3 API structure
      const downloadUrl = build.downloads?.['server:default']?.url;
      if (!downloadUrl) {
        throw new Error(`No download URL found for Paper ${targetVersion} build ${build.id}`);
      }
      
      return {
        url: downloadUrl,
        version: targetVersion,
        buildNumber: build.id,
        filename: 'server.jar',
      };
    } catch (err) {
      throw new Error(`Failed to download Paper: ${err.message}`);
    }
  },
  purpur: async (version) => {
    const projects = (await axios.get('https://api.purpurmc.org/v2/purpur')).data;
    const v = version === 'latest' ? projects.versions[projects.versions.length - 1] : version;
    const latest = (await axios.get(`https://api.purpurmc.org/v2/purpur/${v}/latest`)).data;
    return { url: `https://api.purpurmc.org/v2/purpur/${v}/${latest.build}/download`, version: v, filename: 'server.jar' };
  },
  velocity: async (version) => {
    const projects = (await axios.get('https://api.papermc.io/v2/projects/velocity')).data;
    const v = version === 'latest' ? projects.versions[projects.versions.length - 1] : version;
    const builds = (await axios.get(`https://api.papermc.io/v2/projects/velocity/versions/${v}/builds`)).data;
    const build = builds.builds[builds.builds.length - 1];
    return {
      url: `https://api.papermc.io/v2/projects/velocity/versions/${v}/builds/${build.build}/downloads/velocity-${v}-${build.build}.jar`,
      version: v, filename: 'server.jar',
    };
  },
  waterfall: async (version) => {
    const projects = (await axios.get('https://api.papermc.io/v2/projects/waterfall')).data;
    const v = version === 'latest' ? projects.versions[projects.versions.length - 1] : version;
    const builds = (await axios.get(`https://api.papermc.io/v2/projects/waterfall/versions/${v}/builds`)).data;
    const build = builds.builds[builds.builds.length - 1];
    return {
      url: `https://api.papermc.io/v2/projects/waterfall/versions/${v}/builds/${build.build}/downloads/waterfall-${v}-${build.build}.jar`,
      version: v, filename: 'server.jar',
    };
  },
  fabric: async (version) => {
    const gameVersions = (await axios.get('https://meta.fabricmc.net/v2/versions/game')).data;
    const v = version === 'latest' ? gameVersions.find(x => x.stable)?.version : version;
    const loaders = (await axios.get('https://meta.fabricmc.net/v2/versions/loader')).data;
    return { url: `https://meta.fabricmc.net/v2/versions/loader/${v}/${loaders[0].version}/server/jar`, version: v, filename: 'server.jar' };
  },
  quilt: async (version) => {
    const gameVersions = (await axios.get('https://meta.quiltmc.org/v3/versions/game')).data;
    const v = version === 'latest' ? gameVersions.find(x => x.stable)?.version : version;
    const loaders = (await axios.get('https://meta.quiltmc.org/v3/versions/loader')).data;
    return { url: `https://meta.quiltmc.org/v3/versions/loader/${v}/${loaders[0].version}/server/jar`, version: v, filename: 'server.jar' };
  },
  forge: async (version) => {
    if (version === 'latest') throw new Error('Forge requires explicit version');
    return {
      url: `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`,
      version, filename: 'forge-installer.jar', postInstall: 'forge',
    };
  },
  bungeecord: async () => ({
    url: 'https://ci.md-5.net/job/BungeeCord/lastSuccessfulBuild/artifact/bootstrap/target/BungeeCord.jar',
    version: 'latest', filename: 'server.jar',
  }),
  mohist: async (version) => {
    if (version === 'latest') throw new Error('Mohist requires explicit version');
    return { url: `https://mohistmc.com/api/v2/projects/mohist/${version}/builds/latest/download`, version, filename: 'server.jar' };
  },
};

async function downloadServer(serverId, serverType, version) {
  const dl = SERVER_DOWNLOADERS[serverType];
  if (!dl) throw new Error(`Unsupported server type: ${serverType}`);
  const info = await dl(version);
  const dir = serverDir(serverId);
  ensureDir(dir);
  const target = path.join(dir, info.filename);
  log(`[download] ${serverType} ${info.version} from ${info.url}`);
  const res = await axios({ url: info.url, method: 'GET', responseType: 'stream', timeout: 300000, maxRedirects: 10,
    headers: { 'User-Agent': 'MinecraftPanelAgent/1.0' } });
  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(target);
    res.data.pipe(w);
    res.data.on('error', reject);
    w.on('finish', resolve);
    w.on('error', reject);
  });
  log(`[download] saved ${target} (${fs.statSync(target).size} bytes)`);
  if (info.isZip) {
    log(`[download] extracting ${info.filename}`);
    await new Promise((resolve, reject) => {
      fs.createReadStream(target).pipe(unzipper.Extract({ path: dir })).on('close', resolve).on('error', reject);
    });
    fs.unlinkSync(target);
  }
  if (info.postInstall === 'forge') {
    log(`[download] running forge installer`);
    await runProcess('java', ['-jar', path.basename(target), '--installServer'], dir, 300000);
  }
  return info;
}

async function ensureEula(serverId) {
  const eula = safeJoin(serverId, 'eula.txt');
  if (!fs.existsSync(eula)) fs.writeFileSync(eula, 'eula=true\n');
}

async function writeDefaultConfig(serverId, serverType, port, name) {
  const dir = serverDir(serverId);
  if (['vanilla', 'paper', 'purpur', 'spigot', 'bukkit', 'fabric', 'forge', 'quilt', 'mohist', 'catserver'].includes(serverType)) {
    const p = path.join(dir, 'server.properties');
    let props = {};
    if (fs.existsSync(p)) props = parseProperties(fs.readFileSync(p, 'utf8'));
    props['server-port'] = port;
    props['server-ip'] = '';
    props['motd'] = name || 'Minecraft Server';
    props['online-mode'] = props['online-mode'] !== undefined ? props['online-mode'] : 'true';
    props['max-players'] = props['max-players'] || 20;
    props['view-distance'] = props['view-distance'] || 10;
    props['simulation-distance'] = props['simulation-distance'] || 10;
    fs.writeFileSync(p, writePropertiesString(props));
  } else if (serverType === 'velocity') {
    const p = path.join(dir, 'velocity.toml');
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, `# Velocity configuration\nbind = "0.0.0.0:${port}"\nmotd = "${name || 'Velocity'}"\nshow-max-players = 500\nonline-mode = true\nplayer-info-forwarding-mode = "MODERN"\n[servers]\nlobby = "localhost:25565"\ntry = ["lobby"]\n`);
    } else {
      let c = fs.readFileSync(p, 'utf8');
      c = c.replace(/bind\s*=\s*"[^"]*"/g, `bind = "0.0.0.0:${port}"`);
      fs.writeFileSync(p, c);
    }
  } else if (serverType === 'bungeecord' || serverType === 'waterfall') {
    const p = path.join(dir, 'config.yml');
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, `listeners:\n- host: 0.0.0.0:${port}\n  motd: 'BungeeCord'\n  max_players: 100\nonline_mode: true\n`);
    } else {
      let c = fs.readFileSync(p, 'utf8');
      c = c.replace(/host:\s*[^\n\r]*/g, `host: 0.0.0.0:${port}`);
      fs.writeFileSync(p, c);
    }
  } else if (serverType === 'bedrock') {
    const p = path.join(dir, 'server.properties');
    let props = {};
    if (fs.existsSync(p)) props = parseProperties(fs.readFileSync(p, 'utf8'));
    props['server-port'] = port;
    props['server-portv6'] = port;
    props['server-name'] = name || 'Bedrock Server';
    fs.writeFileSync(p, writePropertiesString(props));
  } else if (serverType === 'nukkit') {
    const p = path.join(dir, 'nukkit.yml');
    if (!fs.existsSync(p)) fs.writeFileSync(p, `server-port: ${port}\nserver-ip: "0.0.0.0"\n`);
  }
}

function parseProperties(content) {
  const out = {};
  content.split('\n').forEach(line => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if (v === 'true' || v === 'false') v = v === 'true';
    else if (/^-?\d+$/.test(v)) v = parseInt(v, 10);
    out[k] = v;
  });
  return out;
}

function writePropertiesString(props) {
  return Object.entries(props).map(([k, v]) => `${k}=${v}`).join('\n') + '\n';
}

async function cmdCreate(serverId, payload) {
  const dir = serverDir(serverId);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length > 0) {
    // Re-run create = reinstall (preserve config files)
    log(`[create] server ${serverId} already exists; refreshing software`);
  }
  ensureDir(dir);
  const type = payload.serverType || payload.runtime || 'vanilla';
  const version = payload.version || 'latest';
  const port = payload.port || 25565;
  const name = payload.name || `Server-${serverId}`;
  const ram = payload.ram || 1024;
  const disk = payload.disk || 10240;  // in MB
  
  // Write allocated RAM and DISK to files for stats calculation
  fs.writeFileSync(path.join(dir, '.ram_mb'), String(ram), 'utf8');
  fs.writeFileSync(path.join(dir, '.disk_mb'), String(disk), 'utf8');

  // Multi-Language Bot Hosting Check (Python, Node.js, Bun)
  const isBot = ['python', 'nodejs', 'node', 'bun', 'bot', 'discord_bot', 'telegram_bot'].includes(type.toLowerCase()) || payload.category === 'bot';

  if (isBot) {
    const botRuntime = type.toLowerCase().includes('python') ? 'python' : type.toLowerCase().includes('bun') ? 'bun' : 'nodejs';
    fs.writeFileSync(path.join(dir, '.runtime_type'), botRuntime, 'utf8');

    if (botRuntime === 'python') {
      const mainPy = path.join(dir, 'main.py');
      if (!fs.existsSync(mainPy)) {
        fs.writeFileSync(mainPy, `# ${name} - Python Bot\nimport os, sys, time\nprint(f"[AetherNode] Python runtime initialized: {sys.version.split()[0]}")\nprint("[AetherNode] Bot environment online. Configure your Discord/Telegram bot token and logic.")\nwhile True:\n    time.sleep(15)\n`);
      }
      const reqTxt = path.join(dir, 'requirements.txt');
      if (!fs.existsSync(reqTxt)) {
        fs.writeFileSync(reqTxt, `# Python Bot Requirements\ndiscord.py>=2.3.0\npython-dotenv>=1.0.0\n`);
      }
    } else if (botRuntime === 'bun') {
      const indexTs = path.join(dir, 'index.ts');
      if (!fs.existsSync(indexTs)) {
        fs.writeFileSync(indexTs, `// ${name} - Bun Bot Runtime\nconsole.log("[AetherNode] Bun bot process initialized: " + process.version);\nconsole.log("[AetherNode] Bot environment online. Add your bot token and logic.");\nsetInterval(() => {}, 15000);\n`);
      }
    } else {
      // Node.js
      const indexJs = path.join(dir, 'index.js');
      if (!fs.existsSync(indexJs)) {
        fs.writeFileSync(indexJs, `// ${name} - Node.js Bot Runtime\nconsole.log("[AetherNode] Node.js process initialized: " + process.version);\nconsole.log("[AetherNode] Bot environment online. Add your discord.js or bot code.");\nsetInterval(() => {}, 15000);\n`);
      }
      const pkgJson = path.join(dir, 'package.json');
      if (!fs.existsSync(pkgJson)) {
        fs.writeFileSync(pkgJson, JSON.stringify({
          name: name.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
          version: "1.0.0",
          main: "index.js",
          scripts: { "start": "node index.js" },
          dependencies: {
            "discord.js": "^14.16.3",
            "dotenv": "^16.4.5"
          }
        }, null, 2));
      }
    }

    log(`[create] Bot hosting environment ${serverId} ready (${botRuntime}, ram ${ram}MB, disk ${disk}MB)`);
    return { ok: true, result: { serverId, type: botRuntime, version, port } };
  }
  
  // Minecraft Server creation
  await downloadServer(serverId, type, version);
  await ensureEula(serverId);
  await writeDefaultConfig(serverId, type, port, name);
  
  log(`[create] Minecraft server ${serverId} ready (${type} ${version}, port ${port}, ram ${ram}MB, disk ${disk}MB)`);
  return { ok: true, result: { serverId, type, version, port } };
}

async function cmdStart(serverId, payload) {
  if (serverProcesses.has(serverId)) {
    return { ok: true, result: { alreadyRunning: true } };
  }
  const dir = serverDir(serverId);
  if (!fs.existsSync(dir)) throw new Error('Server directory missing; reinstall first');

  // CRITICAL: Validate and enforce server port from payload BEFORE starting
  if (payload.port) {
    try {
      const propsFile = path.join(dir, 'server.properties');
      if (fs.existsSync(propsFile)) {
        const content = fs.readFileSync(propsFile, 'utf8');
        const props = parseProperties(content);
        
        if (props['server-port'] !== payload.port) {
          log(`[start] Enforcing port ${payload.port} for server ${serverId} (was ${props['server-port']})`);
          props['server-port'] = payload.port;
          fs.writeFileSync(propsFile, writePropertiesString(props));
          log(`[start] ✅ Port corrected in server.properties to ${payload.port}`);
        } else {
          log(`[start] ✅ Port ${payload.port} confirmed in server.properties`);
        }
      }
    } catch (portErr) {
      log(`[start] Warning: Could not validate port in server.properties: ${portErr.message}`);
    }
  }

  logWriteStreams.delete(serverId);
  serverLineBuffers.delete(serverId);

  // Determine runtime & application type
  let runtimeType = payload.runtime || payload.serverType || '';
  if (fs.existsSync(path.join(dir, '.runtime_type'))) {
    try { runtimeType = fs.readFileSync(path.join(dir, '.runtime_type'), 'utf8').trim(); } catch {}
  }

  const isPythonBot = runtimeType === 'python' || fs.existsSync(path.join(dir, 'main.py')) || fs.existsSync(path.join(dir, 'bot.py')) || fs.existsSync(path.join(dir, 'requirements.txt'));
  const isBunBot = runtimeType === 'bun' || fs.existsSync(path.join(dir, 'index.ts')) || fs.existsSync(path.join(dir, 'bot.ts'));
  const isNodeBot = runtimeType === 'nodejs' || runtimeType === 'node' || (!fs.existsSync(path.join(dir, 'server.properties')) && (fs.existsSync(path.join(dir, 'package.json')) || fs.existsSync(path.join(dir, 'index.js')) || fs.existsSync(path.join(dir, 'bot.js'))));
  const isBot = isPythonBot || isBunBot || isNodeBot;

  serverStopFlags.set(serverId, false);
  let child;

  if (isPythonBot) {
    // Python Bot Runtime (unbuffered output for instant live console logs)
    const entry = fs.existsSync(path.join(dir, 'main.py')) ? 'main.py' : fs.existsSync(path.join(dir, 'bot.py')) ? 'bot.py' : fs.existsSync(path.join(dir, 'app.py')) ? 'app.py' : 'main.py';
    const pyBin = process.platform === 'win32' ? 'python' : 'python3';
    log(`[start] Launching Python Bot ${serverId} with entrypoint: ${entry}`);
    child = spawn(pyBin, ['-u', entry], {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONUNBUFFERED: '1', FORCE_COLOR: '1', ...(payload.envVars || {}) }
    });
  } else if (isBunBot) {
    // Bun Bot Runtime
    const entry = fs.existsSync(path.join(dir, 'index.ts')) ? 'index.ts' : fs.existsSync(path.join(dir, 'bot.ts')) ? 'bot.ts' : 'index.ts';
    log(`[start] Launching Bun Bot ${serverId} with entrypoint: ${entry}`);
    child = spawn('bun', ['run', entry], {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1', ...(payload.envVars || {}) }
    });
  } else if (isNodeBot) {
    // Node.js Bot Runtime
    const entry = fs.existsSync(path.join(dir, 'index.js')) ? 'index.js' : fs.existsSync(path.join(dir, 'bot.js')) ? 'bot.js' : fs.existsSync(path.join(dir, 'app.js')) ? 'app.js' : 'index.js';
    log(`[start] Launching Node.js Bot ${serverId} with entrypoint: ${entry}`);
    child = spawn('node', [entry], {
      cwd: dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '1', ...(payload.envVars || {}) }
    });
  } else {
    // Minecraft Server Runtime
    let type = 'vanilla';
    if (fs.existsSync(path.join(dir, 'velocity.toml'))) type = 'velocity';
    else if (fs.existsSync(path.join(dir, 'nukkit.yml'))) type = 'nukkit';
    else if (fs.existsSync(path.join(dir, 'bedrock_server')) || fs.existsSync(path.join(dir, 'bedrock_server.exe'))) type = 'bedrock';

    if (type === 'bedrock') {
      const exe = process.platform === 'win32' ? 'bedrock_server.exe' : path.join(dir, 'bedrock_server');
      if (process.platform !== 'win32' && fs.existsSync(path.join(dir, 'bedrock_server'))) {
        try { fs.chmodSync(path.join(dir, 'bedrock_server'), 0o755); } catch {}
      }
      child = spawn(exe, [], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
    } else {
      // Find jar
      const jars = fs.readdirSync(dir).filter(f => f.endsWith('.jar') && !f.includes('installer'));
      if (jars.length === 0) throw new Error('No server jar found; reinstall server');
      const jar = jars[0];
      const ram = payload.ram || 1024;
      const xms = Math.max(64, Math.floor(ram / 2));
      
      let startupCmd = payload.startup_command || `java -Xms${xms}M -Xmx${ram}M -jar ${jar} nogui`;
      startupCmd = startupCmd.replace(/{xms}/g, xms).replace(/{ram}/g, ram).replace(/{jar}/g, jar);
      
      const parts = startupCmd.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
      const args = parts.slice(1);
      
      child = spawn('java', args, {
        cwd: dir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '1', CLICOLOR_FORCE: '1', TERM: process.env.TERM || 'xterm-256color' }
      });
    }
  }

  serverProcesses.set(serverId, child);
  serverStartTimes.set(serverId, Date.now());
  
  // Persist start time and PID
  const serverDir_persist = serverDir(serverId);
  try {
    fs.writeFileSync(path.join(serverDir_persist, '.server.starttime'), String(Date.now()), 'utf8');
    fs.writeFileSync(path.join(serverDir_persist, '.server.pid'), String(child.pid), 'utf8');
    log(`[start] Persisted start time and PID for server ${serverId} (pid=${child.pid})`);
  } catch (err) {
    log(`[start] Warning: Failed to persist start time/pid for server ${serverId}: ${err.message}`);
  }

  // IMPORTANT: Minecraft's Log4j logger is the single owner of logs/latest.log.
  // Do NOT create, truncate, or write to that file from this agent. Mixing Log4j
  // with process stdout creates duplicate/mangled lines in servers/<id>/logs/latest.log.
  // Keep native Log4j as the sole writer of latest.log, but preserve the raw
  // process output separately for live console ANSI colors.
  const logsDir = path.join(serverDir_persist, 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  consoleOutputBuffers.set(serverId, { data: Buffer.alloc(0), baseOffset: 0, totalOffset: 0 });
  const appendConsoleOutput = (chunk) => {
    const state = consoleOutputBuffers.get(serverId);
    if (!state) return;
    const incoming = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    state.data = Buffer.concat([state.data, incoming]);
    state.totalOffset += incoming.length;
    const maxBytes = 2 * 1024 * 1024;
    if (state.data.length > maxBytes) {
      const removeBytes = state.data.length - maxBytes;
      state.data = state.data.subarray(removeBytes);
      state.baseOffset += removeBytes;
    }
    if (isBot) {
      try { fs.appendFileSync(path.join(logsDir, 'latest.log'), incoming); } catch {}
    }
  };
  if (child.stdout) child.stdout.on('data', appendConsoleOutput);
  if (child.stderr) child.stderr.on('data', appendConsoleOutput);

  child.on('exit', (code, signal) => {
    log(`[start] server ${serverId} exited code=${code} signal=${signal}`);
    
    // Close the log stream
    try {
      logStream.end();
    } catch {}
    
    serverProcesses.delete(serverId);
    serverStartTimes.delete(serverId);
    logWriteStreams.delete(serverId);
    serverLineBuffers.delete(serverId);
    consoleOutputBuffers.delete(serverId);
    
    try {
      fs.unlinkSync(path.join(serverDir_persist, '.server.pid'));
    } catch {}
    
    if (!serverStopFlags.get(serverId)) {
      log(`[start] server ${serverId} crashed unexpectedly`);
    }
  });

  return { ok: true, result: { pid: child.pid, type } };
}

async function cmdStop(serverId, payload) {
  const child = serverProcesses.get(serverId);
  if (!child) {
    // The agent was restarted while the server kept running, so the original
    // stdin pipe is gone and a graceful "stop" cannot be delivered. Terminate
    // the detached JVM that is listening on the server port instead.
    const port = getServerPort(serverId);
    const listenerPid = await findListeningPid(port);
    if (!listenerPid) return { ok: true, result: { alreadyStopped: true } };

    log(`[stop] Server ${serverId} is detached (pid=${listenerPid}); terminating process`);
    try {
      process.kill(listenerPid);
      log(`[stop] Detached process ${listenerPid} terminated`);
    } catch (err) {
      log(`[stop] Failed to terminate detached pid ${listenerPid}: ${err.message}`);
      throw new Error(`Could not stop detached server process: ${err.message}`);
    }

    try { fs.unlinkSync(path.join(serverDir(serverId), '.server.pid')); } catch {}
    try { fs.unlinkSync(path.join(serverDir(serverId), '.server.starttime')); } catch {}
    rotateServerLog(serverId);
    return { ok: true, result: { detachedKilled: true } };
  }
  serverStopFlags.set(serverId, true);
  const force = !!payload.force;
  if (!force) {
    try { child.stdin.write('stop\n'); } catch {}
    const stopped = await waitForExit(child, 30000);
    if (!stopped) {
      log(`[stop] graceful stop timed out for server ${serverId}; killing`);
      try { child.kill('SIGKILL'); } catch {}
    }
  } else {
    try { child.kill('SIGKILL'); } catch {}
  }
  
  // Rotate the log file on server stop
  rotateServerLog(serverId);
  
  return { ok: true, result: {} };
}

async function cmdRestart(serverId, payload) {
  await cmdStop(serverId, { force: payload.force });
  await new Promise(r => setTimeout(r, 2000));
  return await cmdStart(serverId, payload);
}

async function cmdReinstall(serverId, payload) {
  await cmdStop(serverId, { force: true });
  const type = payload.serverType || 'vanilla';
  const version = payload.version || 'latest';
  const port = payload.port || 25565;
  const name = payload.name || `Server-${serverId}`;
  // Only refresh software/config, keep world and player data
  await downloadServer(serverId, type, version);
  await ensureEula(serverId);
  await writeDefaultConfig(serverId, type, port, name);
  return { ok: true, result: { type, version } };
}

async function cmdDelete(serverId) {
  await cmdStop(serverId, { force: true });
  const dir = serverDir(serverId);
  if (fs.existsSync(dir)) {
    await fsp.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
  }
  return { ok: true, result: {} };
}

// ------------------------------------------------------------
// Stats / logs / players
// ------------------------------------------------------------
// pidusage reports CPU as a delta since the previous call for the same PID, so
// overlapping stats requests would see ~0% CPU. Cache briefly and share one
// in-flight computation so every consumer gets the same real sample.
const statsCache = new Map(); // serverId -> { at, data }
const statsInflight = new Map(); // serverId -> Promise
async function cmdStats(serverId) {
  const cached = statsCache.get(serverId);
  if (cached && Date.now() - cached.at < 1000) return cached.data;
  if (statsInflight.has(serverId)) return statsInflight.get(serverId);

  const pending = computeStats(serverId).then((data) => {
    statsCache.set(serverId, { at: Date.now(), data });
    statsInflight.delete(serverId);
    return data;
  }, (err) => {
    statsInflight.delete(serverId);
    throw err;
  });
  statsInflight.set(serverId, pending);
  return pending;
}

async function computeStats(serverId) {
  const child = serverProcesses.get(serverId);
  const dir = serverDir(serverId);
  let cpu = 0, memBytes = 0;

  const processTracked = child && child.pid && !child.killed;
  const isBot = fs.existsSync(path.join(dir, '.runtime_type')) || 
    (!fs.existsSync(path.join(dir, 'server.properties')) && (
      fs.existsSync(path.join(dir, 'main.py')) || 
      fs.existsSync(path.join(dir, 'bot.py')) || 
      fs.existsSync(path.join(dir, 'package.json')) || 
      fs.existsSync(path.join(dir, 'index.ts'))
    ));

  let isActuallyRunning = false;
  let isStarting = false;
  let statsPid = 0;

  if (isBot) {
    const persistedPid = readPersistedServerPid(serverId);
    isActuallyRunning = Boolean(processTracked || (persistedPid > 0 && isPidAlive(persistedPid)));
    statsPid = processTracked ? child.pid : persistedPid;
  } else {
    // Minecraft port check & JVM tracking
    const portResponding = await isServerPortListening(serverId);
    isActuallyRunning = portResponding;
    const javaPid = await findJavaProcessForServer(serverId);
    isStarting = !isActuallyRunning && javaPid > 0;
    const port = getServerPort(serverId);
    const listenerPid = isActuallyRunning ? await findListeningPid(port) : 0;
    statsPid = listenerPid || javaPid || (processTracked ? child.pid : 0);

    if (isActuallyRunning && !processTracked) {
      if (!detachedLogged.has(serverId)) {
        detachedLogged.add(serverId);
        log(`[stats] Server ${serverId}: Found detached process still running on port`);
      }
    } else {
      detachedLogged.delete(serverId);
    }
  }

  // Collect live process stats while starting too, so CPU/RAM appear in real time during boot
  if (isActuallyRunning || isStarting) {
    try {
      if (statsPid) {
        const s = await pidusage(statsPid);
        // Get raw CPU from pidusage
        const rawCpu = Math.min(s.cpu || 0, 100);

        // Add to history for smoothing
        if (!serverCpuHistory.has(serverId)) {
          serverCpuHistory.set(serverId, []);
        }
        const history = serverCpuHistory.get(serverId);
        history.push(rawCpu);

        // Keep only last 5 samples (smoother average)
        if (history.length > 5) {
          history.shift();
        }

        // Calculate average CPU for more stable display
        cpu = history.length > 0 ? history.reduce((a, b) => a + b, 0) / history.length : 0;
        cpu = Math.round(cpu * 10) / 10; // Round to 1 decimal

        // Memory: use RSS but only if server seems active
        const start = serverStartTimes.get(serverId);
        const uptime = start ? Date.now() - start : 0;

        // Only report memory if uptime > 1 second (initialization complete)
        if (uptime > 1000) {
          memBytes = s.memory || 0;
        }
      } else {
        // Running but no measurable process - just clear history
        serverCpuHistory.delete(serverId);
      }
    } catch (err) {
      log(`[stats] pidusage error: ${err.message}`);
      // Clear CPU history on error
      serverCpuHistory.delete(serverId);
    }
  } else {
    // Clear history when server stops
    serverCpuHistory.delete(serverId);
    
    // Log why server is stopped
    if (processTracked) {
      log(`[stats] Server ${serverId}: Process tracked but port NOT responding - server crashed`);
    } else {
      log(`[stats] Server ${serverId}: Not tracking and port not responding - server stopped`);
    }
  }
  
  const { diskPercent, diskUsedMB } = await getDirSizeDetailed(dir);
  const ramGb = memBytes / (1024 * 1024 * 1024);
  const start = serverStartTimes.get(serverId);
  const uptime = start && (isActuallyRunning || isStarting) ? Date.now() - start : 0;
  const players = await readOnlinePlayersFromLog(serverId);
  
  // Read maxPlayers from server.properties
  let maxPlayers = 20;
  try {
    const propsFile = path.join(dir, 'server.properties');
    if (fs.existsSync(propsFile)) {
      const content = fs.readFileSync(propsFile, 'utf8');
      const props = parseProperties(content);
      maxPlayers = Number(props['max-players']) || 20;
    }
  } catch (err) {
    log(`[stats] Warning: Could not read max-players from server.properties: ${err.message}`);
  }
  
  const status = isActuallyRunning ? 'running' : (isStarting ? 'starting' : 'stopped');
  return {
    ok: true,
    result: {
      cpu: cpu, // Smoothed CPU usage percentage
      ramGb: ramGb, // Actual RAM in GB
      ramUsed: ramGb.toFixed(2),
      ramMax: ((payloadRamGb(serverId)) || 0).toFixed(2),
      memory: memBytes, // Raw bytes for internal use
      disk: diskPercent,
      diskPercent: diskPercent,
      diskUsedMB: diskUsedMB,
      players: players.length,
      maxPlayers: maxPlayers,
      playerList: players,
      tps: readTpsFromLog(serverId), // Real value from latest.log, null when unknown
      uptime,
      status,
    },
  };
}

function serverIsRunning(serverId) {
  // Check if server process exists and hasn't been terminated
  const child = serverProcesses.get(serverId);
  return child && child.pid && !child.killed;
}

// Check if a Minecraft server is actually listening on its port
async function isServerPortListening(serverId) {
  try {
    const dir = serverDir(serverId);
    const propsFile = path.join(dir, 'server.properties');
    
    if (!fs.existsSync(propsFile)) {
      return false;
    }
    
    const content = fs.readFileSync(propsFile, 'utf8');
    const props = parseProperties(content);
    const port = Number(props['server-port']) || 25565;
    
    // Try to connect to the port to verify server is listening
    return new Promise((resolve) => {
      const socket = require('net').createConnection({
        host: 'localhost',
        port: port,
        timeout: 2000
      });
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('error', () => {
        resolve(false);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });
  } catch (err) {
    log(`[server-port-check] Error checking port: ${err.message}`);
    return false;
  }
}

function getServerPort(serverId) {
  try {
    const propsFile = path.join(serverDir(serverId), 'server.properties');
    if (!fs.existsSync(propsFile)) return 0;
    return Number(parseProperties(fs.readFileSync(propsFile, 'utf8'))['server-port']) || 0;
  } catch {
    return 0;
  }
}

// Resolve the PID of the process actually listening on the game port. This is
// the JVM even when it was started through a shell wrapper or survived an agent
// restart, which keeps CPU/RAM stats accurate in both cases.
const detachedLogged = new Set();
const listeningPidCache = new Map(); // port -> { pid, at }
function findListeningPid(port) {
  // Strict numeric validation - port is interpolated into a shell command
  // below, so anything non-numeric must be rejected outright.
  port = Number(port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.resolve(0);
  const cached = listeningPidCache.get(port);
  if (cached && Date.now() - cached.at < 3000) return Promise.resolve(cached.pid);

  return new Promise((resolve) => {
    const finish = (pid) => {
      const value = Number(pid) || 0;
      listeningPidCache.set(port, { pid: value, at: Date.now() });
      resolve(value);
    };

    if (process.platform === 'win32') {
      exec('netstat -ano -p tcp', { timeout: 4000, windowsHide: true }, (err, stdout) => {
        if (err && !stdout) return finish(0);
        const match = new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`, 'i').exec(String(stdout || ''));
        return finish(match ? match[1] : 0);
      });
    } else {
      exec(`ss -ltnp 2>/dev/null | grep ':${port} '`, { timeout: 4000 }, (err, stdout) => {
        const match = /pid=(\d+)/.exec(String(stdout || ''));
        return finish(match ? match[1] : 0);
      });
    }
  });
}

function isPidAlive(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}

function readPersistedServerPid(serverId) {
  try {
    const p = path.join(serverDir(serverId), '.server.pid');
    if (!fs.existsSync(p)) return 0;
    const pid = Number(String(fs.readFileSync(p, 'utf8')).trim());
    return Number.isInteger(pid) && pid > 0 ? pid : 0;
  } catch (e) { return 0; }
}

// Find the java process for a server even while it is still booting (port not
// yet listening) or when the process was detached by an agent restart.
async function findJavaProcessForServer(serverId) {
  const child = serverProcesses.get(serverId);
  if (child && child.pid && !child.killed && isPidAlive(child.pid)) return child.pid;

  const persistedPid = readPersistedServerPid(serverId);
  if (!persistedPid || !isPidAlive(persistedPid)) return 0;

  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync(`wmic process where "processid=${persistedPid}" get name /value`, { timeout: 6000, windowsHide: true });
      if (/java/i.test(String(stdout || ''))) return persistedPid;
    } else {
      const { stdout } = await execAsync(`ps -p ${persistedPid} -o comm=`, { timeout: 6000 });
      if (/java/i.test(String(stdout || ''))) return persistedPid;
    }
  } catch (e) {
    log(`[stats] findJavaProcessForServer ${serverId}: ${e.message}`);
  }
  return 0;
}

// Real TPS: parse the latest.log for the most recent "TPS from last 1m, 5m, 15m"
// line (printed by Paper/Purpur on /tps). Returns null when unknown instead of
// inventing a number.
const tpsCache = new Map(); // serverId -> { at, value }
function readTpsFromLog(serverId) {
  const cached = tpsCache.get(serverId);
  if (cached && Date.now() - cached.at < 30000) return cached.value;

  let value = null;
  try {
    const logFile = path.join(serverDir(serverId), 'logs', 'latest.log');
    if (fs.existsSync(logFile)) {
      const size = fs.statSync(logFile).size;
      const fd = fs.openSync(logFile, 'r');
      const buf = Buffer.alloc(Math.min(size, 256 * 1024));
      fs.readSync(fd, buf, 0, buf.length, Math.max(0, size - buf.length));
      fs.closeSync(fd);
      const text = buf.toString('utf8');
      const re = /TPS from last 1m, 5m, 15m:\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/g;
      let m;
      while ((m = re.exec(text)) !== null) {
        const v = Number(m[1]);
        if (Number.isFinite(v)) value = v;
      }
    }
  } catch (e) {
    log(`[stats] readTpsFromLog ${serverId}: ${e.message}`);
  }
  tpsCache.set(serverId, { at: Date.now(), value });
  return value;
}

function payloadRamGb(serverId) {
  const p = path.join(serverDir(serverId), '.ram_mb');
  try { return Number(fs.readFileSync(p, 'utf8')) / 1024; } catch { return 0; }
}

async function getDirSize(dir) {
  // Returns percentage of allocated disk; falls back to MB used if no limit known
  let total = 0;
  try {
    const walk = async (d) => {
      const entries = await fsp.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) total += (await fsp.stat(p)).size;
      }
    };
    if (fs.existsSync(dir)) await walk(dir);
  } catch {}
  // Compute percentage against .disk_mb file if present, otherwise return MB used
  const allocFile = path.join(dir, '.disk_mb');
  let allocMb = 10240;
  try { allocMb = Number(fs.readFileSync(allocFile, 'utf8')) || 10240; } catch {}
  const usedMb = total / (1024 * 1024);
  return Math.min(100, (usedMb / allocMb) * 100);
}

async function getDirSizeDetailed(dir) {
  // Returns both percentage and actual used MB
  let total = 0;
  try {
    const walk = async (d) => {
      const entries = await fsp.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) total += (await fsp.stat(p)).size;
      }
    };
    if (fs.existsSync(dir)) await walk(dir);
  } catch {}
  // Compute percentage against .disk_mb file if present
  const allocFile = path.join(dir, '.disk_mb');
  let allocMb = 10240;
  try { allocMb = Number(fs.readFileSync(allocFile, 'utf8')) || 10240; } catch {}
  const usedMb = total / (1024 * 1024);
  const diskPercent = Math.min(100, (usedMb / allocMb) * 100);
  return { diskPercent, diskUsedMB: usedMb };
}

async function cmdLogs(serverId, payload) {
  const lines = payload.lines || 200;
  const logFile = path.join(serverDir(serverId), 'logs', 'latest.log');
  if (!fs.existsSync(logFile)) return { ok: true, result: { logs: [] } };
  const content = await readLastLines(logFile, lines);
  return { ok: true, result: { logs: content } };
}

async function readLastLines(file, maxLines) {
  const stat = await fsp.stat(file);
  const maxBytes = 8 * 1024 * 1024; // Read a large enough tail for real console history (up to 8 MiB).
  const start = Math.max(0, stat.size - maxBytes);
  const fd = await fsp.open(file, 'r');
  const buf = Buffer.alloc(stat.size - start);
  await fd.read(buf, 0, buf.length, start);
  await fd.close();
  return buf.toString('utf8').split('\n').slice(-maxLines);
}

async function readOnlinePlayersFromLog(serverId) {
  // Best-effort: scan latest.log for join/leave and /list responses
  try {
    const logFile = path.join(serverDir(serverId), 'logs', 'latest.log');
    if (!fs.existsSync(logFile)) return [];
    const lines = await readLastLines(logFile, 2000);
    const players = new Set();
    for (const line of lines) {
      const joined = /:\s*(\w+)\s+joined the game/i.exec(line);
      if (joined) players.add(joined[1]);
      const left = /:\s*(\w+)\s+left the game/i.exec(line);
      if (left) players.delete(left[1]);
      const list = /There are \d+(?:\/| of a max of )\d+ players online:\s*(.*)/i.exec(line);
      if (list) {
        players.clear();
        list[1].split(',').map(s => s.trim()).filter(Boolean).forEach(p => players.add(p));
      }
    }
    return [...players];
  } catch { return []; }
}

async function cmdPlayerList(serverId) {
  return { ok: true, result: { players: await readOnlinePlayersFromLog(serverId) } };
}

async function cmdPlayerAction(serverId, payload) {
  const { action, name, reason } = payload;
  
  // Special case: whitelist-toggle modifies server.properties instead of sending command
  if (action === 'whitelist-toggle') {
    return await cmdWhitelistToggle(serverId, payload);
  }
  
  const child = serverProcesses.get(serverId);
  if (!child) throw new Error('Server not running');
  const cmd = buildPlayerCommand(action, name, reason);
  child.stdin.write(cmd + '\n');
  return { ok: true, result: { command: cmd } };
}

async function cmdWhitelistToggle(serverId, payload) {
  const enabled = Boolean(payload.enabled);
  const propertiesPath = path.join(serverDir(serverId), 'server.properties');
  
  if (!fs.existsSync(propertiesPath)) {
    throw new Error('server.properties not found');
  }
  
  try {
    let content = fs.readFileSync(propertiesPath, 'utf8');
    const lines = content.split('\n');
    let found = false;
    
    const updated = lines.map(line => {
      if (line.trim().startsWith('white-list=')) {
        found = true;
        return `white-list=${enabled}`;
      }
      return line;
    }).join('\n');
    
    // If not found, add it
    let finalContent = updated;
    if (!found) {
      finalContent = updated + (updated.endsWith('\n') ? '' : '\n') + `white-list=${enabled}\n`;
    }
    
    fs.writeFileSync(propertiesPath, finalContent, 'utf8');
    log(`[whitelist-toggle] Whitelist ${enabled ? 'enabled' : 'disabled'}`);
    
    return { ok: true, result: { enabled, message: `Whitelist ${enabled ? 'enabled' : 'disabled'}` } };
  } catch (err) {
    throw new Error(`Failed to update server.properties: ${err.message}`);
  }
}

function buildPlayerCommand(action, name, reason) {
  switch (action) {
    case 'op':         return `op ${name}`;
    case 'deop':       return `deop ${name}`;
    case 'whitelist-add':    return `whitelist add ${name}`;
    case 'whitelist-remove': return `whitelist remove ${name}`;
    case 'whitelist-toggle': 
      // This is handled separately via server.properties modification
      throw new Error('Use cmdWhitelistToggle instead');
    case 'ban':        return `ban ${name} ${reason || ''}`;
    case 'pardon':     return `pardon ${name}`;
    case 'kick':       return `kick ${name} ${reason || ''}`;
    default: throw new Error(`Unknown player action: ${action}`);
  }
}

// ------------------------------------------------------------
// Console
// ------------------------------------------------------------
async function cmdConsoleCommand(serverId, payload) {
  const child = serverProcesses.get(serverId);
  if (!child) {
    const port = getServerPort(serverId);
    const listenerPid = await findListeningPid(port);
    if (listenerPid) {
      throw new Error('Server is running detached after an agent restart; restart the server from the panel to re-enable console commands');
    }
    throw new Error('Server not running');
  }
  child.stdin.write(String(payload.command) + '\n');
  return { ok: true, result: { sent: true } };
}

// The agent intentionally does not write stdout/stderr to logs/latest.log.
// The Minecraft server's logging system owns that file; the panel tails it directly.
const serverLineBuffers = new Map();

// Lifetime Players and player NBT data
// ------------------------------------------------------------
function parseJavaPlayerNbt(buffer) {
  return new Promise((resolve, reject) => {
    // .dat files are gzip-compressed, decompress first
    zlib.gunzip(buffer, (err, decompressed) => {
      if (err) {
        // If gzip fails, try parsing as raw NBT
        return NBT.parse(buffer, 'big', (err, parsed) => {
          if (err) return reject(err);
          if (!parsed || !parsed.value) return reject(new Error('NBT parser returned an empty root tag'));
          resolve(parsed);
        });
      }
      // Parse decompressed NBT
      NBT.parse(decompressed, 'big', (err, parsed) => {
        if (err) return reject(err);
        if (!parsed || !parsed.value) return reject(new Error('NBT parser returned an empty root tag'));
        resolve(parsed);
      });
    });
  });
}

function loadUserCache(serverId) {
  const cachePath = safeJoin(serverId, 'usercache.json');
  const map = new Map();
  try {
    const rows = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (Array.isArray(rows)) {
      for (const row of rows) {
        if (row && row.uuid && row.name) {
          map.set(String(row.uuid).replace(/-/g, '').toLowerCase(), String(row.name));
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') log(`[lifetime-players] Could not read usercache.json: ${err.message}`);
  }
  return map;
}

async function cmdLifetimePlayers(serverId) {
  try {
    const playerDataDir = path.join(safeJoin(serverId, 'world'), 'playerdata');
    if (!fs.existsSync(playerDataDir)) return { ok: true, result: { players: [], totalPlayers: 0 } };

    const nameCache = loadUserCache(serverId);
    const players = [];
    const datFiles = fs.readdirSync(playerDataDir).filter(f => /^[a-f0-9-]{36}\.dat$/i.test(f));
    for (const file of datFiles) {
      try {
        const uuid = file.slice(0, -4);
        const filePath = path.join(playerDataDir, file);
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
        const normalizedUuid = uuid.replace(/-/g, '').toLowerCase();
        const name = nameCache.get(normalizedUuid) || uuid;
        players.push({
          name,
          uuid,
          lastSeen: stat.mtime.toISOString(),
          fileSize: stat.size,
          fileSizeBytes: stat.size,
          lastModified: stat.mtime.toISOString()
        });
      } catch (err) {
        log(`[lifetime-players] Error reading player file ${file}: ${err.message}`);
      }
    }
    players.sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
    log(`[lifetime-players] Loaded ${players.length} player files for server ${serverId}`);
    return { ok: true, result: { players, totalPlayers: players.length } };
  } catch (err) {
    log(`[lifetime-players] Error: ${err.message}`);
    throw err;
  }
}

async function cmdPlayerData(serverId, uuid) {
  if (typeof uuid !== 'string' || !/^[a-f0-9-]{36}$/i.test(uuid)) throw new Error('Invalid UUID format');
  const playerDataDir = path.join(safeJoin(serverId, 'world'), 'playerdata');
  const playerDataFile = path.resolve(playerDataDir, `${uuid}.dat`);
  if (!playerDataFile.startsWith(path.resolve(playerDataDir) + path.sep)) throw new Error('Invalid player data path');
  if (!fs.existsSync(playerDataFile)) return { ok: true, result: { playerFound: false, error: 'Player data file not found' } };

  const buffer = await fsp.readFile(playerDataFile);
  const parsed = await parseJavaPlayerNbt(buffer);
  // Keep the complete typed NBT tag tree: the existing viewer reads tag.value fields.
  const data = parsed.value;
  const names = loadUserCache(serverId);
  const playerName = names.get(uuid.replace(/-/g, '').toLowerCase()) || uuid;
  const stat = await fsp.stat(playerDataFile);
  return {
    ok: true,
    result: {
      playerFound: true,
      playerName,
      uuid,
      fileSize: stat.size,
      lastModified: stat.mtime.toISOString(),
      data
    }
  };
}

// ------------------------------------------------------------
// Plugins
// ------------------------------------------------------------
async function cmdPluginList(serverId) {
  const dir = safeJoin(serverId, 'plugins');
  if (!fs.existsSync(dir)) return { ok: true, result: { plugins: [] } };
  const plugins = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.jar')) continue;
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    const info = extractPluginInfo(full, f);
    plugins.push({
      name: info.name, filename: f, version: info.version,
      description: info.description, author: info.author,
      size: stat.size, formattedSize: formatSize(stat.size),
      enabled: !f.endsWith('.disabled.jar'),
    });
  }
  plugins.sort((a, b) => a.name.localeCompare(b.name));
  return { ok: true, result: { plugins } };
}

function extractPluginInfo(jarPath, filename) {
  try {
    const zip = new AdmZip(jarPath);
    for (const candidate of ['plugin.yml', 'paper-plugin.yml', 'bungee.yml']) {
      const entry = zip.getEntry(candidate);
      if (entry) {
        const data = yaml.load(zip.readAsText(entry));
        if (data) {
          return {
            name: data.name || filename.replace('.jar', ''),
            version: data.version || 'Unknown',
            description: data.description || null,
            author: data.author || (data.authors && data.authors[0]) || null,
          };
        }
      }
    }
  } catch {}
  return { name: filename.replace('.jar', ''), version: 'Unknown', description: null, author: null };
}

async function cmdPluginInstall(serverId, payload) {
  const dir = safeJoin(serverId, 'plugins');
  ensureDir(dir);
  const filename = sanitize(payload.filename || `${payload.pluginName || 'plugin'}.jar`);
  const target = path.join(dir, filename);
  if (fs.existsSync(target)) throw new Error('Plugin already exists');
  const url = await assertSafeDownloadUrl(payload.url);
  log(`[plugin-install] downloading ${url}`);
  const res = await axios({ url, method: 'GET', responseType: 'stream', timeout: 270000, maxRedirects: 10,
    httpAgent, httpsAgent,
    headers: { 'User-Agent': 'MinecraftPanelAgent/1.0' } });
  await new Promise((resolve, reject) => {
    const w = fs.createWriteStream(target);
    res.data.pipe(w);
    res.data.on('error', reject);
    w.on('finish', resolve);
    w.on('error', reject);
  });
  return { ok: true, result: { filename } };
}

async function cmdPluginDelete(serverId, payload) {
  const file = sanitize(payload.filename || '');
  if (!file) throw new Error('Invalid filename');
  const target = safeJoin(serverId, path.join('plugins', file));
  if (!fs.existsSync(target)) throw new Error('Plugin not found');
  fs.unlinkSync(target);
  return { ok: true, result: { deleted: file } };
}

async function cmdPluginUpload(serverId, payload) {
  const dir = safeJoin(serverId, 'plugins');
  ensureDir(dir);
  const filename = sanitize(payload.filename || '');
  if (!filename.endsWith('.jar')) throw new Error('Only .jar files allowed');
  const target = path.join(dir, filename);
  if (fs.existsSync(target)) throw new Error('Plugin already exists');
  fs.writeFileSync(target, Buffer.from(payload.fileData || '', 'base64'));
  return { ok: true, result: { filename } };
}

// ------------------------------------------------------------
// File manager
// ------------------------------------------------------------
async function cmdFileList(serverId, payload) {
  const rel = payload.path || '/';
  const dir = safeJoin(serverId, rel);
  if (!fs.existsSync(dir)) return { ok: true, result: { files: [] } };
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    const stat = await fsp.stat(full).catch(() => null);
    files.push({
      name: e.name,
      path: `${rel === '/' ? '' : rel}/${e.name}`,
      isDirectory: e.isDirectory(),
      size: e.isDirectory() ? '-' : formatSize(stat?.size || 0),
      modified: stat?.mtime?.toISOString() || null,
    });
  }
  return { ok: true, result: { files } };
}

async function cmdFileRead(serverId, payload) {
  const target = safeJoin(serverId, payload.path);
  if (!fs.existsSync(target)) throw new Error('File not found');
  const stat = fs.statSync(target);
  if (stat.isDirectory()) throw new Error('Path is a directory');
  if (stat.size > 5 * 1024 * 1024) throw new Error('File too large to read (5MB max)');
  return { ok: true, result: { content: fs.readFileSync(target, 'utf8') } };
}

async function cmdFileWrite(serverId, payload) {
  const target = safeJoin(serverId, payload.path);
  ensureDir(path.dirname(target));
  fs.writeFileSync(target, String(payload.content ?? ''), 'utf8');
  return { ok: true, result: { saved: true } };
}

async function cmdFileDelete(serverId, payload, onProgress) {
  const target = safeJoin(serverId, payload.path);
  if (!fs.existsSync(target)) throw new Error('Not found');
  const stat = fs.statSync(target);

  if (!stat.isDirectory()) {
    fs.unlinkSync(target);
    if (onProgress) onProgress(100, 1, 1, `Deleted ${path.basename(target)}`);
    return { ok: true, result: { deleted: true } };
  }

  const name = path.basename(target);
  let total = 0;
  const countWalk = async (p) => {
    const entries = await fsp.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      total++;
      if (e.isDirectory()) await countWalk(path.join(p, e.name));
    }
  };
  await countWalk(target);
  if (onProgress) onProgress(0, 0, total, `Preparing to delete ${name} (${total} items)…`);

  let done = 0;
  const deleteWalk = async (p) => {
    const entries = await fsp.readdir(p, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) {
        await deleteWalk(full);
      } else {
        await fsp.rm(full, { force: true, maxRetries: 2, retryDelay: 150 });
      }
      done++;
      if (onProgress) onProgress(Math.round((done / total) * 100), done, total, `Deleting ${done}/${total} items…`);
    }
    await fsp.rmdir(p);
  };
  await deleteWalk(target);

  if (onProgress) onProgress(100, total, total, `Deleted ${name}`);
  return { ok: true, result: { deleted: true } };
}

async function cmdFileUpload(serverId, payload) {
  const dir = safeJoin(serverId, payload.path || '/');
  ensureDir(dir);
  const filename = sanitize(payload.filename || '');
  if (!filename) throw new Error('Invalid filename');
  fs.writeFileSync(path.join(dir, filename), Buffer.from(payload.fileData || '', 'base64'));
  return { ok: true, result: { filename } };
}

async function cmdFilePull(serverId, payload, onProgress) {
  // Validate URL and block private/internal targets (SSRF protection)
  const url = await assertSafeDownloadUrl(payload.url);
  
  const dir = safeJoin(serverId, payload.path || '/');
  ensureDir(dir);
  
  // Determine filename
  let filename = sanitize(payload.filename || '');
  if (!filename) {
    // Extract filename from URL
    try {
      const urlObj = new URL(url);
      filename = sanitize(path.basename(urlObj.pathname));
      if (!filename || filename === '/') {
        filename = `downloaded-${Date.now()}`;
      }
    } catch (e) {
      filename = `downloaded-${Date.now()}`;
    }
  }
  
  if (!filename) throw new Error('Could not determine filename');
  
  const targetPath = path.join(dir, filename);
  const fmt = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(0) + ' KB' : n + ' B';
  const report = (bytes, total, message) => {
    if (typeof onProgress !== 'function') return;
    const pct = total > 0 ? Math.min(100, (bytes / total) * 100) : 0;
    onProgress(pct, bytes, total, message);
  };
  report(0, 0, 'Connecting…');
  
  try {
    // axios streams + follows redirects (https.get would fail on 302s);
    // keep-alive agents reuse connections across consecutive downloads
    const res = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 270000, // 4.5 min — finishes before the panel's 5 min wait
      maxRedirects: 10,
      httpAgent,
      httpsAgent,
      headers: { 'User-Agent': 'MinecraftPanelAgent/1.0', Accept: '*/*' },
      validateStatus: (s) => s === 200,
    });
    const total = Number(res.headers['content-length']) || 0;
    
    await new Promise((resolve, reject) => {
      let bytes = 0;
      res.data.on('data', (chunk) => {
        bytes += chunk.length;
        report(bytes, total, total > 0
          ? `${fmt(bytes)} / ${fmt(total)} (${Math.round((bytes / total) * 100)}%)`
          : `${fmt(bytes)} received`);
      });
      const writeStream = fs.createWriteStream(targetPath);
      res.data.on('error', reject);
      res.data.pipe(writeStream);
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
    
    const stats = fs.statSync(targetPath);
    report(stats.size, stats.size, 'Download complete');
    return { ok: true, result: { filename, filesize: stats.size } };
  } catch (err) {
    try { fs.unlinkSync(targetPath); } catch (e) {}
    if (err.response) throw new Error(`HTTP ${err.response.status}: ${err.response.statusText}`);
    if (err.code === 'ECONNABORTED') throw new Error('Download timeout (4.5 minutes exceeded)');
    throw new Error(`Download failed: ${err.message}`);
  }
}

async function cmdFileCreate(serverId, payload) {
  const dir = safeJoin(serverId, payload.path || '/');
  ensureDir(dir);
  const filename = sanitize(payload.filename || '');
  if (!filename) throw new Error('Invalid filename');
  const target = path.join(dir, filename);
  if (fs.existsSync(target)) throw new Error('Already exists');
  if (payload.directory) fs.mkdirSync(target);
  else fs.writeFileSync(target, '');
  return { ok: true, result: { created: filename } };
}

async function cmdFileRename(serverId, payload) {
  const oldPath = safeJoin(serverId, payload.oldPath);
  const parent = path.dirname(oldPath);
  const newName = sanitize(payload.newName || '');
  if (!newName) throw new Error('Invalid name');
  const newPath = path.join(parent, newName);
  if (fs.existsSync(newPath)) throw new Error('Target already exists');
  fs.renameSync(oldPath, newPath);
  return { ok: true, result: { renamed: newName } };
}

async function cmdFileZip(serverId, payload) {
  const target = safeJoin(serverId, payload.path);
  if (!fs.existsSync(target)) throw new Error('Not found');
  const dir = path.dirname(target);
  const base = path.basename(target);
  const zipPath = path.join(dir, `${base}.zip`);
  await zipPathFromPath(target, zipPath, base);
  return { ok: true, result: { zip: `${base}.zip` } };
}

async function cmdFileUnzip(serverId, payload) {
  const target = safeJoin(serverId, payload.path);
  if (!fs.existsSync(target)) throw new Error('Not found');
  const dir = path.dirname(target);
  await extractZipTo(target, dir);
  return { ok: true, result: { extracted: path.basename(target) } };
}

async function cmdFileBulkZip(serverId, payload) {
  const paths = Array.isArray(payload.paths) ? payload.paths : [];
  if (paths.length === 0) throw new Error('No paths provided');
  
  const zipName = sanitize(payload.zipName || `archive-${Date.now()}.zip`);
  const baseDir = serverDir(serverId);
  
  // Find the common directory for all selected paths
  let zipDir = baseDir;
  if (paths.length > 0 && payload.currentDir) {
    // If currentDir is provided, use that as the zip location
    zipDir = safeJoin(serverId, payload.currentDir);
  } else if (paths.length === 1) {
    // Single path: create zip in its parent directory
    const singlePath = paths[0];
    const full = safeJoin(serverId, singlePath);
    const stat = fs.statSync(full);
    zipDir = stat.isDirectory() ? path.dirname(full) : path.dirname(full);
  } else {
    // Multiple paths: find common parent directory
    let commonDir = null;
    for (const p of paths) {
      const full = safeJoin(serverId, p);
      let dir = fs.statSync(full).isDirectory() ? full : path.dirname(full);
      
      if (commonDir === null) {
        commonDir = dir;
      } else {
        // Find common parent
        while (!full.startsWith(commonDir) && commonDir !== baseDir) {
          commonDir = path.dirname(commonDir);
        }
      }
    }
    zipDir = commonDir || baseDir;
  }
  
  const zipPath = path.join(zipDir, zipName);
  
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    
    for (const p of paths) {
      const full = safeJoin(serverId, p);
      if (!fs.existsSync(full)) continue;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) archive.directory(full, path.basename(full));
      else archive.file(full, { name: path.basename(full) });
    }
    archive.finalize();
  });
  
  // Return the zip path relative to server root so it can be downloaded
  const relativePath = path.relative(baseDir, zipPath).replace(/\\/g, '/');
  return { ok: true, result: { zip: zipName, zipPath: relativePath } };
}

// ------------------------------------------------------------
// Archive extraction helpers — pure Node.js, cross-platform
// ------------------------------------------------------------

// Sequential zip extraction with zip-slip protection.
// (unzipper.Extract stalls on large archives due to its object-mode backpressure,
// so we drive Parse ourselves with the same protections Extract provides.)
async function extractZipTo(zipPath, outDir, onProgress) {
  let total = 0;
  try {
    const directory = await unzipper.Open.file(zipPath);
    total = directory.files.length;
    if (directory.close) directory.close();
  } catch { total = 0; }

  return new Promise((resolve, reject) => {
    let settled = false;
    let done = 0;
    const rootDir = path.resolve(outDir);
    const finish = (fn) => (arg) => { if (!settled) { settled = true; fn(arg); } };

    const writeEntry = (entry) => new Promise((res, rej) => {
      const rel = String(entry.path || '').replace(/\\/g, '/');
      const extractPath = path.resolve(rootDir, rel);
      if (extractPath !== rootDir && !extractPath.startsWith(rootDir + path.sep)) {
        entry.autodrain();
        return res();
      }
      const doneEntry = (err) => { entry.autodrain(); err ? rej(err) : res(); };
      if (entry.type === 'Directory') {
        fs.mkdir(extractPath, { recursive: true }, (e) => doneEntry(e && e.code !== 'EEXIST' ? e : null));
        return;
      }
      fs.mkdir(path.dirname(extractPath), { recursive: true }, (e) => {
        if (e) return doneEntry(e);
        const ws = fs.createWriteStream(extractPath);
        ws.on('error', doneEntry);
        ws.on('close', () => {
          done++;
          if (onProgress && total > 0) onProgress(Math.min(99, Math.round((done / total) * 100)), done, total, `Extracting ${done}/${total} entries…`);
          else if (onProgress) onProgress(0, done, 0, `Extracting ${done} entries…`);
          doneEntry();
        });
        entry.pipe(ws);
      });
    });

    let chain = Promise.resolve();
    const parser = unzipper.Parse();
    parser.on('entry', (entry) => {
      chain = chain.then(() => writeEntry(entry));
    });
    parser.on('error', finish(reject));
    parser.on('close', () => {
      chain.then(() => finish(resolve)()).catch(finish(reject));
    });
    fs.createReadStream(zipPath).pipe(parser);
  });
}

// tar family via node-tar (pure JS). Handles .tar, .tar.gz, .tgz, .tar.bz2, .tbz2, .tbz.
async function extractTarTo(tarPath, outDir, onProgress) {
  const tar = require('tar');
  const isBz2 = /\.(tar\.bz2|tbz2|tbz)$/i.test(tarPath);

  let total = 0;
  const countEntry = () => { total++; };
  try {
    if (isBz2) {
      await new Promise((resolve, reject) => {
        const p = fs.createReadStream(tarPath)
          .pipe(require('unbzip2-stream')())
          .pipe(tar.t({ onentry: countEntry }));
        p.on('error', reject);
        p.on('end', resolve);
        p.resume();
      });
    } else {
      await tar.t({ file: tarPath, onentry: countEntry });
    }
  } catch { total = 0; }

  let done = 0;
  const onEntry = () => {
    done++;
    if (onProgress && total > 0) onProgress(Math.min(99, Math.round((done / total) * 100)), done, total, `Extracting ${done}/${total} entries…`);
    else if (onProgress) onProgress(0, done, 0, `Extracting ${done} entries…`);
  };

  if (isBz2) {
    await new Promise((resolve, reject) => {
      const p = fs.createReadStream(tarPath)
        .pipe(require('unbzip2-stream')())
        .pipe(tar.x({ cwd: outDir, onentry: onEntry }));
      p.on('error', reject);
      p.on('close', resolve);
    });
  } else {
    await tar.x({ file: tarPath, cwd: outDir, onentry: onEntry });
  }
}

// RAR via node-unrar-js (WASM — no external binaries).
async function extractRarTo(rarPath, outDir, onProgress) {
  const { createExtractorFromFile } = require('node-unrar-js');
  const rootDir = path.resolve(outDir);
  const extractor = await createExtractorFromFile({
    filepath: rarPath,
    targetPath: rootDir,
    // Neutralize any path-traversal segments before anything touches the disk.
    filenameTransform: (name) => String(name).replace(/\\/g, '/').split('/').filter(s => s && s !== '..').join('/')
  });
  const files = [...extractor.getFileList().fileHeaders];
  const total = files.length;
  if (files.some(f => f.flags && f.flags.encrypted)) {
    throw new Error('Password-protected RAR archives are not supported.');
  }
  let done = 0;
  try {
    const extracted = extractor.extract({ files: files.map(f => f.name) });
    for (const arcFile of extracted.files) {
      done++;
      if (onProgress && total > 0) onProgress(Math.min(99, Math.round((done / total) * 100)), done, total, `Extracting ${done}/${total} entries…`);
      else if (onProgress) onProgress(0, done, 0, `Extracting ${done} entries…`);
      // WASM decompression runs synchronously and blocks the event loop, so progress
      // HTTP posts would otherwise sit in the queue until extraction finishes.
      if (done % 50 === 0) await new Promise(resolve => setImmediate(resolve));
    }
  } catch (e) {
    throw new Error(`RAR extraction failed: ${e && e.message ? e.message : e}`);
  }
}

// 7z via the 7za binary bundled with the 7zip-min npm package (cross-platform).
async function extract7zTo(archivePath, outDir, onProgress) {
  let tool = null;
  try {
    tool = require('7zip-bin').path7za;
  } catch (e) {
    throw new Error('7za binary not available (7zip-min dependency missing).');
  }
  if (!tool || !fs.existsSync(tool)) throw new Error('7za binary not found.');

  const archiveName = path.basename(archivePath);

  // "l -slt" prints a "Path = ..." line per entry; the first one is the archive itself.
  let total = 0;
  try {
    total = await new Promise((resolve) => {
      const lister = spawn(tool, ['l', '-slt', archiveName], { cwd: outDir, stdio: ['ignore', 'pipe', 'pipe'] });
      let lines = 0;
      let buf = '';
      lister.stdout.on('data', (d) => {
        buf += d;
        const parts = buf.split('\n');
        for (let i = 0; i < parts.length - 1; i++) {
          if (parts[i].trim().startsWith('Path = ')) lines++;
        }
        buf = parts[parts.length - 1];
      });
      lister.on('error', () => resolve(0));
      lister.on('close', () => {
        const tailBuf = buf.trim().startsWith('Path = ') ? 1 : 0;
        resolve(Math.max(0, lines + tailBuf - 1));
      });
    });
  } catch { total = 0; }

  return new Promise((resolve, reject) => {
    // stdin ignored so password/overwrite prompts get EOF instead of hanging.
    const child = spawn(tool, ['x', '-y', '-bb1', archiveName], { cwd: outDir, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let done = 0;
    let outBuf = '';
    const countOut = (d) => {
      outBuf += d;
      const parts = outBuf.split('\n');
      outBuf = parts[parts.length - 1];
      for (let i = 0; i < parts.length - 1; i++) {
        if (/^-\s+\S/.test(parts[i].trim())) done++;
      }
      if (onProgress && total > 0) onProgress(Math.min(99, Math.round((done / total) * 100)), done, total, `Extracting ${done}/${total} entries…`);
      else if (onProgress) onProgress(0, done, 0, `Extracting ${done} entries…`);
    };
    child.stdout.on('data', countOut);
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => reject(new Error(`7Z extraction failed: ${err.message}`)));
    child.on('close', code => {
      if (code !== 0 && code !== 1) return reject(new Error(`7Z extraction failed (exit ${code}): ${stderr.trim()}`));
      resolve();
    });
  });
}

async function cmdFileExtract(serverId, payload, onProgress) {
  const target = safeJoin(serverId, payload.archivePath);
  if (!fs.existsSync(target)) throw new Error('Archive not found');

  const dir = path.dirname(target);
  const filename = path.basename(target).toLowerCase();
  const baseName = path.basename(target);

  // Detect archive type by extension
  const isTarGz = filename.endsWith('.tar.gz') || filename.endsWith('.tgz');
  const isTar = /\.(tar|tar\.bz2|tbz2|tbz)$/.test(filename) && !isTarGz;
  const isZip = filename.endsWith('.zip');
  const isRar = filename.endsWith('.rar');
  const is7z = filename.endsWith('.7z');

  if (isTarGz || isTar) {
    await extractTarTo(target, dir, onProgress);
  } else if (isZip) {
    await extractZipTo(target, dir, onProgress);
  } else if (isRar) {
    await extractRarTo(target, dir, onProgress);
  } else if (is7z) {
    await extract7zTo(target, dir, onProgress);
  } else {
    // Unsupported format
    throw new Error(`Unsupported archive format. Supported: .zip, .tar, .tar.gz, .tgz, .tar.bz2, .tbz2, .tbz, .rar, .7z`);
  }

  if (onProgress) onProgress(100, 1, 1, `Extracted ${baseName}`);
  return { ok: true, result: { extracted: baseName } };
}

async function cmdFileDownload(serverId, payload) {
  const target = safeJoin(serverId, payload.path);
  if (!fs.existsSync(target)) throw new Error('File not found');
  const stat = fs.statSync(target);
  if (stat.isDirectory()) throw new Error('Cannot download directory');
  if (stat.size > 1024 * 1024 * 1024) throw new Error('File too large for inline transfer (1GB max)');
  return { ok: true, result: { base64: fs.readFileSync(target).toString('base64') } };
}

function zipPathFromPath(src, zipPath, base) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) archive.directory(src, base);
    else archive.file(src, { name: base });
    archive.finalize();
  });
}

// ------------------------------------------------------------
// Worlds
// ------------------------------------------------------------
async function cmdWorldList(serverId) {
  const base = serverDir(serverId);
  const worlds = [];
  if (fs.existsSync(base)) {
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const dir = path.join(base, e.name);
      if (fs.existsSync(path.join(dir, 'level.dat')) || fs.existsSync(path.join(dir, 'uid.dat'))) {
        worlds.push({ name: e.name, size: formatSize(await dirSize(dir)) });
      }
    }
  }
  let currentWorld = 'world';
  const props = path.join(base, 'server.properties');
  if (fs.existsSync(props)) {
    const m = /^level-name=(.*)$/m.exec(fs.readFileSync(props, 'utf8'));
    if (m) currentWorld = m[1].trim();
  }
  const backupsDir = path.join(base, 'backups');
  let backups = [];
  if (fs.existsSync(backupsDir)) {
    backups = fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip'))
      .map(f => ({ name: f, size: formatSize(fs.statSync(path.join(backupsDir, f)).size) }));
  }
  return { ok: true, result: { worlds, currentWorld, backups } };
}

async function dirSize(dir) {
  let total = 0;
  try {
    const walk = async (d) => {
      for (const e of await fsp.readdir(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else total += (await fsp.stat(p)).size;
      }
    };
    await walk(dir);
  } catch {}
  return total;
}

async function cmdWorldDelete(serverId, payload) {
  const name = sanitize(payload.worldName || '');
  if (!name) throw new Error('Invalid world name');
  const target = safeJoin(serverId, name);
  if (!fs.existsSync(target)) throw new Error('World not found');
  await fsp.rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  return { ok: true, result: { deleted: name } };
}

async function cmdWorldUpload(serverId, payload) {
  const name = sanitize(payload.worldName || '');
  if (!name) throw new Error('Invalid world name');
  const { name: finalName, target } = uniqueTarget(serverId, name);
  ensureDir(target);
  
  const filename = payload.filename || 'world.zip';
  const lower = filename.toLowerCase();
  const isTarGz = lower.endsWith('.tar.gz') || lower.endsWith('.tgz');
  const isTar = /\.(tar|tar\.bz2|tbz2|tbz)$/.test(lower) && !isTarGz;
  const isZip = lower.endsWith('.zip');
  const isRar = lower.endsWith('.rar');
  const is7z = lower.endsWith('.7z');

  if (isTarGz || isTar || isZip || isRar || is7z) {
    const tmp = path.join(os.tmpdir(), `world-${Date.now()}-${sanitize(filename)}`);
    fs.writeFileSync(tmp, Buffer.from(payload.fileData || '', 'base64'));
    try {
      if (isTarGz || isTar) await extractTarTo(tmp, target);
      else if (isZip) await extractZipTo(tmp, target);
      else if (isRar) await extractRarTo(tmp, target);
      else await extract7zTo(tmp, target);
      normalizeWorldExtraction(target);
      return { ok: true, result: { worldName: finalName, renamed: finalName !== name } };
    } catch (err) {
      // Extraction failed: remove the empty/partial folder so a retry gets a clean name
      try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) {}
      throw err;
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) {}
    }
  } else {
    throw new Error(`Unsupported world format: ${filename}. Supported: .zip, .tar, .tar.gz, .tgz, .rar, .7z`);
  }
}

// One-click world install from marketplace
async function cmdWorldInstall(serverId, payload) {
  const url = await assertSafeDownloadUrl(payload.url);
  
  const worldName = sanitize(payload.worldName || 'world');
  const { name: finalName, target } = uniqueTarget(serverId, worldName);
  ensureDir(target);
  
  log(`[world-install] downloading from ${url}`);
  
  // Determine file type from the URL so the temp file keeps its extension
  const filename = url.split('?')[0].split('/').pop().toLowerCase() || 'world.zip';
  const tmp = path.join(os.tmpdir(), `world-install-${Date.now()}-${sanitize(filename)}`);
  
  // Download file
  const res = await axios({ 
    url, 
    method: 'GET', 
    responseType: 'stream', 
    timeout: 300000, // 5 minutes
    maxRedirects: 10,
    headers: { 'User-Agent': 'MinecraftPanelAgent/1.0' } 
  });
  
  const fileStream = fs.createWriteStream(tmp);
  res.data.pipe(fileStream);
  
  return new Promise((resolve, reject) => {
    fileStream.on('finish', async () => {
      try {
        const isTarGz = filename.endsWith('.tar.gz') || filename.endsWith('.tgz');
        const isTar = /\.(tar|tar\.bz2|tbz2|tbz)$/.test(filename) && !isTarGz;
        const isZip = filename.endsWith('.zip');
        
        log(`[world-install] extracting ${filename} to ${finalName}`);
        
        try {
          if (isTarGz || isTar) await extractTarTo(tmp, target);
          else if (isZip) await extractZipTo(tmp, target);
          else throw new Error(`Unsupported format: ${filename}`);
          normalizeWorldExtraction(target);
          log(`[world-install] completed: ${finalName}`);
          resolve({ ok: true, result: { worldName: finalName, renamed: finalName !== worldName, filename } });
        } catch (err) {
          try { fs.rmSync(target, { recursive: true, force: true }); } catch (e) {}
          throw err;
        } finally {
          try { fs.unlinkSync(tmp); } catch (e) {}
        }
      } catch (err) {
        try { fs.unlinkSync(tmp); } catch (e) {}
        reject(err);
      }
    });
    
    fileStream.on('error', (err) => {
      try { fs.unlinkSync(tmp); } catch (e) {}
      reject(new Error(`Download failed: ${err.message}`));
    });
    
    res.data.on('error', (err) => {
      try { fs.unlinkSync(tmp); } catch (e) {}
      reject(new Error(`Stream error: ${err.message}`));
    });
  });
}

// World rename handler
async function cmdWorldRename(serverId, payload) {
  const oldName = String(payload.oldName || '').trim();
  const newName = sanitize(payload.newName || '');
  
  if (!oldName) throw new Error('Old world name is required');
  if (!newName) throw new Error('Invalid new world name');
  if (oldName === newName) throw new Error('New name is the same as old name');
  
  const oldPath = safeJoin(serverId, oldName);
  const newPath = safeJoin(serverId, newName);
  
  // Check if old world exists
  if (!fs.existsSync(oldPath)) {
    throw new Error(`World "${oldName}" not found`);
  }
  
  // Check if new name already exists
  if (fs.existsSync(newPath)) {
    throw new Error(`World "${newName}" already exists`);
  }
  
  // Rename the directory
  fs.renameSync(oldPath, newPath);
  log(`[world-rename] ${oldName} → ${newName}`);
  
  // Update server.properties if this is the active world
  const propertiesPath = path.join(serverDir(serverId), 'server.properties');
  if (fs.existsSync(propertiesPath)) {
    try {
      let content = fs.readFileSync(propertiesPath, 'utf8');
      const lines = content.split('\n');
      const updated = lines.map(line => {
        if (line.trim().startsWith('level-name=')) {
          const currentName = line.split('=')[1];
          if (currentName === oldName) {
            return `level-name=${newName}`;
          }
        }
        return line;
      }).join('\n');
      fs.writeFileSync(propertiesPath, updated, 'utf8');
    } catch (err) {
      log(`[world-rename] Warning: could not update server.properties: ${err.message}`);
    }
  }
  
  return { ok: true, result: { oldName, newName } };
}

// World switch handler
async function cmdWorldSwitch(serverId, payload) {
  const worldName = String(payload.worldName || '').trim();
  if (!worldName) throw new Error('World name is required');
  
  const worldDir = safeJoin(serverId, worldName);
  if (!fs.existsSync(worldDir)) {
    throw new Error(`World "${worldName}" not found`);
  }
  
  const targetWorldDir = safeJoin(serverId, 'world');
  
  // If "world" already exists and it's not the same as the selected world, back it up
  if (fs.existsSync(targetWorldDir) && worldName !== 'world') {
    const backupName = `world_backup_${Date.now()}`;
    const backupDir = safeJoin(serverId, backupName);
    log(`[world-switch] backing up current world to: ${backupName}`);
    fs.renameSync(targetWorldDir, backupDir);
  }
  
  // Rename the selected world to "world"
  if (worldName !== 'world') {
    log(`[world-switch] renaming ${worldName} to world`);
    fs.renameSync(worldDir, targetWorldDir);
  }
  
  // Update server.properties to use "world"
  const propertiesPath = path.join(serverDir(serverId), 'server.properties');
  if (fs.existsSync(propertiesPath)) {
    try {
      let content = fs.readFileSync(propertiesPath, 'utf8');
      content = content.replace(/^level-name=.*$/m, 'level-name=world');
      fs.writeFileSync(propertiesPath, content, 'utf8');
    } catch (err) {
      log(`[world-switch] Warning: could not update server.properties: ${err.message}`);
    }
  }
  
  log(`[world-switch] completed: ${worldName} → world`);
  return { ok: true, result: { worldName, message: 'World switched successfully' } };
}

// ------------------------------------------------------------
// Backups
// ------------------------------------------------------------
// DEPRECATED: Use the AdmZip version below instead
// async function cmdBackupCreate_OLD(serverId, payload) { ... }

// ------------------------------------------------------------
// Server properties
// ------------------------------------------------------------
async function cmdPropertiesRead(serverId) {
  const p = path.join(serverDir(serverId), 'server.properties');
  if (!fs.existsSync(p)) return { ok: true, result: { properties: {} } };
  return { ok: true, result: { properties: parseProperties(fs.readFileSync(p, 'utf8')) } };
}

async function cmdPropertiesSave(serverId, payload) {
  const p = path.join(serverDir(serverId), 'server.properties');
  ensureDir(path.dirname(p));
  
  // Read existing properties first
  let existingProps = {};
  if (fs.existsSync(p)) {
    try {
      const content = fs.readFileSync(p, 'utf8');
      content.split('\n').forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx < 0) return;
        const key = line.substring(0, eqIdx).trim();
        let val = line.substring(eqIdx + 1).trim();
        
        // Parse booleans and numbers
        if (val === 'true') {
          val = true;
        } else if (val === 'false') {
          val = false;
        } else if (!isNaN(val) && val !== '') {
          val = Number(val);
        }
        existingProps[key] = val;
      });
      log(`[properties] Read ${Object.keys(existingProps).length} existing properties from ${p}`);
    } catch (err) {
      log(`[properties] Warning: Could not read existing properties: ${err.message}`);
    }
  }
  
  // Merge: keep existing properties, update only the ones being changed
  const mergedProps = { ...existingProps, ...(payload.properties || {}) };
  
  log(`[properties] Merged ${Object.keys(payload.properties || {}).length} changes with ${Object.keys(existingProps).length} existing properties, total: ${Object.keys(mergedProps).length}`);
  
  fs.writeFileSync(p, writePropertiesString(mergedProps));
  return { ok: true, result: { saved: true, count: Object.keys(mergedProps).length } };
}

async function cmdPropertiesReset(serverId, payload) {
  return await cmdPropertiesSave(serverId, payload);
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function formatSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

function waitForExit(child, timeoutMs) {
  return new Promise(resolve => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    child.once('exit', () => finish(true));
    setTimeout(() => finish(false), timeoutMs);
  });
}

// ============================================================
// BACKUP FUNCTIONS
// ============================================================
async function cmdBackupCreate(serverId, payload) {
  const dir = serverDir(serverId);
  if (!fs.existsSync(dir)) throw new Error('Server directory not found');
  
  // Use configurable backup directory (default: /daemon/backups/:id/)
  const backupDir = path.join(ROOT, 'backups', serverId.toString());
  ensureDir(backupDir);
  
  const backupName = payload.name || `Backup ${new Date().toLocaleString()}`;
  const fileName = `backup-${Date.now()}.zip`;
  const filePath = path.join(backupDir, fileName);
  
  log(`[backup] Creating backup for server ${serverId}: ${fileName}`);
  
  return new Promise((resolve, reject) => {
    try {
      // Use AdmZip instead of archiver (no external dependencies needed)
      const zip = new AdmZip();
      
      // Recursively add all files except certain paths
      const walk = (dir, zipPath = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          // Skip backup, logs, and temporary files
          if (['backups', 'logs', '.server.pid', '.server.starttime', '.ram_mb', '.disk_mb', 'node_modules'].includes(entry.name)) {
            continue;
          }
          
          const fullPath = path.join(dir, entry.name);
          const entryPath = zipPath ? `${zipPath}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            walk(fullPath, entryPath);
          } else if (entry.isFile()) {
            const fileData = fs.readFileSync(fullPath);
            zip.addFile(entryPath, fileData);
          }
        }
      };
      
      walk(dir);
      zip.writeZip(filePath);
      
      const stats = fs.statSync(filePath);
      const sizeInBytes = stats.size;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
      const sizeInGB = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2);
      const sizeStr = sizeInGB >= 1 ? `${sizeInGB} GB` : `${sizeInMB} MB`;
      
      log(`[backup] Backup created: ${fileName} (${sizeStr})`);
      
      // Cleanup old backups if limit is specified
      const backupLimit = payload.backup_limit || 10;
      if (backupLimit > 0) {
        try {
          const backups = fs.readdirSync(backupDir)
            .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
            .map(f => ({
              name: f,
              path: path.join(backupDir, f),
              time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time); // Newest first
          
          if (backups.length > backupLimit) {
            const toDelete = backups.slice(backupLimit);
            for (const backup of toDelete) {
              try {
                fs.unlinkSync(backup.path);
                log(`[backup] Deleted old backup: ${backup.name}`);
              } catch (delErr) {
                log(`[backup] Warning: Failed to delete ${backup.name}: ${delErr.message}`);
              }
            }
            log(`[backup] Cleanup: Deleted ${toDelete.length} backups (kept ${backupLimit})`);
          }
        } catch (cleanupErr) {
          log(`[backup] Warning: Cleanup failed: ${cleanupErr.message}`);
        }
      }
      
      resolve({
        ok: true,
        result: {
          fileName,
          size: sizeStr,
          backupName,
          backupDir: backupDir
        }
      });
    } catch (err) {
      log(`[backup] Error: ${err.message}`);
      reject(err);
    }
  });
}

async function cmdBackupDelete(serverId, payload) {
  const { fileName } = payload;
  if (!fileName) throw new Error('Backup filename required');
  
  const backupPath = path.join(ROOT, 'backups', serverId.toString(), fileName);
  
  // Ensure path is safe
  const backupDir = path.join(ROOT, 'backups', serverId.toString());
  const resolved = path.resolve(backupPath);
  if (!isPathInside(path.resolve(backupDir), resolved)) {
    throw new Error('Invalid backup path');
  }
  
  if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
  
  fs.unlinkSync(backupPath);
  log(`[backup] Deleted: ${fileName}`);
  
  return { ok: true, result: { deleted: true } };
}

async function cmdServerBackupDelete(serverId, payload) {
  return await cmdBackupDelete(serverId, payload);
}

async function cmdRestoreBackup(serverId, payload) {
  const { filename } = payload;
  if (!filename) throw new Error('Backup filename required');
  
  const dir = serverDir(serverId);
  const backupPath = path.join(ROOT, 'backups', serverId.toString(), filename);
  
  // Security check - ensure path is within backup directory
  const backupDir = path.join(ROOT, 'backups', serverId.toString());
  const resolved = path.resolve(backupPath);
  if (!isPathInside(path.resolve(backupDir), resolved)) {
    throw new Error('Invalid backup path');
  }
  
  if (!fs.existsSync(backupPath)) {
    throw new Error('Backup file not found');
  }
  
  const stats = fs.statSync(backupPath);
  if (stats.size === 0) {
    throw new Error('Backup file is empty or corrupted');
  }
  
  log(`[backup] Restoring backup ${filename} (${(stats.size / (1024 * 1024)).toFixed(2)} MB) for server ${serverId}...`);
  
  // Create a temporary directory for extraction
  const tempDir = path.join(ROOT, 'temp', `restore-${serverId}-${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  
  try {
    // Extract backup using unzipper
    log(`[backup] Opening backup file...`);
    const unzipper = require('unzipper');
    const directory = await unzipper.Open.file(backupPath);
    
    if (!directory || !directory.files || directory.files.length === 0) {
      throw new Error('Backup file is empty or invalid');
    }
    
    log(`[backup] Backup contains ${directory.files.length} files`);
    log(`[backup] Extracting backup to temp directory...`);
    
    // Extract to temp directory
    await directory.extract({ path: tempDir });
    
    // Close the directory handle
    directory.close && directory.close();
    
    // Wait for file handles to release
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    log(`[backup] Extraction completed successfully`);
    
    // Verify extraction
    if (!fs.existsSync(tempDir)) {
      throw new Error('Extraction failed - temp directory does not exist');
    }
    
    const extractedFiles = fs.readdirSync(tempDir);
    if (extractedFiles.length === 0) {
      throw new Error('Extraction failed - no files were extracted');
    }
    
    log(`[backup] Successfully extracted ${extractedFiles.length} items`);
    
    // Stop the server if it's running
    log(`[backup] Checking if server is running...`);
    let serverRunning = false;
    try {
      // Try to ping the server
      const statsResult = await executeCommandOnServer(serverId, 'list');
      serverRunning = !!statsResult;
    } catch (e) {
      serverRunning = false;
    }
    
    if (serverRunning) {
      log(`[backup] Server is running, stopping it...`);
      try {
        await executeCommandOnServer(serverId, 'stop');
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (e) {
        log(`[backup] Warning: Could not stop server: ${e.message}`);
      }
    }
    
    log(`[backup] Removing old server files...`);
    // Remove all files in server directory with retry logic
    let retries = 3;
    while (retries > 0) {
      try {
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir);
          for (const file of files) {
            const filePath = path.join(dir, file);
            try {
              fs.rmSync(filePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
            } catch (err) {
              log(`[backup] Warning: Failed to delete ${file}: ${err.message}`);
            }
          }
        }
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    log(`[backup] Moving extracted files to server directory...`);
    // Ensure server directory exists
    fs.mkdirSync(dir, { recursive: true });
    
    // Move files from temp to server directory
    for (const file of extractedFiles) {
      const srcPath = path.join(tempDir, file);
      const destPath = path.join(dir, file);
      
      try {
        if (fs.statSync(srcPath).isDirectory()) {
          fs.cpSync(srcPath, destPath, { recursive: true });
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
        log(`[backup] Copied: ${file}`);
      } catch (copyErr) {
        log(`[backup] Error: Failed to copy ${file}: ${copyErr.message}`);
        throw copyErr;
      }
    }
    
    // Clean up temp directory
    log(`[backup] Cleaning up temp directory...`);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanErr) {
      log(`[backup] Warning: Failed to clean temp directory: ${cleanErr.message}`);
    }
    
    log(`[backup] ✅ Backup restored successfully for server ${serverId}`);
    
    return { ok: true, result: { restored: true, wasRunning: serverRunning } };
    
  } catch (extractErr) {
    log(`[backup] Error during restore: ${extractErr.message}`);
    
    // Clean up temp directory on error
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanErr) {
        log(`[backup] Warning: Failed to clean temp directory after error: ${cleanErr.message}`);
      }
    }
    
    throw extractErr;
  }
}

async function runProcess(cmd, args, cwd, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: 'inherit' });
    const timer = setTimeout(() => { try { child.kill('SIGKILL'); } catch {} reject(new Error('Process timed out')); }, timeoutMs);
    child.on('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Process exited with ${code}`)); });
    child.on('error', err => { clearTimeout(timer); reject(err); });
  });
}

// ------------------------------------------------------------
// HTTP API (read-only endpoints used directly by the panel)
// ------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '100mb' }));

function auth(req, res, next) {
  const token = req.headers['x-daemon-token'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const expected = String(config.token);
  const supplied = String(token || '');
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/health', async (req, res) => {
  try {
    // Unauthenticated callers only get a liveness signal; system details
    // (node id, hostname, resource stats) require the daemon token.
    const token = req.headers['x-daemon-token'] || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(String(token || ''));
    const b = Buffer.from(String(config.token));
    if (!token || a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.json({ ok: true, status: 'ok' });
    }

    // Collect system resources
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptime = os.uptime();
    const loadAvg = os.loadavg();
    const platform = os.platform();
    
    // Real measurements only. The CPU figure comes from the rolling os.cpus()
    // sampler and the disk from fs.statfs; anything not measurable reports null
    // so the panel can show "no data" instead of an invented number.
    const cpuUsage = cpuUsagePercent;
    const disk = await getDiskBytes();
    
    // Get running servers count and their aggregate stats
    let serverCount = 0;
    let serverMemoryUsed = 0;
    
    try {
      serverCount = serverProcesses.size;
      // Aggregate memory and CPU from running servers
      for (const [serverId, child] of serverProcesses) {
        try {
          // Try to get memory from server directory if available
          const statsPath = safeJoin(serverId, 'stats.json');
          if (fs.existsSync(statsPath)) {
            const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
            serverMemoryUsed += (stats.memoryUsed || 0);
          }
        } catch (e) {
          // Silently fail
        }
      }
    } catch (e) {
      // Silently fail
    }
    
    const responseData = {
      ok: true,
      nodeId: config.nodeId,
      uptime: Math.round(uptime),
      timestamp: new Date().toISOString(),
      platform: platform,
      arch: os.arch(),
      hostname: os.hostname(),
      
      // System resource information
      resources: {
        // CPU
        cpuCount: cpus.length,
        cpuModel: cpus[0]?.model || 'Unknown',
        cpuUsagePercent: cpuUsage,
        cpuLoadAvg: platform === 'win32' ? null : {
          // os.loadavg() is hardcoded to [0,0,0] on Windows, so reporting it
          // there would be a number with no meaning behind it
          last1m: Math.round(loadAvg[0] * 100) / 100,
          last5m: Math.round(loadAvg[1] * 100) / 100,
          last15m: Math.round(loadAvg[2] * 100) / 100
        },
        
        // Memory (in bytes)
        memoryTotal: totalMem,
        memoryUsed: usedMem,
        memoryFree: freeMem,
        memoryUsagePercent: Math.round((usedMem / totalMem) * 100),
        
        // Disk (in bytes) — null when the filesystem can't be measured
        diskTotal: disk ? disk.total : null,
        diskUsed: disk ? disk.used : null,
        diskFree: disk ? disk.free : null,
        diskUsagePercent: disk && disk.total > 0 ? Math.round((disk.used / disk.total) * 100) : null,
        
        // Network byte counters aren't exposed by Node, so they're reported
        // as unmeasured rather than as a flat 0.
        networkRx: null,
        networkTx: null,
      },
      
      // Server statistics
      servers: {
        count: serverCount,
        memoryUsed: serverMemoryUsed,
      }
    };
    
    res.json(responseData);
  } catch (err) {
    log('[health] failed:', err.message);
    res.status(500).json({
      ok: false,
      error: 'Health collection failed',
      nodeId: config.nodeId,
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/servers/:id/stats', auth, async (req, res) => {
  try {
    const r = await cmdStats(Number(req.params.id));
    res.json(r.result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Console history MUST come from this server's own logs/latest.log file.
app.get('/servers/:id/logs', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    if (!Number.isSafeInteger(serverId) || serverId < 1) {
      return res.status(400).json({ error: 'Invalid server id' });
    }
    const logFile = path.join(serverDir(serverId), 'logs', 'latest.log');
    const limit = Math.min(Math.max(Number.parseInt(req.query.lines, 10) || 200, 1), 50000);

    // While the server is running, prefer the ANSI-preserving stdout buffer so
    // history renders with the exact same colors as the live console.
    if (String(req.query.ansi || '') === '1') {
      const state = consoleOutputBuffers.get(serverId);
      if (state && state.data.length) {
        let text = state.data.toString('utf8');
        if (state.baseOffset > 0) {
          const firstNewline = text.indexOf('\n');
          if (firstNewline !== -1) text = text.slice(firstNewline + 1);
        }
        const ansiLines = text.split(/\r?\n/);
        if (ansiLines.length && !text.endsWith('\n')) ansiLines.pop();
        const logs = ansiLines.filter(line => line.length > 0).slice(-limit);
        if (logs.length > 0) {
          return res.json({
            logs,
            totalLines: logs.length,
            source: `/servers/${serverId}/console-buffer (ANSI)`
          });
        }
      }
    }

    if (!fs.existsSync(logFile)) {
      return res.json({ logs: [], totalLines: 0, source: `/servers/${serverId}/logs/latest.log` });
    }
    const content = await fsp.readFile(logFile, 'utf8');
    const logs = content.split(/\r?\n/).filter((line, index, all) =>
      line.length > 0 || index < all.length - 1
    ).slice(-limit);
    
    // Return logs as-is - NO color modification whatsoever
    return res.json({ logs, totalLines: logs.length, source: `/servers/${serverId}/logs/latest.log` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ANSI-preserving live console stream from process stdout/stderr. This is kept
// in memory only and is deliberately separate from logs/latest.log.
app.get('/servers/:id/console/stream', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    if (!Number.isSafeInteger(serverId) || serverId < 1) {
      return res.status(400).json({ error: 'Invalid server id' });
    }
    const state = consoleOutputBuffers.get(serverId);
    if (!state) return res.json({ chunk: '', offset: 0, baseOffset: 0, size: 0, reset: true });
    const wantsTail = String(req.query.offset || '') === 'tail';
    const requestedOffset = wantsTail ? state.totalOffset : Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const reset = requestedOffset < state.baseOffset || requestedOffset > state.totalOffset;
    const start = reset ? state.baseOffset : requestedOffset;
    const localStart = Math.max(0, start - state.baseOffset);
    const maxBytes = 512 * 1024;
    const endLocal = Math.min(state.data.length, localStart + maxBytes);
    const chunk = state.data.subarray(localStart, endLocal).toString('utf8');
    return res.json({ chunk, offset: state.baseOffset + endLocal, baseOffset: state.baseOffset, size: state.totalOffset, reset });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Incremental console stream endpoint. Byte offsets preserve repeated messages
// and avoid lossy snapshot comparison/deduplication in the panel.
app.get('/servers/:id/logs/stream', auth, async (req, res) => {
  let fd;
  try {
    const serverId = Number(req.params.id);
    if (!Number.isSafeInteger(serverId) || serverId < 1) {
      return res.status(400).json({ error: 'Invalid server id' });
    }
    const logFile = path.join(serverDir(serverId), 'logs', 'latest.log');
    if (!fs.existsSync(logFile)) {
      return res.json({ chunk: '', offset: 0, size: 0, reset: true });
    }
    const stat = await fsp.stat(logFile);
    const wantsTail = String(req.query.offset || '') === 'tail';
    const requestedOffset = wantsTail ? stat.size : Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const reset = !wantsTail && requestedOffset > stat.size;
    const start = reset ? 0 : requestedOffset;
    const maxBytes = 512 * 1024;
    const end = Math.min(stat.size, start + maxBytes);
    const length = Math.max(0, end - start);
    let chunk = '';
    if (length > 0) {
      fd = await fsp.open(logFile, 'r');
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await fd.read(buffer, 0, length, start);
      chunk = buffer.subarray(0, bytesRead).toString('utf8');
    }
    // Return chunk as-is - NO color modification
    res.json({ chunk, offset: end, size: stat.size, reset });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (fd) await fd.close().catch(() => {});
  }
});

app.get('/servers/:id/files', auth, async (req, res) => {
  try {
    const r = await cmdFileList(Number(req.params.id), { path: req.query.path || '/' });
    res.json(r.result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Streaming file upload (raw body) for large files — bypasses the JSON command queue
app.post('/servers/:id/files/upload', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    const targetDir = String(req.headers['x-target-dir'] || '/');
    const filename = sanitize(String(req.headers['x-filename'] || ''));
    if (!filename) return res.status(400).json({ error: 'Invalid filename' });
    const contentLength = Number(req.headers['content-length'] || 0);
    if (contentLength > MAX_UPLOAD_BYTES) {
      return res.status(413).json({ error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB)` });
    }
    const dir = safeJoin(serverId, targetDir);
    ensureDir(dir);
    const target = path.join(dir, filename);
    let received = 0;
    let tooLarge = false;
    let settled = false;
    const cleanup = () => fs.unlink(target, () => {});
    const ws = fs.createWriteStream(target);
    req.on('data', (chunk) => {
      received += chunk.length;
      if (!tooLarge && received > MAX_UPLOAD_BYTES) {
        tooLarge = true;
        ws.destroy();
        cleanup();
        req.destroy();
        if (!settled) { settled = true; res.status(413).json({ error: `File too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024 / 1024)} GB)` }); }
      }
    });
    req.on('error', () => { ws.destroy(); cleanup(); });
    ws.on('error', (err) => {
      if (!settled && !res.headersSent) { settled = true; res.status(500).json({ error: err.message }); }
    });
    ws.on('finish', () => {
      if (!tooLarge && !settled) { settled = true; log(`[upload] Saved ${filename} (${received} bytes) for server ${serverId}`); res.json({ ok: true, result: { filename, size: received } }); }
    });
    req.pipe(ws);
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.get('/servers/:id/players/lifetime', auth, async (req, res) => {
  try {
    const result = await cmdLifetimePlayers(Number(req.params.id));
    res.json({ success: true, ...result.result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/servers/:id/players/data/:uuid', auth, async (req, res) => {
  try {
    const result = await cmdPlayerData(Number(req.params.id), req.params.uuid);
    if (!result.result.playerFound) return res.status(404).json({ success: false, ...result.result });
    res.json({ success: true, ...result.result });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get('/servers/:id/players', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    const players = await readOnlinePlayersFromLog(serverId);
    // Read ops/whitelist/banned files
    const read = (f) => {
      try { return JSON.parse(fs.readFileSync(safeJoin(serverId, f), 'utf8')); } catch { return []; }
    };
    let whitelistEnabled = false;
    const propsPath = safeJoin(serverId, 'server.properties');
    if (fs.existsSync(propsPath)) {
      const m = /^white-list=(true|false)$/m.exec(fs.readFileSync(propsPath, 'utf8'));
      if (m) whitelistEnabled = m[1] === 'true';
    }
    res.json({
      online: players,
      ops: read('ops.json'),
      whitelist: read('whitelist.json'),
      banned: read('banned-players.json'),
      bannedIps: read('banned-ips.json'),
      whitelistEnabled,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/servers/:id/worlds', auth, async (req, res) => {
  try {
    const r = await cmdWorldList(Number(req.params.id));
    res.json(r.result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/servers/:id/plugins', auth, async (req, res) => {
  try {
    const r = await cmdPluginList(Number(req.params.id));
    res.json(r.result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Server properties endpoint - read server.properties file
app.get('/servers/:id/properties', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    const serverPath = path.join(SERVERS_ROOT, serverId.toString());
    const propsFile = path.join(serverPath, 'server.properties');
    
    if (!fs.existsSync(propsFile)) {
      return res.json({});
    }
    
    const content = fs.readFileSync(propsFile, 'utf8');
    const props = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      
      const eqIdx = line.indexOf('=');
      if (eqIdx < 0) return;
      
      const key = line.substring(0, eqIdx).trim();
      let val = line.substring(eqIdx + 1).trim();
      
      // Parse booleans and numbers
      if (val === 'true') {
        val = true;
      } else if (val === 'false') {
        val = false;
      } else if (!isNaN(val) && val !== '') {
        val = Number(val);
      }
      
      props[key] = val;
    });
    
    res.json(props);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Backups endpoint - list all backups for a server
app.get('/servers/:id/backups', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    const backupDir = path.join(ROOT, 'backups', serverId.toString());
    let backups = [];
    
    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir);
      backups = files
        .filter(f => f.endsWith('.zip'))
        .map(f => {
          const filePath = path.join(backupDir, f);
          const stats = fs.statSync(filePath);
          const sizeInBytes = stats.size;
          const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);
          const sizeInGB = (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2);
          const sizeStr = sizeInGB >= 1 ? `${sizeInGB} GB` : `${sizeInMB} MB`;
          
          return {
            file: f,
            name: f.replace('backup-', '').replace('.zip', ''),
            size: sizeStr,
            sizeBytes: sizeInBytes,
            modified: stats.mtime.toISOString(),
            created_at: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    res.json({ backups });
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Download backup endpoint - serve backup file
app.get('/servers/:id/backups/download/:filename', auth, async (req, res) => {
  try {
    const serverId = Number(req.params.id);
    const filename = req.params.filename;
    const backupDir = path.join(ROOT, 'backups', serverId.toString());
    const filePath = path.join(backupDir, filename);
    
    // Security check
    const resolved = path.resolve(filePath);
    if (!isPathInside(path.resolve(backupDir), resolved)) {
      return res.status(403).json({ error: 'Invalid path' });
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Backup not found' });
    }
    
    res.download(filePath, filename);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Startup
// ------------------------------------------------------------
async function main() {
  ensureDir(SERVERS_ROOT);
  
  // Load persisted start times from .server.starttime files
  // This allows uptime tracking to survive agent restarts
  try {
    if (fs.existsSync(SERVERS_ROOT)) {
      const serverDirs = fs.readdirSync(SERVERS_ROOT);
      for (const dir of serverDirs) {
        const serverId = parseInt(dir);
        if (isNaN(serverId)) continue;
        
        const startTimeFile = path.join(SERVERS_ROOT, dir, '.server.starttime');
        if (fs.existsSync(startTimeFile)) {
          try {
            const startTime = parseInt(fs.readFileSync(startTimeFile, 'utf8').trim());
            if (!isNaN(startTime) && startTime > 0) {
              serverStartTimes.set(serverId, startTime);
              log(`[init] Loaded persisted start time for server ${serverId}: ${new Date(startTime).toISOString()}`);
            }
          } catch (err) {
            log(`[init] Failed to load start time for server ${serverId}: ${err.message}`);
          }
        }
      }
    }
  } catch (err) {
    log(`[init] Failed to load persisted start times: ${err.message}`);
  }

  // ================================================
  // RESTORE PREVIOUSLY RUNNING SERVERS
  // ================================================
  async function restoreRunningServers() {
    try {
      log(`[init] Scanning for previously running servers...`);
      const serverDir_base = serverDir('');
      
      if (!fs.existsSync(serverDir_base)) {
        log(`[init] No servers directory found, skipping restoration`);
        return;
      }

      // Scan for .server.pid files that indicate previously running servers
      const dirs = fs.readdirSync(serverDir_base);
      for (const dir of dirs) {
        const pidFile = path.join(serverDir_base, dir, '.server.pid');
        const startTimeFile = path.join(serverDir_base, dir, '.server.starttime');
        
        if (fs.existsSync(pidFile)) {
          try {
            const pidContent = fs.readFileSync(pidFile, 'utf8').trim();
            const oldPid = parseInt(pidContent);
            const serverId = parseInt(dir);
            
            // Check if that process is actually still running
            let processExists = false;
            try {
              process.kill(oldPid, 0);  // Signal 0 just checks if process exists
              processExists = true;
            } catch (err) {
              processExists = false;
            }
            
            if (processExists) {
              log(`[init] Found running process from before restart: server=${dir} pid=${oldPid}`);
              // Don't clean up - process is still running
            } else {
              // Process doesn't exist - but check if server is actually running on its port
              log(`[init] Process ${oldPid} not found for server ${dir}, checking if port is listening...`);
              
              try {
                const isListening = await isServerPortListening(serverId);
                if (isListening) {
                  log(`[init] ✅ Server ${dir} is RUNNING on its port (detached process) - keeping PID file`);
                  // Server is running even though we can't find the process - likely detached
                  // Keep the PID file so we know to track it
                } else {
                  log(`[init] ❌ Server ${dir} not responding on port - cleaning up stale PID file`);
                  try { fs.unlinkSync(pidFile); } catch {}
                  try { fs.unlinkSync(startTimeFile); } catch {}
                }
              } catch (portCheckErr) {
                log(`[init] Error checking port for server ${dir}: ${portCheckErr.message}`);
                // On error, assume process is dead and clean up
                try { fs.unlinkSync(pidFile); } catch {}
                try { fs.unlinkSync(startTimeFile); } catch {}
              }
            }
          } catch (err) {
            log(`[init] Error reading PID file for server ${dir}: ${err.message}`);
          }
        }
      }
    } catch (err) {
      log(`[init] Error restoring servers: ${err.message}`);
    }
  }

  // Call restoration before starting HTTP server
  await restoreRunningServers();

  // Start HTTP server
  http.createServer(app).listen(config.port, config.bindHost, () => {
    log(`[http] listening on ${config.bindHost}:${config.port}`);
  });

  // Heartbeat loop
  setInterval(() => { sendHeartbeat().catch(e => log('[heartbeat] error', e.message)); }, config.heartbeatIntervalMs);
  sendHeartbeat().catch(() => {});

  // Command poll loop
  setInterval(() => { pollCommands().catch(e => log('[poll] error', e.message)); }, config.commandPollIntervalMs);

  log(`[agent] started: nodeId=${config.nodeId} panel=${config.panelUrl}`);
}

process.on('SIGINT', async () => {
  log('[agent] shutting down; servers will continue running in background');
  stopping = true;
  
  // DO NOT STOP SERVERS - Just detach and let them keep running
  // This allows servers to continue even if the agent crashes or is restarted
  for (const [id, child] of serverProcesses) {
    try {
      // Detach child process from agent - let it continue independently
      child.unref();
      log(`[agent] Detached server ${id} (PID ${child.pid}) - will continue running`);
    } catch (err) {
      log(`[agent] Error detaching server ${id}: ${err.message}`);
    }
  }
  
  // Clear server tracking map
  serverProcesses.clear();
  
  log('[agent] All servers detached and running in background. Exiting agent...');
  process.exit(0);
});

main().catch(err => { log('[fatal]', err.message); process.exit(1); });

// Rotate server log file on stop - rename latest.log to timestamped version
function rotateServerLog(serverId) {
  try {
    const dir = serverDir(serverId);
    const logsDir = path.join(dir, 'logs');
    const latestLogPath = path.join(logsDir, 'latest.log');
    
    if (!fs.existsSync(latestLogPath)) return; // No log file to rotate
    
    // Create timestamped filename: latest-2026-10-23_14-30-45.log
    const now = new Date();
    const timestamp = now.getFullYear() + '-' +
                      String(now.getMonth() + 1).padStart(2, '0') + '-' +
                      String(now.getDate()).padStart(2, '0') + '_' +
                      String(now.getHours()).padStart(2, '0') + '-' +
                      String(now.getMinutes()).padStart(2, '0') + '-' +
                      String(now.getSeconds()).padStart(2, '0');
    
    const archivedLogPath = path.join(logsDir, `latest-${timestamp}.log`);
    
    // Rename latest.log to latest-TIMESTAMP.log
    fs.renameSync(latestLogPath, archivedLogPath);
    log(`[rotate] Server ${serverId} log rotated: latest.log → latest-${timestamp}.log`);
  } catch (err) {
    log(`[rotate] Error rotating log for server ${serverId}: ${err.message}`);
  }
}
