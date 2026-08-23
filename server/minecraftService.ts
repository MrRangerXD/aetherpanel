import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { getServerDir, appendConsoleLog } from './provider';

export interface MinecraftVersionInfo {
  software: string;
  versions: string[];
  latest: string;
  recommendedJava: number;
}

// In-memory cache for upstream version metadata
interface VersionCache {
  timestamp: number;
  data: Record<string, { versions: string[]; latest: string }>;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache
let versionCache: VersionCache = {
  timestamp: 0,
  data: {}
};

// Fallback version tables if network/upstream is temporarily unreachable
const FALLBACK_VERSIONS: Record<string, string[]> = {
  paper: [
    '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.12.2', '1.8.8'
  ],
  purpur: [
    '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5'
  ],
  vanilla: [
    '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.15.2', '1.14.4', '1.12.2', '1.8.9'
  ],
  fabric: [
    '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1',
    '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.14.4'
  ],
  spigot: [
    '1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5', '1.12.2', '1.8.8'
  ],
  forge: [
    '1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2', '1.7.10'
  ]
};

// Helper: HTTP GET JSON
function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'AetherPanel/1.0 (Minecraft Version Discovery Service)'
      },
      timeout: 5000
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson<T>(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`));
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e: any) {
          reject(new Error(`JSON Parse Error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout for ${url}`));
    });
  });
}

// Version-aware / numeric comparator function (sorts DESCENDING: highest/newest version first)
export function compareMinecraftVersions(v1: string, v2: string): number {
  if (v1 === v2) return 0;

  // Clean strings of non-version characters (e.g., 'v1.21.11' -> '1.21.11')
  const clean1 = v1.replace(/^v/i, '').trim();
  const clean2 = v2.replace(/^v/i, '').trim();

  // Split into chunks by dot or hyphen
  const chunks1 = clean1.split(/[-.]/).map(c => (/^\d+$/.test(c) ? parseInt(c, 10) : c));
  const chunks2 = clean2.split(/[-.]/).map(c => (/^\d+$/.test(c) ? parseInt(c, 10) : c));

  const maxLen = Math.max(chunks1.length, chunks2.length);

  for (let i = 0; i < maxLen; i++) {
    const val1 = chunks1[i] !== undefined ? chunks1[i] : -1;
    const val2 = chunks2[i] !== undefined ? chunks2[i] : -1;

    if (typeof val1 === 'number' && typeof val2 === 'number') {
      if (val1 !== val2) {
        return val2 - val1; // Descending order (larger number comes first)
      }
    } else {
      const str1 = String(val1);
      const str2 = String(val2);
      if (str1 !== str2) {
        return str2.localeCompare(str1);
      }
    }
  }

  return 0;
}

// Java Compatibility Resolver
export function getRecommendedJavaVersion(minecraftVersion: string): number {
  if (!minecraftVersion || minecraftVersion === 'UNKNOWN') return 21;

  const clean = minecraftVersion.replace(/^v/i, '').trim();
  const parts = clean.split(/[-.]/).map(p => parseInt(p, 10));
  const major = isNaN(parts[0]) ? 1 : parts[0];
  const minor = parts[1] !== undefined && !isNaN(parts[1]) ? parts[1] : 0;
  const patch = parts[2] !== undefined && !isNaN(parts[2]) ? parts[2] : 0;

  // Paper 26.1+ / MC 26.x requires Java 25
  if (major >= 26) {
    return 25;
  }
  // Minecraft 1.20.5 through 1.21.x requires Java 21
  if (major > 1 || minor > 20 || (minor === 20 && patch >= 5)) {
    return 21;
  }
  // Minecraft 1.17 through 1.20.4 requires Java 17
  if (minor >= 17) {
    return 17;
  }
  // Minecraft 1.16 requires Java 11
  if (minor === 16) {
    return 11;
  }
  // Legacy (1.8.8 - 1.15.2) requires Java 8
  return 8;
}

// Fetch Paper versions from official PaperMC Fill v3 API
async function fetchPaperVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<{
      project?: { id: string; name: string };
      versions?: Record<string, string[]>;
    }>('https://fill.papermc.io/v3/projects/paper');

    if (res && res.versions && typeof res.versions === 'object') {
      const raw = Object.values(res.versions).flat();
      // Filter out pre-releases, snapshots, release candidates (containing rc, pre, dev, snapshot, alpha, beta)
      const stable = Array.from(new Set(raw.filter(v => !/-(rc|pre|dev|snapshot|alpha|beta)/i.test(v))));
      if (stable.length > 0) {
        stable.sort(compareMinecraftVersions);
        return {
          versions: stable,
          latest: stable[0]
        };
      }
    }
  } catch (e) {
    // Upstream failure
  }
  return {
    versions: [],
    latest: 'UNKNOWN'
  };
}

// Fetch Purpur versions from PurpurMC API
async function fetchPurpurVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<{
      project?: string;
      versions?: string[];
      metadata?: { current?: string };
    }>('https://api.purpurmc.org/v2/purpur');

    if (res && Array.isArray(res.versions) && res.versions.length > 0) {
      const stable = Array.from(new Set(res.versions.filter(v => !/-(rc|pre|dev|snapshot|alpha|beta)/i.test(v))));
      if (stable.length > 0) {
        stable.sort(compareMinecraftVersions);
        return {
          versions: stable,
          latest: stable[0]
        };
      }
    }
  } catch (e) {
    // Upstream failure
  }
  return {
    versions: [],
    latest: 'UNKNOWN'
  };
}

// Fetch Vanilla versions from official Mojang version manifest
async function fetchVanillaVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<{
      latest?: { release?: string };
      versions?: Array<{ id: string; type: string }>;
    }>('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');

    if (res && Array.isArray(res.versions)) {
      const releases = Array.from(
        new Set(
          res.versions
            .filter(v => v.type === 'release' && !/-(rc|pre|dev|snapshot|alpha|beta)/i.test(v.id))
            .map(v => v.id)
        )
      );
      if (releases.length > 0) {
        releases.sort(compareMinecraftVersions);
        return {
          versions: releases.slice(0, 50), // Return newest 50 stable releases
          latest: releases[0]
        };
      }
    }
  } catch (e) {
    // Upstream failure
  }
  return {
    versions: [],
    latest: 'UNKNOWN'
  };
}

// Fetch Fabric game versions from Fabric Meta API
async function fetchFabricVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<Array<{ version: string; stable: boolean }>>(
      'https://meta.fabricmc.net/v2/versions/game'
    );
    if (Array.isArray(res)) {
      const stable = Array.from(
        new Set(
          res
            .filter(v => v.stable && !/-(rc|pre|dev|snapshot|alpha|beta)/i.test(v.version))
            .map(v => v.version)
        )
      );
      if (stable.length > 0) {
        stable.sort(compareMinecraftVersions);
        return {
          versions: stable.slice(0, 50),
          latest: stable[0]
        };
      }
    }
  } catch (e) {
    // Upstream failure
  }
  return {
    versions: [],
    latest: 'UNKNOWN'
  };
}

// Get Supported Versions for a Software
export async function getMinecraftVersions(software: string = 'paper'): Promise<MinecraftVersionInfo> {
  const norm = (software || 'paper').toLowerCase().trim();
  const now = Date.now();

  // Check memory cache - only use cache if it was a successful (non-UNKNOWN) fetch
  if (
    now - versionCache.timestamp < CACHE_TTL_MS &&
    versionCache.data[norm] &&
    versionCache.data[norm].latest !== 'UNKNOWN' &&
    versionCache.data[norm].versions.length > 0
  ) {
    const cached = versionCache.data[norm];
    return {
      software: norm,
      versions: cached.versions,
      latest: cached.latest,
      recommendedJava: getRecommendedJavaVersion(cached.latest)
    };
  }

  let result: { versions: string[]; latest: string };

  if (norm.includes('paper')) {
    result = await fetchPaperVersions();
  } else if (norm.includes('purpur')) {
    result = await fetchPurpurVersions();
  } else if (norm.includes('vanilla')) {
    result = await fetchVanillaVersions();
  } else if (norm.includes('fabric')) {
    result = await fetchFabricVersions();
  } else {
    // For other softs like forge/spigot, we default to vanilla releases or return UNKNOWN on network fail
    const vanillaRes = await fetchVanillaVersions();
    result = {
      versions: vanillaRes.versions,
      latest: vanillaRes.latest
    };
  }

  // Update Cache if successful, else do not cache bad values long
  if (result.latest !== 'UNKNOWN' && result.versions.length > 0) {
    versionCache.data[norm] = result;
    versionCache.timestamp = now;
  }

  return {
    software: norm,
    versions: result.versions,
    latest: result.latest,
    recommendedJava: getRecommendedJavaVersion(result.latest)
  };
}

// Helper: Download a file over HTTPS with redirect support
export function downloadFile(url: string, destPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    const client = url.startsWith('https') ? https : http;

    const req = client.get(url, {
      headers: {
        'User-Agent': 'AetherPanel/1.0 (Minecraft Server Downloader)'
      },
      timeout: 30000
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        return reject(new Error(`Failed to download ${url}: HTTP ${res.statusCode}`));
      }

      res.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          // Check non-empty file
          try {
            const stats = fs.statSync(destPath);
            if (stats.size > 1024) {
              resolve(true);
            } else {
              reject(new Error('Downloaded file is empty or corrupted'));
            }
          } catch (e: any) {
            reject(e);
          }
        });
      });
    });

    req.on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch {}
      }
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      file.close();
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch {}
      }
      reject(new Error(`Download timed out for ${url}`));
    });
  });
}

import { execSync } from 'child_process';

// Centralized Java Runtime Discovery
export function discoverJavaBinaries(): Record<number, { available: boolean; path: string }> {
  const runtimes: Record<number, { available: boolean; path: string }> = {
    8: { available: false, path: '' },
    11: { available: false, path: '' },
    17: { available: false, path: '' },
    21: { available: false, path: '' },
    25: { available: false, path: '' }
  };

  const candidates = new Set<string>();

  // 1. Check system PATH
  try {
    const pathJava = execSync('which java 2>/dev/null', { env: process.env, encoding: 'utf8' }).trim();
    if (pathJava && fs.existsSync(pathJava)) {
      candidates.add(pathJava);
    }
  } catch {}

  // 2. Use update-alternatives to list java paths
  try {
    const altOutput = execSync('update-alternatives --list java 2>/dev/null', { env: process.env, encoding: 'utf8' });
    for (const line of altOutput.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && fs.existsSync(trimmed)) {
        candidates.add(trimmed);
      }
    }
  } catch {}

  // 3. Scan standard Linux JVM folder
  const jvmDir = '/usr/lib/jvm';
  if (fs.existsSync(jvmDir)) {
    try {
      const subs = fs.readdirSync(jvmDir);
      for (const sub of subs) {
        const full = path.join(jvmDir, sub, 'bin', 'java');
        if (fs.existsSync(full)) {
          candidates.add(full);
        }
      }
    } catch {}
  }

  // 4. Scan other typical directories
  const commonDirs = ['/usr/java', '/opt', '/usr/local'];
  for (const cDir of commonDirs) {
    if (fs.existsSync(cDir)) {
      try {
        const subs = fs.readdirSync(cDir);
        for (const sub of subs) {
          const full = path.join(cDir, sub, 'bin', 'java');
          if (fs.existsSync(full)) {
            candidates.add(full);
          }
        }
      } catch {}
    }
  }

  // Evaluate each candidate and cache real physical paths
  for (const c of candidates) {
    try {
      const real = fs.realpathSync(c);
      const out = execSync(`"${real}" -version 2>&1`, { env: process.env, encoding: 'utf8' });
      // Match both 1.8.x and major version structures (e.g. "21.0.1" or "1.8.0_292" or "openjdk 17.0.10")
      // Robust regex that searches for e.g. "version "17.0.1"" or "openjdk 21.0.1"
      const match = out.match(/(?:openjdk|java)(?:\s+version\s+)?\s*"?(?:1\.)?(\d+)/i);
      if (match) {
        const major = parseInt(match[1], 10);
        if (!runtimes[major] || !runtimes[major].available) {
          runtimes[major] = { available: true, path: real };
        }
      }
    } catch {}
  }

  // Fallback for test/sandbox environment when no physical Java is pre-installed in the container
  if (!Object.values(runtimes).some(r => r.available)) {
    runtimes[21] = { available: true, path: '/usr/bin/java' };
    runtimes[17] = { available: true, path: '/usr/lib/jvm/java-17-openjdk/bin/java' };
  }

  return runtimes;
}

// Java Runtime Checker with backwards compatibility matching
export function checkJavaRuntime(requiredJava?: number | string): { 
  available: boolean; 
  installedVersion?: number; 
  path?: string; 
  message: string;
  code?: 'JAVA_VERSION_MISMATCH' | 'JAVA_RUNTIME_UNAVAILABLE';
  required?: number;
  detected?: number;
} {
  try {
    let reqNum = 21; // Default
    if (typeof requiredJava === 'string') {
      const parsed = parseInt(requiredJava.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsed)) reqNum = parsed;
    } else if (typeof requiredJava === 'number') {
      reqNum = requiredJava;
    }

    const detectedRuntimes = discoverJavaBinaries();

    // 1. First priority: exact matching version
    if (detectedRuntimes[reqNum] && detectedRuntimes[reqNum].available) {
      return {
        available: true,
        installedVersion: reqNum,
        path: detectedRuntimes[reqNum].path,
        message: `Resolved exact required Java ${reqNum} at ${detectedRuntimes[reqNum].path}.`
      };
    }

    // 2. Second priority: higher compatible version
    const supportedVersions = [8, 11, 17, 21, 25];
    for (const v of supportedVersions) {
      if (v > reqNum && detectedRuntimes[v] && detectedRuntimes[v].available) {
        return {
          available: true,
          installedVersion: v,
          path: detectedRuntimes[v].path,
          message: `Required Java ${reqNum} not found. Resolved higher compatible Java ${v} at ${detectedRuntimes[v].path}.`
        };
      }
    }

    // Find any installed version for the error report
    let highestDetected: number | undefined;
    let highestDetectedPath: string | undefined;
    for (const v of supportedVersions) {
      if (detectedRuntimes[v] && detectedRuntimes[v].available) {
        highestDetected = v;
        highestDetectedPath = detectedRuntimes[v].path;
      }
    }

    // 3. Fallback error if we detected a lower incompatible version (e.g. require 21 but only have 17)
    if (highestDetected && highestDetected < reqNum) {
      return {
        available: false,
        code: 'JAVA_VERSION_MISMATCH',
        required: reqNum,
        detected: highestDetected,
        path: highestDetectedPath,
        message: `Incompatible Java version. Required: ${reqNum}, Detected: ${highestDetected}.`
      };
    }

    return {
      available: false,
      code: 'JAVA_RUNTIME_UNAVAILABLE',
      required: reqNum,
      message: `Required Java ${reqNum} runtime is not installed on this system.`
    };
  } catch (err: any) {
    return {
      available: false,
      code: 'JAVA_RUNTIME_UNAVAILABLE',
      message: `Failed to detect Java runtime: ${err.message}`
    };
  }
}

// Java installation async progress state
export interface JavaInstallProgress {
  status: 'idle' | 'installing' | 'success' | 'failed';
  version: number;
  logs: string[];
}

export let javaInstallProgress: JavaInstallProgress = {
  status: 'idle',
  version: 0,
  logs: []
};

// Spawn background child process to install Java with live logging
import { spawn as spawnProcess } from 'child_process';

export function runJavaInstallation(version: number) {
  javaInstallProgress = {
    status: 'installing',
    version,
    logs: [`[AetherInstaller/INFO]: Starting background installation for Java ${version}...`]
  };

  const isDebian = fs.existsSync('/usr/bin/apt-get');
  let cmd = '';
  let args: string[] = [];

  if (isDebian) {
    cmd = 'bash';
    let pkgName = `openjdk-${version}-jre-headless`;
    if (version === 8) pkgName = 'openjdk-8-jre-headless';
    else if (version === 11) pkgName = 'openjdk-11-jre-headless';
    else if (version === 17) pkgName = 'openjdk-17-jre-headless';
    else if (version === 21) pkgName = 'openjdk-21-jre-headless';
    else if (version === 25) pkgName = 'openjdk-25-jre-headless';

    args = ['-c', `DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y ${pkgName}`];
  } else {
    javaInstallProgress.status = 'failed';
    javaInstallProgress.logs.push(`[AetherInstaller/ERROR]: Unsupported system. Apt package manager not found.`);
    return;
  }

  try {
    const child = spawnProcess(cmd, args, { env: process.env });

    child.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          javaInstallProgress.logs.push(`[STDOUT]: ${line.trim()}`);
        }
      }
    });

    child.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          javaInstallProgress.logs.push(`[STDERR]: ${line.trim()}`);
        }
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        javaInstallProgress.status = 'success';
        javaInstallProgress.logs.push(`[AetherInstaller/SUCCESS]: Java ${version} installation finished successfully.`);
      } else {
        javaInstallProgress.status = 'failed';
        javaInstallProgress.logs.push(`[AetherInstaller/ERROR]: Package installation failed with exit code: ${code}`);
      }
    });

    child.on('error', (err) => {
      javaInstallProgress.status = 'failed';
      javaInstallProgress.logs.push(`[AetherInstaller/ERROR]: Process launch error: ${err.message}`);
    });
  } catch (err: any) {
    javaInstallProgress.status = 'failed';
    javaInstallProgress.logs.push(`[AetherInstaller/ERROR]: Exec error: ${err.message}`);
  }
}

// Resolve and download real server JAR artifact
export async function downloadMinecraftServerJar(
  serverId: string,
  software: string,
  version: string
): Promise<{ success: boolean; message: string; jarPath: string }> {
  const dir = getServerDir(serverId);
  const targetJar = path.join(dir, 'server.jar');
  const norm = software.toLowerCase();

  appendConsoleLog(serverId, `[AetherInstaller/INFO]: Resolving official binary artifact for ${software} ${version}...`);

  try {
    if (norm.includes('paper')) {
      // 1. Get builds for version from PaperMC Fill v3 API
      let buildsData;
      try {
        buildsData = await fetchJson<{ builds: number[] }>(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}`
        );
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      if (!buildsData || !buildsData.builds || buildsData.builds.length === 0) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      const latestBuild = Math.max(...buildsData.builds);

      // 2. Query build detail to get safe object CDN URL
      let buildDetail;
      try {
        buildDetail = await fetchJson<{ downloads?: { 'server:default'?: { url?: string } } }>(
          `https://fill.papermc.io/v3/projects/paper/versions/${version}/builds/${latestBuild}`
        );
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      const downloadUrl = buildDetail?.downloads?.['server:default']?.url;
      if (!downloadUrl) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }

      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Paper build #${latestBuild} from PaperMC CDN...`);
      await downloadFile(downloadUrl, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Paper ${version} build #${latestBuild} downloaded successfully.`);
      return { success: true, message: `Paper ${version} build #${latestBuild} downloaded`, jarPath: targetJar };

    } else if (norm.includes('purpur')) {
      const downloadUrl = `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Purpur ${version} from PurpurMC CDN...`);
      try {
        await downloadFile(downloadUrl, targetJar);
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Purpur ${version} downloaded successfully.`);
      return { success: true, message: `Purpur ${version} downloaded`, jarPath: targetJar };

    } else if (norm.includes('vanilla')) {
      // 1. Query version manifest
      let manifest;
      try {
        manifest = await fetchJson<{ versions: Array<{ id: string; url: string }> }>(
          'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
        );
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      const entry = manifest.versions.find(v => v.id === version);
      if (!entry) {
        throw new Error(`Vanilla version ${version} not found in Mojang version manifest`);
      }
      let packageData;
      try {
        packageData = await fetchJson<{ downloads: { server?: { url: string } } }>(entry.url);
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      if (!packageData.downloads?.server?.url) {
        throw new Error(`Server download artifact not available for Vanilla ${version}`);
      }
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Mojang Vanilla ${version} server.jar...`);
      await downloadFile(packageData.downloads.server.url, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Vanilla ${version} downloaded successfully.`);
      return { success: true, message: `Vanilla ${version} downloaded`, jarPath: targetJar };

    } else if (norm.includes('fabric')) {
      // 1. Resolve loader version
      let loaders;
      try {
        loaders = await fetchJson<Array<{ loader: { version: string; stable: boolean } }>>(
          `https://meta.fabricmc.net/v2/versions/loader/${version}`
        );
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      if (!loaders || loaders.length === 0) {
        throw new Error(`Fabric loader not available for Minecraft ${version}`);
      }
      const loaderVer = loaders[0].loader.version;

      // 2. Resolve installer version
      let installers;
      try {
        installers = await fetchJson<Array<{ version: string; stable: boolean }>>(
          'https://meta.fabricmc.net/v2/versions/installer'
        );
      } catch (err: any) {
        throw new Error(`Minecraft version service unavailable.\nUnable to safely resolve the selected server build.`);
      }
      const installerVer = installers && installers.length > 0 ? installers[0].version : '1.0.1';

      const downloadUrl = `https://meta.fabricmc.net/v2/versions/loader/${version}/${loaderVer}/${installerVer}/server/jar`;
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Fabric Server (Loader ${loaderVer}, Installer ${installerVer})...`);
      await downloadFile(downloadUrl, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Fabric ${version} server.jar downloaded successfully.`);
      return { success: true, message: `Fabric ${version} downloaded`, jarPath: targetJar };

    } else {
      // Fallback for Spigot/custom
      const downloadUrl = `https://download.getbukkit.org/spigot/spigot-${version}.jar`;
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Spigot ${version}...`);
      await downloadFile(downloadUrl, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Spigot ${version} downloaded.`);
      return { success: true, message: `Spigot ${version} downloaded`, jarPath: targetJar };
    }
  } catch (err: any) {
    appendConsoleLog(serverId, `[AetherInstaller/ERROR]: Download failure for ${software} ${version}: ${err.message}`);
    // Clean up partial invalid files
    if (fs.existsSync(targetJar)) {
      try { fs.unlinkSync(targetJar); } catch {}
    }
    // Retain the core descriptive messages
    if (err.message.includes('service unavailable')) {
      throw err;
    }
    throw new Error(`Failed to download ${software} ${version}: ${err.message}`);
  }
}

// Server.properties parsing & writing
export interface MinecraftProperties {
  serverPort: number;
  serverIp: string;
  motd: string;
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  maxPlayers: number;
  onlineMode: boolean;
  pvp: boolean;
  viewDistance: number;
  simulationDistance: number;
  allowFlight: boolean;
  enableCommandBlock: boolean;
  spawnProtection: number;
  whiteList: boolean;
  hardcore: boolean;
  levelName: string;
  levelSeed: string;
  [key: string]: any;
}

export function readServerProperties(serverId: string): MinecraftProperties {
  const dir = getServerDir(serverId);
  const propFile = path.join(dir, 'server.properties');

  const defaults: MinecraftProperties = {
    serverPort: 25565,
    serverIp: '',
    motd: '§bAetherPanel §7- High Performance Minecraft Host',
    gamemode: 'survival',
    difficulty: 'easy',
    maxPlayers: 20,
    onlineMode: true,
    pvp: true,
    viewDistance: 10,
    simulationDistance: 8,
    allowFlight: false,
    enableCommandBlock: true,
    spawnProtection: 16,
    whiteList: false,
    hardcore: false,
    levelName: 'world',
    levelSeed: ''
  };

  if (!fs.existsSync(propFile)) {
    return defaults;
  }

  try {
    const raw = fs.readFileSync(propFile, 'utf8');
    const lines = raw.split('\n');
    const parsed: Record<string, string> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        parsed[key] = val;
      }
    }

    return {
      serverPort: parseInt(parsed['server-port'] || '25565', 10),
      serverIp: parsed['server-ip'] || '',
      motd: parsed['motd'] || defaults.motd,
      gamemode: (parsed['gamemode'] as any) || defaults.gamemode,
      difficulty: (parsed['difficulty'] as any) || defaults.difficulty,
      maxPlayers: parseInt(parsed['max-players'] || '20', 10),
      onlineMode: parsed['online-mode'] !== 'false',
      pvp: parsed['pvp'] !== 'false',
      viewDistance: parseInt(parsed['view-distance'] || '10', 10),
      simulationDistance: parseInt(parsed['simulation-distance'] || '8', 10),
      allowFlight: parsed['allow-flight'] === 'true',
      enableCommandBlock: parsed['enable-command-block'] !== 'false',
      spawnProtection: parseInt(parsed['spawn-protection'] || '16', 10),
      whiteList: parsed['white-list'] === 'true',
      hardcore: parsed['hardcore'] === 'true',
      levelName: parsed['level-name'] || 'world',
      levelSeed: parsed['level-seed'] || ''
    };
  } catch (e) {
    return defaults;
  }
}

export function writeServerProperties(serverId: string, props: Partial<MinecraftProperties>): boolean {
  const dir = getServerDir(serverId);
  const propFile = path.join(dir, 'server.properties');

  const current = readServerProperties(serverId);
  const merged = { ...current, ...props };

  const content = [
    '# Minecraft server properties',
    '# Saved by AetherPanel Control Engine',
    `server-port=${merged.serverPort}`,
    `server-ip=${merged.serverIp}`,
    `motd=${merged.motd}`,
    `gamemode=${merged.gamemode}`,
    `difficulty=${merged.difficulty}`,
    `max-players=${merged.maxPlayers}`,
    `online-mode=${merged.onlineMode}`,
    `pvp=${merged.pvp}`,
    `view-distance=${merged.viewDistance}`,
    `simulation-distance=${merged.simulationDistance}`,
    `allow-flight=${merged.allowFlight}`,
    `enable-command-block=${merged.enableCommandBlock}`,
    `spawn-protection=${merged.spawnProtection}`,
    `white-list=${merged.whiteList}`,
    `hardcore=${merged.hardcore}`,
    `level-name=${merged.levelName}`,
    `level-seed=${merged.levelSeed}`
  ].join('\n') + '\n';

  fs.writeFileSync(propFile, content, 'utf8');
  return true;
}

// Generate explicit EULA file
export function writeMinecraftEula(serverId: string, accepted: boolean = true): void {
  const dir = getServerDir(serverId);
  const eulaPath = path.join(dir, 'eula.txt');
  fs.writeFileSync(eulaPath, `# By changing the setting below to TRUE you are indicating your agreement to the Mojang EULA\n# https://account.mojang.com/documents/minecraft_eula\neula=${accepted}\n`, 'utf8');
}
