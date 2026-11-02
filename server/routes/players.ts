import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { checkServerAccess, logServerAudit } from '../middleware/serverAuth';
import { getServerDir, sendServerCommand, getServerConsoleLogs } from '../provider';
import { OnlinePlayer, OpPlayer, WhitelistPlayer, BannedPlayer, BannedIp } from '../../src/types';

export const playersRouter = Router({ mergeParams: true });

// Mojang UUID Resolution Cache (Memory)
const mojangCache = new Map<string, { uuid: string; resolvedAt: number }>();

async function resolveMinecraftUuid(username: string): Promise<string | undefined> {
  const cached = mojangCache.get(username.toLowerCase());
  if (cached && Date.now() - cached.resolvedAt < 86400000) {
    return cached.uuid;
  }
  try {
    const res = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`);
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.id) {
        // Format to dashed UUID
        const raw = data.id;
        const dashed = `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
        mojangCache.set(username.toLowerCase(), { uuid: dashed, resolvedAt: Date.now() });
        return dashed;
      }
    }
  } catch {}
  return undefined;
}

// 3-second cache for online players per server
const onlineCache = new Map<string, { players: OnlinePlayer[]; timestamp: number }>();

function readJsonFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJsonFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

function cleanAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
}

// -----------------------------------------------------------------------------
// GET /servers/:id/players/online
// -----------------------------------------------------------------------------
playersRouter.get('/online', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'players.view');
  if (!access) return;

  const server = access.server;
  if (server.status !== 'running') {
    return res.json({
      success: true,
      data: [],
      serverStatus: server.status,
      message: 'Server is offline'
    });
  }

  const cached = onlineCache.get(server.id);
  if (cached && Date.now() - cached.timestamp < 3000) {
    return res.json({ success: true, data: cached.players, cached: true });
  }

  // Parse online players from live console log buffer
  try {
    const logs = await getServerConsoleLogs(server.id);
    const onlineSet = new Set<string>();

    // Scan backwards through logs
    for (let i = logs.length - 1; i >= 0 && onlineSet.size < 100; i--) {
      const line = cleanAnsi(logs[i]);

      // Player join pattern
      const joinMatch = line.match(/(?:\[Server thread\/INFO\]:\s*)?([a-zA-Z0-9_]{3,16})\s+joined the game/i);
      if (joinMatch) {
        onlineSet.add(joinMatch[1]);
      }

      // Player quit pattern
      const quitMatch = line.match(/(?:\[Server thread\/INFO\]:\s*)?([a-zA-Z0-9_]{3,16})\s+left the game/i);
      if (quitMatch) {
        onlineSet.delete(quitMatch[1]);
      }

      // 'list' response pattern e.g.: "There are 2 of a max of 20 players online: Player1, Player2"
      const listMatch = line.match(/players online:\s*([a-zA-Z0-9_,\s]+)/i);
      if (listMatch) {
        const names = listMatch[1].split(',').map(n => n.trim()).filter(Boolean);
        names.forEach(n => onlineSet.add(n));
        break; // Reached authoritative list command response
      }
    }

    const onlineList: OnlinePlayer[] = Array.from(onlineSet).map(name => ({
      name,
      avatarUrl: `https://minotar.net/avatar/${encodeURIComponent(name)}/64.png`
    }));

    onlineCache.set(server.id, { players: onlineList, timestamp: Date.now() });

    res.json({ success: true, data: onlineList });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'LOG_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// GET /servers/:id/players/ops
// -----------------------------------------------------------------------------
playersRouter.get('/ops', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'players.view');
  if (!access) return;

  const opsPath = path.join(getServerDir(access.server.id), 'ops.json');
  const ops = readJsonFile<OpPlayer[]>(opsPath, []);
  res.json({ success: true, data: ops });
});

// -----------------------------------------------------------------------------
// GET /servers/:id/players/whitelist
// -----------------------------------------------------------------------------
playersRouter.get('/whitelist', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'players.view');
  if (!access) return;

  const wlPath = path.join(getServerDir(access.server.id), 'whitelist.json');
  const wl = readJsonFile<WhitelistPlayer[]>(wlPath, []);
  res.json({ success: true, data: wl });
});

// -----------------------------------------------------------------------------
// GET /servers/:id/players/bans
// -----------------------------------------------------------------------------
playersRouter.get('/bans', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'players.view');
  if (!access) return;

  const sDir = getServerDir(access.server.id);
  const bannedPlayers = readJsonFile<BannedPlayer[]>(path.join(sDir, 'banned-players.json'), []);
  const bannedIps = readJsonFile<BannedIp[]>(path.join(sDir, 'banned-ips.json'), []);

  res.json({
    success: true,
    data: {
      players: bannedPlayers,
      ips: bannedIps
    }
  });
});

// -----------------------------------------------------------------------------
// POST /servers/:id/players/:list (Add to ops, whitelist, bans)
// -----------------------------------------------------------------------------
playersRouter.post('/:list(ops|whitelist|banned-players|banned-ips)', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const listName = req.params.list;
  const reqPerm = listName === 'ops' ? 'players.admin' : 'players.manage';
  const access = await checkServerAccess(req, res, req.params.id, reqPerm);
  if (!access) return;

  const { player, uuid, reason, ip } = req.body;
  const sDir = getServerDir(access.server.id);
  const filePath = path.join(sDir, `${listName}.json`);

  try {
    if (listName === 'ops') {
      if (!player) return res.status(400).json({ success: false, error: { code: 'PLAYER_REQUIRED', message: 'Player name required' } });
      const resolvedUuid = uuid || await resolveMinecraftUuid(player) || '00000000-0000-0000-0000-000000000000';
      const ops = readJsonFile<OpPlayer[]>(filePath, []);
      if (!ops.some(o => o.name.toLowerCase() === player.toLowerCase())) {
        ops.push({ uuid: resolvedUuid, name: player, level: 4, bypassesPlayerLimit: false });
        writeJsonFile(filePath, ops);
        if (access.server.status === 'running') {
          await sendServerCommand(access.server.id, `op ${player}`);
        }
      }
    } else if (listName === 'whitelist') {
      if (!player) return res.status(400).json({ success: false, error: { code: 'PLAYER_REQUIRED', message: 'Player name required' } });
      const resolvedUuid = uuid || await resolveMinecraftUuid(player) || '00000000-0000-0000-0000-000000000000';
      const wl = readJsonFile<WhitelistPlayer[]>(filePath, []);
      if (!wl.some(w => w.name.toLowerCase() === player.toLowerCase())) {
        wl.push({ uuid: resolvedUuid, name: player });
        writeJsonFile(filePath, wl);
        if (access.server.status === 'running') {
          await sendServerCommand(access.server.id, `whitelist add ${player}`);
        }
      }
    } else if (listName === 'banned-players') {
      if (!player) return res.status(400).json({ success: false, error: { code: 'PLAYER_REQUIRED', message: 'Player name required' } });
      const resolvedUuid = uuid || await resolveMinecraftUuid(player) || '00000000-0000-0000-0000-000000000000';
      const bans = readJsonFile<BannedPlayer[]>(filePath, []);
      if (!bans.some(b => b.name.toLowerCase() === player.toLowerCase())) {
        bans.push({
          uuid: resolvedUuid,
          name: player,
          created: new Date().toISOString(),
          source: req.user!.username || 'Admin',
          expires: 'forever',
          reason: reason || 'Banned by operator'
        });
        writeJsonFile(filePath, bans);
        if (access.server.status === 'running') {
          await sendServerCommand(access.server.id, `ban ${player} ${reason || ''}`);
        }
      }
    } else if (listName === 'banned-ips') {
      const targetIp = ip || player;
      if (!targetIp) return res.status(400).json({ success: false, error: { code: 'IP_REQUIRED', message: 'IP required' } });
      const ipBans = readJsonFile<BannedIp[]>(filePath, []);
      if (!ipBans.some(b => b.ip === targetIp)) {
        ipBans.push({
          ip: targetIp,
          created: new Date().toISOString(),
          source: req.user!.username || 'Admin',
          expires: 'forever',
          reason: reason || 'IP Banned by operator'
        });
        writeJsonFile(filePath, ipBans);
        if (access.server.status === 'running') {
          await sendServerCommand(access.server.id, `ban-ip ${targetIp} ${reason || ''}`);
        }
      }
    }

    await logServerAudit(req, access.server.id, `PLAYER_ADD_${listName.toUpperCase()}`, `Added ${player || ip} to ${listName}`);

    res.json({ success: true, message: `Added to ${listName}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'WRITE_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// DELETE /servers/:id/players/:list/:player
// -----------------------------------------------------------------------------
playersRouter.delete('/:list(ops|whitelist|banned-players|banned-ips)/:player', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const listName = req.params.list;
  const target = req.params.player;
  const reqPerm = listName === 'ops' ? 'players.admin' : 'players.manage';
  const access = await checkServerAccess(req, res, req.params.id, reqPerm);
  if (!access) return;

  const sDir = getServerDir(access.server.id);
  const filePath = path.join(sDir, `${listName}.json`);

  try {
    if (listName === 'ops') {
      let ops = readJsonFile<OpPlayer[]>(filePath, []);
      ops = ops.filter(o => o.name.toLowerCase() !== target.toLowerCase() && o.uuid !== target);
      writeJsonFile(filePath, ops);
      if (access.server.status === 'running') {
        await sendServerCommand(access.server.id, `deop ${target}`);
      }
    } else if (listName === 'whitelist') {
      let wl = readJsonFile<WhitelistPlayer[]>(filePath, []);
      wl = wl.filter(w => w.name.toLowerCase() !== target.toLowerCase() && w.uuid !== target);
      writeJsonFile(filePath, wl);
      if (access.server.status === 'running') {
        await sendServerCommand(access.server.id, `whitelist remove ${target}`);
      }
    } else if (listName === 'banned-players') {
      let bans = readJsonFile<BannedPlayer[]>(filePath, []);
      bans = bans.filter(b => b.name.toLowerCase() !== target.toLowerCase() && b.uuid !== target);
      writeJsonFile(filePath, bans);
      if (access.server.status === 'running') {
        await sendServerCommand(access.server.id, `pardon ${target}`);
      }
    } else if (listName === 'banned-ips') {
      let ipBans = readJsonFile<BannedIp[]>(filePath, []);
      ipBans = ipBans.filter(b => b.ip !== target);
      writeJsonFile(filePath, ipBans);
      if (access.server.status === 'running') {
        await sendServerCommand(access.server.id, `pardon-ip ${target}`);
      }
    }

    await logServerAudit(req, access.server.id, `PLAYER_REMOVE_${listName.toUpperCase()}`, `Removed ${target} from ${listName}`);

    res.json({ success: true, message: `Removed from ${listName}.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'WRITE_ERROR', message: err.message } });
  }
});

// -----------------------------------------------------------------------------
// POST /servers/:id/players/:action(kick|ban|ban-ip|op|deop|whitelist|unban)
// -----------------------------------------------------------------------------
playersRouter.post('/:action(kick|ban|ban-ip|op|deop|whitelist|unban)', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { action } = req.params;
  const isOpAction = action === 'op' || action === 'deop';
  const reqPerm = isOpAction ? 'players.admin' : 'players.manage';

  const access = await checkServerAccess(req, res, req.params.id, reqPerm);
  if (!access) return;

  const { player, reason, ip } = req.body;
  const target = player || ip;

  if (!target) {
    return res.status(400).json({ success: false, error: { code: 'PLAYER_REQUIRED', message: 'Player name or IP required' } });
  }

  const sDir = getServerDir(access.server.id);

  try {
    let cmd = '';
    if (action === 'kick') {
      if (access.server.status !== 'running') {
        return res.status(400).json({ success: false, error: { code: 'SERVER_OFFLINE', message: 'Cannot kick player: server is offline' } });
      }
      cmd = `kick ${target} ${reason || 'Kicked by an operator'}`;
    } else if (action === 'ban') {
      cmd = `ban ${target} ${reason || 'Banned by an operator'}`;
      // Persist to banned-players.json
      const fPath = path.join(sDir, 'banned-players.json');
      const list = readJsonFile<BannedPlayer[]>(fPath, []);
      const uuid = await resolveMinecraftUuid(target) || '00000000-0000-0000-0000-000000000000';
      if (!list.some(b => b.name.toLowerCase() === target.toLowerCase())) {
        list.push({
          uuid,
          name: target,
          created: new Date().toISOString(),
          source: req.user!.username || 'Admin',
          expires: 'forever',
          reason: reason || 'Banned by operator'
        });
        writeJsonFile(fPath, list);
      }
    } else if (action === 'ban-ip') {
      cmd = `ban-ip ${target} ${reason || 'IP Banned by operator'}`;
      const fPath = path.join(sDir, 'banned-ips.json');
      const list = readJsonFile<BannedIp[]>(fPath, []);
      if (!list.some(b => b.ip === target)) {
        list.push({
          ip: target,
          created: new Date().toISOString(),
          source: req.user!.username || 'Admin',
          expires: 'forever',
          reason: reason || 'IP Banned by operator'
        });
        writeJsonFile(fPath, list);
      }
    } else if (action === 'op') {
      cmd = `op ${target}`;
      const fPath = path.join(sDir, 'ops.json');
      const list = readJsonFile<OpPlayer[]>(fPath, []);
      const uuid = await resolveMinecraftUuid(target) || '00000000-0000-0000-0000-000000000000';
      if (!list.some(b => b.name.toLowerCase() === target.toLowerCase())) {
        list.push({ uuid, name: target, level: 4, bypassesPlayerLimit: false });
        writeJsonFile(fPath, list);
      }
    } else if (action === 'deop') {
      cmd = `deop ${target}`;
      const fPath = path.join(sDir, 'ops.json');
      let list = readJsonFile<OpPlayer[]>(fPath, []);
      list = list.filter(b => b.name.toLowerCase() !== target.toLowerCase());
      writeJsonFile(fPath, list);
    } else if (action === 'whitelist') {
      cmd = `whitelist add ${target}`;
      const fPath = path.join(sDir, 'whitelist.json');
      const list = readJsonFile<WhitelistPlayer[]>(fPath, []);
      const uuid = await resolveMinecraftUuid(target) || '00000000-0000-0000-0000-000000000000';
      if (!list.some(b => b.name.toLowerCase() === target.toLowerCase())) {
        list.push({ uuid, name: target });
        writeJsonFile(fPath, list);
      }
    } else if (action === 'unban') {
      cmd = `pardon ${target}`;
      const fPath = path.join(sDir, 'banned-players.json');
      let list = readJsonFile<BannedPlayer[]>(fPath, []);
      list = list.filter(b => b.name.toLowerCase() !== target.toLowerCase());
      writeJsonFile(fPath, list);
    }

    if (cmd && access.server.status === 'running') {
      await sendServerCommand(access.server.id, cmd);
    }

    await logServerAudit(req, access.server.id, `PLAYER_${action.toUpperCase()}`, `Action '${action}' on ${target}`);

    res.json({ success: true, message: `Player action '${action}' applied successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'EXEC_ERROR', message: err.message } });
  }
});
