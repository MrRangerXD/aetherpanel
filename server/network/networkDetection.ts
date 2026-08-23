import os from 'os';
import https from 'https';
import net from 'net';

/**
 * Validates if an IP address belongs to RFC 1918 private spaces, carrier-grade NAT, or loopback/link-local ranges.
 */
export function isPrivateIP(ip: string): boolean {
  if (!ip) return true;
  const trimmed = ip.trim();
  
  // If it's a domain/hostname and not an IP, it's not a private IP
  if (net.isIP(trimmed) === 0) {
    return false;
  }

  const parts = trimmed.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return true; // Treat invalid or IPv6 as private/non-public-ipv4 for this system
  }
  
  const [o1, o2, o3, o4] = parts;
  
  // 10.0.0.0/8 (Private-Use Networks)
  if (o1 === 10) return true;
  
  // 172.16.0.0/12 (Private-Use Networks)
  if (o1 === 172 && (o2 >= 16 && o2 <= 31)) return true;
  
  // 192.168.0.0/16 (Private-Use Networks)
  if (o1 === 192 && o2 === 168) return true;
  
  // 100.64.0.0/10 (Shared Address Space / Carrier-Grade NAT)
  if (o1 === 100 && (o2 >= 64 && o2 <= 127)) return true;
  
  // 127.0.0.0/8 (Loopback)
  if (o1 === 127) return true;
  
  // 169.254.0.0/16 (Link-Local)
  if (o1 === 169 && o2 === 254) return true;

  // 0.0.0.0/8 (Current network)
  if (o1 === 0) return true;

  // 224.0.0.0/4 (Multicast)
  if (o1 >= 224 && o1 <= 239) return true;

  // 240.0.0.0/4 (Reserved)
  if (o1 >= 240) return true;
  
  return false;
}

/**
 * Lists all active non-internal IPv4 addresses bound to local interfaces.
 */
export function getLocalIPv4s(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const netInterfaces = interfaces[name];
    if (netInterfaces) {
      for (const netInterface of netInterfaces) {
        if (netInterface.family === 'IPv4' && !netInterface.internal) {
          ips.push(netInterface.address);
        }
      }
    }
  }
  return ips;
}

/**
 * Resolves the public IPv4 address using multiple authoritative lookup API services with redundant fallbacks.
 */
export function fetchPublicIP(): Promise<string | null> {
  const services = [
    'https://api.ipify.org',
    'https://icanhazip.com',
    'https://ifconfig.me/ip',
    'https://ipecho.net/plain'
  ];

  const fetchWithTimeout = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const req = https.get(url, { timeout: 2500 }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          const ip = data.trim();
          if (ip && ip.split('.').length === 4) {
            resolve(ip);
          } else {
            reject(new Error('Invalid IP format from service'));
          }
        });
      });
      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  };

  return (async () => {
    for (const service of services) {
      try {
        const ip = await fetchWithTimeout(service);
        if (ip && !isPrivateIP(ip)) {
          return ip;
        }
      } catch (err) {
        // Suppress and fall back to the next available provider
      }
    }
    // Final fallback: check if any local non-loopback IP looks public
    const locals = getLocalIPv4s();
    const firstPublicLocal = locals.find(ip => !isPrivateIP(ip));
    return firstPublicLocal || null;
  })();
}

/**
 * Validates TCP listener reachability on a specific host and port.
 */
export function checkPortReachable(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let completed = false;

    socket.setTimeout(timeoutMs);

    const finish = (result: boolean) => {
      if (!completed) {
        completed = true;
        socket.destroy();
        resolve(result);
      }
    };

    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));

    socket.connect(port, host);
  });
}

export interface NetworkDiagnostics {
  localIps: string[];
  publicIp: string | null;
  isBehindNat: boolean;
  isPublicIpReachable: boolean;
  preferPlayit: boolean;
  mode: 'direct' | 'playit' | 'unavailable';
}

/**
 * Runs a complete network diagnostic suite.
 */
export async function runNetworkDiagnostics(sftpPort = 2022): Promise<NetworkDiagnostics> {
  const localIps = getLocalIPv4s();
  const publicIp = await fetchPublicIP();
  
  let isBehindNat = true;
  let isPublicIpReachable = false;
  
  if (publicIp) {
    // If the public IP matches one of the local IPs, it is not behind NAT
    isBehindNat = !localIps.includes(publicIp);
    
    // Check if the SFTP port is reachable externally on this public IP
    isPublicIpReachable = await checkPortReachable(publicIp, sftpPort);
  }

  // We prefer Playit if we are behind NAT and the port is not reachable directly,
  // or if we have no public IP.
  const preferPlayit = !publicIp || isBehindNat || !isPublicIpReachable;

  let mode: 'direct' | 'playit' | 'unavailable' = 'unavailable';
  if (publicIp && !isBehindNat && isPublicIpReachable) {
    mode = 'direct';
  } else {
    mode = 'playit';
  }

  return {
    localIps,
    publicIp,
    isBehindNat,
    isPublicIpReachable,
    preferPlayit,
    mode
  };
}
