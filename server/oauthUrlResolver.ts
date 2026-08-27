import { Request } from 'express';
import { SystemSettings, DiscordBotSettings } from '../src/types';

/**
 * Validates whether a host string is a safe, well-formed hostname or host:port string.
 * Prevents header injection, CRLF, path characters, etc.
 */
function isValidHost(host: string): boolean {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (trimmed.length === 0 || trimmed.length > 253) return false;
  // Allowed: alphanumeric, dots, hyphens, underscores, colons (for port numbers)
  return /^[a-zA-Z0-9.\-:_]+$/.test(trimmed);
}

/**
 * Determines whether a host string is a local/loopback development address.
 */
function isLocalHost(host: string): boolean {
  const clean = host.split(':')[0].toLowerCase().trim();
  return (
    clean === 'localhost' ||
    clean === '127.0.0.1' ||
    clean === '0.0.0.0' ||
    clean === '::1' ||
    clean === 'local-vps' ||
    clean.endsWith('.local')
  );
}

/**
 * Resolves the canonical public base URL for the current AetherPanel installation.
 * Priority:
 *   1. Explicit trusted configured installation URL (env: APP_URL, PANEL_URL, AETHER_PUBLIC_URL, PUBLIC_URL, or DB settings)
 *   2. Incoming trusted request origin (via reverse proxy headers X-Forwarded-Proto / X-Forwarded-Host or Host)
 *   3. Development fallback (http://localhost:3000)
 *
 * @param req Optional incoming Express Request
 * @param settings Optional DB SystemSettings or DiscordBotSettings object
 * @returns Clean normalized public base URL (no trailing slash)
 */
export function getCurrentInstallationPublicUrl(
  req?: Request | any,
  settings?: Partial<SystemSettings> | Partial<DiscordBotSettings> | any
): string {
  // 1. Check explicit environment variable configuration (PANEL_URL prioritized)
  const envUrl =
    process.env.PANEL_URL ||
    process.env.APP_URL ||
    process.env.AETHER_PUBLIC_URL ||
    process.env.PUBLIC_URL;

  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    const trimmed = envUrl.trim().replace(/\/+$/, '');
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
  }

  // Check explicit database setting if present
  if (settings && (settings as any).panelUrl) {
    const panelUrl = String((settings as any).panelUrl).trim().replace(/\/+$/, '');
    if (panelUrl.startsWith('http://') || panelUrl.startsWith('https://')) {
      return panelUrl;
    }
  }
  if (settings && (settings as any).appUrl) {
    const appUrl = String((settings as any).appUrl).trim().replace(/\/+$/, '');
    if (appUrl.startsWith('http://') || appUrl.startsWith('https://')) {
      return appUrl;
    }
  }

  // 2. Derive dynamically from the incoming request (supporting reverse proxies)
  if (req && typeof req.get === 'function') {
    // Protocol resolution
    const xForwardedProto = req.headers?.['x-forwarded-proto'];
    const xForwardedSsl = req.headers?.['x-forwarded-ssl'];
    const frontEndHttps = req.headers?.['front-end-https'];

    let proto = 'http';
    if (typeof xForwardedProto === 'string' && xForwardedProto.trim()) {
      proto = xForwardedProto.split(',')[0].trim().toLowerCase();
    } else if (xForwardedSsl === 'on' || frontEndHttps === 'on' || req.secure || req.protocol === 'https') {
      proto = 'https';
    }

    // Host resolution
    const xForwardedHost = req.headers?.['x-forwarded-host'];
    let host = '';

    if (typeof xForwardedHost === 'string' && xForwardedHost.trim()) {
      host = xForwardedHost.split(',')[0].trim();
    } else {
      host = req.get('host') || req.headers?.host || '';
    }

    // Clean any leading protocol accidentally in host header
    host = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '').trim();

    if (isValidHost(host)) {
      // If it's a real public hostname (not localhost / 127.0.0.1)
      if (!isLocalHost(host)) {
        // Public installations default to HTTPS if not explicitly running unencrypted IP
        const effectiveProto = proto === 'http' && (host.includes('.') && !/^\d+\.\d+\.\d+\.\d+/.test(host)) ? 'https' : proto;
        return `${effectiveProto}://${host}`.replace(/\/+$/, '');
      }

      // Local development host
      return `http://${host}`.replace(/\/+$/, '');
    }
  }

  // 3. Fallback for local development or background worker without req context
  return 'http://localhost:3000';
}

/**
 * Authoritative Discord OAuth2 Redirect URI resolver for the current AetherPanel installation.
 * Concept:
 *   getCurrentInstallationPublicUrl()
 *          ↓
 *   current installation public origin
 *          ↓
 *   getDiscordOAuthRedirectUri()
 *          ↓
 *   {public-origin}/api/v1/auth/discord/callback
 *
 * Guarantees:
 *   - Never hardcodes any third-party or global domain
 *   - Preserves HTTPS protocol behind reverse proxies
 *   - Cleans all trailing slashes to prevent `//` double-slash bugs
 *   - Matches across admin UI, auth URL generation, and callback handling
 */
export function getDiscordOAuthRedirectUri(
  req?: Request | any,
  settings?: Partial<SystemSettings> | Partial<DiscordBotSettings> | any
): string {
  const publicBase = getCurrentInstallationPublicUrl(req, settings);
  const cleanBase = publicBase.replace(/\/+$/, '');
  return `${cleanBase}/api/v1/auth/discord/callback`;
}
