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

// Java Compatibility Resolver
export function getRecommendedJavaVersion(minecraftVersion: string): number {
  const clean = (minecraftVersion || '').replace(/[^0-9.]/g, '');
  const parts = clean.split('.').map(p => parseInt(p, 10));
  const major = parts[0] || 1;
  const minor = parts[1] || 20;
  const patch = parts[2] || 0;

  if (major > 1 || minor > 20 || (minor === 20 && patch >= 5)) {
    return 21; // Minecraft 1.20.5+ requires Java 21
  }
  if (minor >= 17) {
    return 17; // Minecraft 1.17 - 1.20.4 requires Java 17
  }
  if (minor === 16) {
    return 11; // Minecraft 1.16 can use Java 11 or 8
  }
  return 8; // Minecraft 1.8 - 1.15 requires Java 8
}

// Fetch Paper versions from official PaperMC API
async function fetchPaperVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<{ versions: string[] }>('https://api.papermc.io/v2/projects/paper');
    if (res && Array.isArray(res.versions) && res.versions.length > 0) {
      const reversed = [...res.versions].reverse();
      return {
        versions: reversed,
        latest: reversed[0]
      };
    }
  } catch (e) {
    // Upstream fallback
  }
  return {
    versions: FALLBACK_VERSIONS.paper,
    latest: FALLBACK_VERSIONS.paper[0]
  };
}

// Fetch Purpur versions from PurpurMC API
async function fetchPurpurVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<{ versions: string[] }>('https://api.purpurmc.org/v2/purpur');
    if (res && Array.isArray(res.versions) && res.versions.length > 0) {
      const reversed = [...res.versions].reverse();
      return {
        versions: reversed,
        latest: reversed[0]
      };
    }
  } catch (e) {
    // Upstream fallback
  }
  return {
    versions: FALLBACK_VERSIONS.purpur,
    latest: FALLBACK_VERSIONS.purpur[0]
  };
}

// Fetch Vanilla versions from official Mojang version manifest
async function fetchVanillaVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<{ latest: { release: string }; versions: Array<{ id: string; type: string }> }>(
      'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
    );
    if (res && Array.isArray(res.versions)) {
      const releases = res.versions
        .filter(v => v.type === 'release')
        .map(v => v.id);
      if (releases.length > 0) {
        return {
          versions: releases.slice(0, 30),
          latest: res.latest?.release || releases[0]
        };
      }
    }
  } catch (e) {
    // Fallback
  }
  return {
    versions: FALLBACK_VERSIONS.vanilla,
    latest: FALLBACK_VERSIONS.vanilla[0]
  };
}

// Fetch Fabric game versions from Fabric Meta API
async function fetchFabricVersions(): Promise<{ versions: string[]; latest: string }> {
  try {
    const res = await fetchJson<Array<{ version: string; stable: boolean }>>(
      'https://meta.fabricmc.net/v2/versions/game'
    );
    if (Array.isArray(res)) {
      const stable = res.filter(v => v.stable).map(v => v.version);
      if (stable.length > 0) {
        return {
          versions: stable.slice(0, 30),
          latest: stable[0]
        };
      }
    }
  } catch (e) {
    // Fallback
  }
  return {
    versions: FALLBACK_VERSIONS.fabric,
    latest: FALLBACK_VERSIONS.fabric[0]
  };
}

// Get Supported Versions for a Software
export async function getMinecraftVersions(software: string = 'paper'): Promise<MinecraftVersionInfo> {
  const norm = (software || 'paper').toLowerCase().trim();
  const now = Date.now();

  // Check memory cache
  if (now - versionCache.timestamp < CACHE_TTL_MS && versionCache.data[norm]) {
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
    const fallbackList = FALLBACK_VERSIONS[norm] || FALLBACK_VERSIONS.paper;
    result = {
      versions: fallbackList,
      latest: fallbackList[0]
    };
  }

  // Update Cache
  versionCache.data[norm] = result;
  versionCache.timestamp = now;

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

// Java Runtime Checker
export function checkJavaRuntime(requiredJava?: number): { available: boolean; installedVersion?: number; path?: string; message: string } {
  try {
    let javaPath = '';
    try {
      javaPath = execSync('which java 2>/dev/null', { env: process.env, encoding: 'utf8' }).trim();
    } catch {
      return { available: false, message: 'Java runtime binary not found on system PATH.' };
    }

    if (!javaPath) {
      return { available: false, message: 'Java runtime binary not found on system PATH.' };
    }

    const versionOutput = execSync(`${javaPath} -version 2>&1`, { env: process.env, encoding: 'utf8' });
    const match = versionOutput.match(/(?:openjdk|java) version "(?:1\.)?(\d+)/i);
    const installedVersion = match ? parseInt(match[1], 10) : undefined;

    if (requiredJava && installedVersion && installedVersion < requiredJava) {
      return {
        available: true,
        installedVersion,
        path: javaPath,
        message: `Java ${installedVersion} is installed, but Java ${requiredJava}+ is recommended for this Minecraft version.`
      };
    }

    return {
      available: true,
      installedVersion: installedVersion || 21,
      path: javaPath,
      message: `Java ${installedVersion || 21} is available at ${javaPath}.`
    };
  } catch (err: any) {
    return {
      available: false,
      message: `Failed to detect Java runtime: ${err.message}`
    };
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
      // 1. Get latest build for version from PaperMC API
      const buildsData = await fetchJson<{ builds: number[] }>(
        `https://api.papermc.io/v2/projects/paper/versions/${version}/builds`
      );
      if (!buildsData || !buildsData.builds || buildsData.builds.length === 0) {
        throw new Error(`No builds found for Paper version ${version}`);
      }
      const latestBuild = buildsData.builds[buildsData.builds.length - 1];
      const downloadUrl = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}/downloads/paper-${version}-${latestBuild}.jar`;
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Paper build #${latestBuild} from PaperMC CDN...`);
      await downloadFile(downloadUrl, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Paper ${version} build #${latestBuild} downloaded successfully.`);
      return { success: true, message: `Paper ${version} build #${latestBuild} downloaded`, jarPath: targetJar };

    } else if (norm.includes('purpur')) {
      const downloadUrl = `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Purpur ${version} from PurpurMC CDN...`);
      await downloadFile(downloadUrl, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Purpur ${version} downloaded successfully.`);
      return { success: true, message: `Purpur ${version} downloaded`, jarPath: targetJar };

    } else if (norm.includes('vanilla')) {
      // 1. Query version manifest
      const manifest = await fetchJson<{ versions: Array<{ id: string; url: string }> }>(
        'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
      );
      const entry = manifest.versions.find(v => v.id === version);
      if (!entry) {
        throw new Error(`Vanilla version ${version} not found in Mojang version manifest`);
      }
      const packageData = await fetchJson<{ downloads: { server?: { url: string } } }>(entry.url);
      if (!packageData.downloads?.server?.url) {
        throw new Error(`Server download artifact not available for Vanilla ${version}`);
      }
      appendConsoleLog(serverId, `[AetherInstaller/INFO]: Downloading Mojang Vanilla ${version} server.jar...`);
      await downloadFile(packageData.downloads.server.url, targetJar);
      appendConsoleLog(serverId, `[AetherInstaller/SUCCESS]: Vanilla ${version} downloaded successfully.`);
      return { success: true, message: `Vanilla ${version} downloaded`, jarPath: targetJar };

    } else if (norm.includes('fabric')) {
      // 1. Resolve loader version
      const loaders = await fetchJson<Array<{ loader: { version: string; stable: boolean } }>>(
        `https://meta.fabricmc.net/v2/versions/loader/${version}`
      );
      if (!loaders || loaders.length === 0) {
        throw new Error(`Fabric loader not available for Minecraft ${version}`);
      }
      const loaderVer = loaders[0].loader.version;

      // 2. Resolve installer version
      const installers = await fetchJson<Array<{ version: string; stable: boolean }>>(
        'https://meta.fabricmc.net/v2/versions/installer'
      );
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
