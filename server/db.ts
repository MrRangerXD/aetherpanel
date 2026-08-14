import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';
import {
  User, Product, Plan, Server, Node, Allocation, Order, Coupon,
  SupportTicket, Announcement, AuditLog, SystemSettings, ServerBackup,
  ServerDatabase, ServerSchedule, ServerActivity, Location, NodeInstallToken,
  AdItem, AdEvent, AfkSession, RewardTransaction, AfkSettings, ServerTemplate,
  DiscordAccount, DiscordBotSettings, ServerDiscordLink, DiscordAuditLog,
  MarketplaceItem, StatusComponent, Incident, ScheduledMaintenance, AlertRule,
  AlertIncident, TelemetryPoint, DayUptime, ApiKey, WebhookSubscription
} from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  users: User[];
  passwords: Record<string, string>; // userId -> passwordHash
  products: Product[];
  plans: Plan[];
  servers: Server[];
  templates: ServerTemplate[];
  locations: Location[];
  nodes: Node[];
  nodeInstallTokens: NodeInstallToken[];
  allocations: Allocation[];
  backups: ServerBackup[];
  databases: ServerDatabase[];
  schedules: ServerSchedule[];
  activities: ServerActivity[];
  orders: Order[];
  coupons: Coupon[];
  tickets: SupportTicket[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
  ads: AdItem[];
  adEvents: AdEvent[];
  afkSessions: AfkSession[];
  afkSettings: AfkSettings;
  rewardTransactions: RewardTransaction[];
  discordLinks: Record<string, DiscordAccount>;
  serverDiscordLinks: ServerDiscordLink[];
  discordAuditLogs: DiscordAuditLog[];
  marketplaceItems: MarketplaceItem[];
  statusComponents: StatusComponent[];
  incidents: Incident[];
  scheduledMaintenances: ScheduledMaintenance[];
  alertRules: AlertRule[];
  alertIncidents: AlertIncident[];
  telemetryHistory: Record<string, TelemetryPoint[]>;
  apiKeys: ApiKey[];
  webhooks: WebhookSubscription[];
}


const defaultLocations: Location[] = [
  {
    id: 'loc_us_east',
    name: 'United States (Virginia)',
    code: 'us-east',
    country: 'United States',
    flagCode: 'US',
    description: 'Ashburn Datacenter, Low latency across US & EU East',
    isActive: true
  },
  {
    id: 'loc_eu_central',
    name: 'Germany (Frankfurt)',
    code: 'eu-central',
    country: 'Germany',
    flagCode: 'DE',
    description: 'Frankfurt Equinix, Central European routing hub',
    isActive: true
  },
  {
    id: 'loc_ap_southeast',
    name: 'Singapore',
    code: 'ap-southeast',
    country: 'Singapore',
    flagCode: 'SG',
    description: 'Singapore Regional Hub, APAC region priority routing',
    isActive: true
  },
  {
    id: 'loc_in_delhi',
    name: 'India (Delhi/Mumbai)',
    code: 'in-south',
    country: 'India',
    flagCode: 'IN',
    description: 'Direct Peering with Airtel/Jio, Sub-15ms regional ping',
    isActive: true
  }
];

const defaultTemplates: ServerTemplate[] = [
  {
    id: 'tpl_mc_paper',
    name: 'Paper Minecraft Server',
    description: 'High-performance Spigot fork focused on fixing security, gameplay and performance exploits.',
    category: 'minecraft',
    icon: 'Gamepad2',
    runtime: 'minecraft',
    versions: ['1.20.4', '1.20.2', '1.19.4', '1.18.2'],
    defaultVersion: '1.20.4',
    startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -XX:+UseG1GC -jar server.jar nogui',
    environmentVars: { EULA: 'true', MINECRAFT_VERSION: '1.20.4', SERVER_PORT: '{PORT}' },
    defaultPort: 25565,
    recommendedRamMB: 2048,
    recommendedCpuCores: 1,
    recommendedDiskGB: 15,
    status: 'active',
    isPopular: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_mc_purpur',
    name: 'Purpur High Performance',
    description: 'Drop-in replacement for Paper designed for extreme performance, TPS optimization and customizable gameplay mechanics.',
    category: 'minecraft',
    icon: 'Zap',
    runtime: 'minecraft',
    versions: ['1.20.4', '1.20.2', '1.19.4'],
    defaultVersion: '1.20.4',
    startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -XX:+UseG1GC -jar purpur.jar nogui',
    environmentVars: { EULA: 'true', PURPUR_VERSION: '1.20.4', SERVER_PORT: '{PORT}' },
    defaultPort: 25565,
    recommendedRamMB: 4096,
    recommendedCpuCores: 2,
    recommendedDiskGB: 30,
    status: 'active',
    isPopular: true,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_mc_vanilla',
    name: 'Official Vanilla Minecraft',
    description: 'Standard official Mojang server jar without plugins or mod modifications.',
    category: 'minecraft',
    icon: 'Box',
    runtime: 'minecraft',
    versions: ['1.20.4', '1.20.1', '1.19.4'],
    defaultVersion: '1.20.4',
    startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui',
    environmentVars: { EULA: 'true', SERVER_PORT: '{PORT}' },
    defaultPort: 25565,
    recommendedRamMB: 2048,
    recommendedCpuCores: 1,
    recommendedDiskGB: 10,
    status: 'active',
    isPopular: false,
    sortOrder: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_mc_fabric',
    name: 'Fabric Modded Framework',
    description: 'Modular, lightweight modding toolchain for modern Minecraft versions.',
    category: 'minecraft',
    icon: 'Cpu',
    runtime: 'minecraft',
    versions: ['1.20.4', '1.20.1', '1.19.4'],
    defaultVersion: '1.20.4',
    startupCommand: 'java -Xms1024M -Xmx{RAM_MB}M -jar fabric-server-launch.jar nogui',
    environmentVars: { EULA: 'true', FABRIC_VERSION: '0.15.7', SERVER_PORT: '{PORT}' },
    defaultPort: 25565,
    recommendedRamMB: 4096,
    recommendedCpuCores: 2,
    recommendedDiskGB: 20,
    status: 'active',
    isPopular: false,
    sortOrder: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_mc_forge',
    name: 'Forge Modded Server',
    description: 'Standard modding engine supporting heavy modpacks, Pixelmon, and custom launchers.',
    category: 'minecraft',
    icon: 'Hammer',
    runtime: 'minecraft',
    versions: ['1.20.1', '1.19.2', '1.16.5'],
    defaultVersion: '1.20.1',
    startupCommand: 'java -Xms2048M -Xmx{RAM_MB}M @user_jvm_args.txt @libraries/net/minecraftforge/forge/forge-args.txt nogui',
    environmentVars: { EULA: 'true', FORGE_VERSION: '47.2.0', SERVER_PORT: '{PORT}' },
    defaultPort: 25565,
    recommendedRamMB: 6144,
    recommendedCpuCores: 4,
    recommendedDiskGB: 40,
    status: 'active',
    isPopular: true,
    sortOrder: 5,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_bot_python',
    name: 'Python Bot Engine',
    description: 'Preconfigured Python 3.11 environment with pip, virtualenv, and Discord.py/Telethon libraries.',
    category: 'bot',
    icon: 'Terminal',
    runtime: 'python',
    versions: ['Python 3.11', 'Python 3.10', 'Python 3.9'],
    defaultVersion: 'Python 3.11',
    startupCommand: 'python3 main.py',
    environmentVars: { PYTHONUNBUFFERED: '1', BOT_ENV: 'production' },
    defaultPort: 8000,
    recommendedRamMB: 1024,
    recommendedCpuCores: 1,
    recommendedDiskGB: 5,
    status: 'active',
    isPopular: true,
    sortOrder: 6,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_bot_nodejs',
    name: 'Node.js Application / Bot',
    description: 'High-speed V8 JavaScript runtime supporting ES Modules, TypeScript, and PM2 process watchdog.',
    category: 'bot',
    icon: 'Bot',
    runtime: 'nodejs',
    versions: ['Node 20', 'Node 18', 'Node 16'],
    defaultVersion: 'Node 20',
    startupCommand: 'node index.js',
    environmentVars: { NODE_ENV: 'production', PORT: '{PORT}' },
    defaultPort: 3000,
    recommendedRamMB: 1024,
    recommendedCpuCores: 1,
    recommendedDiskGB: 5,
    status: 'active',
    isPopular: true,
    sortOrder: 7,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'tpl_bot_discordjs',
    name: 'Discord.js v14 Ready Bot',
    description: 'Optimized Discord bot template preinstalled with discord.js v14 and Slash Commands framework.',
    category: 'bot',
    icon: 'MessageSquare',
    runtime: 'nodejs',
    versions: ['Node 20', 'Node 18'],
    defaultVersion: 'Node 20',
    startupCommand: 'npm start',
    environmentVars: { DISCORD_TOKEN: '', CLIENT_ID: '', NODE_ENV: 'production' },
    defaultPort: 3000,
    recommendedRamMB: 1024,
    recommendedCpuCores: 1,
    recommendedDiskGB: 5,
    status: 'active',
    isPopular: true,
    sortOrder: 8,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const defaultMarketplaceItems: MarketplaceItem[] = [
  {
    id: 'mkt_mc_paper_120',
    slug: 'paper-minecraft-1204',
    name: 'Paper MC 1.20.4 High Performance',
    description: 'Ultra-optimized Paper Spigot server ready for high player counts, plugins, and custom datapacks.',
    longDescription: 'Paper is a high-performance Minecraft server software designed to fix security, gameplay and performance exploits while providing high compatibility with Spigot and Bukkit plugins.',
    category: 'minecraft',
    icon: 'Gamepad2',
    bannerUrl: 'https://images.unsplash.com/photo-1627856013091-fed6e4e30025?w=600&auto=format&fit=crop&q=80',
    author: 'AetherPanel Core',
    badge: 'official',
    version: '1.20.4-v2',
    changelog: 'Updated Paper build to #496 with Java 21 runtime flags.',
    compatibility: 'Minecraft 1.20.x, Spigot/Paper plugins, All Nodes',
    requirements: {
      minRamMB: 2048,
      minCpuCores: 1,
      minDiskGB: 15,
      notes: 'Recommended 4GB RAM for 15+ simultaneous players.'
    },
    installType: 'template_deploy',
    templateId: 'tpl_mc_paper',
    startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -XX:+UseG1GC -jar server.jar nogui',
    environmentVars: { EULA: 'true', MINECRAFT_VERSION: '1.20.4', SERVER_PORT: '{PORT}' },
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: true,
    securityValidated: true,
    securityNotes: 'Verified official Paper build source. Safe JVM launch args.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mkt_mc_purpur_extreme',
    slug: 'purpur-extreme-tps',
    name: 'Purpur Extreme TPS Optimization Engine',
    description: 'Drop-in Paper replacement with specialized TPS optimizations and custom gameplay mechanics.',
    longDescription: 'Purpur is a fork of Paper focused on extreme performance optimizations, customizable entity tick ratios, and enhanced API capabilities.',
    category: 'minecraft',
    icon: 'Zap',
    bannerUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&auto=format&fit=crop&q=80',
    author: 'PurpurMC Community',
    badge: 'verified',
    version: '1.20.4-p2',
    changelog: 'Added AI tick throttle presets and auto-lag recovery.',
    compatibility: 'Minecraft 1.20.x, Paper & Bukkit Plugins',
    requirements: {
      minRamMB: 4096,
      minCpuCores: 2,
      minDiskGB: 25,
      notes: 'Optimal for heavy survival servers with custom mobs.'
    },
    installType: 'template_deploy',
    templateId: 'tpl_mc_purpur',
    startupCommand: 'java -Xms512M -Xmx{RAM_MB}M -XX:+UseG1GC -jar purpur.jar nogui',
    environmentVars: { EULA: 'true', PURPUR_VERSION: '1.20.4', SERVER_PORT: '{PORT}' },
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: true,
    securityValidated: true,
    securityNotes: 'Scanned binary hash verified against PurpurMC repository.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mkt_bot_discord_mod',
    slug: 'discord-moderation-music-bot',
    name: 'Discord.js v14 Moderation & Music Suite',
    description: 'Turnkey Discord bot with slash commands, auto-moderation, level system, and high quality audio player.',
    longDescription: 'Complete Node.js Discord bot template with modular command handlers, SQLite storage, voice channel audio streaming, and ticket support system.',
    category: 'bot',
    icon: 'Bot',
    bannerUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
    author: 'AetherPanel Labs',
    badge: 'official',
    version: '2.4.0',
    changelog: 'Upgraded to discord.js v14.14 with embed builders.',
    compatibility: 'Node.js 20+, Discord REST API v10',
    requirements: {
      minRamMB: 1024,
      minCpuCores: 1,
      minDiskGB: 5,
      notes: 'Requires Discord Bot Token from Discord Developer Portal.'
    },
    installType: 'template_deploy',
    templateId: 'tpl_bot_discordjs',
    startupCommand: 'npm start',
    environmentVars: { DISCORD_TOKEN: '', CLIENT_ID: '', NODE_ENV: 'production' },
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: true,
    securityValidated: true,
    securityNotes: 'Validated npm lockfile. Secrets stored in process environment variables.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mkt_bot_python_telethon',
    slug: 'python-telegram-automation-bot',
    name: 'Python Telethon Automation & Channel Bot',
    description: 'Python 3.11 bot powered by Telethon & Asyncio for managing Telegram groups and channels.',
    longDescription: 'High performance Telegram userbot / bot framework with command router, message scheduler, media downloader, and admin dashboard integrations.',
    category: 'bot',
    icon: 'Terminal',
    author: 'PyTelegram Devs',
    badge: 'verified',
    version: '1.8.2',
    changelog: 'Added async session reconnect watchdog.',
    compatibility: 'Python 3.10+, Telegram API',
    requirements: {
      minRamMB: 1024,
      minCpuCores: 1,
      minDiskGB: 5
    },
    installType: 'template_deploy',
    templateId: 'tpl_bot_python',
    startupCommand: 'python3 main.py',
    environmentVars: { API_ID: '', API_HASH: '', BOT_TOKEN: '' },
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: false,
    securityValidated: true,
    securityNotes: 'Clean python source code. No unverified binary imports.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mkt_tpl_express_ws',
    slug: 'nodejs-express-websocket-template',
    name: 'Node.js 20 Express & WebSockets App',
    description: 'Production-ready Node.js full-stack application template with Express, ws WebSockets, and health checks.',
    longDescription: 'Clean backend architecture with CORS, rate limiting, structured logging, health endpoints, and graceful shutdown handlers.',
    category: 'template',
    icon: 'Cpu',
    author: 'AetherPanel Staff',
    badge: 'official',
    version: '1.5.0',
    changelog: 'Added ESM module support and custom middleware pipeline.',
    compatibility: 'Node 18+, Node 20+, All Nodes',
    requirements: {
      minRamMB: 1024,
      minCpuCores: 1,
      minDiskGB: 5
    },
    installType: 'template_deploy',
    templateId: 'tpl_bot_nodejs',
    startupCommand: 'node index.js',
    environmentVars: { NODE_ENV: 'production', PORT: '{PORT}' },
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: true,
    securityValidated: true,
    securityNotes: 'Sandboxed Node.js environment with non-root runtime target.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mkt_tool_backup_sync',
    slug: 's3-auto-sync-backup-tool',
    name: 'Server Backup & S3 Cloud Sync Tool',
    description: 'Automated script utility to archive server worlds/files and upload directly to S3 / Cloud storage.',
    longDescription: 'Lightweight shell & python utility that compresses server state, calculates SHA256 checksums, and syncs to S3 bucket or remote node storage.',
    category: 'tool',
    icon: 'Archive',
    author: 'AetherPanel DevOps',
    badge: 'official',
    version: '1.2.0',
    changelog: 'Added multi-part zip compression and progress logging.',
    compatibility: 'Minecraft, Node, Python, All Server Types',
    requirements: {
      minRamMB: 512,
      minCpuCores: 1,
      minDiskGB: 2,
      notes: 'Requires S3 Access Keys or Local Backup permission.'
    },
    installType: 'resource_install',
    startupCommand: 'python3 s3_backup.py',
    environmentVars: { S3_BUCKET: '', S3_REGION: '', RETENTION_DAYS: '7' },
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: false,
    securityValidated: true,
    securityNotes: 'Restricted script runtime. No elevated sudo privileges needed.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mkt_util_rcon_cli',
    slug: 'rcon-cli-manager',
    name: 'RCON Command & Automation Manager',
    description: 'Interactive CLI and web utility for executing batch RCON commands across Minecraft servers.',
    longDescription: 'Utility tool for server operators to schedule automated announcements, item give commands, or broadcast alerts via RCON protocol.',
    category: 'utility',
    icon: 'Terminal',
    author: 'AetherPanel Utility',
    badge: 'official',
    version: '1.0.1',
    changelog: 'Initial official release.',
    compatibility: 'Minecraft Paper / Spigot / Forge / Bedrock RCON',
    requirements: {
      minRamMB: 256,
      minCpuCores: 0.5,
      minDiskGB: 1
    },
    installType: 'resource_install',
    downloadsCount: 0,
    rating: 0,
    reviewsCount: 0,
    reviews: [],
    status: 'active',
    isFeatured: false,
    securityValidated: true,
    securityNotes: 'Encrypted RCON credentials in local memory.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const defaultStatusComponents: StatusComponent[] = [
  {
    id: 'comp_panel',
    name: 'Control Panel Web UI',
    type: 'panel',
    description: 'AetherPanel NextGen Web Client, User Portal & Admin Console',
    group: 'Core Platform',
    status: 'operational',
    uptimePercent90Days: 99.99,
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 12,
    details: 'Serving via high-speed Edge CDN with HTTP/2 and zero latency spikes.',
    order: 1,
    isPublic: true
  },
  {
    id: 'comp_api',
    name: 'API Gateway & Daemon Stream',
    type: 'api',
    description: 'REST API, WebSocket daemon broker & real-time telemetry stream',
    group: 'Core Platform',
    status: 'operational',
    uptimePercent90Days: 99.98,
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 18,
    details: 'WebSocket streaming and API response times under 25ms nominal.',
    order: 2,
    isPublic: true
  },
  {
    id: 'comp_database',
    name: 'Database Cluster',
    type: 'database',
    description: 'Primary transactional storage, user state, and server registry',
    group: 'Core Platform',
    status: 'operational',
    uptimePercent90Days: 100.0,
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 4,
    details: 'Zero replication lag, read/write I/O performance nominal.',
    order: 3,
    isPublic: true
  },
  {
    id: 'comp_storage',
    name: 'Local NVMe & Object Storage',
    type: 'storage',
    description: 'High IOPS NVMe server disks, automated backups & snapshot cluster',
    group: 'Storage Subsystems',
    status: 'operational',
    uptimePercent90Days: 99.95,
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 8,
    details: 'ZFS/Btrfs pools healthy with ample storage reserve.',
    order: 4,
    isPublic: true
  },
  {
    id: 'comp_discord',
    name: 'Discord Bot & Webhook Relay',
    type: 'discord',
    description: 'Two-way Discord command bridge, console stream & server notifications',
    group: 'External Integrations',
    status: 'operational',
    uptimePercent90Days: 99.92,
    lastCheckedAt: new Date().toISOString(),
    latencyMs: 35,
    details: 'Gateway connection established with Discord API.',
    order: 5,
    isPublic: true
  }
];

export const defaultAlertRules: AlertRule[] = [
  {
    id: 'rule_node_offline',
    name: 'Node Daemon Offline / Unreachable',
    targetType: 'node',
    targetId: 'all',
    metric: 'status_offline',
    threshold: 1,
    durationMinutes: 1,
    cooldownMinutes: 15,
    notificationChannel: 'all',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_node_high_cpu',
    name: 'High Compute Node CPU Load (>90%)',
    targetType: 'node',
    targetId: 'all',
    metric: 'cpu_high',
    threshold: 90,
    durationMinutes: 10,
    cooldownMinutes: 30,
    notificationChannel: 'all',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_node_high_ram',
    name: 'High Compute Node RAM Usage (>92%)',
    targetType: 'node',
    targetId: 'all',
    metric: 'ram_high',
    threshold: 92,
    durationMinutes: 10,
    cooldownMinutes: 30,
    notificationChannel: 'all',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_server_crash',
    name: 'Game/Bot Server Abnormal Exit or Crash',
    targetType: 'server',
    targetId: 'all',
    metric: 'server_crashed',
    threshold: 1,
    durationMinutes: 1,
    cooldownMinutes: 10,
    notificationChannel: 'discord',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rule_storage_high',
    name: 'Node NVMe Disk Capacity Alert (>88%)',
    targetType: 'storage',
    targetId: 'all',
    metric: 'disk_high',
    threshold: 88,
    durationMinutes: 15,
    cooldownMinutes: 60,
    notificationChannel: 'panel',
    isEnabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const defaultIncidents: Incident[] = [
  {
    id: 'inc_sample_1',
    title: 'Upstream Transit Latency on Asia-Pacific Route',
    description: 'We observed brief packet loss and elevated latency on regional routing paths through Singapore. Traffic was rerouted via backup Tier-1 carriers.',
    status: 'resolved',
    severity: 'minor',
    affectedComponents: ['comp_api', 'Singapore Compute Cluster'],
    timeline: [
      {
        id: 'inc_upd_3',
        status: 'resolved',
        message: 'All transit routes stabilized. Network jitter and packet loss returned to baseline nominal values.',
        timestamp: new Date(Date.now() - 36 * 3600000).toISOString()
      },
      {
        id: 'inc_upd_2',
        status: 'monitoring',
        message: 'Traffic successfully rerouted through secondary BGP transits. Monitoring packet loss metrics.',
        timestamp: new Date(Date.now() - 38 * 3600000).toISOString()
      },
      {
        id: 'inc_upd_1',
        status: 'investigating',
        message: 'Engineers are investigating elevated latency reports from APAC users.',
        timestamp: new Date(Date.now() - 40 * 3600000).toISOString()
      }
    ],
    startedAt: new Date(Date.now() - 40 * 3600000).toISOString(),
    resolvedAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    isPublic: true
  }
];

export const defaultScheduledMaintenances: ScheduledMaintenance[] = [
  {
    id: 'maint_sample_1',
    title: 'Scheduled Hypervisor Kernel & Security Upgrades',
    description: 'Routine Linux kernel live-patching and security enhancements across compute nodes. No downtime is expected for existing instances.',
    affectedComponents: ['Compute Nodes Cluster', 'API Gateway & Daemon Stream'],
    scheduledStartTime: new Date(Date.now() + 48 * 3600000).toISOString(),
    scheduledEndTime: new Date(Date.now() + 50 * 3600000).toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString()
  }
];

let dbCache: DatabaseSchema | null = null;


export async function getDb(): Promise<DatabaseSchema> {
  if (dbCache) return dbCache;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const adminEmail = process.env.AETHER_ADMIN_EMAIL || 'admin@aetherpanel.in';
  const adminPassword = process.env.AETHER_ADMIN_PASSWORD || 'adminopp';

  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      dbCache = JSON.parse(raw);

      if (!dbCache!.locations || dbCache!.locations.length === 0) {
        dbCache!.locations = defaultLocations;
      }
      if (!dbCache!.templates || dbCache!.templates.length === 0) {
        dbCache!.templates = defaultTemplates;
      }
      if (!dbCache!.nodeInstallTokens) {
        dbCache!.nodeInstallTokens = [];
      }
      if (!dbCache!.ads) {
        dbCache!.ads = [
          {
            id: 'ad_aether_pro',
            title: 'Aether Pro Infrastructure',
            description: 'Upgrade to dedicated NVMe node clusters with guaranteed 99.99% uptime and DDoS protection.',
            imageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
            destinationUrl: '/pricing',
            type: 'banner',
            placement: 'dashboard',
            priority: 10,
            frequencyCapPerSession: 5,
            isActive: true,
            impressions: 42,
            clicks: 5,
            createdAt: new Date().toISOString()
          },
          {
            id: 'ad_discord_bot',
            title: 'Deploy High-Speed Discord Bots',
            description: 'Run Python 3.11 & Node.js 20 bots with instant 24/7 process uptime starting at $0/mo.',
            destinationUrl: '/bot',
            type: 'card',
            placement: 'server_list',
            priority: 5,
            frequencyCapPerSession: 3,
            isActive: true,
            impressions: 28,
            clicks: 3,
            createdAt: new Date().toISOString()
          }
        ];
      }
      if (!dbCache!.adEvents) {
        dbCache!.adEvents = [];
      }
      if (!dbCache!.afkSessions) {
        dbCache!.afkSessions = [];
      }
      if (!dbCache!.rewardTransactions) {
        dbCache!.rewardTransactions = [];
      }
      if (!dbCache!.afkSettings) {
        dbCache!.afkSettings = {
          enabled: true,
          creditsPerInterval: 5,
          intervalMinutes: 10,
          dailyMaxCredits: 100,
          weeklyMaxCredits: 500,
          minAccountAgeDays: 0
        };
      }
      if (!dbCache!.settings) {
        dbCache!.settings = {
          brandName: 'AetherPanel',
          brandTagline: 'Next-Generation Cloud Platform',
          supportEmail: 'support@aetherpanel.com',
          discordUrl: 'https://discord.gg/aetherpanel',
          currencySymbol: '$',
          currencyCode: 'USD',
          registrationEnabled: true,
          emailVerificationRequired: false,
          maintenanceMode: false,
          maintenanceMessage: 'Under maintenance',
          defaultTheme: 'dark',
          accentColor: '#8b5cf6'
        };
      }
      if (!dbCache!.settings.paymentGateways) {
        dbCache!.settings.paymentGateways = {
          upi: {
            enabled: true,
            upiId: 'aetherpay@upi',
            merchantName: 'AetherPanel Hosting',
            qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80',
            instructions: 'Scan the QR code or send payment to the UPI ID. Enter the 12-digit UTR or Transaction Ref ID after payment.'
          },
          bank: {
            enabled: true,
            bankName: 'HDFC Bank / Global Web Bank',
            accountNumber: '918237192837',
            ifsc: 'HDFC0001234',
            accountHolder: 'Aether Cloud Infrastructure LLC',
            instructions: 'Transfer to Bank Account and submit your NEFT/IMPS/Wire Reference Number.'
          },
          crypto: {
            enabled: false,
            walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
            network: 'USDT (TRC20 / ERC20)',
            instructions: 'Send USDT to the wallet address and submit TX Hash.'
          },
          stripe: {
            enabled: true,
            instructions: 'Instant automatic payment via Credit/Debit Card or Wallet.'
          }
        };
      }

      // Filter out demo user and demo customer data
      const demoUserIds = ['usr_demo', 'usr_demo_customer'];
      const demoEmails = ['demo@aetherpanel.com', 'demo@example.com'];

      dbCache!.users = dbCache!.users.filter(u => !demoUserIds.includes(u.id) && !demoEmails.includes(u.email));
      dbCache!.servers = dbCache!.servers.filter(s => !demoUserIds.includes(s.userId));
      dbCache!.orders = dbCache!.orders.filter(o => !demoUserIds.includes(o.userId));
      dbCache!.tickets = dbCache!.tickets.filter(t => !demoUserIds.includes(t.userId));

      // Filter out fake demo nodes if any existed
      const fakeNodeIds = ['node_us_east', 'node_eu_central', 'node_ap_southeast', 'demo_node', 'test_node'];
      dbCache!.nodes = dbCache!.nodes.filter(n => !fakeNodeIds.includes(n.id) && !n.name.toLowerCase().includes('demo') && !n.name.toLowerCase().includes('test'));

      // If no node remains, auto create Local Node with auto-detected OS hardware telemetry
      if (dbCache!.nodes.length === 0) {
        const hostRamMB = Math.round(os.totalmem() / (1024 * 1024));
        const hostCpuCores = os.cpus()?.length || 4;
        const hostName = os.hostname() || 'local-vps';

        const localNode: Node = {
          id: 'node_local',
          name: 'Local Node',
          hostname: hostName,
          ip: '127.0.0.1',
          fqdn: hostName,
          daemonPort: 8080,
          sftpPort: 2022,
          location: 'local',
          locationName: 'Primary Control Plane VPS',
          flagCode: 'LOCAL',
          totalRamMB: hostRamMB,
          usedRamMB: 0,
          totalCpuCores: hostCpuCores,
          usedCpuCores: 0,
          totalDiskGB: 200,
          usedDiskGB: 5,
          reservedRamMB: 2048,
          reservedCpuCores: 1,
          reservedDiskGB: 10,
          ramOverallocatePercent: 0,
          cpuOverallocatePercent: 0,
          diskOverallocatePercent: 0,
          maxServers: 100,
          allowedProducts: ['prod_minecraft', 'prod_bot'],
          status: 'online',
          isMaintenanceMode: false,
          isLocalNode: true,
          serverCount: dbCache!.servers.length,
          daemonToken: 'daemon_token_local_node_secret_82910',
          lastHeartbeatAt: new Date().toISOString(),
          isSecure: true
        };
        dbCache!.nodes.push(localNode);
      }

      // Ensure primary admin account exists with admin@aetherpanel.in
      let admin = dbCache!.users.find(u => u.role === 'super_admin' || u.role === 'admin' || u.email === 'admin@aetherpanel.com' || u.email === adminEmail);
      if (!admin) {
        const adminHash = bcrypt.hashSync(adminPassword, 10);
        admin = {
          id: 'usr_admin',
          username: 'admin',
          displayName: 'Aether Administrator',
          email: adminEmail,
          role: 'super_admin',
          avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
          isSuspended: false,
          emailVerified: true,
          twoFactorEnabled: false,
          mustChangePassword: true,
          credits: 500.0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        dbCache!.users.unshift(admin);
        dbCache!.passwords[admin.id] = adminHash;
      } else {
        admin.email = adminEmail;
        admin.username = 'admin';
        // Always ensure password for primary admin is set to configured adminPassword unless updated
        dbCache!.passwords[admin.id] = bcrypt.hashSync(adminPassword, 10);
      }
      delete dbCache!.passwords['usr_demo'];

      dbCache!.nodes.forEach(n => {
        if (n.daemonPort === undefined) n.daemonPort = 8080;
        if (n.sftpPort === undefined) n.sftpPort = 2022;
        if (n.ramOverallocatePercent === undefined) n.ramOverallocatePercent = 0;
        if (n.cpuOverallocatePercent === undefined) n.cpuOverallocatePercent = 0;
        if (n.diskOverallocatePercent === undefined) n.diskOverallocatePercent = 0;
        if (n.maxServers === undefined) n.maxServers = 100;
        if (!n.allowedProducts) n.allowedProducts = ['prod_minecraft', 'prod_bot'];
        if (!n.lastHeartbeatAt) n.lastHeartbeatAt = new Date().toISOString();
      });

      if (!dbCache!.marketplaceItems || dbCache!.marketplaceItems.length === 0) {
        dbCache!.marketplaceItems = defaultMarketplaceItems;
      }
      if (!dbCache!.statusComponents || dbCache!.statusComponents.length === 0) {
        dbCache!.statusComponents = defaultStatusComponents;
      }
      if (!dbCache!.incidents) {
        dbCache!.incidents = defaultIncidents;
      }
      if (!dbCache!.scheduledMaintenances) {
        dbCache!.scheduledMaintenances = defaultScheduledMaintenances;
      }
      if (!dbCache!.alertRules || dbCache!.alertRules.length === 0) {
        dbCache!.alertRules = defaultAlertRules;
      }
      if (!dbCache!.alertIncidents) {
        dbCache!.alertIncidents = [];
      }
      if (!dbCache!.telemetryHistory) {
        dbCache!.telemetryHistory = {};
      }
      if (!dbCache!.apiKeys) {
        dbCache!.apiKeys = [];
      }
      if (!dbCache!.webhooks) {
        dbCache!.webhooks = [];
      }

      saveDbSync();
      return dbCache!;
    } catch (e) {
      console.error('Error reading db.json, generating default database:', e);
    }
  }

  // Generate initial database
  dbCache = await generateInitialDb();
  saveDbSync();
  return dbCache;
}

export function saveDbSync(): void {
  if (!dbCache) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
}

export async function saveDb(): Promise<void> {
  saveDbSync();
}

async function generateInitialDb(): Promise<DatabaseSchema> {
  const adminEmail = process.env.AETHER_ADMIN_EMAIL || 'admin@aetherpanel.in';
  const adminPassword = process.env.AETHER_ADMIN_PASSWORD || 'adminopp';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const adminUser: User = {
    id: 'usr_admin',
    username: 'admin',
    displayName: 'Aether Administrator',
    email: adminEmail,
    role: 'super_admin',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isSuspended: false,
    emailVerified: true,
    twoFactorEnabled: false,
    mustChangePassword: true,
    credits: 500.0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const products: Product[] = [
    {
      id: 'prod_minecraft',
      slug: 'minecraft',
      name: 'Minecraft Hosting',
      description: 'High-performance Minecraft server hosting powered by high clock-speed AMD Ryzen CPU nodes and NVMe SSDs.',
      category: 'minecraft',
      icon: 'Gamepad2',
      isActive: true,
      sortOrder: 1
    },
    {
      id: 'prod_bot',
      slug: 'bot',
      name: 'Discord Bot Hosting',
      description: '24/7 persistent process hosting for Discord, Telegram, and Twitch bots supporting Node.js, Python, and Bun.',
      category: 'bot',
      icon: 'Bot',
      isActive: true,
      sortOrder: 2
    }
  ];

  const plans: Plan[] = [
    // Minecraft Plans
    {
      id: 'plan_mc_free',
      productId: 'prod_minecraft',
      name: 'Free Tier',
      description: 'Free plan for testing, small survival worlds, and plugins.',
      priceMonthly: 0.00,
      priceYearly: 0.00,
      ramMB: 1024,
      cpuCores: 1,
      diskGB: 10,
      backupLimit: 1,
      databaseLimit: 1,
      serverLimit: 1,
      networkMbps: 1000,
      features: ['1GB DDR5 RAM', '1 vCPU Ryzen 9', '10GB NVMe Storage', 'Subdomain Included', 'Free Forever'],
      locations: ['local'],
      isActive: true
    },
    {
      id: 'plan_mc_starter',
      productId: 'prod_minecraft',
      name: 'Starter Tier',
      description: 'Ideal for small friend groups & vanilla survival worlds.',
      priceMonthly: 19.00,
      priceYearly: 190.00,
      ramMB: 2048,
      cpuCores: 1.5,
      diskGB: 20,
      backupLimit: 2,
      databaseLimit: 1,
      serverLimit: 1,
      networkMbps: 1000,
      features: ['2GB DDR5 RAM', '1.5 vCPU Ryzen 9', '20GB NVMe Storage', 'Subdomain Included', '2 Backups'],
      locations: ['local'],
      isActive: true
    },
    {
      id: 'plan_mc_basic',
      productId: 'prod_minecraft',
      name: 'Basic Tier',
      description: 'Great for small community servers & light plugin setups.',
      priceMonthly: 39.00,
      priceYearly: 390.00,
      ramMB: 3072,
      cpuCores: 2,
      diskGB: 30,
      backupLimit: 3,
      databaseLimit: 2,
      serverLimit: 2,
      networkMbps: 1000,
      features: ['3GB DDR5 RAM', '2 vCPU Ryzen 9', '30GB NVMe Storage', 'Custom Subdomain', '3 Backups', '2 MySQL DBs'],
      locations: ['local'],
      isActive: true
    },
    {
      id: 'plan_mc_pro',
      productId: 'prod_minecraft',
      name: 'Pro Tier',
      description: 'Recommended for heavily modded servers, Paper, and Purpur networks.',
      priceMonthly: 69.00,
      priceYearly: 690.00,
      ramMB: 4096,
      cpuCores: 3,
      diskGB: 50,
      backupLimit: 5,
      databaseLimit: 3,
      serverLimit: 3,
      networkMbps: 2500,
      features: ['4GB DDR5 RAM', '3 vCPU Ryzen 9', '50GB NVMe Storage', 'DDoS Protection', '5 Backups', '3 MySQL DBs'],
      locations: ['local'],
      isPopular: true,
      isActive: true
    },
    {
      id: 'plan_mc_advanced',
      productId: 'prod_minecraft',
      name: 'Advanced Network',
      description: 'Maximum performance for large networks and Forge/Fabric modpacks.',
      priceMonthly: 99.00,
      priceYearly: 990.00,
      ramMB: 6144,
      cpuCores: 4,
      diskGB: 75,
      backupLimit: 10,
      databaseLimit: 5,
      serverLimit: 5,
      networkMbps: 10000,
      features: ['6GB DDR5 RAM', '4 vCPU Ryzen 9', '75GB NVMe Storage', '10 Backups', '5 MySQL DBs', 'VIP Support'],
      locations: ['local'],
      isActive: true
    },

    // Bot Hosting Plans
    {
      id: 'plan_bot_free',
      productId: 'prod_bot',
      name: 'Free Bot Tier',
      description: 'Free 24/7 process hosting for Discord, Telegram, and Twitch bots.',
      priceMonthly: 0.00,
      priceYearly: 0.00,
      ramMB: 512,
      cpuCores: 0.5,
      diskGB: 5,
      backupLimit: 1,
      databaseLimit: 1,
      serverLimit: 1,
      networkMbps: 1000,
      features: ['512MB RAM', '0.5 vCPU', '5GB Storage', 'Node.js & Python 3', '24/7 Process Manager'],
      locations: ['local'],
      isActive: true
    },
    {
      id: 'plan_bot_starter',
      productId: 'prod_bot',
      name: 'Bot Starter',
      description: 'Perfect for single-sharded Discord bots.',
      priceMonthly: 9.00,
      priceYearly: 90.00,
      ramMB: 1024,
      cpuCores: 0.75,
      diskGB: 10,
      backupLimit: 1,
      databaseLimit: 1,
      serverLimit: 1,
      networkMbps: 1000,
      features: ['1GB RAM', '0.75 vCPU', '10GB Storage', 'Node.js & Python', '24/7 Auto-restart'],
      locations: ['local'],
      isActive: true
    },
    {
      id: 'plan_bot_basic',
      productId: 'prod_bot',
      name: 'Bot Basic',
      description: 'Great for multi-function moderation and music bots.',
      priceMonthly: 19.00,
      priceYearly: 190.00,
      ramMB: 2048,
      cpuCores: 1,
      diskGB: 20,
      backupLimit: 2,
      databaseLimit: 1,
      serverLimit: 2,
      networkMbps: 1000,
      features: ['2GB RAM', '1 vCPU', '20GB Storage', 'Node.js, Python, Bun', '2 Backups'],
      locations: ['local'],
      isActive: true
    },
    {
      id: 'plan_bot_pro',
      productId: 'prod_bot',
      name: 'Bot Pro',
      description: 'For high-traffic, multi-server bots and database-backed bots.',
      priceMonthly: 39.00,
      priceYearly: 390.00,
      ramMB: 4096,
      cpuCores: 2,
      diskGB: 40,
      backupLimit: 3,
      databaseLimit: 2,
      serverLimit: 3,
      networkMbps: 1000,
      features: ['4GB RAM', '2 vCPU', '40GB Storage', 'Node.js, Python, Bun', '3 Backups', '2 Databases'],
      locations: ['local'],
      isPopular: true,
      isActive: true
    },
    {
      id: 'plan_bot_advanced',
      productId: 'prod_bot',
      name: 'Bot Advanced',
      description: 'Enterprise tier for large Discord bot networks.',
      priceMonthly: 69.00,
      priceYearly: 690.00,
      ramMB: 6144,
      cpuCores: 3,
      diskGB: 60,
      backupLimit: 5,
      databaseLimit: 3,
      serverLimit: 5,
      networkMbps: 2500,
      features: ['6GB RAM', '3 vCPU', '60GB Storage', 'Node.js, Python, Bun', '5 Backups', '3 Databases'],
      locations: ['local'],
      isActive: true
    }
  ];

  const hostRamMB = Math.round(os.totalmem() / (1024 * 1024));
  const hostCpuCores = os.cpus()?.length || 4;
  const hostName = os.hostname() || 'local-vps';

  const nodes: Node[] = [
    {
      id: 'node_local',
      name: 'Local Node',
      hostname: hostName,
      ip: '127.0.0.1',
      fqdn: hostName,
      daemonPort: 8080,
      sftpPort: 2022,
      location: 'local',
      locationName: 'Primary Control Plane VPS',
      flagCode: 'LOCAL',
      totalRamMB: hostRamMB,
      usedRamMB: 0,
      totalCpuCores: hostCpuCores,
      usedCpuCores: 0,
      totalDiskGB: 200,
      usedDiskGB: 5,
      reservedRamMB: 2048,
      reservedCpuCores: 1,
      reservedDiskGB: 10,
      ramOverallocatePercent: 0,
      cpuOverallocatePercent: 0,
      diskOverallocatePercent: 0,
      maxServers: 100,
      allowedProducts: ['prod_minecraft', 'prod_bot'],
      status: 'online',
      isMaintenanceMode: false,
      isLocalNode: true,
      serverCount: 0,
      daemonToken: 'daemon_token_local_node_secret_82910',
      lastHeartbeatAt: new Date().toISOString(),
      isSecure: true
    }
  ];

  const allocations: Allocation[] = [
    { id: 'alloc_1', nodeId: 'node_us_east', ip: '104.22.14.88', port: 25565, serverId: 'srv_survival', isAssigned: true },
    { id: 'alloc_2', nodeId: 'node_us_east', ip: '104.22.14.88', port: 25566, isAssigned: false },
    { id: 'alloc_3', nodeId: 'node_us_east', ip: '104.22.14.88', port: 3000, serverId: 'srv_discord_bot', isAssigned: true },
    { id: 'alloc_4', nodeId: 'node_eu_central', ip: '185.120.44.12', port: 25565, isAssigned: false },
    { id: 'alloc_5', nodeId: 'node_ap_southeast', ip: '139.180.201.5', port: 25565, isAssigned: false }
  ];

  const servers: Server[] = [
    {
      id: 'srv_survival',
      name: 'Survival SMP - Season 2',
      userId: 'usr_demo',
      productId: 'prod_minecraft',
      planId: 'plan_mc_pro',
      nodeId: 'node_us_east',
      status: 'running',
      primaryIp: '104.22.14.88',
      primaryPort: 25565,
      location: 'Ashburn, VA',
      software: 'Paper',
      version: '1.20.4',
      limits: {
        ramMB: 8192,
        cpuCores: 4,
        diskGB: 60,
        backups: 5,
        databases: 3
      },
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      cpuUsage: 18.5,
      ramUsageMB: 3420,
      diskUsageMB: 8400,
      uptimeSeconds: 142000
    },
    {
      id: 'srv_discord_bot',
      name: 'Community Moderation Bot',
      userId: 'usr_demo',
      productId: 'prod_bot',
      planId: 'plan_bot_pro',
      nodeId: 'node_us_east',
      status: 'running',
      primaryIp: '104.22.14.88',
      primaryPort: 3000,
      location: 'Ashburn, VA',
      software: 'Node.js',
      version: 'Node 20',
      limits: {
        ramMB: 2048,
        cpuCores: 1.5,
        diskGB: 15,
        backups: 3,
        databases: 2
      },
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
      cpuUsage: 2.1,
      ramUsageMB: 184,
      diskUsageMB: 450,
      uptimeSeconds: 89000
    }
  ];

  const backups: ServerBackup[] = [
    {
      id: 'bk_1',
      serverId: 'srv_survival',
      name: 'Pre-World-Reset-Backup.tar.gz',
      sizeMB: 1420,
      status: 'COMPLETED',
      type: 'manual',
      storageProvider: 'local',
      checksum: 'sha256_8a9f31c0e2',
      createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const databases: ServerDatabase[] = [
    {
      id: 'db_1',
      serverId: 'srv_survival',
      name: 's2_luckperms_db',
      username: 'u_s2_luckperms',
      host: 'node-us1.aetherpanel.com',
      port: 3306,
      dbType: 'mysql',
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString()
    }
  ];

  const schedules: ServerSchedule[] = [
    {
      id: 'sch_1',
      serverId: 'srv_survival',
      name: 'Daily 4 AM World Save & Restart',
      cronExpression: '0 4 * * *',
      scheduleType: 'daily',
      action: 'restart',
      isEnabled: true,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      lastRunAt: new Date(Date.now() - 14 * 3600000).toISOString(),
      nextRunAt: new Date(Date.now() + 10 * 3600000).toISOString()
    }
  ];

  const activities: ServerActivity[] = [
    {
      id: 'act_1',
      serverId: 'srv_survival',
      userId: 'usr_demo',
      username: 'demouser',
      action: 'SERVER_START',
      details: 'Started Minecraft server instance',
      createdAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];

  const orders: Order[] = [
    {
      id: 'ord_1001',
      userId: 'usr_demo',
      userEmail: 'demo@aetherpanel.com',
      planId: 'plan_mc_pro',
      planName: 'Minecraft Pro Tier',
      billingCycle: 'monthly',
      amount: 14.99,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'Credit Card (Stripe)',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
      id: 'ord_1002',
      userId: 'usr_demo',
      userEmail: 'demo@aetherpanel.com',
      planId: 'plan_bot_pro',
      planName: 'Discord Bot Pro Tier',
      billingCycle: 'monthly',
      amount: 4.99,
      currency: 'USD',
      status: 'paid',
      paymentMethod: 'PayPal',
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString()
    }
  ];

  const coupons: Coupon[] = [
    {
      id: 'coup_welcome20',
      code: 'WELCOME20',
      discountType: 'percent',
      discountValue: 20,
      usageLimit: 100,
      timesUsed: 14,
      isActive: true
    },
    {
      id: 'coup_AETHER50',
      code: 'AETHER50',
      discountType: 'percent',
      discountValue: 50,
      usageLimit: 10,
      timesUsed: 2,
      isActive: true
    }
  ];

  const tickets: SupportTicket[] = [
    {
      id: 'tkt_101',
      userId: 'usr_demo',
      userName: 'Alex Rivers',
      userEmail: 'demo@aetherpanel.com',
      subject: 'Question regarding custom Java flags',
      category: 'Minecraft Configuration',
      priority: 'medium',
      status: 'answered',
      messages: [
        {
          id: 'msg_1',
          senderId: 'usr_demo',
          senderName: 'Alex Rivers',
          senderRole: 'user',
          message: 'Hi team, how can I add Aikar\'s flags to my Minecraft Paper server startup options?',
          createdAt: new Date(Date.now() - 2 * 3600000).toISOString()
        },
        {
          id: 'msg_2',
          senderId: 'usr_admin',
          senderName: 'Aether Support Specialist',
          senderRole: 'super_admin',
          message: 'Hello Alex! You can easily toggle or customize Aikar\'s optimized JVM flags under the "Startup Configuration" tab on your server management dashboard.',
          createdAt: new Date(Date.now() - 1 * 3600000).toISOString()
        }
      ],
      createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 3600000).toISOString()
    }
  ];

  const announcements: Announcement[] = [
    {
      id: 'ann_1',
      title: 'AetherPanel v2.4 Platform Upgrade',
      content: 'We have upgraded all US East and EU Central nodes with AMD Ryzen 9 7950X processors and DDR5 ECC RAM for 35% higher TPS in Minecraft and sub-millisecond bot response times!',
      type: 'update',
      isPublished: true,
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 'ann_2',
      title: 'Scheduled Node Maintenance - AP South',
      content: 'Routine firmware updates on AP South (Singapore) node scheduled for Sunday at 02:00 UTC. Expected downtime under 3 minutes.',
      type: 'maintenance',
      isPublished: true,
      createdAt: new Date(Date.now() - 86400000 * 5).toISOString()
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      actorId: 'usr_admin',
      actorEmail: 'admin@aetherpanel.com',
      actorRole: 'super_admin',
      action: 'SYSTEM_INIT',
      targetResource: 'DATABASE',
      details: 'AetherPanel database initialized with security policies.',
      ipAddress: '127.0.0.1',
      createdAt: new Date().toISOString()
    }
  ];

  const settings: SystemSettings = {
    brandName: 'AetherPanel',
    brandTagline: 'Next-Generation Cloud Platform for Minecraft & Bot Infrastructure',
    supportEmail: 'support@aetherpanel.com',
    discordUrl: 'https://discord.gg/aetherpanel',
    currencySymbol: '$',
    currencyCode: 'USD',
    registrationEnabled: true,
    emailVerificationRequired: false,
    maintenanceMode: false,
    maintenanceMessage: 'AetherPanel is currently performing scheduled system upgrades. We will be back online shortly.',
    defaultTheme: 'dark',
    accentColor: '#8b5cf6', // Violet
    paymentGateways: {
      upi: {
        enabled: true,
        upiId: 'aetherpay@upi',
        merchantName: 'AetherPanel Hosting',
        qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80',
        instructions: 'Scan the QR code or send payment to the UPI ID. Enter the 12-digit UTR or Transaction Ref ID after payment.'
      },
      bank: {
        enabled: true,
        bankName: 'HDFC Bank / Global Web Bank',
        accountNumber: '918237192837',
        ifsc: 'HDFC0001234',
        accountHolder: 'Aether Cloud Infrastructure LLC',
        instructions: 'Transfer to Bank Account and submit your NEFT/IMPS/Wire Reference Number.'
      },
      crypto: {
        enabled: false,
        walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
        network: 'USDT (TRC20 / ERC20)',
        instructions: 'Send USDT to the wallet address and submit TX Hash.'
      },
      stripe: {
        enabled: true,
        instructions: 'Instant automatic payment via Credit/Debit Card or Wallet.'
      }
    },
    discordSettings: {
      enabled: true,
      botToken: 'bot_token_secret_aether_live_prod_2026',
      clientId: '109283749281729384',
      clientSecret: 'discord_client_secret_masked',
      redirectUri: 'http://localhost:3000/settings',
      defaultWebhookUrl: 'https://discord.com/api/webhooks/demo/aetherpanel-notifications',
      botStatus: 'online',
      commandRateLimitPerMin: 10,
      defaultNotificationEvents: [
        'SERVER_STARTED',
        'SERVER_STOPPED',
        'SERVER_CRASHED',
        'SERVER_RESTARTED',
        'BACKUP_COMPLETED',
        'BACKUP_FAILED',
        'RESOURCE_WARNING'
      ]
    }
  };

  return {
    users: [adminUser],
    passwords: {
      'usr_admin': adminPasswordHash
    },
    products,
    plans,
    servers: [],
    templates: defaultTemplates,
    locations: defaultLocations,
    nodes,
    nodeInstallTokens: [],
    allocations,
    backups: [],
    databases: [],
    schedules: [],
    activities: [],
    orders: [],
    coupons,
    tickets: [],
    announcements,
    auditLogs,
    settings,
    ads: [],
    adEvents: [],
    afkSessions: [],
    rewardTransactions: [],
    discordLinks: {
      'usr_admin': {
        discordId: '987654321012345678',
        username: 'AlexAdmin#0001',
        globalName: 'Alex (Aether Admin)',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80',
        email: 'admin@aetherpanel.com',
        linkedAt: new Date(Date.now() - 30 * 86400000).toISOString()
      },
      'usr_demo': {
        discordId: '123456789012345678',
        username: 'JohnGamer#1337',
        globalName: 'JohnGamer',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80',
        email: 'demo@aetherpanel.com',
        linkedAt: new Date(Date.now() - 7 * 86400000).toISOString()
      }
    },
    serverDiscordLinks: [
      {
        serverId: 'srv_survival',
        enabled: true,
        webhookUrl: 'https://discord.com/api/webhooks/demo/survival-server-alerts',
        channelName: '#survival-status',
        enabledEvents: [
          'SERVER_STARTED',
          'SERVER_STOPPED',
          'SERVER_CRASHED',
          'SERVER_RESTARTED',
          'BACKUP_COMPLETED',
          'BACKUP_FAILED',
          'RESOURCE_WARNING'
        ],
        mentionRoleId: '112233445566778899',
        cooldownSeconds: 60,
        allowServerCommands: true,
        updatedAt: new Date().toISOString()
      }
    ],
    discordAuditLogs: [
      {
        id: 'aud_disc_1',
        command: '/server status',
        discordUserId: '123456789012345678',
        discordUsername: 'JohnGamer#1337',
        aetherUserId: 'usr_demo',
        aetherUserEmail: 'demo@aetherpanel.com',
        serverId: 'srv_survival',
        serverName: 'Minecraft Survival SMP',
        result: 'success',
        details: 'Status requested via Discord slash command. CPU: 18.5%, RAM: 3.4GB.',
        timestamp: new Date(Date.now() - 3600000).toISOString()
      }
    ],
    afkSettings: {
      enabled: true,
      creditsPerInterval: 5,
      intervalMinutes: 10,
      dailyMaxCredits: 100,
      weeklyMaxCredits: 500,
      minAccountAgeDays: 0
    },
    marketplaceItems: defaultMarketplaceItems,
    statusComponents: defaultStatusComponents,
    incidents: defaultIncidents,
    scheduledMaintenances: defaultScheduledMaintenances,
    alertRules: defaultAlertRules,
    alertIncidents: [],
    telemetryHistory: {},
    apiKeys: [],
    webhooks: []
  };
}

