/**
 * String and data normalization helpers for robust UI rendering.
 * Prevents runtime TypeErrors when accessing optional or asynchronous backend properties.
 */

export function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function safeLowerCase(value: unknown, fallback = ''): string {
  const str = normalizeString(value, fallback);
  return str.toLowerCase();
}

export function safeIncludes(value: unknown, search: unknown): boolean {
  const str = safeLowerCase(value);
  const q = safeLowerCase(search);
  if (!q) return true;
  return str.includes(q);
}

export function normalizeServer<T extends Record<string, any>>(server: T | null | undefined): T | null {
  if (!server || typeof server !== 'object') return null;
  return {
    ...server,
    name: normalizeString(server.name, 'Server'),
    software: normalizeString(server.software, 'Paper'),
    version: normalizeString(server.version, '1.21.4'),
    location: normalizeString(server.location, 'Local VPS Node (Standard)'),
    primaryIp: normalizeString(server.primaryIp, '127.0.0.1'),
    status: normalizeString(server.status, 'offline'),
  };
}
