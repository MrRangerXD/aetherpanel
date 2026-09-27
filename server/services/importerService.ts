import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { Client as SftpClient } from 'ssh2';
import AdmZip from 'adm-zip';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getDb } from '../db';
import { resolveDirectDownloadUrl } from './remoteDownloadService';

function getServerVolumePath(serverId: string): string {
  const dir = path.resolve(process.cwd(), 'data', 'servers', serverId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const execAsync = promisify(exec);

export interface ImportJobStatus {
  serverId: string;
  sourceType: 'sftp' | 'url' | 'pterodactyl';
  status: 'IDLE' | 'CONNECTING' | 'ANALYZING' | 'TRANSFERRING' | 'EXTRACTING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  progressPercent: number;
  transferredBytes: number;
  totalBytes: number;
  transferredFiles: number;
  totalFiles: number;
  currentFile: string;
  speedMBps: number;
  etaSeconds: number;
  message: string;
  logs: string[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// In-memory active import jobs
const activeImportJobs = new Map<string, ImportJobStatus>();
const jobCancelFlags = new Set<string>();

export function getImportJobStatus(serverId: string): ImportJobStatus {
  return activeImportJobs.get(serverId) || {
    serverId,
    sourceType: 'url',
    status: 'IDLE',
    progressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    transferredFiles: 0,
    totalFiles: 0,
    currentFile: '',
    speedMBps: 0,
    etaSeconds: 0,
    message: 'No active import job.',
    logs: []
  };
}

export function cancelImportJob(serverId: string): boolean {
  if (activeImportJobs.has(serverId)) {
    jobCancelFlags.add(serverId);
    const job = activeImportJobs.get(serverId)!;
    job.status = 'CANCELED';
    job.message = 'Import job canceled by user.';
    job.logs.push(`[${new Date().toISOString()}] [Importer]: Import job canceled by user.`);
    return true;
  }
  return false;
}

function appendJobLog(job: ImportJobStatus, line: string) {
  const time = new Date().toLocaleTimeString();
  const entry = `[${time}] ${line}`;
  job.logs.push(entry);
  if (job.logs.length > 500) {
    job.logs.shift();
  }
}

/**
 * Tests SFTP credentials and path
 */
export async function testSftpConnection(config: {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath?: string;
}): Promise<{ success: boolean; fileCount?: number; totalSizeBytes?: number; message?: string; error?: string }> {
  return new Promise((resolve) => {
    const conn = new SftpClient();
    const port = config.port || 22;
    const remoteDir = config.remotePath || '/';

    const timeoutTimer = setTimeout(() => {
      try { conn.end(); } catch {}
      resolve({ success: false, error: 'Connection timed out after 10 seconds.' });
    }, 10000);

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          clearTimeout(timeoutTimer);
          conn.end();
          return resolve({ success: false, error: `SFTP subsystem error: ${err.message}` });
        }

        sftp.readdir(remoteDir, (readErr, list) => {
          clearTimeout(timeoutTimer);
          conn.end();

          if (readErr) {
            return resolve({ success: false, error: `Remote directory '${remoteDir}' not accessible: ${readErr.message}` });
          }

          let fileCount = 0;
          let totalSize = 0;

          if (Array.isArray(list)) {
            fileCount = list.length;
            list.forEach((item: any) => {
              if (item.attrs && item.attrs.size) {
                totalSize += item.attrs.size;
              }
            });
          }

          resolve({
            success: true,
            fileCount,
            totalSizeBytes: totalSize,
            message: `Connected successfully! Found ${fileCount} items in '${remoteDir}'.`
          });
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeoutTimer);
      resolve({ success: false, error: `SFTP Connection Failed: ${err.message}` });
    });

    try {
      conn.connect({
        host: config.host,
        port,
        username: config.username,
        password: config.password || undefined,
        privateKey: config.privateKey || undefined,
        readyTimeout: 8000
      });
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      resolve({ success: false, error: err.message || 'Connection configuration error' });
    }
  });
}

/**
 * Start SFTP recursive migration
 */
export async function startSftpImport(serverId: string, config: {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath?: string;
  autoExtractArchives?: boolean;
}): Promise<ImportJobStatus> {
  const serverPath = getServerVolumePath(serverId);
  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath, { recursive: true });
  }

  jobCancelFlags.delete(serverId);

  const job: ImportJobStatus = {
    serverId,
    sourceType: 'sftp',
    status: 'CONNECTING',
    progressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    transferredFiles: 0,
    totalFiles: 0,
    currentFile: 'Initializing connection...',
    speedMBps: 0,
    etaSeconds: 0,
    message: `Connecting to SFTP ${config.host}:${config.port || 22}...`,
    logs: [],
    startedAt: new Date().toISOString()
  };

  activeImportJobs.set(serverId, job);
  appendJobLog(job, `Connecting to SFTP server ${config.username}@${config.host}:${config.port || 22}...`);

  // Run migration in background worker
  (async () => {
    const conn = new SftpClient();
    const port = config.port || 22;
    const remoteDir = (config.remotePath || '/').replace(/\/+$/, '') || '/';

    try {
      await new Promise<void>((resolve, reject) => {
        conn.on('ready', () => resolve());
        conn.on('error', (err) => reject(err));
        conn.connect({
          host: config.host,
          port,
          username: config.username,
          password: config.password || undefined,
          privateKey: config.privateKey || undefined,
          readyTimeout: 10000
        });
      });

      appendJobLog(job, `[✓ Connected]: SFTP authentication successful.`);
      job.status = 'ANALYZING';
      job.message = 'Scanning remote directory tree...';

      const sftp = await new Promise<any>((resolve, reject) => {
        conn.sftp((err, sftpSession) => err ? reject(err) : resolve(sftpSession));
      });

      // Walk remote tree
      interface RemoteFileItem {
        remotePath: string;
        relativePath: string;
        size: number;
        isDir: boolean;
      }

      const itemsToFetch: RemoteFileItem[] = [];

      async function walkRemoteDir(currentRemote: string, currentRelative: string) {
        if (jobCancelFlags.has(serverId)) return;

        const list = await new Promise<any[]>((resolve, reject) => {
          sftp.readdir(currentRemote, (err: any, files: any[]) => err ? reject(err) : resolve(files || []));
        });

        for (const item of list) {
          if (jobCancelFlags.has(serverId)) return;
          if (item.filename === '.' || item.filename === '..') continue;

          const itemRemotePath = `${currentRemote}/${item.filename}`;
          const itemRelPath = currentRelative ? `${currentRelative}/${item.filename}` : item.filename;
          const isDir = item.attrs && (item.attrs.mode & 0o40000) !== 0;

          if (isDir) {
            itemsToFetch.push({ remotePath: itemRemotePath, relativePath: itemRelPath, size: 0, isDir: true });
            await walkRemoteDir(itemRemotePath, itemRelPath);
          } else {
            const size = item.attrs ? item.attrs.size || 0 : 0;
            itemsToFetch.push({ remotePath: itemRemotePath, relativePath: itemRelPath, size, isDir: false });
            job.totalFiles++;
            job.totalBytes += size;
          }
        }
      }

      appendJobLog(job, `Scanning files in remote directory '${remoteDir}'...`);
      await walkRemoteDir(remoteDir, '');

      if (jobCancelFlags.has(serverId)) {
        conn.end();
        return;
      }

      appendJobLog(job, `Scan completed: Found ${job.totalFiles} files (${(job.totalBytes / (1024 * 1024)).toFixed(2)} MB).`);
      job.status = 'TRANSFERRING';
      job.message = 'Transferring files via SFTP stream...';

      const startTime = Date.now();
      let lastBytes = 0;
      let lastTime = Date.now();

      for (const item of itemsToFetch) {
        if (jobCancelFlags.has(serverId)) {
          appendJobLog(job, `Import job canceled by user.`);
          conn.end();
          return;
        }

        const localDestPath = path.join(serverPath, item.relativePath);

        if (item.isDir) {
          fs.mkdirSync(localDestPath, { recursive: true });
          continue;
        }

        // Ensure target directory exists
        fs.mkdirSync(path.dirname(localDestPath), { recursive: true });

        job.currentFile = item.relativePath;

        await new Promise<void>((resolve, reject) => {
          sftp.fastGet(item.remotePath, localDestPath, {
            step: (transferred, chunk, total) => {
              // Calculate live transfer speed
              const now = Date.now();
              const dt = (now - lastTime) / 1000;
              if (dt >= 0.5) {
                const deltaBytes = job.transferredBytes + transferred - lastBytes;
                job.speedMBps = +((deltaBytes / (1024 * 1024)) / dt).toFixed(2);
                lastTime = now;
                lastBytes = job.transferredBytes + transferred;
              }
            }
          }, (err: any) => {
            if (err) {
              appendJobLog(job, `[Warning] Failed to fetch ${item.relativePath}: ${err.message}`);
              resolve(); // Continue transferring other files
            } else {
              job.transferredBytes += item.size;
              job.transferredFiles++;
              job.progressPercent = job.totalBytes > 0 ? Math.min(99, Math.round((job.transferredBytes / job.totalBytes) * 100)) : 100;
              resolve();
            }
          });
        });
      }

      conn.end();

      // Check for auto-extraction of archives
      if (config.autoExtractArchives) {
        job.status = 'EXTRACTING';
        job.message = 'Auto-extracting server archives...';
        appendJobLog(job, 'Checking for server archives (.zip, .tar.gz, .tgz) to unpack...');

        const zipFiles = fs.readdirSync(serverPath).filter(f => f.endsWith('.zip') || f.endsWith('.tar.gz') || f.endsWith('.tgz'));
        for (const archive of zipFiles) {
          const archivePath = path.join(serverPath, archive);
          appendJobLog(job, `Unpacking archive '${archive}' into server root...`);
          try {
            if (archive.endsWith('.zip')) {
              const zip = new AdmZip(archivePath);
              zip.extractAllTo(serverPath, true);
            } else {
              await execAsync(`tar -xzf "${archivePath}" -C "${serverPath}"`);
            }
            appendJobLog(job, `[✓ Extracted]: '${archive}' successfully unpacked.`);
          } catch (exErr: any) {
            appendJobLog(job, `[Warning]: Failed to unpack '${archive}': ${exErr.message}`);
          }
        }
      }

      job.status = 'COMPLETED';
      job.progressPercent = 100;
      job.speedMBps = 0;
      job.message = `Import Completed! Successfully transferred ${job.transferredFiles} files.`;
      job.completedAt = new Date().toISOString();
      appendJobLog(job, `[✓ SUCCESS]: Server migration completed successfully!`);

    } catch (err: any) {
      conn.end();
      job.status = 'FAILED';
      job.error = err.message || 'SFTP Transfer Failed';
      job.message = `Import Failed: ${err.message}`;
      appendJobLog(job, `[❌ ERROR]: ${err.message}`);
    }
  })();

  return job;
}

/**
 * Start direct URL archive download import
 */
export async function startUrlImport(serverId: string, config: {
  downloadUrl: string;
  autoExtract?: boolean;
}): Promise<ImportJobStatus> {
  const serverPath = getServerVolumePath(serverId);
  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath, { recursive: true });
  }

  jobCancelFlags.delete(serverId);

  const job: ImportJobStatus = {
    serverId,
    sourceType: 'url',
    status: 'CONNECTING',
    progressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    transferredFiles: 0,
    totalFiles: 1,
    currentFile: 'Downloading archive from URL...',
    speedMBps: 0,
    etaSeconds: 0,
    message: 'Initiating archive download...',
    logs: [],
    startedAt: new Date().toISOString()
  };

  activeImportJobs.set(serverId, job);
  appendJobLog(job, `Resolving download link: ${config.downloadUrl}...`);

  (async () => {
    try {
      const resolved = await resolveDirectDownloadUrl(config.downloadUrl);
      const directUrl = resolved.directUrl;
      appendJobLog(job, `Resolved direct link: ${directUrl}`);

      const urlObj = new URL(directUrl);
      const isHttps = urlObj.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      // Extract filename from URL or default to backup.zip
      let urlFilename = resolved.filenameFromUrl || path.basename(urlObj.pathname) || 'server_import.zip';
      if (!urlFilename.includes('.')) urlFilename += '.zip';

      const tempDestFile = path.join(serverPath, urlFilename);

      await new Promise<void>((resolve, reject) => {
        let lastTime = Date.now();
        let lastTransferred = 0;

        const downloadWithRedirects = (currentUrl: string, redirectCount = 0) => {
          if (redirectCount > 8) {
            return reject(new Error('Too many HTTP redirects.'));
          }

          if (jobCancelFlags.has(serverId)) {
            return reject(new Error('Import job canceled by user.'));
          }

          const curUrlObj = new URL(currentUrl);
          const request = (curUrlObj.protocol === 'https:' ? https : http).get(currentUrl, {
            headers: {
              'User-Agent': 'AetherPanel-Server-Importer/2.4.0',
              'Accept': '*/*'
            }
          }, (res) => {
            // Handle HTTP Redirects
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const redirectUrl = new URL(res.headers.location, currentUrl).toString();
              appendJobLog(job, `Following redirect to: ${redirectUrl}...`);
              return downloadWithRedirects(redirectUrl, redirectCount + 1);
            }

            if (res.statusCode && res.statusCode >= 400) {
              return reject(new Error(`Server returned HTTP ${res.statusCode}: ${res.statusMessage}`));
            }

            const totalHeader = res.headers['content-length'];
            job.totalBytes = totalHeader ? parseInt(totalHeader, 10) : 0;
            job.status = 'TRANSFERRING';
            job.message = 'Downloading server archive...';

            appendJobLog(job, `Connected! File size: ${job.totalBytes ? (job.totalBytes / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'}.`);

            const fileStream = fs.createWriteStream(tempDestFile);

            res.on('data', (chunk) => {
              if (jobCancelFlags.has(serverId)) {
                res.destroy();
                fileStream.close();
                try { fs.unlinkSync(tempDestFile); } catch {}
                return reject(new Error('Import job canceled by user.'));
              }

              job.transferredBytes += chunk.length;
              if (job.totalBytes > 0) {
                job.progressPercent = Math.min(99, Math.round((job.transferredBytes / job.totalBytes) * 100));
              }

              const now = Date.now();
              const dt = (now - lastTime) / 1000;
              if (dt >= 0.5) {
                const delta = job.transferredBytes - lastTransferred;
                job.speedMBps = +((delta / (1024 * 1024)) / dt).toFixed(2);
                lastTime = now;
                lastTransferred = job.transferredBytes;
              }
            });

            res.pipe(fileStream);

            fileStream.on('finish', () => {
              fileStream.close(() => resolve());
            });

            fileStream.on('error', (err) => {
              try { fs.unlinkSync(tempDestFile); } catch {}
              reject(err);
            });
          });

          request.on('error', (err) => reject(err));
        };

        downloadWithRedirects(directUrl);
      });

      appendJobLog(job, `[✓ Download Complete]: Archive saved to '${urlFilename}'.`);

      if (config.autoExtract !== false) {
        job.status = 'EXTRACTING';
        job.message = 'Unpacking server archive into root volume...';
        appendJobLog(job, `Extracting archive '${urlFilename}'...`);

        if (urlFilename.endsWith('.zip')) {
          const zip = new AdmZip(tempDestFile);
          zip.extractAllTo(serverPath, true);
        } else if (urlFilename.endsWith('.tar.gz') || urlFilename.endsWith('.tgz')) {
          await execAsync(`tar -xzf "${tempDestFile}" -C "${serverPath}"`);
        } else if (urlFilename.endsWith('.rar')) {
          await execAsync(`unrar x -o+ "${tempDestFile}" "${serverPath}"`);
        } else {
          // Attempt zip extraction fallback
          try {
            const zip = new AdmZip(tempDestFile);
            zip.extractAllTo(serverPath, true);
          } catch {
            appendJobLog(job, `[Notice]: Saved raw file to server root.`);
          }
        }

        appendJobLog(job, `[✓ Extracted]: Archive successfully unpacked into server filesystem.`);
      }

      job.status = 'COMPLETED';
      job.progressPercent = 100;
      job.speedMBps = 0;
      job.message = 'Import Completed! All server files imported and ready.';
      job.completedAt = new Date().toISOString();
      appendJobLog(job, `[✓ SUCCESS]: Server migration completed successfully!`);

    } catch (err: any) {
      job.status = 'FAILED';
      job.error = err.message || 'URL Download Failed';
      job.message = `Import Failed: ${err.message}`;
      appendJobLog(job, `[❌ ERROR]: ${err.message}`);
    }
  })();

  return job;
}

/**
 * Pterodactyl Panel One-Click API Importer
 */
export async function startPterodactylImport(serverId: string, config: {
  panelUrl: string;
  apiKey: string;
  serverIdentifier: string;
}): Promise<ImportJobStatus> {
  const cleanUrl = config.panelUrl.replace(/\/+$/, '');
  
  jobCancelFlags.delete(serverId);

  const job: ImportJobStatus = {
    serverId,
    sourceType: 'pterodactyl',
    status: 'CONNECTING',
    progressPercent: 0,
    transferredBytes: 0,
    totalBytes: 0,
    transferredFiles: 0,
    totalFiles: 0,
    currentFile: 'Authenticating with Pterodactyl API...',
    speedMBps: 0,
    etaSeconds: 0,
    message: `Connecting to Pterodactyl Panel at ${cleanUrl}...`,
    logs: [],
    startedAt: new Date().toISOString()
  };

  activeImportJobs.set(serverId, job);
  appendJobLog(job, `Connecting to Pterodactyl Client API (${cleanUrl})...`);

  (async () => {
    try {
      // Step 1: Query Pterodactyl Client API for server details & SFTP details
      const response = await fetch(`${cleanUrl}/api/client/servers/${config.serverIdentifier}`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Pterodactyl API Authentication Failed (HTTP ${response.status}). Verify API Key and Server Identifier.`);
      }

      const pteroData = await response.json();
      const serverAttributes = pteroData?.attributes;
      const sftpDetails = serverAttributes?.sftp_details;

      appendJobLog(job, `[✓ Authenticated]: Connected to Pterodactyl server '${serverAttributes?.name || config.serverIdentifier}'.`);

      if (sftpDetails && sftpDetails.ip && sftpDetails.port) {
        appendJobLog(job, `Extracted Pterodactyl SFTP Details: ${sftpDetails.ip}:${sftpDetails.port}`);
        // Trigger automated SFTP import using Pterodactyl credentials
        await startSftpImport(serverId, {
          host: sftpDetails.ip,
          port: sftpDetails.port,
          username: `${serverAttributes.username || config.serverIdentifier}`,
          password: config.apiKey, // Pterodactyl accepts API Key / Account Password
          remotePath: '/',
          autoExtractArchives: true
        });
        return;
      }

      // Step 2: Fallback to Pterodactyl Backups API endpoint
      appendJobLog(job, `Querying Pterodactyl Backups API for automated snapshot download...`);
      const backupRes = await fetch(`${cleanUrl}/api/client/servers/${config.serverIdentifier}/backups`, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (backupRes.ok) {
        const backupList = await backupRes.json();
        const backups = backupList?.data || [];
        if (backups.length > 0) {
          const latestBackup = backups[0];
          const backupUuid = latestBackup?.attributes?.uuid;
          appendJobLog(job, `Found Pterodactyl Backup '${backupUuid}'. Requesting download URL...`);

          const downloadLinkRes = await fetch(`${cleanUrl}/api/client/servers/${config.serverIdentifier}/backups/${backupUuid}/download`, {
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Accept': 'application/json'
            }
          });

          if (downloadLinkRes.ok) {
            const dlData = await downloadLinkRes.json();
            const downloadUrl = dlData?.attributes?.url;
            if (downloadUrl) {
              appendJobLog(job, `[✓ Link Generated]: Streaming backup directly from Pterodactyl storage...`);
              await startUrlImport(serverId, { downloadUrl, autoExtract: true });
              return;
            }
          }
        }
      }

      throw new Error(`Could not establish SFTP or Backup stream from Pterodactyl. Please use direct SFTP or Backup URL import.`);

    } catch (err: any) {
      job.status = 'FAILED';
      job.error = err.message || 'Pterodactyl Import Failed';
      job.message = `Import Failed: ${err.message}`;
      appendJobLog(job, `[❌ ERROR]: ${err.message}`);
    }
  })();

  return job;
}
