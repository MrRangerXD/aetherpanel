import net from 'net';
import { Node, Server, SftpConnectionInfo } from '../../src/types';
import { isPrivateIP } from './networkDetection';

/**
 * System-reserved infrastructure ports that user game/bot server allocations must NEVER claim.
 */
export const RESERVED_SYSTEM_PORTS = new Set<number>([
  22,   // SSH
  80,   // HTTP / Let's Encrypt ACME Challenge
  443,  // HTTPS Primary Web Panel
  2022, // SFTP Dedicated Daemon
  3000, // Node.js Application Ingress / Vite Web App
  8080, // Node HTTP / Internal API Channel
  8443  // Secure Node Daemon HTTPS Gateway
]);

export const NO_EXTERNAL_ENDPOINT = 'NO_EXTERNAL_ENDPOINT';

/**
 * Validates whether an IP address or hostname is an internal, loopback, or non-routable address.
 * Customer-facing public endpoints must NEVER expose these addresses.
 */
export function isInternalAddress(addr?: string | null): boolean {
  if (!addr) return true;
  const trimmed = addr.trim().toLowerCase();

  if (
    trimmed === '127.0.0.1' ||
    trimmed === 'localhost' ||
    trimmed === '0.0.0.0' ||
    trimmed === '::1' ||
    trimmed === 'local-vps' ||
    trimmed === 'local' ||
    trimmed.startsWith('127.') ||
    trimmed === NO_EXTERNAL_ENDPOINT.toLowerCase() ||
    isPrivateIP(trimmed)
  ) {
    return true;
  }

  return false;
}

/**
 * Validates whether a string is a well-formed Fully Qualified Domain Name (FQDN) or valid public hostname.
 */
export function isValidFQDN(fqdn?: string | null): boolean {
  if (!fqdn) return false;
  const trimmed = fqdn.trim();
  if (trimmed.length < 3 || trimmed.length > 253) return false;
  if (trimmed === 'localhost' || trimmed.endsWith('.local') || trimmed === 'local-vps') return false;

  // If it's a raw IP address, it's not an FQDN
  if (net.isIP(trimmed) !== 0) return false;

  const fqdnRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
  return fqdnRegex.test(trimmed);
}

/**
 * Validates whether a string is a standard public IPv4 address.
 */
export function isValidIPv4(ip?: string | null): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  if (net.isIPv4(trimmed)) {
    return !isInternalAddress(trimmed);
  }
  return false;
}

/**
 * Validates whether a string is a standard public IPv6 address.
 */
export function isValidIPv6(ip?: string | null): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  if (net.isIPv6(trimmed)) {
    const lower = trimmed.toLowerCase();
    if (lower === '::1' || lower === '::' || lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
      return false; // Loopback, unspecified, link-local or unique-local
    }
    return true;
  }
  return false;
}

export interface PublicEndpointResult {
  endpoint: string;
  source: 'fqdn' | 'public_ipv4' | 'public_ipv6' | 'playit' | 'none';
  port: number;
  isExternallyReachable: boolean;
  rawHost: string;
}

/**
 * Resolves the primary external connection address for a server according to the strict priority:
 * 1. Explicit FQDN
 * 2. Public IPv4
 * 3. Public IPv6
 * 4. Playit tunnel endpoint
 * 5. NO_EXTERNAL_ENDPOINT
 *
 * GUARANTEE: NEVER returns localhost, 127.0.0.1, 0.0.0.0, or ::1.
 */
export function resolveServerPublicEndpoint(
  server: Partial<Server>,
  node?: Partial<Node> | null,
  playitStatus?: { isInstalled?: boolean; status?: string; tunnelAddress?: string; tunnelPort?: number } | null
): PublicEndpointResult {
  const port = server.primaryPort || 25565;

  // 1. Explicit FQDN on node or server
  if (node?.fqdn && isValidFQDN(node.fqdn)) {
    return {
      endpoint: `${node.fqdn.trim()}:${port}`,
      rawHost: node.fqdn.trim(),
      source: 'fqdn',
      port,
      isExternallyReachable: true
    };
  }

  if (server.primaryIp && isValidFQDN(server.primaryIp)) {
    return {
      endpoint: `${server.primaryIp.trim()}:${port}`,
      rawHost: server.primaryIp.trim(),
      source: 'fqdn',
      port,
      isExternallyReachable: true
    };
  }

  // 2. Public IPv4
  if (node?.publicIpv4 && isValidIPv4(node.publicIpv4)) {
    return {
      endpoint: `${node.publicIpv4.trim()}:${port}`,
      rawHost: node.publicIpv4.trim(),
      source: 'public_ipv4',
      port,
      isExternallyReachable: true
    };
  }

  if (node?.ip && isValidIPv4(node.ip)) {
    return {
      endpoint: `${node.ip.trim()}:${port}`,
      rawHost: node.ip.trim(),
      source: 'public_ipv4',
      port,
      isExternallyReachable: true
    };
  }

  if (server.primaryIp && isValidIPv4(server.primaryIp)) {
    return {
      endpoint: `${server.primaryIp.trim()}:${port}`,
      rawHost: server.primaryIp.trim(),
      source: 'public_ipv4',
      port,
      isExternallyReachable: true
    };
  }

  // 3. Public IPv6
  if (node?.publicIpv6 && isValidIPv6(node.publicIpv6)) {
    return {
      endpoint: `[${node.publicIpv6.trim()}]:${port}`,
      rawHost: node.publicIpv6.trim(),
      source: 'public_ipv6',
      port,
      isExternallyReachable: true
    };
  }

  // 4. Playit tunnel endpoint
  if (
    playitStatus?.isInstalled &&
    playitStatus?.status?.toLowerCase() === 'connected' &&
    playitStatus?.tunnelAddress &&
    !isInternalAddress(playitStatus.tunnelAddress)
  ) {
    const playitPort = playitStatus.tunnelPort || port;
    return {
      endpoint: `${playitStatus.tunnelAddress.trim()}:${playitPort}`,
      rawHost: playitStatus.tunnelAddress.trim(),
      source: 'playit',
      port: playitPort,
      isExternallyReachable: true
    };
  }

  // 5. No externally reachable address exists
  return {
    endpoint: NO_EXTERNAL_ENDPOINT,
    rawHost: NO_EXTERNAL_ENDPOINT,
    source: 'none',
    port,
    isExternallyReachable: false
  };
}

/**
 * Resolves the public host endpoint for a compute Node.
 */
export function resolveNodePublicEndpoint(
  node: Partial<Node>,
  playitStatus?: { isInstalled?: boolean; status?: string; tunnelAddress?: string } | null
): { host: string; source: 'fqdn' | 'public_ipv4' | 'public_ipv6' | 'playit' | 'none'; isExternallyReachable: boolean } {
  if (node.fqdn && isValidFQDN(node.fqdn)) {
    return { host: node.fqdn.trim(), source: 'fqdn', isExternallyReachable: true };
  }

  if (node.publicIpv4 && isValidIPv4(node.publicIpv4)) {
    return { host: node.publicIpv4.trim(), source: 'public_ipv4', isExternallyReachable: true };
  }

  if (node.ip && isValidIPv4(node.ip)) {
    return { host: node.ip.trim(), source: 'public_ipv4', isExternallyReachable: true };
  }

  if (node.publicIpv6 && isValidIPv6(node.publicIpv6)) {
    return { host: node.publicIpv6.trim(), source: 'public_ipv6', isExternallyReachable: true };
  }

  if (
    playitStatus?.isInstalled &&
    playitStatus?.status?.toLowerCase() === 'connected' &&
    playitStatus?.tunnelAddress &&
    !isInternalAddress(playitStatus.tunnelAddress)
  ) {
    return { host: playitStatus.tunnelAddress.trim(), source: 'playit', isExternallyReachable: true };
  }

  return { host: NO_EXTERNAL_ENDPOINT, source: 'none', isExternallyReachable: false };
}

/**
 * Validates an allocation port against reserved system infrastructure ports.
 */
export function isPortReserved(port: number, node?: Partial<Node>): boolean {
  if (RESERVED_SYSTEM_PORTS.has(port)) return true;
  if (node?.daemonPort && port === node.daemonPort) return true;
  if (node?.sftpPort && port === node.sftpPort) return true;
  return false;
}
