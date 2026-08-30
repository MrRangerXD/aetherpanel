/**
 * Shared path utility for server-relative paths in AetherPanel.
 * Guarantees all paths returned are relative to the server root (starting with '/').
 * Eliminates duplicate slashes, leading host paths, path traversal ('..'), and trailing slashes.
 */

export function normalizeServerPath(rawPath?: string | null): string {
  if (!rawPath || typeof rawPath !== 'string') return '/';
  
  // Replace null bytes and normalize backslashes
  let cleaned = rawPath.replace(/\0/g, '').trim().replace(/\\/g, '/');

  // If path contains host base directory fragments, strip them out safely
  if (cleaned.includes('/data/servers/')) {
    const idx = cleaned.indexOf('/data/servers/');
    const rest = cleaned.substring(idx + '/data/servers/'.length);
    const slashIdx = rest.indexOf('/');
    cleaned = slashIdx !== -1 ? rest.substring(slashIdx) : '/';
  }

  // Strip duplicate slashes
  cleaned = cleaned.replace(/\/+/g, '/');

  // Strip trailing slash unless it's strictly root '/'
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  // Ensure leading slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }

  // Sanitize path traversal segments ('..', '.')
  const segments = cleaned.split('/').filter(Boolean);
  const safeSegments: string[] = [];

  for (const seg of segments) {
    if (seg === '..') {
      if (safeSegments.length > 0) {
        safeSegments.pop();
      }
    } else if (seg !== '.') {
      safeSegments.push(seg);
    }
  }

  return safeSegments.length === 0 ? '/' : '/' + safeSegments.join('/');
}

export function joinServerPath(basePath: string, ...segments: string[]): string {
  const normBase = normalizeServerPath(basePath);
  const filtered = segments
    .filter(s => typeof s === 'string' && s.trim().length > 0)
    .map(s => s.replace(/\\/g, '/').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  if (filtered.length === 0) return normBase;

  const prefix = normBase === '/' ? '' : normBase;
  const rawCombined = prefix + '/' + filtered.join('/');
  return normalizeServerPath(rawCombined);
}

export function getParentServerPath(rawPath: string): string {
  const norm = normalizeServerPath(rawPath);
  if (norm === '/') return '/';
  const parts = norm.split('/').filter(Boolean);
  parts.pop();
  return parts.length === 0 ? '/' : '/' + parts.join('/');
}

export function buildBreadcrumbs(rawPath: string): Array<{ name: string; path: string }> {
  const norm = normalizeServerPath(rawPath);
  const crumbs = [{ name: 'root', path: '/' }];
  if (norm === '/') return crumbs;

  const parts = norm.split('/').filter(Boolean);
  let acc = '';
  for (const part of parts) {
    acc += '/' + part;
    crumbs.push({ name: part, path: acc });
  }
  return crumbs;
}
