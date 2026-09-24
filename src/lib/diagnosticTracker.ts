import { UiRenderErrorLog } from '../types';

export interface DispatchedErrorInfo {
  incidentId: string;
  errorName: string;
  errorMessage: string;
  componentName: string;
  timestamp: string;
  url: string;
  status: 'dispatched' | 'failed' | 'queued';
}

/**
 * Extracts candidate component name from React ErrorInfo stack or JS error stack
 */
export function extractComponentName(componentStack?: string, stack?: string): string {
  if (componentStack) {
    const lines = componentStack.split('\n');
    for (const line of lines) {
      const match = line.match(/at\s+([A-Z][A-Za-z0-9_]*)/);
      if (match && match[1] && match[1] !== 'ErrorBoundary') {
        return match[1];
      }
    }
  }
  if (stack) {
    const match = stack.match(/at\s+([A-Z][A-Za-z0-9_]*)/);
    if (match && match[1] && match[1] !== 'ErrorBoundary') {
      return match[1];
    }
  }
  return 'ComponentTreeRoot';
}

/**
 * Generates a clean human-readable incident reference code (e.g. ERR-UI-4F2A)
 */
export function generateIncidentCode(): string {
  const hex = Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');
  return `ERR-UI-${hex}`;
}

/**
 * Automated diagnostic error tracker that dispatches UI render crashes to the diagnostic endpoint
 */
export async function trackUiRenderError(
  error: Error,
  errorInfo?: { componentStack?: string | null } | null,
  context?: {
    severity?: 'warning' | 'error' | 'fatal';
    additionalContext?: Record<string, any>;
  }
): Promise<DispatchedErrorInfo> {
  const incidentCode = generateIncidentCode();
  const componentName = extractComponentName(errorInfo?.componentStack || undefined, error.stack);
  const now = new Date().toISOString();
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown Browser';
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : undefined;
  const screenHeight = typeof window !== 'undefined' ? window.innerHeight : undefined;

  let userId: string | undefined;
  let userRole: string | undefined;

  try {
    const userJson = localStorage.getItem('aether_user');
    if (userJson) {
      const user = JSON.parse(userJson);
      userId = user.id;
      userRole = user.role;
    }
  } catch {}

  const payload = {
    incidentCode,
    errorName: error.name || 'RenderError',
    errorMessage: error.message || 'Unknown component rendering failure',
    componentName,
    componentStack: errorInfo?.componentStack || undefined,
    stack: error.stack,
    url: currentUrl,
    pathname,
    timestamp: now,
    userAgent,
    screenWidth,
    screenHeight,
    userId,
    userRole,
    severity: context?.severity || 'error',
    extra: context?.additionalContext
  };

  // 1. Log cleanly to browser console
  console.group(`%c[UI-DIAGNOSTICS] Render Failure Captured in <${componentName}> [${incidentCode}]`, 'color: #f43f5e; font-weight: bold;');
  console.error('Error Object:', error);
  if (errorInfo?.componentStack) {
    console.info('Component Hierarchy Stack:', errorInfo.componentStack);
  }
  console.groupEnd();

  // 2. Dispatch telemetry to backend diagnostic endpoint
  let status: DispatchedErrorInfo['status'] = 'dispatched';

  try {
    const jsonBody = JSON.stringify(payload);
    
    // Prefer sendBeacon for unblockable telemetry if supported
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([jsonBody], { type: 'application/json' });
      const sent = navigator.sendBeacon('/api/v1/diagnostics/ui-errors', blob);
      if (!sent) {
        // Fallback to fetch
        await fetch('/api/v1/diagnostics/ui-errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: jsonBody,
          keepalive: true
        });
      }
    } else {
      await fetch('/api/v1/diagnostics/ui-errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
        keepalive: true
      });
    }
  } catch (netErr) {
    console.warn('[UI-DIAGNOSTICS] Diagnostic endpoint delivery failed (fallback in memory):', netErr);
    status = 'failed';
  }

  return {
    incidentId: incidentCode,
    errorName: error.name || 'RenderError',
    errorMessage: error.message || 'Unknown render error',
    componentName,
    timestamp: now,
    url: currentUrl,
    status
  };
}
