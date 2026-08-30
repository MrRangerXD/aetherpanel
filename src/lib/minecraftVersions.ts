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
  paper: ['26.2', '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
  purpur: ['26.2', '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4'],
  vanilla: ['26.2', '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2'],
  fabric: ['26.2', '1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2'],
  forge: ['26.2', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5']
};

export function normalizeSoftwareKey(software: string): string {
  const norm = (software || 'paper').toLowerCase().trim();
  if (norm.includes('purpur')) return 'purpur';
  if (norm.includes('vanilla')) return 'vanilla';
  if (norm.includes('fabric')) return 'fabric';
  if (norm.includes('forge')) return 'forge';
  if (norm.includes('spigot')) return 'spigot';
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
        const versions = res.data.versions.includes('26.2') ? res.data.versions : ['26.2', ...res.data.versions];
        const latest = versions[0] || '26.2';
        const data: MinecraftVersionResponse = {
          software: key,
          versions,
          latest,
          recommendedJava: res.data.recommendedJava || 25
        };
        mcVersionCache[key] = data;
        return data;
      }
    } catch {
      // Fallback
    }

    const fallbackList = FALLBACK_VERSIONS[key] || ['26.2'];
    const fallbackData: MinecraftVersionResponse = {
      software: key,
      versions: fallbackList,
      latest: '26.2',
      recommendedJava: 25
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
