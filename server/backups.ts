import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';
import { getDb, saveDbSync } from './db';
import { getServerDir, stopServer, appendConsoleLog, recordServerActivity } from './provider';
import { dispatchDiscordNotification } from './discordService';
import { ServerBackup, BackupStatus, BackupType, BackupStorageProvider } from '../src/types';

const BACKUPS_BASE_DIR = path.join(process.cwd(), 'data', 'backups');

export function getBackupDirectory(serverId: string, provider: BackupStorageProvider = 'local'): string {
  let targetDir = path.join(BACKUPS_BASE_DIR, serverId);
  if (provider === 'node') {
    targetDir = path.join(process.cwd(), 'data', 'node_storage', 'backups', serverId);
  } else if (provider === 'object') {
    targetDir = path.join(process.cwd(), 'data', 'object_storage', 'bucket_aether', 'backups', serverId);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return targetDir;
}

export function getBackupFilePath(backup: ServerBackup): string {
  const dir = getBackupDirectory(backup.serverId, backup.storageProvider);
  return path.join(dir, `${backup.id}.zip`);
}

export async function createRealBackupProcess(
  serverId: string,
  backupName: string,
  type: BackupType = 'manual',
  requestedProvider?: BackupStorageProvider
): Promise<ServerBackup> {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);
  if (!server) {
    throw new Error('Server not found for backup creation');
  }

  const plan = db.plans.find(p => p.id === server.planId);
  const currentBackups = db.backups.filter(b => b.serverId === serverId && b.status !== 'FAILED');

  // Enforce plan limits
  const maxAllowedBackups = server.limits?.backups || plan?.backupLimit || 3;
  if (currentBackups.length >= maxAllowedBackups) {
    throw new Error(`Backup limit reached (${maxAllowedBackups} max allowed for your server plan). Please delete an old backup first.`);
  }

  // Calculate total backup storage consumed
  const currentTotalStorageMB = currentBackups.reduce((acc, b) => acc + (b.sizeMB || 0), 0);
  const maxStorageMB = server.limits?.maxBackupStorageMB || plan?.maxBackupStorageMB || 5120;
  if (currentTotalStorageMB >= maxStorageMB) {
    throw new Error(`Backup storage quota exceeded (${currentTotalStorageMB.toFixed(1)}MB / ${maxStorageMB}MB max allowed).`);
  }

  const defaultProvider = db.settings?.backupSettings?.storageProvider || 'local';
  const provider = requestedProvider || defaultProvider;

  const backupId = `bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanName = backupName.trim() || `Backup_${new Date().toISOString().slice(0, 10)}_${Date.now().toString().slice(-4)}`;

  const newBackup: ServerBackup = {
    id: backupId,
    serverId,
    serverName: server.name,
    userEmail: db.users.find(u => u.id === server.userId)?.email || 'user',
    name: cleanName,
    sizeMB: 0,
    sizeBytes: 0,
    status: 'QUEUED',
    type,
    storageProvider: provider,
    storagePath: path.join(serverId, `${backupId}.zip`),
    createdAt: new Date().toISOString()
  };

  db.backups.push(newBackup);
  saveDbSync();

  // Async process step
  setImmediate(async () => {
    const backupRef = db.backups.find(b => b.id === backupId);
    if (!backupRef) return;

    try {
      backupRef.status = 'CREATING';
      saveDbSync();
      appendConsoleLog(serverId, `[BackupEngine]: Starting background filesystem backup archive creation '${cleanName}'...`);

      const sourceDir = getServerDir(serverId);
      if (!fs.existsSync(sourceDir)) {
        throw new Error('Server directory does not exist on host storage');
      }

      const destFilePath = getBackupFilePath(backupRef);

      // Create ZIP using AdmZip
      const zip = new AdmZip();
      
      // Read files in server directory and add to archive (excluding temp files or backups)
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        if (file === '.backups' || file.startsWith('.tmp_')) continue;
        const fullPath = path.join(sourceDir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          zip.addLocalFolder(fullPath, file);
        } else {
          zip.addLocalFile(fullPath);
        }
      }

      // Write zip file
      zip.writeZip(destFilePath);

      // Compute physical size & SHA-256 Checksum
      const fileStats = fs.statSync(destFilePath);
      const fileBuffer = fs.readFileSync(destFilePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      const checksum = `sha256:${hashSum.digest('hex')}`;

      const sizeBytes = fileStats.size;
      const sizeMB = parseFloat((sizeBytes / (1024 * 1024)).toFixed(2)) || 0.1;

      backupRef.status = 'COMPLETED';
      backupRef.sizeBytes = sizeBytes;
      backupRef.sizeMB = sizeMB;
      backupRef.checksum = checksum;
      backupRef.completedAt = new Date().toISOString();
      saveDbSync();

      appendConsoleLog(serverId, `[BackupEngine/SUCCESS]: Backup '${cleanName}' created successfully (${sizeMB} MB, ${checksum.slice(0, 18)}...).`);
      await recordServerActivity(serverId, server.userId, 'System', 'BACKUP_CREATE', `Created backup '${cleanName}' (${sizeMB} MB)`);

      // Dispatch Discord Notification
      dispatchDiscordNotification(serverId, 'BACKUP_COMPLETED', {
        message: `Backup snapshot '${cleanName}' created successfully.`,
        backupName: cleanName,
        sizeMB
      }).catch(err => console.error('[Discord] Backup notification error:', err));

    } catch (err: any) {
      console.error(`Backup creation error for server ${serverId}:`, err);
      backupRef.status = 'FAILED';
      backupRef.errorMessage = err.message || 'Error occurred while compressing server filesystem.';
      saveDbSync();

      // Clean incomplete temporary archive if created
      const destFilePath = getBackupFilePath(backupRef);
      if (fs.existsSync(destFilePath)) {
        try { fs.unlinkSync(destFilePath); } catch (e) {}
      }

      appendConsoleLog(serverId, `[BackupEngine/ERROR]: Backup creation failed: ${err.message}`);

      // Dispatch Discord Notification
      dispatchDiscordNotification(serverId, 'BACKUP_FAILED', {
        message: `Backup snapshot '${cleanName}' failed to create.`,
        details: err.message
      }).catch(e => console.error('[Discord] Backup fail notification error:', e));
    }
  });

  return newBackup;
}

export async function restoreRealBackupProcess(serverId: string, backupId: string): Promise<void> {
  const db = await getDb();
  const backup = db.backups.find(b => b.id === backupId && b.serverId === serverId);

  if (!backup) {
    throw new Error('Backup record not found.');
  }

  if (backup.status !== 'COMPLETED') {
    throw new Error(`Cannot restore backup in status ${backup.status}`);
  }

  const archivePath = getBackupFilePath(backup);
  if (!fs.existsSync(archivePath)) {
    throw new Error('Physical backup file missing from storage provider.');
  }

  // Gracefully stop server before restoring files
  await stopServer(serverId);
  appendConsoleLog(serverId, `[RestoreEngine]: Stopping server process for filesystem restoration...`);

  backup.status = 'RESTORING';
  saveDbSync();

  try {
    const targetDir = getServerDir(serverId);

    // Extract archive
    const zip = new AdmZip(archivePath);
    zip.extractAllTo(targetDir, true);

    backup.status = 'COMPLETED';
    saveDbSync();

    appendConsoleLog(serverId, `[RestoreEngine/SUCCESS]: Successfully restored server files from backup snapshot '${backup.name}'.`);
    await recordServerActivity(serverId, backup.serverId, 'System', 'BACKUP_RESTORE', `Restored server filesystem from backup '${backup.name}'`);

  } catch (err: any) {
    backup.status = 'COMPLETED'; // Revert status so user can retry or manage
    saveDbSync();
    appendConsoleLog(serverId, `[RestoreEngine/ERROR]: Failed to unpack restore archive: ${err.message}`);
    throw new Error(`Restore failed: ${err.message}`);
  }
}

export async function deleteRealBackupProcess(serverId: string, backupId: string): Promise<void> {
  const db = await getDb();
  const idx = db.backups.findIndex(b => b.id === backupId && b.serverId === serverId);

  if (idx === -1) {
    throw new Error('Backup not found.');
  }

  const backup = db.backups[idx];
  backup.status = 'DELETING';
  saveDbSync();

  try {
    const filePath = getBackupFilePath(backup);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err: any) {
    console.warn(`Failed to delete physical file for backup ${backupId}:`, err);
  } finally {
    // Remove record from database
    const currentIdx = db.backups.findIndex(b => b.id === backupId);
    if (currentIdx !== -1) {
      db.backups.splice(currentIdx, 1);
      saveDbSync();
    }
  }
}

export async function pruneExpiredBackups(): Promise<number> {
  const db = await getDb();
  const retentionDays = db.settings?.backupSettings?.backupRetentionDays || 30;
  const maxPerServer = db.settings?.backupSettings?.maxBackupsPerServer || 10;
  const autoCleanup = db.settings?.backupSettings?.autoCleanupEnabled ?? true;

  if (!autoCleanup) return 0;

  let prunedCount = 0;
  const now = Date.now();
  const retentionMs = retentionDays * 86400 * 1000;

  const serverIds = Array.from(new Set(db.backups.map(b => b.serverId)));

  for (const sId of serverIds) {
    const serverBackups = db.backups
      .filter(b => b.serverId === sId && b.status === 'COMPLETED')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (let i = 0; i < serverBackups.length; i++) {
      const b = serverBackups[i];
      const ageMs = now - new Date(b.createdAt).getTime();

      // Prune if older than retention days OR exceeds max backups per server
      if (ageMs > retentionMs || i >= maxPerServer) {
        try {
          await deleteRealBackupProcess(sId, b.id);
          prunedCount++;
        } catch (e) {
          console.error(`Failed auto cleanup for backup ${b.id}:`, e);
        }
      }
    }
  }

  return prunedCount;
}
