import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { authMiddleware, AuthenticatedRequest } from '../auth';
import { checkServerAccess, checkServerStateSafety, logServerAudit } from '../middleware/serverAuth';
import { getServerDir } from '../provider';
import { ServerPropertyField } from '../../src/types';

export const propertiesRouter = Router({ mergeParams: true });

function getPropertiesPath(serverId: string): string {
  return path.join(getServerDir(serverId), 'server.properties');
}

// Full Minecraft server.properties schema definitions with categories and validations
const PROPERTY_SCHEMA: Record<string, Partial<ServerPropertyField>> = {
  // Gameplay
  'gamemode': { type: 'enum', category: 'Gameplay', default: 'survival', options: ['survival', 'creative', 'adventure', 'spectator'], description: 'Default game mode for new players.' },
  'difficulty': { type: 'enum', category: 'Gameplay', default: 'easy', options: ['peaceful', 'easy', 'normal', 'hard'], description: 'Defines the difficulty of the world.' },
  'hardcore': { type: 'boolean', category: 'Gameplay', default: false, description: 'If true, player is banned or set to spectator on death.' },
  'pvp': { type: 'boolean', category: 'Gameplay', default: true, description: 'Enable or disable player versus player combat.' },
  'spawn-monsters': { type: 'boolean', category: 'Gameplay', default: true, description: 'Determines if hostile mobs can spawn.' },
  'spawn-animals': { type: 'boolean', category: 'Gameplay', default: true, description: 'Determines if passive animals can spawn.' },
  'spawn-npcs': { type: 'boolean', category: 'Gameplay', default: true, description: 'Determines if villagers can spawn.' },
  'allow-flight': { type: 'boolean', category: 'Gameplay', default: false, description: 'Allows flight in survival mode (e.g. mods, elytra).' },
  'enable-command-block': { type: 'boolean', category: 'Gameplay', default: true, description: 'Enables command blocks.' },

  // Network
  'server-ip': { type: 'string', category: 'Network', default: '', locked: true, description: 'Locked to allocated interface. Controlled by panel.' },
  'server-port': { type: 'number', category: 'Network', default: 25565, locked: true, description: 'Primary allocated server listening port.' },
  'online-mode': { type: 'boolean', category: 'Network', default: true, description: 'Authenticates players against Mojang session servers. Disable only if behind BungeeCord/Velocity proxy.' },
  'white-list': { type: 'boolean', category: 'Network', default: false, description: 'Enforces whitelist. Only listed players can join.' },
  'enforce-whitelist': { type: 'boolean', category: 'Network', default: false, description: 'Kicks players who are removed from whitelist while online.' },
  'max-players': { type: 'number', category: 'Network', default: 20, min: 1, max: 500, description: 'Maximum players allowed simultaneously.' },
  'motd': { type: 'textarea', category: 'Network', default: 'AetherPanel Minecraft Server', description: 'Message of the day displayed in the server list (max 59 chars recommended).' },
  'network-compression-threshold': { type: 'number', category: 'Network', default: 256, min: -1, max: 1500, description: 'Packet compression threshold in bytes (-1 to disable).' },

  // Performance
  'view-distance': { type: 'number', category: 'Performance', default: 10, min: 2, max: 32, description: 'Render radius around each player in chunks.' },
  'simulation-distance': { type: 'number', category: 'Performance', default: 10, min: 2, max: 32, description: 'Radius of ticking entities in chunks.' },
  'max-tick-time': { type: 'number', category: 'Performance', default: 60000, description: 'Maximum millisecond duration before watchdog halts server (-1 to disable).' },
  'entity-broadcast-range-percentage': { type: 'number', category: 'Performance', default: 100, min: 10, max: 500, description: 'Controls how close entities must be to be sent to client.' },
  'sync-chunk-writes': { type: 'boolean', category: 'Performance', default: true, description: 'Synchronous chunk writing.' },

  // World
  'level-name': { type: 'string', category: 'World', default: 'world', description: 'Name of the active world directory.' },
  'level-seed': { type: 'string', category: 'World', default: '', description: 'World generation seed.' },
  'level-type': { type: 'enum', category: 'World', default: 'minecraft:normal', options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified'], description: 'World generator preset.' },
  'generate-structures': { type: 'boolean', category: 'World', default: true, description: 'Generates villages, temples, and dungeons.' },
  'allow-nether': { type: 'boolean', category: 'World', default: true, description: 'Enables Nether portal transitions.' },
  'spawn-protection': { type: 'number', category: 'World', default: 16, min: 0, max: 100, description: 'Radius around world spawn protected from non-OPs.' },

  // Advanced
  'enable-rcon': { type: 'boolean', category: 'Advanced', default: false, description: 'Enables remote console (RCON).' },
  'rcon.port': { type: 'number', category: 'Advanced', default: 25575, description: 'RCON listening port.' },
  'rcon.password': { type: 'string', category: 'Advanced', default: '', description: 'RCON access password.' },
  'enable-query': { type: 'boolean', category: 'Advanced', default: false, description: 'Enables GameSpy4 query protocol.' },
  'query.port': { type: 'number', category: 'Advanced', default: 25565, description: 'GameSpy4 query port.' },
  'enable-status': { type: 'boolean', category: 'Advanced', default: true, description: 'Makes server visible in client server list.' }
};

interface ParsedLine {
  type: 'comment' | 'empty' | 'property';
  key?: string;
  value?: string;
  raw: string;
}

function parsePropertiesFile(content: string): { lines: ParsedLine[]; props: Record<string, string> } {
  const lines: ParsedLine[] = [];
  const props: Record<string, string> = {};

  const rawLines = content.split('\n');
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      lines.push({ type: 'empty', raw });
    } else if (trimmed.startsWith('#') || trimmed.startsWith('!')) {
      lines.push({ type: 'comment', raw });
    } else {
      const eqIdx = raw.indexOf('=');
      if (eqIdx !== -1) {
        const key = raw.substring(0, eqIdx).trim();
        const value = raw.substring(eqIdx + 1).trim();
        lines.push({ type: 'property', key, value, raw });
        props[key] = value;
      } else {
        lines.push({ type: 'comment', raw });
      }
    }
  }

  return { lines, props };
}

function serializePropertiesWithComments(
  originalLines: ParsedLine[],
  changes: Record<string, string | boolean | number>
): string {
  const handledKeys = new Set<string>();
  const outLines: string[] = [];

  for (const item of originalLines) {
    if (item.type === 'property' && item.key) {
      if (item.key in changes) {
        outLines.push(`${item.key}=${changes[item.key]}`);
        handledKeys.add(item.key);
      } else {
        outLines.push(item.raw);
        handledKeys.add(item.key);
      }
    } else {
      outLines.push(item.raw);
    }
  }

  // Append new keys that were not in the file originally
  for (const [k, v] of Object.entries(changes)) {
    if (!handledKeys.has(k)) {
      outLines.push(`${k}=${v}`);
    }
  }

  return outLines.join('\n');
}

// -----------------------------------------------------------------------------
// GET /servers/:id/properties
// -----------------------------------------------------------------------------
propertiesRouter.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'properties.view');
  if (!access) return;

  const propPath = getPropertiesPath(access.server.id);
  if (!fs.existsSync(propPath)) {
    // Generate default template
    const defaultLines = [
      '# Minecraft server properties',
      `# Generated by AetherPanel for ${access.server.name}`,
      `server-port=${access.server.primaryPort || 25565}`,
      'gamemode=survival',
      'difficulty=easy',
      'pvp=true',
      'max-players=20',
      'motd=AetherPanel Minecraft Server',
      'online-mode=true',
      'level-name=world'
    ].join('\n');
    fs.writeFileSync(propPath, defaultLines, 'utf-8');
  }

  const content = fs.readFileSync(propPath, 'utf-8');
  const { props } = parsePropertiesFile(content);

  // Lock server-port and server-ip to allocation
  props['server-port'] = String(access.server.primaryPort || props['server-port'] || '25565');
  props['server-ip'] = access.server.primaryIp || props['server-ip'] || '0.0.0.0';

  const fields: ServerPropertyField[] = [];
  const knownKeys = new Set(Object.keys(PROPERTY_SCHEMA));

  // Add all properties from file
  for (const [key, rawVal] of Object.entries(props)) {
    const schema = PROPERTY_SCHEMA[key];
    let typedVal: any = rawVal;
    if (schema?.type === 'boolean') {
      typedVal = rawVal.toLowerCase() === 'true';
    } else if (schema?.type === 'number') {
      typedVal = Number(rawVal) || 0;
    }

    fields.push({
      key,
      value: typedVal,
      type: schema?.type || 'string',
      category: schema?.category || 'Unknown',
      default: schema?.default,
      description: schema?.description,
      options: schema?.options,
      min: schema?.min,
      max: schema?.max,
      locked: schema?.locked
    });
    knownKeys.delete(key);
  }

  // Add any missing defined schema properties with default values
  for (const key of knownKeys) {
    const schema = PROPERTY_SCHEMA[key];
    fields.push({
      key,
      value: schema.default ?? '',
      type: schema.type || 'string',
      category: schema.category || 'Advanced',
      default: schema.default,
      description: schema.description,
      options: schema.options,
      min: schema.min,
      max: schema.max,
      locked: schema.locked
    });
  }

  res.json({ success: true, data: fields });
});

// -----------------------------------------------------------------------------
// PATCH /servers/:id/properties
// -----------------------------------------------------------------------------
const PatchPropertiesSchema = z.object({
  changes: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()]))
});

propertiesRouter.patch('/', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'properties.edit');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const parsed = PatchPropertiesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues.map(i => i.message).join(', ') }
    });
  }

  const { changes } = parsed.data;

  // Never allow changing server-port or server-ip away from allocation
  delete changes['server-port'];
  delete changes['server-ip'];

  // Validations
  if ('max-players' in changes) {
    const mp = Number(changes['max-players']);
    if (mp < 1 || mp > 500) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_VALUE', message: 'max-players must be between 1 and 500.' } });
    }
  }
  if ('view-distance' in changes) {
    const vd = Number(changes['view-distance']);
    if (vd < 2 || vd > 32) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_VALUE', message: 'view-distance must be between 2 and 32.' } });
    }
  }
  if ('simulation-distance' in changes) {
    const sd = Number(changes['simulation-distance']);
    if (sd < 2 || sd > 32) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_VALUE', message: 'simulation-distance must be between 2 and 32.' } });
    }
  }
  if ('motd' in changes && String(changes['motd']).length > 100) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_VALUE', message: 'motd must be ≤ 100 characters.' } });
  }

  const propPath = getPropertiesPath(access.server.id);
  const content = fs.existsSync(propPath) ? fs.readFileSync(propPath, 'utf-8') : '';
  const { lines } = parsePropertiesFile(content);

  const updatedContent = serializePropertiesWithComments(lines, changes as Record<string, string | number | boolean>);
  fs.writeFileSync(propPath, updatedContent, 'utf-8');

  await logServerAudit(
    req,
    access.server.id,
    'PROPERTIES_UPDATE',
    `Updated server properties: ${Object.keys(changes).join(', ')}`
  );

  res.json({
    success: true,
    message: 'Server properties saved successfully.',
    restartRequired: access.server.status === 'running',
    changedKeys: Object.keys(changes)
  });
});

// -----------------------------------------------------------------------------
// POST /servers/:id/properties/reset
// -----------------------------------------------------------------------------
propertiesRouter.post('/reset', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'properties.edit');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const { keys } = req.body;
  if (!Array.isArray(keys)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_KEYS', message: 'Keys array required' } });
  }

  const resetChanges: Record<string, any> = {};
  for (const k of keys) {
    if (PROPERTY_SCHEMA[k] && PROPERTY_SCHEMA[k].default !== undefined) {
      resetChanges[k] = PROPERTY_SCHEMA[k].default;
    }
  }

  const propPath = getPropertiesPath(access.server.id);
  const content = fs.existsSync(propPath) ? fs.readFileSync(propPath, 'utf-8') : '';
  const { lines } = parsePropertiesFile(content);

  const updatedContent = serializePropertiesWithComments(lines, resetChanges);
  fs.writeFileSync(propPath, updatedContent, 'utf-8');

  await logServerAudit(req, access.server.id, 'PROPERTIES_RESET', `Reset ${keys.length} keys to default`);

  res.json({
    success: true,
    message: `Reset ${Object.keys(resetChanges).length} properties to default values.`,
    restartRequired: access.server.status === 'running'
  });
});

// -----------------------------------------------------------------------------
// GET /servers/:id/properties/raw
// -----------------------------------------------------------------------------
propertiesRouter.get('/raw', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'properties.view');
  if (!access) return;

  const propPath = getPropertiesPath(access.server.id);
  const content = fs.existsSync(propPath) ? fs.readFileSync(propPath, 'utf-8') : '';
  res.json({ success: true, data: { content } });
});

// -----------------------------------------------------------------------------
// POST /servers/:id/properties/raw
// -----------------------------------------------------------------------------
propertiesRouter.post('/raw', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const access = await checkServerAccess(req, res, req.params.id, 'properties.edit');
  if (!access) return;

  if (!checkServerStateSafety(access.server, res)) return;

  const { content } = req.body;
  if (typeof content !== 'string') {
    return res.status(400).json({ success: false, error: { code: 'CONTENT_REQUIRED', message: 'Raw content required' } });
  }

  // Syntax check: ensure it can be parsed
  try {
    const { props } = parsePropertiesFile(content);
    // Lock server-port back to assigned allocation
    props['server-port'] = String(access.server.primaryPort || 25565);
  } catch (err: any) {
    return res.status(400).json({ success: false, error: { code: 'SYNTAX_ERROR', message: `Invalid syntax: ${err.message}` } });
  }

  const propPath = getPropertiesPath(access.server.id);
  fs.writeFileSync(propPath, content, 'utf-8');

  await logServerAudit(req, access.server.id, 'PROPERTIES_RAW_UPDATE', 'Updated server.properties via raw editor');

  res.json({
    success: true,
    message: 'Raw server.properties saved.',
    restartRequired: access.server.status === 'running'
  });
});
