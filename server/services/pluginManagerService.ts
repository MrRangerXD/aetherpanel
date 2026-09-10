import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import AdmZip from 'adm-zip';
import { getServerDir, safePath } from '../provider';
import { getDbSync } from '../db';

export interface PluginMetadata {
  name: string;
  version: string;
  main?: string;
  apiVersion?: string;
  description?: string;
  author?: string;
  authors?: string[];
  website?: string;
  depend?: string[];
  softDepend?: string[];
}

export interface JarValidationResult {
  isValid: boolean;
  status: 'VALID' | 'CORRUPTED_JAR' | 'INVALID_JAR' | 'EMPTY_FILE' | 'PLUGIN_METADATA_MISSING';
  error?: string;
  size: number;
  entryCount: number;
  metadata?: PluginMetadata;
}

export interface PluginPaperStatusResult {
  paperStatus: 'LOADED' | 'FAILED_TO_LOAD' | 'NOT_STARTED' | 'DISABLED';
  paperError?: string;
}

export interface EnrichedPluginInfo {
  filename: string;
  name: string;
  version: string;
  size: number;
  isEnabled: boolean;
  updatedAt: string;
  integrityStatus: 'VALID' | 'CORRUPTED_JAR' | 'INVALID_JAR' | 'EMPTY_FILE' | 'PLUGIN_METADATA_MISSING';
  integrityError?: string;
  paperStatus: 'LOADED' | 'FAILED_TO_LOAD' | 'NOT_STARTED' | 'DISABLED';
  paperError?: string;
  metadata?: PluginMetadata;
}

interface InstallLock {
  pluginName: string;
  startedAt: number;
  stage: 'QUEUED' | 'DOWNLOADING' | 'VALIDATING' | 'INSTALLING';
}

const activeInstallLocks = new Map<string, InstallLock>();
const USER_AGENT = 'AetherPanel/3.5 (admin@aetherpanel.in)';

// Validation cache keyed by "path:mtime:size"
const validationCache = new Map<string, { result: JarValidationResult; timestamp: number }>();

/**
 * Acquire per-server per-plugin installation lock to prevent concurrent writes
 */
export function acquireInstallLock(serverId: string, pluginKey: string, pluginName: string): boolean {
  const lockKey = `${serverId}:${pluginKey.toLowerCase()}`;
  const existing = activeInstallLocks.get(lockKey);
  if (existing) {
    // Release stale locks older than 2 minutes
    if (Date.now() - existing.startedAt > 120000) {
      activeInstallLocks.delete(lockKey);
    } else {
      return false;
    }
  }

  activeInstallLocks.set(lockKey, {
    pluginName,
    startedAt: Date.now(),
    stage: 'DOWNLOADING'
  });
  return true;
}

export function updateInstallLockStage(serverId: string, pluginKey: string, stage: 'QUEUED' | 'DOWNLOADING' | 'VALIDATING' | 'INSTALLING') {
  const lockKey = `${serverId}:${pluginKey.toLowerCase()}`;
  const existing = activeInstallLocks.get(lockKey);
  if (existing) {
    existing.stage = stage;
  }
}

export function releaseInstallLock(serverId: string, pluginKey: string) {
  const lockKey = `${serverId}:${pluginKey.toLowerCase()}`;
  activeInstallLocks.delete(lockKey);
}

/**
 * Parse plugin.yml or paper-plugin.yml text safely
 */
export function parsePluginDescriptor(text: string): PluginMetadata {
  const meta: PluginMetadata = {
    name: '',
    version: '1.0.0'
  };

  const lines = text.split('\n');
  let currentKey = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Simple list item under current key (e.g. authors or depend)
    if (line.startsWith('  - ') || line.startsWith(' - ') || line.startsWith('\t- ')) {
      const itemVal = trimmed.replace(/^-\s*/, '').replace(/['"]/g, '').trim();
      if (currentKey === 'authors') {
        if (!meta.authors) meta.authors = [];
        meta.authors.push(itemVal);
      } else if (currentKey === 'depend') {
        if (!meta.depend) meta.depend = [];
        meta.depend.push(itemVal);
      } else if (currentKey === 'softdepend') {
        if (!meta.softDepend) meta.softDepend = [];
        meta.softDepend.push(itemVal);
      }
      continue;
    }

    const match = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*:\s*(.*)$/);
    if (match) {
      currentKey = match[1].toLowerCase();
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }

      if (currentKey === 'name') meta.name = val;
      else if (currentKey === 'version') meta.version = val;
      else if (currentKey === 'main') meta.main = val;
      else if (currentKey === 'api-version') meta.apiVersion = val;
      else if (currentKey === 'description') meta.description = val;
      else if (currentKey === 'author') {
        meta.author = val;
        if (!meta.authors) meta.authors = [val];
      }
      else if (currentKey === 'website') meta.website = val;
    }
  }

  if (meta.authors && meta.authors.length > 0 && !meta.author) {
    meta.author = meta.authors.join(', ');
  }

  return meta;
}

/**
 * Perform exhaustive, double-layered ZIP & JAR integrity validation
 */
export function validateJarIntegrity(filePath: string): JarValidationResult {
  if (!fs.existsSync(filePath)) {
    return {
      isValid: false,
      status: 'EMPTY_FILE',
      error: 'File does not exist on disk',
      size: 0,
      entryCount: 0
    };
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch (e: any) {
    return {
      isValid: false,
      status: 'CORRUPTED_JAR',
      error: `Filesystem read error: ${e.message}`,
      size: 0,
      entryCount: 0
    };
  }

  // 1. File Size Verification
  if (stat.size === 0) {
    return {
      isValid: false,
      status: 'EMPTY_FILE',
      error: 'File is empty (0 bytes). Download or upload produced no data.',
      size: 0,
      entryCount: 0
    };
  }

  // Minimum valid ZIP header (End of Central Directory record) requires at least 22 bytes
  if (stat.size < 22) {
    return {
      isValid: false,
      status: 'CORRUPTED_JAR',
      error: `File size (${stat.size} bytes) is less than the minimum ZIP header record (22 bytes). Missing zip END header.`,
      size: stat.size,
      entryCount: 0
    };
  }

  // 2. Magic Header & ASCII Content Check
  const headerBuf = Buffer.alloc(Math.min(stat.size, 512));
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, headerBuf, 0, headerBuf.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const textPrefix = headerBuf.toString('utf8').trim().toLowerCase();
  if (
    textPrefix.startsWith('<!doctype') ||
    textPrefix.startsWith('<html') ||
    textPrefix.startsWith('{"error"') ||
    textPrefix.startsWith('{"message"') ||
    textPrefix.startsWith('{"code"') ||
    textPrefix.startsWith('404 ') ||
    textPrefix.startsWith('502 ') ||
    textPrefix.startsWith('503 ')
  ) {
    return {
      isValid: false,
      status: 'INVALID_JAR',
      error: `File contains HTML/JSON error text instead of binary JAR archive (received: "${textPrefix.slice(0, 60)}...")`,
      size: stat.size,
      entryCount: 0
    };
  }

  // ZIP archives start with PK\x03\x04 (0x50 0x4b 0x03 0x04) or PK\x05\x06 (empty archive)
  if (headerBuf[0] !== 0x50 || headerBuf[1] !== 0x4b) {
    return {
      isValid: false,
      status: 'INVALID_JAR',
      error: `Invalid magic signature for JAR archive. Expected 'PK' (0x504B), found 0x${headerBuf.slice(0, 2).toString('hex').toUpperCase()}`,
      size: stat.size,
      entryCount: 0
    };
  }

  // 3. Exact End of Central Directory (EOCD) Backward Scan (0x06054b50)
  // Standard ZIP EOCD can have up to 65535 bytes comment plus 22 bytes header = 65557 bytes
  const scanLength = Math.min(stat.size, 65557);
  const scanBuf = Buffer.alloc(scanLength);
  const scanFd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(scanFd, scanBuf, 0, scanLength, stat.size - scanLength);
  } finally {
    fs.closeSync(scanFd);
  }

  let foundEocd = false;
  // Scan backwards for PK\x05\x06 (0x50, 0x4b, 0x05, 0x06)
  for (let i = scanLength - 22; i >= 0; i--) {
    if (
      scanBuf[i] === 0x50 &&
      scanBuf[i + 1] === 0x4b &&
      scanBuf[i + 2] === 0x05 &&
      scanBuf[i + 3] === 0x06
    ) {
      foundEocd = true;
      break;
    }
  }

  if (!foundEocd) {
    return {
      isValid: false,
      status: 'CORRUPTED_JAR',
      error: 'zip END header not found: Archive central directory record is missing or truncated.',
      size: stat.size,
      entryCount: 0
    };
  }

  // 4. Archive Parsing & Central Directory Validation with AdmZip
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
  } catch (err: any) {
    const msg = err.message || 'Corrupt zip archive';
    return {
      isValid: false,
      status: 'CORRUPTED_JAR',
      error: msg.includes('END header') ? 'zip END header not found' : `Corrupt ZIP archive: ${msg}`,
      size: stat.size,
      entryCount: 0
    };
  }

  let entries: AdmZip.IZipEntry[];
  try {
    entries = zip.getEntries();
  } catch (err: any) {
    return {
      isValid: false,
      status: 'CORRUPTED_JAR',
      error: `Invalid central directory header: ${err.message}`,
      size: stat.size,
      entryCount: 0
    };
  }

  if (!entries || entries.length === 0) {
    return {
      isValid: false,
      status: 'EMPTY_FILE',
      error: 'JAR archive contains 0 files or entries',
      size: stat.size,
      entryCount: 0
    };
  }

  // 5. Plugin Metadata Extraction (plugin.yml or paper-plugin.yml)
  const descriptorEntry = entries.find((e) => {
    const lower = e.entryName.toLowerCase().trim();
    return (
      lower === 'plugin.yml' ||
      lower === 'paper-plugin.yml' ||
      lower === 'bungee.yml' ||
      lower === 'velocity-plugin.json'
    );
  });

  let metadata: PluginMetadata | undefined = undefined;

  if (descriptorEntry) {
    try {
      const descriptorText = zip.readAsText(descriptorEntry);
      if (descriptorText) {
        metadata = parsePluginDescriptor(descriptorText);
      }
    } catch (e: any) {
      console.warn(`[AetherPanel] Failed parsing descriptor in ${filePath}:`, e.message);
    }
  }

  // Check if this is a Minecraft plugin archive
  if (!descriptorEntry || !metadata || !metadata.name) {
    const hasClassFiles = entries.some(e => e.entryName.endsWith('.class'));
    if (!descriptorEntry) {
      return {
        isValid: false,
        status: 'PLUGIN_METADATA_MISSING',
        error: 'Archive is a valid ZIP but missing required plugin descriptor (plugin.yml or paper-plugin.yml).',
        size: stat.size,
        entryCount: entries.length,
        metadata
      };
    }
  }

  return {
    isValid: true,
    status: 'VALID',
    size: stat.size,
    entryCount: entries.length,
    metadata
  };
}

/**
 * Resolve direct download URL for Modrinth, Hangar, or direct link
 */
export async function resolveArtifactDownloadUrl(
  provider?: string,
  projectId?: string,
  directUrl?: string,
  pluginName?: string
): Promise<{ downloadUrl: string; resolvedFilename: string }> {
  // If direct URL is already a genuine .jar download artifact
  if (directUrl && !directUrl.includes('/version') && directUrl.includes('.jar')) {
    const urlObj = new URL(directUrl);
    const resolvedName = path.basename(urlObj.pathname) || `${pluginName || 'plugin'}.jar`;
    return { downloadUrl: directUrl, resolvedFilename: resolvedName };
  }

  // 1. Modrinth Provider Resolution
  if (provider === 'Modrinth' || (projectId && !projectId.startsWith('hangar_'))) {
    const projId = projectId || directUrl?.split('/project/')?.[1]?.split('/')?.[0];
    if (projId) {
      try {
        const verUrl = `https://api.modrinth.com/v2/project/${projId}/version`;
        const res = await fetch(verUrl, {
          headers: { 'User-Agent': USER_AGENT }
        });
        if (res.ok) {
          const versions = (await res.json()) as any[];
          if (Array.isArray(versions) && versions.length > 0) {
            // Find latest version containing .jar files
            for (const ver of versions) {
              if (ver.files && ver.files.length > 0) {
                const primaryJar = ver.files.find((f: any) => f.primary && f.filename?.endsWith('.jar'));
                const anyJar = ver.files.find((f: any) => f.filename?.endsWith('.jar'));
                const chosen = primaryJar || anyJar;
                if (chosen && chosen.url) {
                  return {
                    downloadUrl: chosen.url,
                    resolvedFilename: chosen.filename || `${pluginName || 'plugin'}.jar`
                  };
                }
              }
            }
          }
        }
      } catch (err: any) {
        console.error('[AetherPanel] Error resolving Modrinth artifact:', err.message);
      }
    }
  }

  // 2. Hangar Provider Resolution
  if (provider === 'Hangar' || (projectId && projectId.startsWith('hangar_'))) {
    const slug = (projectId || '').replace(/^hangar_/, '') || pluginName;
    if (slug) {
      try {
        const hangarUrl = `https://hangar.papermc.io/api/v1/projects/${encodeURIComponent(slug)}/versions?limit=1`;
        const res = await fetch(hangarUrl, {
          headers: { 'User-Agent': USER_AGENT }
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          const ver = data.result?.[0];
          if (ver && ver.downloads) {
            const platformDl = ver.downloads.PAPER || ver.downloads.SPIGOT || ver.downloads.VELOCITY || Object.values(ver.downloads)[0] as any;
            if (platformDl && platformDl.downloadUrl) {
              return {
                downloadUrl: platformDl.downloadUrl,
                resolvedFilename: platformDl.fileInfo?.name || `${pluginName || 'plugin'}.jar`
              };
            }
          }
        }
      } catch (err: any) {
        console.error('[AetherPanel] Error resolving Hangar artifact:', err.message);
      }
    }
  }

  // 3. Direct URL fallback
  if (directUrl) {
    try {
      const urlObj = new URL(directUrl);
      const filename = path.basename(urlObj.pathname) || `${pluginName || 'plugin'}.jar`;
      return { downloadUrl: directUrl, resolvedFilename: filename };
    } catch {
      throw new Error(`Invalid download URL: ${directUrl}`);
    }
  }

  throw new Error('Unable to resolve a downloadable .jar artifact URL from repository.');
}

/**
 * Atomic Download & Validation Workflow
 * Download -> Temporary File -> Verify Size -> Verify ZIP/JAR Integrity -> Atomic Move
 */
export async function downloadAndInstallPlugin(
  serverId: string,
  pluginName: string,
  directUrl?: string,
  projectId?: string,
  provider?: string
): Promise<{ success: boolean; filename: string; size: number; metadata?: PluginMetadata; message: string }> {
  const baseDir = getServerDir(serverId);
  const pluginsDir = path.join(baseDir, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  const cleanKey = pluginName.replace(/[^a-zA-Z0-9_\-]/g, '').toLowerCase() || 'plugin';

  // 1. Lock against concurrent duplicate installations
  const lockAcquired = acquireInstallLock(serverId, cleanKey, pluginName);
  if (!lockAcquired) {
    const err: any = new Error(`Installation in progress: '${pluginName}' is already being installed.`);
    err.code = 'INSTALLATION_IN_PROGRESS';
    throw err;
  }

  // Temporary file path in plugins directory
  const tempFilename = `.aetherpanel-download-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
  const tempPath = path.join(pluginsDir, tempFilename);

  try {
    // 2. Resolve genuine download URL
    const { downloadUrl, resolvedFilename } = await resolveArtifactDownloadUrl(provider, projectId, directUrl, pluginName);

    // 3. Streaming download to temporary file
    updateInstallLockStage(serverId, cleanKey, 'DOWNLOADING');

    const downloadRes = await fetch(downloadUrl, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow'
    });

    if (!downloadRes.ok) {
      throw new Error(`HTTP_ERROR: Server returned HTTP ${downloadRes.status} (${downloadRes.statusText})`);
    }

    const contentType = (downloadRes.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('text/html')) {
      throw new Error(`INVALID_JAR: Remote server returned an HTML webpage instead of a binary JAR archive.`);
    }

    const contentLengthHeader = downloadRes.headers.get('content-length');
    const expectedBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : undefined;

    if (!downloadRes.body) {
      throw new Error('EMPTY_FILE: Received empty response stream from download server.');
    }

    const writeStream = fs.createWriteStream(tempPath);
    let bytesWritten = 0;

    const nodeReadable = Readable.fromWeb(downloadRes.body as any);
    nodeReadable.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
    });

    await pipeline(nodeReadable, writeStream);

    // Verify stream completion vs Content-Length
    if (expectedBytes !== undefined && bytesWritten !== expectedBytes) {
      throw new Error(`INCOMPLETE_DOWNLOAD: Download terminated prematurely. Expected ${expectedBytes} bytes, but received ${bytesWritten} bytes.`);
    }

    // 4. Verify temporary file on disk
    if (!fs.existsSync(tempPath)) {
      throw new Error('FILESYSTEM_WRITE_FAILED: Temporary file was not written to disk.');
    }

    const stat = fs.statSync(tempPath);
    if (stat.size === 0) {
      throw new Error('EMPTY_FILE: Downloaded file is 0 bytes.');
    }

    // 5. JAR Integrity Validation
    updateInstallLockStage(serverId, cleanKey, 'VALIDATING');
    const validation = validateJarIntegrity(tempPath);

    if (!validation.isValid) {
      // Validation failed: Remove temporary file, do NOT promote to .jar
      throw new Error(validation.error || 'JAR integrity validation failed');
    }

    // 6. Atomic Promotion to Final plugins/<plugin>.jar
    updateInstallLockStage(serverId, cleanKey, 'INSTALLING');

    let finalName = resolvedFilename;
    if (!finalName.toLowerCase().endsWith('.jar')) {
      finalName = `${finalName}.jar`;
    }
    // Clean filename
    finalName = path.basename(finalName).replace(/[^a-zA-Z0-9_\-\.]/g, '');
    if (!finalName || finalName === '.jar') {
      finalName = `${cleanKey}.jar`;
    }

    const finalPath = path.join(pluginsDir, finalName);

    // Atomic move
    fs.renameSync(tempPath, finalPath);

    return {
      success: true,
      filename: finalName,
      size: validation.size,
      metadata: validation.metadata,
      message: `Plugin '${pluginName}' installed successfully. Restart the server to load it.`
    };
  } catch (err: any) {
    // Ensure temporary file is cleanly destroyed on any error
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {}

    throw err;
  } finally {
    releaseInstallLock(serverId, cleanKey);
  }
}

/**
 * Atomic Upload & Validation Workflow
 * Upload -> Temporary File -> Verify Size -> Verify ZIP/JAR Integrity -> Atomic Move
 */
export async function installUploadedPlugin(
  serverId: string,
  tempUploadedPath: string,
  originalName: string
): Promise<{ success: boolean; filename: string; size: number; metadata?: PluginMetadata }> {
  const baseDir = getServerDir(serverId);
  const pluginsDir = path.join(baseDir, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  const safeOriginal = path.basename(originalName).replace(/[^a-zA-Z0-9_\-\.]/g, '');
  const cleanKey = safeOriginal.replace(/\.jar$/i, '').toLowerCase() || 'plugin';

  const lockAcquired = acquireInstallLock(serverId, cleanKey, originalName);
  if (!lockAcquired) {
    const err: any = new Error(`Installation in progress: '${originalName}' is already being processed.`);
    err.code = 'INSTALLATION_IN_PROGRESS';
    throw err;
  }

  try {
    if (!fs.existsSync(tempUploadedPath)) {
      throw new Error('Uploaded file was not found on server.');
    }

    // Validate JAR structure and metadata
    const validation = validateJarIntegrity(tempUploadedPath);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Uploaded file is not a valid Minecraft plugin JAR.');
    }

    let finalName = safeOriginal;
    if (!finalName.toLowerCase().endsWith('.jar')) {
      finalName = `${finalName}.jar`;
    }

    const finalPath = path.join(pluginsDir, finalName);
    fs.renameSync(tempUploadedPath, finalPath);

    return {
      success: true,
      filename: finalName,
      size: validation.size,
      metadata: validation.metadata
    };
  } catch (err: any) {
    try {
      if (fs.existsSync(tempUploadedPath)) {
        fs.unlinkSync(tempUploadedPath);
      }
    } catch {}
    throw err;
  } finally {
    releaseInstallLock(serverId, cleanKey);
  }
}

/**
 * Inspect server console logs and logs/latest.log to detect runtime Paper plugin errors
 */
export function checkPluginPaperStatus(
  serverId: string,
  pluginName: string,
  filename: string,
  serverLogs: string[],
  isCorruptedJar: boolean = false
): PluginPaperStatusResult {
  const baseDir = getServerDir(serverId);

  if (filename.endsWith('.disabled')) {
    return { paperStatus: 'DISABLED' };
  }

  const db = getDbSync();
  const server = db.servers.find(s => s.id === serverId);
  const isOnline = server?.status === 'running' || server?.status === 'starting';

  if (!isOnline && serverLogs.length === 0) {
    return { paperStatus: 'NOT_STARTED' };
  }

  // Also read logs/latest.log if present
  const latestLogPath = path.join(baseDir, 'logs', 'latest.log');
  let combinedLines = [...serverLogs];
  if (fs.existsSync(latestLogPath)) {
    try {
      const content = fs.readFileSync(latestLogPath, 'utf8');
      const diskLines = content.split('\n').filter(Boolean);
      // Take the last 500 lines
      combinedLines = combinedLines.concat(diskLines.slice(-500));
    } catch {}
  }

  const cleanNameLower = pluginName.toLowerCase().trim();
  const cleanFileLower = filename.toLowerCase().trim();

  let detectedError: string | undefined = undefined;
  let detectedLoaded = false;

  for (let i = combinedLines.length - 1; i >= 0; i--) {
    const line = combinedLines[i];
    const lineLower = line.toLowerCase();

    // Check for corrupt zip errors or paper load errors
    if (
      (lineLower.includes('zip end header not found') && (isCorruptedJar || lineLower.includes(cleanNameLower) || lineLower.includes(cleanFileLower))) ||
      (lineLower.includes('error loading plugin') && (lineLower.includes(cleanNameLower) || lineLower.includes(cleanFileLower))) ||
      (lineLower.includes('could not load') && (lineLower.includes(cleanNameLower) || lineLower.includes(cleanFileLower))) ||
      (lineLower.includes('invalidpluginexception') && lineLower.includes(cleanNameLower)) ||
      (lineLower.includes('unsupportedclassversionerror') && lineLower.includes(cleanNameLower)) ||
      (lineLower.includes('unknowndependencyexception') && lineLower.includes(cleanNameLower)) ||
      (lineLower.includes('invaliddescriptionexception') && lineLower.includes(cleanNameLower))
    ) {
      detectedError = line.trim();
      break;
    }

    // Check if plugin successfully enabled
    if (
      (lineLower.includes('enabling') && lineLower.includes(cleanNameLower)) ||
      (lineLower.includes(`[${cleanNameLower}]`) && lineLower.includes('enabled'))
    ) {
      detectedLoaded = true;
      break;
    }
  }

  if (detectedError) {
    return {
      paperStatus: 'FAILED_TO_LOAD',
      paperError: detectedError
    };
  }

  if (detectedLoaded) {
    return { paperStatus: 'LOADED' };
  }

  return {
    paperStatus: isOnline ? 'LOADED' : 'NOT_STARTED'
  };
}

/**
 * List all installed plugins with complete integrity checks and Paper runtime status
 */
export function listMinecraftPluginsWithIntegrity(serverId: string, consoleLogs: string[] = []): EnrichedPluginInfo[] {
  const baseDir = getServerDir(serverId);
  const pluginsDir = path.join(baseDir, 'plugins');

  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
    return [];
  }

  const files = fs.readdirSync(pluginsDir);
  const list: EnrichedPluginInfo[] = [];

  for (const f of files) {
    // Skip hidden files, temporary files (.aetherpanel-*.tmp)
    if (f.startsWith('.') || f.endsWith('.tmp')) continue;

    if (f.endsWith('.jar') || f.endsWith('.jar.disabled')) {
      const fullPath = path.join(pluginsDir, f);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      const isEnabled = !f.endsWith('.disabled');
      const cleanName = f.replace(/\.jar(\.disabled)?$/, '');

      // Run integrity check
      const validation = validateJarIntegrity(fullPath);

      const displayName = validation.metadata?.name || cleanName;
      const displayVersion = validation.metadata?.version || (validation.isValid ? '1.0.0' : 'Corrupted');

      // Check Paper runtime status
      const paperStatusRes = checkPluginPaperStatus(serverId, displayName, f, consoleLogs, !validation.isValid);

      list.push({
        filename: f,
        name: displayName,
        version: displayVersion,
        size: stat.size,
        isEnabled,
        updatedAt: stat.mtime.toISOString(),
        integrityStatus: validation.status,
        integrityError: validation.error,
        paperStatus: paperStatusRes.paperStatus,
        paperError: paperStatusRes.paperError,
        metadata: validation.metadata
      });
    }
  }

  return list;
}
