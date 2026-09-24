import crypto from 'crypto';
import { getDb, saveDbSync } from '../db';
import { UiRenderErrorLog, UiDiagnosticStats } from '../../src/types';

// In-memory recent error log ring-buffer
const MAX_LOGS = 100;
let inMemoryUiErrors: UiRenderErrorLog[] = [];
let initialized = false;

// Anti-spam deduplication cache: hash -> lastTimestamp
const recentDedupeMap = new Map<string, number>();

async function ensureInitialized() {
  if (initialized) return;
  try {
    const db = await getDb();
    if (Array.isArray((db as any).uiErrors)) {
      inMemoryUiErrors = (db as any).uiErrors;
    } else {
      (db as any).uiErrors = [];
    }
    initialized = true;
  } catch (err) {
    console.error('Failed to initialize uiDiagnosticService from DB:', err);
  }
}

/**
 * Extracts clean React component name from componentStack or error stack
 */
export function extractComponentName(componentStack?: string, stack?: string): string {
  if (componentStack) {
    const match = componentStack.match(/at\s+([A-Z][A-Za-z0-9_]*)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  if (stack) {
    const match = stack.match(/at\s+([A-Z][A-Za-z0-9_]*)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return 'UnknownComponent';
}

/**
 * Records a client-side UI render error or invisible component crash
 */
export async function recordUiError(payload: {
  errorName?: string;
  errorMessage?: string;
  componentName?: string;
  componentStack?: string;
  stack?: string;
  url?: string;
  pathname?: string;
  userAgent?: string;
  screenWidth?: number;
  screenHeight?: number;
  userId?: string;
  userRole?: string;
  severity?: 'warning' | 'error' | 'fatal';
}, clientIp?: string): Promise<{ recorded: boolean; errorLog: UiRenderErrorLog; deduplicated: boolean }> {
  await ensureInitialized();

  const errName = (payload.errorName || 'Error').slice(0, 150);
  const errMsg = (payload.errorMessage || 'Unknown UI render error occurred').slice(0, 1000);
  const compName = payload.componentName || extractComponentName(payload.componentStack, payload.stack);
  const cleanUrl = (payload.url || '/').slice(0, 500);

  // Deduplication check: fingerprint based on error message + component + URL
  const fingerprint = `${errName}:${errMsg}:${compName}:${cleanUrl}:${clientIp || ''}`;
  const now = Date.now();
  const lastSeen = recentDedupeMap.get(fingerprint);

  // If exact same error from same client in last 5 seconds, drop duplicates to prevent spam
  if (lastSeen && now - lastSeen < 5000) {
    const existing = inMemoryUiErrors.find(e => e.errorMessage === errMsg && e.componentName === compName);
    return {
      recorded: false,
      errorLog: existing || {
        id: `err_ui_${now.toString(36)}`,
        errorName: errName,
        errorMessage: errMsg,
        componentName: compName,
        url: cleanUrl,
        timestamp: new Date().toISOString()
      },
      deduplicated: true
    };
  }

  recentDedupeMap.set(fingerprint, now);

  // Clean old entries from dedupe map
  if (recentDedupeMap.size > 200) {
    for (const [key, time] of recentDedupeMap.entries()) {
      if (now - time > 60000) {
        recentDedupeMap.delete(key);
      }
    }
  }

  const logId = `err_ui_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const newEntry: UiRenderErrorLog = {
    id: logId,
    errorName: errName,
    errorMessage: errMsg,
    componentName: compName,
    componentStack: payload.componentStack ? payload.componentStack.slice(0, 4000) : undefined,
    stack: payload.stack ? payload.stack.slice(0, 4000) : undefined,
    url: cleanUrl,
    pathname: payload.pathname || (payload.url ? new URL(payload.url, 'http://localhost').pathname : undefined),
    timestamp: new Date().toISOString(),
    userAgent: payload.userAgent ? payload.userAgent.slice(0, 300) : undefined,
    screenWidth: payload.screenWidth,
    screenHeight: payload.screenHeight,
    userId: payload.userId,
    userRole: payload.userRole,
    severity: payload.severity || 'error',
    resolved: false
  };

  inMemoryUiErrors.unshift(newEntry);
  if (inMemoryUiErrors.length > MAX_LOGS) {
    inMemoryUiErrors = inMemoryUiErrors.slice(0, MAX_LOGS);
  }

  try {
    const db = await getDb();
    (db as any).uiErrors = inMemoryUiErrors;
    saveDbSync();
  } catch (err) {
    console.error('Failed to persist UI error log to DB:', err);
  }

  console.warn(`[UI_DIAGNOSTICS] Registered UI render error in <${compName}>: ${errMsg} (${logId})`);

  return { recorded: true, errorLog: newEntry, deduplicated: false };
}

/**
 * Returns list of tracked UI render error incidents
 */
export async function getUiErrors(limit = 50): Promise<UiRenderErrorLog[]> {
  await ensureInitialized();
  return inMemoryUiErrors.slice(0, limit);
}

/**
 * Marks an incident as resolved or clears all
 */
export async function clearUiErrors(): Promise<void> {
  await ensureInitialized();
  inMemoryUiErrors = [];
  try {
    const db = await getDb();
    (db as any).uiErrors = [];
    saveDbSync();
  } catch (err) {
    console.error('Failed to clear UI errors from DB:', err);
  }
}

export async function resolveUiError(id: string): Promise<boolean> {
  await ensureInitialized();
  const entry = inMemoryUiErrors.find(e => e.id === id);
  if (entry) {
    entry.resolved = true;
    try {
      const db = await getDb();
      (db as any).uiErrors = inMemoryUiErrors;
      saveDbSync();
    } catch {}
    return true;
  }
  return false;
}

/**
 * Computes diagnostic health stats for frontend components
 */
export async function getUiDiagnosticStats(): Promise<UiDiagnosticStats> {
  await ensureInitialized();
  const unresolved = inMemoryUiErrors.filter(e => !e.resolved);
  const affectedComps = Array.from(new Set(inMemoryUiErrors.map(e => e.componentName || 'UnknownComponent').filter(Boolean)));

  return {
    totalCount: inMemoryUiErrors.length,
    unresolvedCount: unresolved.length,
    lastIncidentAt: inMemoryUiErrors.length > 0 ? inMemoryUiErrors[0].timestamp : null,
    affectedComponents: affectedComps
  };
}
