import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface InstallationInfo {
  installationId: string;
  installationSecret: string;
  installedAt: string;
  version: string;
  systemName?: string;
}

const PRIMARY_SYSTEM_PATH = '/etc/aetherpanel/installation.json';
const FALLBACK_DATA_DIR = path.join(process.cwd(), 'data');
const FALLBACK_PATH = path.join(FALLBACK_DATA_DIR, 'installation.json');

let cachedInstallation: InstallationInfo | null = null;

function generateInstallationId(): string {
  // Generate format: aep_ + timestamp in base36 + 12 random hex characters
  const timestampPart = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  return `aep_${timestampPart}${randomPart}`;
}

function generateInstallationSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get or initialize the persistent unique installation identity.
 * Stored securely on the host filesystem and never regenerated on requests/restarts.
 */
export function getInstallationInfo(): InstallationInfo {
  if (cachedInstallation) {
    return cachedInstallation;
  }

  // 1. Check if environment variable overrides installation ID
  const envId = process.env.AETHER_INSTALLATION_ID;
  const envSecret = process.env.AETHER_INSTALLATION_SECRET;

  // 2. Try to read from /etc/aetherpanel/installation.json first, then data/installation.json
  const candidatePaths = [
    process.env.AETHER_INSTALLATION_PATH,
    PRIMARY_SYSTEM_PATH,
    FALLBACK_PATH
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.installationId) {
          cachedInstallation = {
            installationId: envId || parsed.installationId,
            installationSecret: envSecret || parsed.installationSecret || generateInstallationSecret(),
            installedAt: parsed.installedAt || new Date().toISOString(),
            version: parsed.version || '2.6.0',
            systemName: parsed.systemName || 'AetherPanel Local VPS'
          };
          return cachedInstallation;
        }
      }
    } catch {
      // Continue to next candidate path
    }
  }

  // 3. No existing installation found - create a new unique identity
  const newInstallation: InstallationInfo = {
    installationId: envId || generateInstallationId(),
    installationSecret: envSecret || generateInstallationSecret(),
    installedAt: new Date().toISOString(),
    version: '2.6.0',
    systemName: 'AetherPanel Control Plane'
  };

  // 4. Persist to filesystem
  let saved = false;

  // Try /etc/aetherpanel first
  try {
    const etcDir = path.dirname(PRIMARY_SYSTEM_PATH);
    if (!fs.existsSync(etcDir)) {
      fs.mkdirSync(etcDir, { recursive: true });
    }
    fs.writeFileSync(PRIMARY_SYSTEM_PATH, JSON.stringify(newInstallation, null, 2), { mode: 0o600 });
    saved = true;
  } catch {
    // If /etc is not writable (e.g. non-root container), fallback to data/installation.json
  }

  if (!saved) {
    try {
      if (!fs.existsSync(FALLBACK_DATA_DIR)) {
        fs.mkdirSync(FALLBACK_DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(FALLBACK_PATH, JSON.stringify(newInstallation, null, 2), { mode: 0o600 });
      saved = true;
    } catch (err) {
      console.warn('[Installation] Warning: Could not write installation.json to disk:', err);
    }
  }

  cachedInstallation = newInstallation;
  console.log(`[Installation] Control Plane initialized with ID: ${newInstallation.installationId}`);
  return cachedInstallation;
}

/**
 * Returns the current installation ID
 */
export function getInstallationId(): string {
  return getInstallationInfo().installationId;
}

/**
 * Returns the installation public metadata (safe for frontend/API, excluding secrets)
 */
export function getInstallationPublicMetadata() {
  const info = getInstallationInfo();
  return {
    installationId: info.installationId,
    installedAt: info.installedAt,
    version: info.version,
    systemName: info.systemName
  };
}
