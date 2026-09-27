import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { safePath, getServerDir } from '../provider';
import { getRealServerDiskUsageBytes } from '../routes/monitoring';
import { getDb } from '../db';

const CHUNKS_BASE_DIR = path.join(process.cwd(), 'data', 'temp', 'chunked_uploads');

export interface ChunkUploadSession {
  uploadId: string;
  serverId: string;
  userId: string;
  fileName: string;
  targetPath: string;
  fileSize: number;
  totalChunks: number;
  chunkSize: number;
  uploadedChunks: number[];
  createdAt: string;
  updatedAt: string;
  status: 'initialized' | 'uploading' | 'assembling' | 'completed' | 'aborted';
}

function ensureBaseDir() {
  if (!fs.existsSync(CHUNKS_BASE_DIR)) {
    fs.mkdirSync(CHUNKS_BASE_DIR, { recursive: true });
  }
}

function sanitizeUploadId(uploadId: string): string {
  const clean = (uploadId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!clean) throw new Error('Invalid upload ID');
  return clean;
}

function getSessionDir(uploadId: string): string {
  ensureBaseDir();
  const safeId = sanitizeUploadId(uploadId);
  return path.join(CHUNKS_BASE_DIR, safeId);
}

function getSessionFile(uploadId: string): string {
  return path.join(getSessionDir(uploadId), 'session.json');
}

export function readUploadSession(uploadId: string): ChunkUploadSession | null {
  try {
    const filePath = getSessionFile(uploadId);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function saveUploadSession(session: ChunkUploadSession) {
  const sessionDir = getSessionDir(session.uploadId);
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(getSessionFile(session.uploadId), JSON.stringify(session, null, 2), 'utf8');
}

/**
 * Initializes a new high-capacity resumable upload session (5GB - 15GB+).
 */
export async function initChunkedUpload(params: {
  serverId: string;
  userId: string;
  fileName: string;
  fileSize: number;
  targetPath?: string;
  chunkSize?: number;
}): Promise<ChunkUploadSession> {
  const db = await getDb();
  const server = db.servers.find(s => s.id === params.serverId);
  if (!server) {
    throw new Error('Server not found.');
  }

  // Check Disk Quota (Safety for 15GB files)
  const currentDiskBytes = getRealServerDiskUsageBytes(params.serverId);
  const diskLimitBytes = (server.limits?.diskGB || 10) * 1024 * 1024 * 1024;
  const availableBytes = Math.max(0, diskLimitBytes - currentDiskBytes);

  if (params.fileSize > availableBytes) {
    const freeGB = (availableBytes / (1024 * 1024 * 1024)).toFixed(2);
    const reqGB = (params.fileSize / (1024 * 1024 * 1024)).toFixed(2);
    throw new Error(`Insufficient server disk quota. Free: ${freeGB} GB, Required: ${reqGB} GB.`);
  }

  let cleanName = path.basename(params.fileName || 'uploaded_file').replace(/[\/\\]/g, '_').trim();
  if (!cleanName || cleanName === '.' || cleanName === '..') {
    cleanName = `upload_${Date.now()}`;
  }
  const chunkSize = params.chunkSize || 10 * 1024 * 1024; // Default 10MB chunk
  const totalChunks = Math.max(1, Math.ceil(params.fileSize / chunkSize));
  const uploadId = `upl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

  const session: ChunkUploadSession = {
    uploadId,
    serverId: params.serverId,
    userId: params.userId,
    fileName: cleanName,
    targetPath: params.targetPath || '/',
    fileSize: params.fileSize,
    totalChunks,
    chunkSize,
    uploadedChunks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: 'initialized'
  };

  saveUploadSession(session);
  return session;
}

/**
 * Saves a single uploaded chunk part (e.g. part 42 of 1000).
 */
export async function saveChunkPart(
  uploadId: string,
  chunkIndex: number,
  chunkBuffer: Buffer
): Promise<{ success: boolean; chunkIndex: number; uploadedCount: number; totalChunks: number; progressPercent: number }> {
  const session = readUploadSession(uploadId);
  if (!session) {
    throw new Error('Upload session not found or expired.');
  }

  if (session.status === 'completed') {
    throw new Error('Upload session has already been completed.');
  }

  if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
    throw new Error(`Invalid chunk index ${chunkIndex}. Must be between 0 and ${session.totalChunks - 1}.`);
  }

  const sessionDir = getSessionDir(uploadId);
  const partPath = path.join(sessionDir, `part_${chunkIndex}.chunk`);

  // Write chunk part directly to disk
  fs.writeFileSync(partPath, chunkBuffer);

  if (!session.uploadedChunks.includes(chunkIndex)) {
    session.uploadedChunks.push(chunkIndex);
    session.uploadedChunks.sort((a, b) => a - b);
  }

  session.status = 'uploading';
  saveUploadSession(session);

  const progressPercent = Math.min(100, +((session.uploadedChunks.length / session.totalChunks) * 100).toFixed(1));

  return {
    success: true,
    chunkIndex,
    uploadedCount: session.uploadedChunks.length,
    totalChunks: session.totalChunks,
    progressPercent
  };
}

/**
 * Assembles all chunks into the final destination file using streaming pipeline (Memory Efficient).
 */
export async function completeChunkedUpload(uploadId: string): Promise<{
  success: boolean;
  fileName: string;
  finalPath: string;
  fileSize: number;
  totalChunks: number;
}> {
  const session = readUploadSession(uploadId);
  if (!session) {
    throw new Error('Upload session not found.');
  }

  // Verify all parts exist
  const sessionDir = getSessionDir(uploadId);
  for (let i = 0; i < session.totalChunks; i++) {
    const partPath = path.join(sessionDir, `part_${i}.chunk`);
    if (!fs.existsSync(partPath)) {
      throw new Error(`Missing chunk part ${i} of ${session.totalChunks}. Please resume and retry upload.`);
    }
  }

  session.status = 'assembling';
  saveUploadSession(session);

  const cleanFileName = path.basename(session.fileName || 'file.dat').replace(/[\/\\]/g, '_');
  const relDestPath = path.join(session.targetPath || '/', cleanFileName);
  const finalPath = safePath(session.serverId, relDestPath);
  const targetDir = path.dirname(finalPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const tempAssemblyPath = path.join(targetDir, `.assembling_${session.uploadId}_${cleanFileName}`);

  // Create stream to assemble file sequentially
  const writeStream = fs.createWriteStream(tempAssemblyPath, { flags: 'w' });

  try {
    for (let i = 0; i < session.totalChunks; i++) {
      const partPath = path.join(sessionDir, `part_${i}.chunk`);
      const readStream = fs.createReadStream(partPath);

      await new Promise<void>((resolve, reject) => {
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          // Immediately delete chunk part to preserve disk space during assembly
          try { fs.unlinkSync(partPath); } catch {}
          resolve();
        });
        readStream.on('error', reject);
      });
    }

    // Close write stream
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    // Atomically promote assembled file to target final destination
    if (fs.existsSync(finalPath)) {
      fs.unlinkSync(finalPath);
    }
    fs.renameSync(tempAssemblyPath, finalPath);

    session.status = 'completed';
    saveUploadSession(session);

    // Clean up session directory
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch {}

    const stat = fs.statSync(finalPath);
    return {
      success: true,
      fileName: session.fileName,
      finalPath,
      fileSize: stat.size,
      totalChunks: session.totalChunks
    };
  } catch (err: any) {
    if (fs.existsSync(tempAssemblyPath)) {
      try { fs.unlinkSync(tempAssemblyPath); } catch {}
    }
    throw new Error(`Assembly failed: ${err.message}`);
  }
}

/**
 * Aborts and deletes partial upload files.
 */
export function abortChunkedUpload(uploadId: string): boolean {
  const sessionDir = getSessionDir(uploadId);
  if (fs.existsSync(sessionDir)) {
    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

// Background cleanup: Sweeps upload sessions older than 24 hours
setInterval(() => {
  try {
    ensureBaseDir();
    const dirs = fs.readdirSync(CHUNKS_BASE_DIR);
    const now = Date.now();
    for (const d of dirs) {
      const sDir = path.join(CHUNKS_BASE_DIR, d);
      try {
        const stat = fs.statSync(sDir);
        if (now - stat.mtimeMs > 24 * 60 * 60 * 1000) {
          fs.rmSync(sDir, { recursive: true, force: true });
        }
      } catch {}
    }
  } catch {}
}, 60 * 60 * 1000);
