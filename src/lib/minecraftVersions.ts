import { apiRequest } from './api';

export interface MinecraftVersionResponse {
  software: string;
  versions: string[];
  latest: string;
  recommendedJava?: number;
}

// Module-level authoritative in-memory cache shared across the frontend
const mcVersionCache: Record<string, MinecraftVersionResponse> = {};
const inFlightRequests: Record<string, Promise<MinecraftVersionResponse>> = {};

const FALLBACK_VERSIONS: Record<string, string[]> = {
  paper: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.8'],
  purpur: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
  vanilla: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'],
  fabric: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.14.4'],
  neoforge: ['1.21.4', '1.21.1', '1.20.6', '1.20.4'],
  spigot: ['1.21.4', '1.21.1', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.17.1', '1.16.5', '1.12.2', '1.8.8'],
  forge: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.7.10'],
  bedrock: ['1.21.50', '1.21.40', '1.21.30', '1.21.20', '1.20.80', '1.20.70'],
  velocity: ['3.3.0', '3.2.0', '3.1.2'],
  bungeecord: ['1.21', '1.20', '1.19', '1.18', '1.16']
};

export function normalizeSoftwareKey(software: string): string {
  const norm = (software || 'paper').toLowerCase().trim();
  if (norm.includes('purpur')) return 'purpur';
  if (norm.includes('vanilla')) return 'vanilla';
  if (norm.includes('fabric')) return 'fabric';
  if (norm.includes('neoforge')) return 'neoforge';
  if (norm.includes('forge')) return 'forge';
  if (norm.includes('spigot')) return 'spigot';
  if (norm.includes('bedrock')) return 'bedrock';
  if (norm.includes('velocity')) return 'velocity';
  if (norm.includes('bungee')) return 'bungeecord';
  return 'paper';
}

export function getCachedMinecraftVersions(software: string): MinecraftVersionResponse | null {
  const key = normalizeSoftwareKey(software);
  return mcVersionCache[key] || null;
}

export async function fetchAuthoritativeMinecraftVersions(software: string): Promise<MinecraftVersionResponse> {
  const key = normalizeSoftwareKey(software);

  if (mcVersionCache[key] && mcVersionCache[key].versions.length > 0) {
    return mcVersionCache[key];
  }

  if (inFlightRequests[key]) {
    return inFlightRequests[key];
  }

  const fetchPromise = (async () => {
    try {
      const res = await apiRequest<MinecraftVersionResponse>(`/minecraft/versions?software=${encodeURIComponent(software)}`);
      if (res.success && res.data && Array.isArray(res.data.versions) && res.data.versions.length > 0) {
        const versions = res.data.versions;
        const latest = versions[0] || '1.21.4';
        const data: MinecraftVersionResponse = {
          software: key,
          versions,
          latest,
          recommendedJava: res.data.recommendedJava || 21
        };
        mcVersionCache[key] = data;
        return data;
      }
    } catch {
      // Fallback
    }

    const fallbackList = FALLBACK_VERSIONS[key] || ['1.21.4', '1.21.1', '1.20.4', '1.19.4'];
    const fallbackData: MinecraftVersionResponse = {
      software: key,
      versions: fallbackList,
      latest: fallbackList[0] || '1.21.4',
      recommendedJava: 21
    };
    mcVersionCache[key] = fallbackData;
    return fallbackData;
  })();

  inFlightRequests[key] = fetchPromise;

  try {
    const result = await fetchPromise;
    return result;
  } finally {
    delete inFlightRequests[key];
  }
}
