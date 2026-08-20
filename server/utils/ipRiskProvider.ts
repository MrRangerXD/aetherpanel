export interface IpRiskResult {
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isDatacenter: boolean;
  riskScore: number; // 0 - 100
  provider: string;
  ip: string;
  details?: Record<string, any>;
}

export interface AntiAbuseConfig {
  enabled: boolean;
  provider?: 'proxycheck' | 'ipqualityscore' | 'custom';
  apiKey?: string;
  blockVpn?: boolean;
  blockProxy?: boolean;
  blockTor?: boolean;
  blockDatacenter?: boolean;
  maxRiskScore?: number;
  maxRegistrationsPerIpPerDay?: number;
  loginLockoutMaxAttempts?: number;
  loginLockoutDurationSec?: number;
}

export interface IpRiskProvider {
  name: string;
  checkIp(ip: string): Promise<IpRiskResult>;
}

/**
 * Proxycheck.io IP Intelligence Provider Implementation
 */
export class ProxyCheckProvider implements IpRiskProvider {
  name = 'proxycheck';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async checkIp(ip: string): Promise<IpRiskResult> {
    // Loopback / Private ranges are safe
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
      return {
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        riskScore: 0,
        provider: 'proxycheck',
        ip
      };
    }

    try {
      const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?key=${encodeURIComponent(this.apiKey)}&vpn=1&asn=1&risk=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`Proxycheck API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      const ipData = data[ip] || {};

      const isProxy = ipData.proxy === 'yes';
      const isVpn = ipData.type === 'VPN' || isProxy;
      const isTor = ipData.type === 'TOR';
      const riskScore = typeof ipData.risk === 'number' ? ipData.risk : 0;
      const isDatacenter = ipData.type === 'Hosting' || (ipData.is_datacenter === 'yes');

      return {
        isVpn,
        isProxy,
        isTor,
        isDatacenter,
        riskScore,
        provider: 'proxycheck',
        ip,
        details: {
          type: ipData.type,
          country: ipData.country,
          provider: ipData.provider,
          asn: ipData.asn
        }
      };
    } catch (err: any) {
      console.warn(`[AntiAbuse] Proxycheck query failed for ${ip}:`, err.message);
      return {
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        riskScore: 0,
        provider: 'proxycheck',
        ip,
        details: { error: err.message }
      };
    }
  }
}

/**
 * IPQualityScore Provider Implementation
 */
export class IpQualityScoreProvider implements IpRiskProvider {
  name = 'ipqualityscore';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async checkIp(ip: string): Promise<IpRiskResult> {
    if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('10.') || ip.startsWith('192.168.')) {
      return {
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        riskScore: 0,
        provider: 'ipqualityscore',
        ip
      };
    }

    try {
      const url = `https://ipqualityscore.com/api/json/ip/${encodeURIComponent(this.apiKey)}/${encodeURIComponent(ip)}?strictness=1&allow_public_access_points=true`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`IPQualityScore API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'IPQualityScore query failed');
      }

      return {
        isVpn: !!data.vpn,
        isProxy: !!data.proxy,
        isTor: !!data.tor,
        isDatacenter: !!data.is_crawler || !!data.active_vpn,
        riskScore: typeof data.fraud_score === 'number' ? data.fraud_score : 0,
        provider: 'ipqualityscore',
        ip,
        details: {
          fraudScore: data.fraud_score,
          country: data.country_code,
          isp: data.ISP
        }
      };
    } catch (err: any) {
      console.warn(`[AntiAbuse] IPQualityScore query failed for ${ip}:`, err.message);
      return {
        isVpn: false,
        isProxy: false,
        isTor: false,
        isDatacenter: false,
        riskScore: 0,
        provider: 'ipqualityscore',
        ip,
        details: { error: err.message }
      };
    }
  }
}

/**
 * Fallback / Disabled Provider
 */
export class PassThroughProvider implements IpRiskProvider {
  name = 'passthrough';
  async checkIp(ip: string): Promise<IpRiskResult> {
    return {
      isVpn: false,
      isProxy: false,
      isTor: false,
      isDatacenter: false,
      riskScore: 0,
      provider: 'passthrough',
      ip
    };
  }
}

/**
 * Factory to get configured IP Risk Provider
 */
export function getIpRiskProvider(config?: AntiAbuseConfig): IpRiskProvider {
  const apiKey = config?.apiKey || process.env.VPN_CHECK_API_KEY || process.env.PROXYCHECK_KEY;
  if (!config?.enabled || !apiKey) {
    return new PassThroughProvider();
  }

  const providerType = config.provider || 'proxycheck';
  if (providerType === 'ipqualityscore') {
    return new IpQualityScoreProvider(apiKey);
  }
  return new ProxyCheckProvider(apiKey);
}

/**
 * Evaluate IP address risk against admin policy
 */
export async function evaluateIpRisk(
  ip: string,
  config?: AntiAbuseConfig
): Promise<{ allowed: boolean; reason?: string; errorCode?: string; result?: IpRiskResult }> {
  if (!config || !config.enabled) {
    return { allowed: true };
  }

  const provider = getIpRiskProvider(config);
  if (provider instanceof PassThroughProvider) {
    // Provider not configured with real key -> allow request
    return { allowed: true };
  }

  const result = await provider.checkIp(ip);

  // Check VPN
  if (config.blockVpn && result.isVpn) {
    return {
      allowed: false,
      errorCode: 'HIGH_RISK_NETWORK',
      reason: 'Registrations from VPN / Proxy networks are restricted. Please disconnect and retry.',
      result
    };
  }

  // Check Proxy
  if (config.blockProxy && result.isProxy) {
    return {
      allowed: false,
      errorCode: 'HIGH_RISK_NETWORK',
      reason: 'Registrations from proxy connections are prohibited.',
      result
    };
  }

  // Check Tor
  if (config.blockTor && result.isTor) {
    return {
      allowed: false,
      errorCode: 'HIGH_RISK_NETWORK',
      reason: 'Registrations from Tor exit nodes are prohibited.',
      result
    };
  }

  // Check Datacenter / Hosting IP
  if (config.blockDatacenter && result.isDatacenter) {
    return {
      allowed: false,
      errorCode: 'HIGH_RISK_NETWORK',
      reason: 'Registrations from cloud datacenter IP addresses are restricted.',
      result
    };
  }

  // Check Risk Score threshold
  const maxScore = config.maxRiskScore ?? 65;
  if (result.riskScore > maxScore) {
    return {
      allowed: false,
      errorCode: 'HIGH_RISK_NETWORK',
      reason: `IP reputation risk score exceeds threshold (${result.riskScore} > ${maxScore}).`,
      result
    };
  }

  return { allowed: true, result };
}

/**
 * Test connectivity and API validity of configured IP risk provider
 */
export async function testIpRiskConnection(config: AntiAbuseConfig): Promise<{
  status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR';
  message: string;
  sampleResult?: IpRiskResult;
}> {
  const apiKey = config.apiKey || process.env.VPN_CHECK_API_KEY || process.env.PROXYCHECK_KEY;
  if (!apiKey) {
    return {
      status: 'NOT_CONFIGURED',
      message: 'Anti-Abuse IP Intelligence: NOT CONFIGURED (API Key required for Proxycheck or IPQualityScore)'
    };
  }

  try {
    const provider = getIpRiskProvider({ ...config, enabled: true });
    // Test against a known public DNS IP
    const sample = await provider.checkIp('1.1.1.1');
    return {
      status: 'CONFIGURED',
      message: `Successfully validated ${provider.name.toUpperCase()} API connection.`,
      sampleResult: sample
    };
  } catch (err: any) {
    return {
      status: 'ERROR',
      message: `Failed to query IP Intelligence API: ${err.message}`
    };
  }
}
