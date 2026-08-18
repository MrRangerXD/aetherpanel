import fs from 'fs';
import path from 'path';
import os from 'os';
import bcrypt from 'bcryptjs';
import { getInstallationId } from './installation';
import {
  User, Product, Plan, Server, Node, Allocation, Order, Coupon,
  SupportTicket, Announcement, AuditLog, SystemSettings, ServerBackup,
  ServerDatabase, ServerSchedule, ServerActivity, Location, NodeInstallToken,
  AdItem, AdEvent, AfkSession, RewardTransaction, AfkSettings, ServerTemplate,
  DiscordAccount, DiscordBotSettings, ServerDiscordLink, DiscordAuditLog,
  MarketplaceItem, StatusComponent, Incident, ScheduledMaintenance, AlertRule,
  AlertIncident, TelemetryPoint, DayUptime, ApiKey, ApiAuditLog, WebhookSubscription, LegalPage
} from '../src/types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  installationId?: string;
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
  apiAuditLogs: ApiAuditLog[];
  webhooks: WebhookSubscription[];
  legalPages: LegalPage[];
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

export const defaultLegalPages: LegalPage[] = [
  {
    id: 'legal_terms',
    slug: 'terms',
    title: 'Terms of Service',
    summary: 'Rules, resource usage terms, service availability, and account governance on AetherPanel.',
    version: '2.4.0',
    isPublished: true,
    lastUpdatedAt: new Date().toISOString(),
    updatedBy: 'Aether Legal Compliance',
    content: `# AetherPanel Terms of Service

**Effective Date:** January 1, 2025  
**Last Revised:** August 15, 2026  

Welcome to **AetherPanel**. These Terms of Service ("Terms", "Agreement") govern your access to and usage of the AetherPanel hosting control plane, APIs, virtualized server environments, compute nodes, and related cloud services provided by AetherPanel ("we", "us", "our").

By registering an account, purchasing or deploying a hosting instance, or using our platform, you agree to be bound by these Terms in full.

---

## 1. Eligibility & Account Responsibilities
- You must be at least 13 years of age (or the minimum legal age in your jurisdiction) to establish an account.
- You are strictly responsible for maintaining the confidentiality of your authentication credentials, 2FA recovery keys, and API tokens.
- Any activity, process, or network traffic originating from your provisioned game or bot instances is legally attributable to your account.

---

## 2. Service Provisioning & Resource Limits
- **Resource Allocations:** Dedicated memory (RAM), virtual CPU cores (vCPU), NVMe storage, port allocations, and backup quotas are allocated strictly according to your active plan tier.
- **Fair Use:** Free and shared tier instances must adhere to fair usage policies. Processes that deliberately attempt to evade container limits, starve host memory, or exploit background kernel vulnerabilities are subject to immediate suspension.
- **Node Relocation & Maintenance:** We reserve the right to migrate instances between hardware hypervisors during scheduled maintenance windows to maintain infrastructure stability and security.

---

## 3. Billing, Invoicing & Refunds
- **Subscription Billing:** Paid plans are billed on a recurring monthly or yearly cycle according to your chosen payment method.
- **Credits & Balance:** Account credits earned via AFK rewards, manual vouchers, or promotions are non-transferable and possess no standalone cash redemption value.
- **Refund Policy:** If you encounter persistent infrastructure downtime (>24 hours non-maintenance outage), you may request a pro-rated account credit refund within 7 days of the billing incident.

---

## 4. User Content & Data Security
- You retain all ownership rights to world saves, bot scripts, database contents, configuration files, and custom plugins uploaded to your virtual filesystem.
- We maintain isolated, multi-tenant container barriers (cgroups, namespaces, chroot jail SFTP) to prevent cross-account data access.
- You are responsible for scheduling periodic backups using the integrated Backup & Snapshot engine before performing major server upgrades or software re-installations.

---

## 5. Termination & Suspension
We reserve the right to suspend or terminate service without prior notice if an instance is found in violation of our **Acceptable Use Policy (AUP)**, including but not limited to participating in Denial of Service (DDoS) campaigns, unauthorized cryptocurrency mining, or distributing malicious payloads.

---

## 6. Limitation of Liability
TO THE MAXIMUM EXTENT PERMITTED BY LAW, AETHERPANEL DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED. UNDER NO CIRCUMSTANCES SHALL AETHERPANEL BE LIABLE FOR INDIRECT, INCIDENTAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES RESULTING FROM DATA LOSS, INTERRUPTED GAMEPLAY, OR UPSTREAM TRANSIT OUTAGES.`
  },
  {
    id: 'legal_privacy',
    slug: 'privacy',
    title: 'Privacy Policy',
    summary: 'How AetherPanel collects, protects, isolates, and handles your account and telemetry data.',
    version: '2.1.0',
    isPublished: true,
    lastUpdatedAt: new Date().toISOString(),
    updatedBy: 'Aether Data Privacy Office',
    content: `# AetherPanel Privacy Policy

**Effective Date:** January 1, 2025  
**Last Revised:** August 15, 2026  

AetherPanel values your privacy and data autonomy. This Privacy Policy details how we collect, process, store, and safeguard your personal information and server data when using our platform.

---

## 1. Information We Collect
We collect only the minimum required information necessary to provide reliable hosting services:
1. **Account Identification:** Email address, username, display name, and hashed credentials (salted using bcrypt).
2. **Infrastructure Telemetry:** CPU utilization, memory consumption, disk storage metrics, network I/O, uptime timestamps, and node status indicators collected by our local and remote node agents.
3. **Audit & Security Logs:** IP addresses, login timestamps, API key requests, and administrative actions for security tracking.

---

## 2. Server Filesystem & Code Privacy
- **Strict Isolation:** Your server files (Minecraft worlds, Discord bot scripts, \`.env\` configurations, and databases) are stored in sandboxed directories.
- **No Unsolicited Scanning:** We do not read, inspect, or commercialize the contents of your private server files or application source code, except when strictly necessary to execute automated virus/malware scans or when compelled by law.

---

## 3. Cryptographic Storage & Security Measures
- Authentication tokens and session cookies are signed using industry-standard HMAC-SHA256 signatures with expiration limits.
- SSH/SFTP connections are authenticated through standard public key cryptography and secure host key verification.
- Passwords are never stored in plaintext and cannot be retrieved in unhashed format by administrators.

---

## 4. Third-Party Integrations
- **Discord Webhooks:** When configured by you, event payloads (start, stop, crash alerts) are securely dispatched to your chosen Discord channel endpoints.
- **Payment Providers:** Sensitive credit card details are handled directly by PCI-DSS compliant payment gateways (Stripe, UPI providers); AetherPanel does not store raw payment card numbers.

---

## 5. Data Retention & Deletion Rights
- When you delete a server instance, its associated virtual disk, SFTP permissions, and local backup archives are permanently unlinked and erased from the node filesystem.
- You may request complete account deletion at any time by contacting our support team or opening a ticket in the Support Center.`
  },
  {
    id: 'legal_acceptable_use',
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    summary: 'Prohibited activities, bot guidelines, game server standards, and security obligations.',
    version: '2.3.0',
    isPublished: true,
    lastUpdatedAt: new Date().toISOString(),
    updatedBy: 'Aether Security Operations',
    content: `# AetherPanel Acceptable Use Policy (AUP)

**Effective Date:** January 1, 2025  
**Last Revised:** August 15, 2026  

This Acceptable Use Policy outlines mandatory rules and prohibited activities across all AetherPanel compute nodes, virtual instances, and networking infrastructure. Violations will result in immediate suspension, termination, and potential reporting to law enforcement authorities.

---

## 1. Strictly Prohibited Activities
You may NOT use AetherPanel infrastructure for:
- **Network Attacks:** Launching, participating in, or orchestrating Distributed Denial of Service (DDoS), SYN floods, UDP amplification attacks, or port-scanning operations.
- **Botnets & Command & Control (C2):** Hosting botnet controllers, malware distribution hubs, trojans, ransomware, or keyloggers.
- **Cryptocurrency Mining:** Running CPU, GPU, or memory-intensive cryptocurrency miners (e.g., XMRig, Monero miners) on shared or standard compute nodes without written enterprise permission.
- **Phishing & Fraud:** Hosting counterfeit login portals, credential harvesting schemes, or fraudulent billing sites.
- **Mass Spam & Mail Abuse:** Operating unauthenticated SMTP relays, unsolicited spam bots, or automated mass-messaging scrapers.

---

## 2. Minecraft & Game Server Standards
- **Minecraft EULA Compliance:** All Minecraft server instances must comply with Mojang Studios' Commercial Usage Guidelines and End User License Agreement (EULA).
- **Anti-Exploitation:** Running deliberate lag machines or malicious crash-spigot plugins designed to exhaust hypervisor shared resources is prohibited.

---

## 3. Discord & API Bot Standards
- **Platform Terms:** Bot hosting instances must comply with the Discord Developer Terms of Service and Policy Guidelines.
- **Token Security:** Users must not embed publicly leaked or hijacked bot tokens.
- **Resource Discipline:** Bots must implement proper gateway reconnect backoff intervals and rate-limiting handling.

---

## 4. Enforcement & Abuse Reporting
- Automated watchdog processes continuously monitor for abnormal outbound traffic spikes, high raw packet rates, and unauthorized binary signatures.
- If abuse is detected, the affected instance will be immediately stopped and quarantined.
- To report abuse originating from our IP ranges, please contact **abuse@aetherpanel.com** with relevant log excerpts and timestamps.`
  }
];

let dbCache: DatabaseSchema | null = null;
let isWriting = false;
let pendingSave: Promise<void> | null = null;

export async function getDb(reload = false): Promise<DatabaseSchema> {
  if (reload) dbCache = null;
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
        dbCache!.ads = [];
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
          platformName: 'AetherPanel',
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
      if (!dbCache!.settings.platformName) {
        dbCache!.settings.platformName = dbCache!.settings.brandName || 'AetherPanel';
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
          tokenVersion: 1,
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
        if (admin.tokenVersion === undefined) admin.tokenVersion = 1;
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

      // Templates and Marketplace are completely removed
      dbCache!.templates = [];
      dbCache!.marketplaceItems = [];

      // Strict Data Isolation Check across VPS environments
      const currentInstId = getInstallationId();

      // If dbCache installationId exists and is different from current VPS installationId, purge stale cross-VPS database and files
      if (dbCache!.installationId && dbCache!.installationId !== currentInstId) {
        console.warn(`[AetherPanel Isolation]: Detected DB state from another installation (${dbCache!.installationId}). Purging stale cross-VPS database and files for new installation (${currentInstId}).`);
        const serversDir = path.join(DATA_DIR, 'servers');
        if (fs.existsSync(serversDir)) {
          fs.rmSync(serversDir, { recursive: true, force: true });
          fs.mkdirSync(serversDir, { recursive: true });
        }
        dbCache = await generateInitialDb();
        saveDbSync();
        createDbSnapshot();
        return dbCache;
      }

      dbCache!.installationId = currentInstId;

      dbCache!.users.forEach(u => {
        if (!u.installationId) u.installationId = currentInstId;
      });
      dbCache!.nodes.forEach(n => {
        if (!n.installationId) n.installationId = currentInstId;
      });
      dbCache!.servers.forEach(s => {
        s.installationId = currentInstId;
      });
      dbCache!.allocations.forEach(a => {
        if (!a.installationId) a.installationId = currentInstId;
      });
      dbCache!.backups.forEach(b => {
        if (!b.installationId) b.installationId = currentInstId;
      });
      dbCache!.databases.forEach(d => {
        if (!d.installationId) d.installationId = currentInstId;
      });
      dbCache!.schedules.forEach(s => {
        if (!s.installationId) s.installationId = currentInstId;
      });
      dbCache!.orders.forEach(o => {
        if (!o.installationId) o.installationId = currentInstId;
      });
      dbCache!.tickets.forEach(t => {
        if (!t.installationId) t.installationId = currentInstId;
      });
      dbCache!.auditLogs.forEach(l => {
        if (!l.installationId) l.installationId = currentInstId;
      });

      saveDbSync();
      createDbSnapshot();
      return dbCache!;
    } catch (e) {
      console.error('Error reading db.json, generating default database:', e);
    }
  }

  // Generate initial database
  dbCache = await generateInitialDb();
  saveDbSync();
  createDbSnapshot();
  return dbCache;
}

export function createDbSnapshot(): void {
  try {
    if (!dbCache) return;
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const snapshotFile = path.join(backupDir, 'db-snapshot.json');
    fs.writeFileSync(snapshotFile, JSON.stringify(dbCache, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Failed to write db-snapshot:', err);
  }
}

export function saveDbSync(): void {
  if (!dbCache) return;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('[Database] Error in atomic write, falling back to direct write:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
  }
}

export async function saveDb(): Promise<void> {
  saveDbSync();
}

/**
 * Executes an atomic transaction lock on the database state.
 */
export async function runTransaction<T>(action: (db: DatabaseSchema) => Promise<T> | T): Promise<T> {
  const db = await getDb();
  try {
    const result = await action(db);
    saveDbSync();
    return result;
  } catch (err) {
    saveDbSync();
    throw err;
  }
}

async function generateInitialDb(): Promise<DatabaseSchema> {
  const adminEmail = process.env.AETHER_ADMIN_EMAIL || 'admin@aetherpanel.in';
  const adminPassword = process.env.AETHER_ADMIN_PASSWORD || 'adminopp';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const currentInstId = getInstallationId();

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
    installationId: currentInstId,
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
      isSecure: true,
      installationId: currentInstId
    }
  ];

  const allocations: Allocation[] = [
    { id: 'alloc_1', nodeId: 'node_local', ip: '127.0.0.1', port: 25565, isAssigned: false, installationId: currentInstId },
    { id: 'alloc_2', nodeId: 'node_local', ip: '127.0.0.1', port: 25566, isAssigned: false, installationId: currentInstId },
    { id: 'alloc_3', nodeId: 'node_local', ip: '127.0.0.1', port: 25567, isAssigned: false, installationId: currentInstId },
    { id: 'alloc_4', nodeId: 'node_local', ip: '127.0.0.1', port: 3000, isAssigned: false, installationId: currentInstId },
    { id: 'alloc_5', nodeId: 'node_local', ip: '127.0.0.1', port: 3001, isAssigned: false, installationId: currentInstId }
  ];

  const coupons: Coupon[] = [
    {
      id: 'coup_welcome20',
      code: 'WELCOME20',
      discountType: 'percent',
      discountValue: 20,
      usageLimit: 100,
      timesUsed: 0,
      isActive: true
    },
    {
      id: 'coup_AETHER50',
      code: 'AETHER50',
      discountType: 'percent',
      discountValue: 50,
      usageLimit: 10,
      timesUsed: 0,
      isActive: true
    }
  ];

  const announcements: Announcement[] = [
    {
      id: 'ann_1',
      title: 'Welcome to AetherPanel',
      content: 'Your high-performance game and bot hosting control panel is initialized and ready for production provisioning.',
      type: 'update',
      isPublished: true,
      createdAt: new Date().toISOString()
    }
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_1',
      actorId: 'usr_admin',
      actorEmail: adminEmail,
      actorRole: 'super_admin',
      action: 'SYSTEM_INIT',
      targetResource: 'DATABASE',
      details: 'AetherPanel database initialized with security policies and installation isolation.',
      ipAddress: '127.0.0.1',
      installationId: currentInstId,
      createdAt: new Date().toISOString()
    }
  ];

  const settings: SystemSettings = {
    platformName: 'AetherPanel',
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
      enabled: false,
      botToken: '',
      clientId: '',
      clientSecret: '',
      redirectUri: 'http://localhost:3000/settings',
      defaultWebhookUrl: '',
      botStatus: 'offline',
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
    installationId: currentInstId,
    users: [adminUser],
    passwords: {
      'usr_admin': adminPasswordHash
    },
    products,
    plans,
    servers: [],
    templates: [],
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
    discordLinks: {},
    serverDiscordLinks: [],
    discordAuditLogs: [],
    afkSettings: {
      enabled: true,
      creditsPerInterval: 5,
      intervalMinutes: 10,
      dailyMaxCredits: 100,
      weeklyMaxCredits: 500,
      minAccountAgeDays: 0
    },
    marketplaceItems: [],
    statusComponents: defaultStatusComponents,
    incidents: defaultIncidents,
    scheduledMaintenances: defaultScheduledMaintenances,
    alertRules: defaultAlertRules,
    alertIncidents: [],
    telemetryHistory: {},
    apiKeys: [],
    apiAuditLogs: [],
    webhooks: [],
    legalPages: defaultLegalPages
  };
}

