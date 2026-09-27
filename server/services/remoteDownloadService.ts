import fs from 'fs';
import path from 'path';
import { safePath } from '../provider';
import admZip from 'adm-zip';

export interface RemoteDownloadJob {
  id: string;
  serverId: string;
  originalUrl: string;
  resolvedUrl: string;
  targetFolder: string;
  customFilename?: string;
  autoExtract: boolean;
  status: 'pending' | 'downloading' | 'extracting' | 'completed' | 'error';
  filename: string;
  finalFilePath: string;
  downloadedBytes: number;
  totalBytes: number;
  progress: number; // 0 to 100
  speedBytesPerSec: number;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

const activeJobs = new Map<string, RemoteDownloadJob>();

/**
 * Clean & resolve various URL formats (Google Drive, MediaFire, Dropbox, etc.) to direct download URLs
 */
export async function resolveDirectDownloadUrl(rawUrl: string): Promise<{ directUrl: string; filenameFromUrl?: string }> {
  let urlStr = rawUrl.trim();
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }

  const parsed = new URL(urlStr);
  let directUrl = urlStr;
  let filenameFromUrl: string | undefined;

  // 1. Google Drive
  if (parsed.hostname.includes('drive.google.com')) {
    let fileId: string | null = null;
    
    // Pattern: /file/d/FILE_ID/view or /open?id=FILE_ID or /uc?id=FILE_ID
    const match = urlStr.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) {
      fileId = match[1];
    } else {
      fileId = parsed.searchParams.get('id');
    }

    if (fileId) {
      directUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    }
  }

  // 2. Dropbox
  else if (parsed.hostname.includes('dropbox.com')) {
    parsed.searchParams.set('dl', '1');
    directUrl = parsed.toString();
  }

  // 3. MediaFire
  else if (parsed.hostname.includes('mediafire.com')) {
    try {
      const response = await fetch(urlStr, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (response.ok) {
        const html = await response.text();
        // Look for direct download link in HTML
        const mfMatch = html.match(/href="(https?:\/\/download\d+\.mediafire\.com\/[^"]+)"/i) ||
                        html.match(/aria-label="Download file"\s+href="([^"]+)"/i) ||
                        html.match(/id="downloadButton"\s+href="([^"]+)"/i);
        if (mfMatch && mfMatch[1]) {
          directUrl = mfMatch[1];
        }
      }
    } catch {
      // Fallback to original url
    }
  }

  // Try extracting filename from pathname if present
  try {
    const finalParsed = new URL(directUrl);
    const baseName = path.basename(finalParsed.pathname);
    if (baseName && baseName.includes('.') && !['uc', 'download', 'view', 'file'].includes(baseName.toLowerCase())) {
      filenameFromUrl = decodeURIComponent(baseName);
    }
  } catch {}

  return { directUrl, filenameFromUrl };
}

/**
 * Parses content-disposition header for filenames
 */
function parseContentDispositionFilename(headerValue: string | null): string | null {
  if (!headerValue) return null;

  // filename*=UTF-8''filename.ext
  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;\s]+)/i);
  if (utf8Match && utf8Match[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {}
  }

  // filename="filename.ext" or filename=filename.ext
  const standardMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1].trim();
  }

  return null;
}

/**
 * Start background remote download
 */
export async function startRemoteDownload(
  serverId: string,
  rawUrl: string,
  targetFolder: string = '/',
  customFilename?: string,
  autoExtract: boolean = false
): Promise<RemoteDownloadJob> {
  const jobId = `rdl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const normFolder = targetFolder.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

  const job: RemoteDownloadJob = {
    id: jobId,
    serverId,
    originalUrl: rawUrl,
    resolvedUrl: rawUrl,
    targetFolder: normFolder,
    customFilename,
    autoExtract,
    status: 'pending',
    filename: customFilename || 'downloading_file',
    finalFilePath: '',
    downloadedBytes: 0,
    totalBytes: 0,
    progress: 0,
    speedBytesPerSec: 0,
    createdAt: Date.now()
  };

  activeJobs.set(jobId, job);

  // Execute asynchronously
  executeDownload(job).catch(err => {
    job.status = 'error';
    job.error = err.message || 'Remote download failed';
    job.completedAt = Date.now();
  });

  return job;
}

async function executeDownload(job: RemoteDownloadJob) {
  job.status = 'downloading';
  
  const { directUrl, filenameFromUrl } = await resolveDirectDownloadUrl(job.originalUrl);
  job.resolvedUrl = directUrl;

  const reqHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  const response = await fetch(directUrl, {
    headers: reqHeaders,
    redirect: 'follow'
  });

  if (!response.ok) {
    throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
  }

  // Check if response is HTML confirmation (Google Drive confirm)
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/html') && job.originalUrl.includes('drive.google.com')) {
    const html = await response.text();
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/i) || html.match(/name="confirm"\s+value="([^"]+)"/i);
    if (confirmMatch && confirmMatch[1]) {
      const confirmToken = confirmMatch[1];
      const retryUrl = `${directUrl}&confirm=${confirmToken}`;
      const retryRes = await fetch(retryUrl, { headers: reqHeaders, redirect: 'follow' });
      if (retryRes.ok) {
        return handleStreamResponse(job, retryRes, filenameFromUrl);
      }
    }
  }

  return handleStreamResponse(job, response, filenameFromUrl);
}

async function handleStreamResponse(job: RemoteDownloadJob, response: Response, filenameFromUrl?: string) {
  const contentDisp = response.headers.get('content-disposition');
  const headerFilename = parseContentDispositionFilename(contentDisp);

  let finalFilename = job.customFilename;
  if (!finalFilename) {
    finalFilename = headerFilename || filenameFromUrl || 'downloaded_file';
    // Clean filename
    finalFilename = path.basename(finalFilename).replace(/[\/\\]/g, '_');
    if (!finalFilename || finalFilename === '.' || finalFilename === '..') {
      finalFilename = `file_${Date.now()}`;
    }
  }

  job.filename = finalFilename;

  // Determine target directory path on disk
  const absTargetDir = safePath(job.serverId, job.targetFolder);
  if (!fs.existsSync(absTargetDir)) {
    fs.mkdirSync(absTargetDir, { recursive: true });
  }

  const absFinalPath = path.join(absTargetDir, finalFilename);
  const tempPath = `${absFinalPath}.part_${job.id}`;
  job.finalFilePath = absFinalPath;

  const contentLength = response.headers.get('content-length');
  job.totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

  const fileStream = fs.createWriteStream(tempPath);
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error('Response body stream is unreadable.');
  }

  let startTime = Date.now();
  let lastCalcTime = startTime;
  let lastBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      fileStream.write(value);
      job.downloadedBytes += value.length;

      const now = Date.now();
      if (job.totalBytes > 0) {
        job.progress = Math.min(99, Math.round((job.downloadedBytes / job.totalBytes) * 100));
      } else {
        job.progress = 50; // Undefined total size progress placeholder
      }

      // Calculate speed every 500ms
      const timeDiff = (now - lastCalcTime) / 1000;
      if (timeDiff >= 0.5) {
        const bytesDiff = job.downloadedBytes - lastBytes;
        job.speedBytesPerSec = Math.round(bytesDiff / timeDiff);
        lastCalcTime = now;
        lastBytes = job.downloadedBytes;
      }
    }

    fileStream.end();

    // Move temp file to final destination
    if (fs.existsSync(absFinalPath)) {
      fs.unlinkSync(absFinalPath);
    }
    fs.renameSync(tempPath, absFinalPath);

    // Auto extract if requested and file is zip
    if (job.autoExtract && (finalFilename.toLowerCase().endsWith('.zip'))) {
      job.status = 'extracting';
      try {
        const zip = new admZip(absFinalPath);
        zip.extractAllTo(absTargetDir, true);
      } catch (extractErr: any) {
        console.error('Auto extraction failed:', extractErr);
      }
    }

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = Date.now();
  } catch (err: any) {
    fileStream.close();
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    throw err;
  }
}

export function getDownloadJob(jobId: string): RemoteDownloadJob | undefined {
  return activeJobs.get(jobId);
}

export function listServerDownloadJobs(serverId: string): RemoteDownloadJob[] {
  return Array.from(activeJobs.values())
    .filter(j => j.serverId === serverId)
    .sort((a, b) => b.createdAt - a.createdAt);
}
