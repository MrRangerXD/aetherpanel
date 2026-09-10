import fs from 'fs';
import path from 'path';
import { getServerDir } from './provider';
import { downloadAndInstallPlugin } from './services/pluginManagerService';

export interface RealPluginItem {
  id: string;
  name: string;
  description: string;
  author: string;
  iconUrl?: string;
  downloads: number;
  category: string;
  version: string;
  supportedVersions?: string[];
  platform: string;
  provider: 'Modrinth' | 'Hangar';
  projectUrl: string;
  downloadUrl?: string;
}

const USER_AGENT = 'AetherPanel/3.5 (admin@aetherpanel.in)';

export async function searchModrinthPlugins(query: string): Promise<RealPluginItem[]> {
  try {
    const q = query.trim();
    // Modrinth Search API
    const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&limit=12`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!res.ok) {
      console.error(`Modrinth API error: ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    if (!data || !Array.isArray(data.hits)) return [];

    return data.hits.map((hit: any) => {
      return {
        id: hit.project_id || hit.slug,
        name: hit.title || hit.slug,
        description: hit.description || 'No description provided.',
        author: hit.author || 'Community',
        iconUrl: hit.icon_url || '',
        downloads: hit.downloads || 0,
        category: (hit.categories && hit.categories[0]) ? hit.categories[0].toUpperCase() : 'GENERAL',
        version: hit.latest_version || 'Latest',
        supportedVersions: hit.versions || ['1.20.x'],
        platform: 'Spigot / Paper',
        provider: 'Modrinth',
        projectUrl: `https://modrinth.com/${hit.project_type || 'mod'}/${hit.slug}`,
        // Leave downloadUrl undefined so downloadAndInstallPlugin resolves the actual CDN .jar rather than an API endpoint
        downloadUrl: undefined
      };
    });
  } catch (err: any) {
    console.error('Error searching Modrinth:', err.message);
    return [];
  }
}

export async function searchHangarPlugins(query: string): Promise<RealPluginItem[]> {
  try {
    const q = query.trim();
    const url = `https://hangar.papermc.io/api/v1/projects?q=${encodeURIComponent(q)}&limit=12`;
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT }
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json() as any;
    if (!data || !Array.isArray(data.result)) return [];

    return data.result.map((item: any) => {
      const slug = item.namespace?.slug || item.name;
      const owner = item.namespace?.owner || 'Paper';
      return {
        id: `hangar_${slug}`,
        name: item.name || slug,
        description: item.description || 'Hangar PaperMC plugin project.',
        author: owner,
        iconUrl: item.avatarUrl || '',
        downloads: item.stats?.downloads || 0,
        category: item.category ? item.category.toUpperCase() : 'PAPER',
        version: 'Latest',
        platform: 'Paper / Velocity',
        provider: 'Hangar',
        projectUrl: `https://hangar.papermc.io/${owner}/${slug}`
      };
    });
  } catch (err: any) {
    console.error('Error searching Hangar:', err.message);
    return [];
  }
}

export async function searchRealPlugins(query: string): Promise<RealPluginItem[]> {
  const [modrinthHits, hangarHits] = await Promise.all([
    searchModrinthPlugins(query),
    searchHangarPlugins(query)
  ]);

  return [...modrinthHits, ...hangarHits];
}

export async function downloadPluginJar(
  serverId: string,
  pluginName: string,
  directUrl?: string,
  projectId?: string,
  provider?: string
): Promise<{ success: boolean; filename: string; size: number; message: string }> {
  return await downloadAndInstallPlugin(serverId, pluginName, directUrl, projectId, provider);
}
