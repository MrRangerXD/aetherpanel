import { Node, Server, SftpConnectionInfo } from '../src/types';
import { getDb } from './db';
import { runNetworkDiagnostics, checkPortReachable, isPrivateIP } from './network/networkDetection';
import { getNodePlayitStatus } from './playit/playitService';
import { isInternalAddress, isValidFQDN, isValidIPv4, NO_EXTERNAL_ENDPOINT } from './network/endpointResolver';

export { isInternalAddress };
export const isInternalLoopback = isInternalAddress;

export interface SftpResolutionDetails {
  mode: 'DIRECT' | 'TUNNELED' | 'UNAVAILABLE' | 'direct' | 'playit' | 'unavailable';
  status: 'online' | 'offline' | 'degraded' | 'unconfigured';
  host: string;
  port: number;
  source: 'public_ipv4' | 'fqdn' | 'playit' | 'none';
  reachable: boolean;
  agent: {
    installed: boolean;
    claimed: boolean;
    connected: boolean;
  };
}

/**
 * Performs full, authoritative, real-time verification of node network & sftp availability.
 */
export async function resolveNodeSftpMode(nodeId: string): Promise<SftpResolutionDetails> {
  const db = await getDb();
  const node = db.nodes.find(n => n.id === nodeId);
  
  const sftpPort = node?.sftpPort || 2022;
  const sftpDaemonOnline = await checkPortReachable('127.0.0.1', sftpPort, 1000);

  // 1. Run real-time IP, NAT, and port reachability diagnostic checks
  const netDiag = await runNetworkDiagnostics(sftpPort);
  const playitStatus = await getNodePlayitStatus(nodeId);

  const statusUpper = String(playitStatus.status).toUpperCase();

  const playitInstalled = !!playitStatus.isInstalled;
  const playitClaimed = statusUpper === 'CONNECTED' || statusUpper === 'CLAIMED';
  const playitConnected = statusUpper === 'CONNECTED' && !!playitStatus.sftpTunnelAddress && playitStatus.sftpTunnelAddress.endsWith('.playit.gg');

  // SCENARIO A: Direct connection is possible (public IP exists and sftp port is reachable externally)
  let directHost = '';
  let directReachable = false;

  if (node?.publicIpv4 && isValidIPv4(node.publicIpv4)) {
    directHost = node.publicIpv4.trim();
    directReachable = sftpDaemonOnline && (await checkPortReachable(directHost, sftpPort, 1000));
  } else if (netDiag.publicIp) {
    directHost = netDiag.publicIp;
    directReachable = sftpDaemonOnline && (netDiag.isPublicIpReachable || (await checkPortReachable(directHost, sftpPort, 1000)));
  }

  if (directHost && directReachable) {
    return {
      mode: 'DIRECT',
      status: 'online',
      host: directHost,
      port: sftpPort,
      source: 'public_ipv4',
      reachable: true,
      agent: {
        installed: playitInstalled,
        claimed: playitClaimed,
        connected: playitConnected
      }
    };
  }

  // SCENARIO B: Configured FQDN exists and is valid and reachable
  if (node?.sftpFqdn && isValidFQDN(node.sftpFqdn) && sftpDaemonOnline) {
    const fqdnHost = node.sftpFqdn.trim();
    const fqdnReachable = await checkPortReachable(fqdnHost, sftpPort, 1000);
    if (fqdnReachable) {
      return {
        mode: 'DIRECT',
        status: 'online',
        host: fqdnHost,
        port: sftpPort,
        source: 'fqdn',
        reachable: true,
        agent: {
          installed: playitInstalled,
          claimed: playitClaimed,
          connected: playitConnected
        }
      };
    }
  }

  if (node?.fqdn && isValidFQDN(node.fqdn) && sftpDaemonOnline) {
    const fqdnHost = node.fqdn.trim();
    const fqdnReachable = await checkPortReachable(fqdnHost, sftpPort, 1000);
    if (fqdnReachable) {
      return {
        mode: 'DIRECT',
        status: 'online',
        host: fqdnHost,
        port: sftpPort,
        source: 'fqdn',
        reachable: true,
        agent: {
          installed: playitInstalled,
          claimed: playitClaimed,
          connected: playitConnected
        }
      };
    }
  }

  // SCENARIO C: Playit fallback is active and fully connected
  if (playitInstalled && playitConnected && sftpDaemonOnline) {
    const playitHost = playitStatus.sftpTunnelAddress || 'sftp-tunnel.playit.gg';
    const playitPort = playitStatus.sftpTunnelPort || sftpPort;

    return {
      mode: 'TUNNELED',
      status: 'online',
      host: playitHost,
      port: playitPort,
      source: 'playit',
      reachable: true,
      agent: {
        installed: playitInstalled,
        claimed: playitClaimed,
        connected: playitConnected
      }
    };
  }

  // SCENARIO D: SFTP is unconfigured, offline or degraded
  let currentStatus: 'offline' | 'degraded' | 'unconfigured' = 'unconfigured';
  if (!sftpDaemonOnline) {
    currentStatus = 'offline'; // SFTP Daemon is not running locally
  } else if (playitInstalled && !playitClaimed) {
    currentStatus = 'unconfigured'; // Playit agent needs claiming
  } else if (playitInstalled && !playitConnected) {
    currentStatus = 'degraded'; // Playit disconnected
  } else {
    currentStatus = 'offline';
  }

  return {
    mode: 'UNAVAILABLE',
    status: currentStatus,
    host: NO_EXTERNAL_ENDPOINT,
    port: sftpPort,
    source: 'none',
    reachable: false,
    agent: {
      installed: playitInstalled,
      claimed: playitClaimed,
      connected: playitConnected
    }
  };
}

/**
 * Resolves the public, production-grade SFTP endpoint for any server.
 * GUARANTEE: NEVER returns 127.0.0.1:2022, localhost:2022, or 0.0.0.0:2022.
 * Priority:
 * 1. Direct SFTP endpoint (Public IPv4)
 * 2. Configured SFTP FQDN or Node FQDN
 * 3. Playit SFTP tunnel
 * 4. NO_EXTERNAL_ENDPOINT
 */
export async function resolveServerSftpInfo(
  serverId: string,
  clientHostHeader?: string
): Promise<SftpConnectionInfo> {
  const db = await getDb();
  const server = db.servers.find(s => s.id === serverId);
  const node = server ? db.nodes.find(n => n.id === server.nodeId) : null;

  const sftpUsername = server ? `srv_${server.id.substring(0, 10)}` : 'srv_default';
  const sftpPassword = (server as any)?.sftpPassword || '••••••••••••••••';

  const nodeId = node?.id || 'node_local';
  const modeDetails = await resolveNodeSftpMode(nodeId);

  let host = '';
  let port = node?.sftpPort || 2022;
  let tunnelType: 'direct' | 'fqdn' | 'playit' = 'direct';

  // 1. Explicit SFTP FQDN or Node FQDN
  if (node?.sftpFqdn && isValidFQDN(node.sftpFqdn)) {
    host = node.sftpFqdn.trim();
    port = node.sftpPort || 2022;
    tunnelType = 'fqdn';
  } else if (node?.fqdn && isValidFQDN(node.fqdn)) {
    host = node.fqdn.trim();
    port = node.sftpPort || 2022;
    tunnelType = 'fqdn';
  } else if (node?.publicIpv4 && isValidIPv4(node.publicIpv4)) {
    host = node.publicIpv4.trim();
    port = node.sftpPort || 2022;
    tunnelType = 'direct';
  } else if (modeDetails.source === 'public_ipv4' && !isInternalAddress(modeDetails.host)) {
    host = modeDetails.host;
    port = modeDetails.port;
    tunnelType = 'direct';
  } else if (node?.playitSftpAddress && !isInternalAddress(node.playitSftpAddress)) {
    host = node.playitSftpAddress.trim();
    port = node.playitSftpPort || modeDetails.port || 2022;
    tunnelType = 'playit';
  } else if (modeDetails.source === 'playit' && !isInternalAddress(modeDetails.host)) {
    host = modeDetails.host;
    port = modeDetails.port;
    tunnelType = 'playit';
  } else {
    // If clientHostHeader is a real public domain and not loopback, use sftp.<domain>
    const cleanHeader = clientHostHeader ? clientHostHeader.split(':')[0].trim() : '';
    if (cleanHeader && isValidFQDN(cleanHeader)) {
      host = `sftp.${cleanHeader}`;
      port = node?.sftpPort || 2022;
      tunnelType = 'fqdn';
    } else {
      host = NO_EXTERNAL_ENDPOINT;
    }
  }

  // Safety fallback
  if (isInternalAddress(host) && host !== NO_EXTERNAL_ENDPOINT) {
    host = NO_EXTERNAL_ENDPOINT;
  }

  const uri = host !== NO_EXTERNAL_ENDPOINT ? `sftp://${sftpUsername}@${host}:${port}` : `sftp://${sftpUsername}@${NO_EXTERNAL_ENDPOINT}:${port}`;

  return {
    host,
    port,
    username: sftpUsername,
    password: sftpPassword,
    uri,
    isProtected: true,
    tunnelType,
    nodeName: node?.name || 'Primary Node'
  };
}

