import fs from 'fs';
import path from 'path';
import { getServerDir } from './provider';

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

const USER_AGENT = 'AetherPanel/2.5 (admin@aetherpanel.in)';

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
        downloadUrl: hit.versions && hit.versions.length ? `https://api.modrinth.com/v2/project/${hit.project_id}/version` : undefined
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

export async function downloadPluginJar(serverId: string, pluginName: string, directUrl?: string, projectId?: string, provider?: string): Promise<{ success: boolean; filename: string; size: number }> {
  const baseDir = getServerDir(serverId);
  const pluginsDir = path.join(baseDir, 'plugins');
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  const cleanName = pluginName.replace(/[^a-zA-Z0-9_\-]/g, '');
  const jarFilename = `${cleanName}.jar`;
  const targetPath = path.join(pluginsDir, jarFilename);

  let targetDownloadUrl = directUrl;

  // Resolve download URL from Modrinth API if only projectId provided
  if (!targetDownloadUrl && projectId && provider === 'Modrinth') {
    try {
      const verRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version`, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (verRes.ok) {
        const versions = await verRes.json() as any[];
        if (versions && versions.length > 0 && versions[0].files && versions[0].files.length > 0) {
          targetDownloadUrl = versions[0].files[0].url;
        }
      }
    } catch (e) {
      console.error('Failed to resolve Modrinth download URL:', e);
    }
  }

  if (!targetDownloadUrl) {
    throw new Error('Unable to resolve download artifact URL from provider API.');
  }

  try {
    const downloadRes = await fetch(targetDownloadUrl, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow'
    });

    if (!downloadRes.ok) {
      throw new Error(`Failed to download plugin artifact. HTTP ${downloadRes.status}`);
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(targetPath, buffer);

    return {
      success: true,
      filename: jarFilename,
      size: buffer.length
    };
  } catch (err: any) {
    console.error(`Download plugin failed for ${pluginName}:`, err.message);
    throw new Error(`Plugin download failed: ${err.message}`);
  }
}
