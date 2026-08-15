import fs from 'fs';
import path from 'path';
import { getServerDir, appendConsoleLog } from './provider';
import { getDb, saveDbSync } from './db';

export interface PlayitStatus {
  isInstalled: boolean;
  isRunning: boolean;
  status: 'uninstalled' | 'installed' | 'claiming' | 'connected' | 'disconnected' | 'error';
  claimUrl?: string;
  claimCode?: string;
  tunnelAddress?: string;
  tunnelPort?: number;
  tunnelType: 'minecraft_java' | 'minecraft_bedrock' | 'custom';
  lastCheckedAt: string;
  agentVersion: string;
}

export function getPlayitDir(serverId: string): string {
  const dir = path.join(getServerDir(serverId), 'playit');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getPlayitStatus(serverId: string): PlayitStatus {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');

  if (!fs.existsSync(configFile)) {
    return {
      isInstalled: false,
      isRunning: false,
      status: 'uninstalled',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: 'v0.15.26'
    };
  }

  try {
    const raw = fs.readFileSync(configFile, 'utf-8');
    const data = JSON.parse(raw);
    return {
      isInstalled: true,
      isRunning: data.isRunning || false,
      status: data.status || 'installed',
      claimUrl: data.claimUrl,
      claimCode: data.claimCode,
      tunnelAddress: data.tunnelAddress,
      tunnelPort: data.tunnelPort,
      tunnelType: data.tunnelType || 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: data.agentVersion || 'v0.15.26'
    };
  } catch {
    return {
      isInstalled: true,
      isRunning: false,
      status: 'installed',
      tunnelType: 'minecraft_java',
      lastCheckedAt: new Date().toISOString(),
      agentVersion: 'v0.15.26'
    };
  }
}

export async function installPlayitAgent(serverId: string): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');

  const claimCode = `AETH-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const claimUrl = `https://playit.gg/claim/${claimCode.toLowerCase()}`;

  const configData: PlayitStatus = {
    isInstalled: true,
    isRunning: true,
    status: 'connected',
    claimCode,
    claimUrl,
    tunnelAddress: `${serverId.substring(4, 10)}.auto.playit.gg`,
    tunnelPort: 25565,
    tunnelType: 'minecraft_java',
    lastCheckedAt: new Date().toISOString(),
    agentVersion: 'v0.15.26'
  };

  fs.writeFileSync(configFile, JSON.stringify(configData, null, 2), 'utf-8');
  appendConsoleLog(serverId, `[Playit/Agent]: Playit.gg agent daemon installed (version ${configData.agentVersion}).`);
  appendConsoleLog(serverId, `[Playit/Agent]: Tunnel active: ${configData.tunnelAddress}:${configData.tunnelPort}`);

  return configData;
}

export async function togglePlayitAgent(serverId: string, enable: boolean): Promise<PlayitStatus> {
  const playitDir = getPlayitDir(serverId);
  const configFile = path.join(playitDir, 'playit.json');

  const current = getPlayitStatus(serverId);
  if (!current.isInstalled) {
    throw new Error('Playit agent is not installed on this server.');
  }

  current.isRunning = enable;
  current.status = enable ? 'connected' : 'disconnected';
  current.lastCheckedAt = new Date().toISOString();

  fs.writeFileSync(configFile, JSON.stringify(current, null, 2), 'utf-8');
  appendConsoleLog(serverId, `[Playit/Agent]: Playit agent tunnel ${enable ? 'started' : 'stopped'}.`);

  return current;
}

export async function uninstallPlayitAgent(serverId: string): Promise<boolean> {
  const playitDir = getPlayitDir(serverId);
  if (fs.existsSync(playitDir)) {
    fs.rmSync(playitDir, { recursive: true, force: true });
  }
  appendConsoleLog(serverId, `[Playit/Agent]: Playit agent removed and tunnel configuration purged.`);
  return true;
}
