import net from 'net';
import { Node, Server, SftpConnectionInfo } from '../../src/types';

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

export function isPortReserved(port: number): boolean {
  return RESERVED_SYSTEM_PORTS.has(port);
}

export const NO_EXTERNAL_ENDPOINT = 'NO_EXTERNAL_ENDPOINT';

export function isInternalAddress(addr?: string | null): boolean {
  if (!addr) return true;
  const trimmed = addr.trim().toLowerCase();
  return trimmed === '127.0.0.1' || trimmed === 'localhost' || trimmed === '0.0.0.0' || trimmed === '::1';
}

export function isValidFQDN(fqdn?: string | null): boolean {
  if (!fqdn) return false;
  const trimmed = fqdn.trim();
  if (trimmed.length < 3 || trimmed.length > 253) return false;
  if (trimmed === 'localhost' || trimmed.endsWith('.local') || trimmed === 'local-vps') return false;
  if (net.isIP(trimmed) !== 0) return false;
  const fqdnRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
  return fqdnRegex.test(trimmed);
}

export function isValidIPv4(ip?: string | null): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  return net.isIPv4(trimmed) && trimmed !== '0.0.0.0';
}

export function isValidIPv6(ip?: string | null): boolean {
  if (!ip) return false;
  const trimmed = ip.trim();
  return net.isIPv6(trimmed);
}

export interface PublicEndpointResult {
  endpoint: string;
  source: 'fqdn' | 'public_ipv4' | 'public_ipv6' | 'node_ip';
  port: number;
  isExternallyReachable: boolean;
  rawHost: string;
}

/**
 * Resolves the external connection address for a server (Pterodactyl style):
 * Priority: Node FQDN > Node Public IPv4 > Server Primary IP > Node IP / Hostname > '127.0.0.1'
 */
export function resolveServerPublicEndpoint(
  server: Partial<Server>,
  node?: Partial<Node> | null
): PublicEndpointResult {
  const port = (server as any).port || server.primaryPort || 25565;

  // 1. Node explicit FQDN (Highest priority: DNS domain configured for player connections)
  const nodeFqdn = (node?.fqdn || '').trim();
  if (nodeFqdn && nodeFqdn !== 'localhost' && nodeFqdn !== '127.0.0.1' && nodeFqdn !== '0.0.0.0' && !nodeFqdn.endsWith('.local') && nodeFqdn !== 'local-vps') {
    return {
      endpoint: `${nodeFqdn}:${port}`,
      rawHost: nodeFqdn,
      source: 'fqdn',
      port,
      isExternallyReachable: true
    };
  }

  // 2. Node Hostname if it is a valid external hostname
  const nodeHostname = (node?.hostname || '').trim();
  if (nodeHostname && nodeHostname !== 'localhost' && nodeHostname !== '127.0.0.1' && nodeHostname !== '0.0.0.0' && !nodeHostname.endsWith('.local') && nodeHostname !== 'local-vps') {
    return {
      endpoint: `${nodeHostname}:${port}`,
      rawHost: nodeHostname,
      source: nodeHostname.includes('.') ? 'fqdn' : 'node_ip',
      port,
      isExternallyReachable: true
    };
  }

  // 2. Node Public IPv4
  if (node?.publicIpv4 && node.publicIpv4.trim()) {
    const rawHost = node.publicIpv4.trim();
    return {
      endpoint: `${rawHost}:${port}`,
      rawHost,
      source: 'public_ipv4',
      port,
      isExternallyReachable: true
    };
  }

  // 3. Server Primary IP if non-loopback
  const serverIp = (server.primaryIp || '').trim();
  if (serverIp && serverIp !== '127.0.0.1' && serverIp !== '0.0.0.0' && serverIp !== 'localhost') {
    return {
      endpoint: `${serverIp}:${port}`,
      rawHost: serverIp,
      source: 'node_ip',
      port,
      isExternallyReachable: true
    };
  }

  // 4. Node IP / Hostname fallback
  const fallbackHost = node?.ip?.trim() || node?.hostname?.trim() || serverIp || '127.0.0.1';
  return {
    endpoint: `${fallbackHost}:${port}`,
    rawHost: fallbackHost,
    source: 'node_ip',
    port,
    isExternallyReachable: fallbackHost !== '127.0.0.1'
  };
}

/**
 * Resolves the host endpoint for a compute Node.
 */
export function resolveNodePublicEndpoint(
  node: Partial<Node>
): { host: string; source: 'fqdn' | 'public_ipv4' | 'node_ip'; isExternallyReachable: boolean } {
  if (node.fqdn && node.fqdn.trim()) {
    return { host: node.fqdn.trim(), source: 'fqdn', isExternallyReachable: true };
  }

  if (node.publicIpv4 && node.publicIpv4.trim()) {
    return { host: node.publicIpv4.trim(), source: 'public_ipv4', isExternallyReachable: true };
  }

  return { host: node.ip?.trim() || node.hostname?.trim() || '127.0.0.1', source: 'node_ip', isExternallyReachable: true };
}
