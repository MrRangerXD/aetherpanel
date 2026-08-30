import path from 'path';

/**
 * Validates and normalizes an entrypoint path (e.g. index.js, src/bot.py, main.py, server.jar).
 * Rejects path traversal attempts (../../), absolute paths, null bytes, or paths resolving outside server directory.
 */
export function validateAndNormalizeEntrypoint(
  entrypoint: string | undefined,
  defaultFile: string
): { valid: boolean; normalized: string; error?: string } {
  if (!entrypoint || typeof entrypoint !== 'string' || !entrypoint.trim()) {
    return { valid: true, normalized: defaultFile };
  }

  const raw = entrypoint.trim();

  // Rejection 1: Null bytes
  if (raw.includes('\0')) {
    return { valid: false, normalized: defaultFile, error: 'Entrypoint cannot contain null bytes.' };
  }

  // Rejection 2: Absolute paths
  if (path.isAbsolute(raw) || raw.startsWith('/') || raw.startsWith('\\') || /^[a-zA-Z]:/.test(raw)) {
    return { valid: false, normalized: defaultFile, error: 'Absolute paths are not permitted for entrypoint.' };
  }

  // Normalize path separators
  const normalized = path.normalize(raw).replace(/\\/g, '/');

  // Rejection 3: Path traversal attempts
  if (normalized.startsWith('..') || normalized.includes('/../') || normalized.endsWith('/..')) {
    return { valid: false, normalized: defaultFile, error: 'Entrypoint path traversal outside server directory is forbidden.' };
  }

  return { valid: true, normalized };
}

/**
 * Sanitizes command-line flags and parameters.
 * Strips dangerous shell metacharacters and memory override flags.
 */
export function sanitizeStartupFlags(
  flags: string | undefined,
  options?: { disallowMemoryOverride?: boolean }
): string {
  if (!flags || typeof flags !== 'string') return '';
  let cleaned = flags.trim();

  // Strip dangerous shell metacharacters and control operators
  cleaned = cleaned.replace(/[;&|`$><\r\n]/g, '');

  // Strip memory override flags if disallowMemoryOverride is true
  if (options?.disallowMemoryOverride) {
    cleaned = cleaned.replace(/--max-old-space-size=\d+/gi, '');
    cleaned = cleaned.replace(/-Xmx\d+[MGKmgk]?/gi, '');
    cleaned = cleaned.replace(/-Xms\d+[MGKmgk]?/gi, '');
  }

  // Strip dangerous process-execution Node/Python flags
  cleaned = cleaned.replace(/--import\b/gi, '');
  cleaned = cleaned.replace(/--require\b/gi, '');
  cleaned = cleaned.replace(/--eval\b/gi, '');
  cleaned = cleaned.replace(/(^|\s)-e\b/gi, ' ');
  cleaned = cleaned.replace(/(^|\s)-p\b/gi, ' ');

  return cleaned.trim().replace(/\s+/g, ' ');
}

/**
 * Validates and normalizes runtime versions for Node.js, Python, Bun, and Java.
 */
export function validateRuntimeVersion(
  software: string | undefined,
  version: string | undefined
): { valid: boolean; normalized: string } {
  if (!version || typeof version !== 'string' || !version.trim()) {
    return { valid: true, normalized: 'Latest Stable' };
  }

  const sw = (software || '').toLowerCase();
  const v = version.trim();

  if (sw.includes('node')) {
    const validNode = ['24.x', '22.x', '20.x', '18.x', 'Latest Stable'];
    const found = validNode.find(n => n.toLowerCase() === v.toLowerCase());
    if (found) return { valid: true, normalized: found };
    if (/^\d+(\.\d+)*(\.x)?$/.test(v)) return { valid: true, normalized: v };
    return { valid: false, normalized: '20.x' };
  }

  if (sw.includes('python')) {
    const validPy = ['3.14.x', '3.13.x', '3.12.x', '3.11.x', '3.10.x', 'Latest Stable'];
    const found = validPy.find(p => p.toLowerCase() === v.toLowerCase());
    if (found) return { valid: true, normalized: found };
    if (/^\d+(\.\d+)*(\.x)?$/.test(v)) return { valid: true, normalized: v };
    return { valid: false, normalized: '3.12.x' };
  }

  if (sw.includes('bun')) {
    const validBun = ['1.2.x', '1.1.x', '1.0.x', 'Latest Stable'];
    const found = validBun.find(b => b.toLowerCase() === v.toLowerCase());
    if (found) return { valid: true, normalized: found };
    if (/^\d+(\.\d+)*(\.x)?$/.test(v)) return { valid: true, normalized: v };
    return { valid: false, normalized: '1.x' };
  }

  if (sw.includes('java') || sw.includes('minecraft') || sw.includes('paper') || sw.includes('purpur') || sw.includes('forge') || sw.includes('fabric')) {
    if (/^Java\s*\d+$/i.test(v)) return { valid: true, normalized: v.replace(/^java\s*/i, 'Java ') };
    if (/^\d+$/.test(v)) return { valid: true, normalized: `Java ${v}` };
  }

  return { valid: true, normalized: v };
}
