/**
 * AetherPanel - Global Type Definitions
 */

export type UserRole = 'user' | 'support' | 'moderator' | 'admin' | 'super_admin';

export interface User {
  id: string;
  installationId?: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  isSuspended: boolean;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  tokenVersion?: number;
  mustChangePassword?: boolean;
  authProvider?: 'local' | 'google' | 'discord';
  googleId?: string;
  discordId?: string;
  lastLoginIp?: string;
  registrationIp?: string;
  serverLimit?: number;
  credits: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductCategory = 'minecraft' | 'bot' | 'other';

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ProductCategory;
  icon: string;
  isActive: boolean;
  sortOrder: number;
}

export interface Plan {
  id: string;
  productId: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  ramMB: number;
  cpuCores: number; // e.g. 1, 2, 4 cores or 200%
  diskGB: number;
  backupLimit: number;
  maxBackupStorageMB?: number;
  allowScheduledBackups?: boolean;
  databaseLimit: number;
  serverLimit: number; // max servers user with this plan can own
  networkMbps: number;
  features: string[];
  locations: string[]; // e.g. ['us-east', 'eu-central', 'ap-southeast']
  isPopular?: boolean;
  isActive: boolean;
}

export type ServerStatus = 'running' | 'stopped' | 'starting' | 'stopping' | 'installing' | 'error' | 'suspended' | 'crashed';

export type ServerDeploymentState = 
  | 'QUEUED' 
  | 'PROVISIONING' 
  | 'INSTALLING' 
  | 'CONFIGURING' 
  | 'STARTING' 
  | 'READY' 
  | 'FAILED' 
  | 'CANCELLED';

export interface ServerTypeTheme {
  id: string;
  serverTypeId: string;
  backgroundUrl: string;
  iconUrl?: string;
  accentColor: string;
  overlayOpacity: number; // 0 to 1
  gradientEnabled: boolean;
  cardStyle?: 'default' | 'compact' | 'glass';
  badgeStyle?: 'solid' | 'outline' | 'glow';
  statusStyle?: 'default' | 'pill' | 'dot';
  defaultResourceLabels?: {
    cpu?: string;
    ram?: string;
    disk?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ServerType {
  id: string;
  name: string;
  slug: string;
  category: 'Minecraft' | 'Bot Hosting' | 'Other' | string;
  runtime: 'Java' | 'Bedrock' | 'Node.js' | 'Bun' | 'Python' | string;
  description: string;
  icon: string;
  enabled: boolean;
  sortOrder: number;
  theme: ServerTypeTheme;
  defaultPort?: number;
  defaultStartupCommand?: string;
  defaultEnvVars?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  category: 'minecraft' | 'bot' | 'other';
  icon: string;
  runtime: 'minecraft' | 'python' | 'nodejs';
  versions: string[];
  defaultVersion: string;
  startupCommand: string;
  environmentVars: Record<string, string>;
  installScript?: string;
  defaultPort: number;
  recommendedRamMB: number;
  recommendedCpuCores: number;
  recommendedDiskGB: number;
  status: 'active' | 'maintenance' | 'disabled';
  isPopular?: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServerResourceLimits {
  ramMB: number;
  cpuCores: number;
  diskGB: number;
  backups: number;
  maxBackupStorageMB?: number;
  allowScheduledBackups?: boolean;
  databases: number;
}

export interface BotRuntimeSettings {
  version?: string;
  startupFile?: string;
  startupArguments?: string;
  memoryLimitMB?: number;
  packageManager?: string;
  requirementsFile?: string;
}

export interface ServerStartupConfig {
  // General & Lifecycle
  startupCommand?: string;
  compiledCommand?: string;
  customFlags?: string;
  autoStartOnBoot?: boolean;
  autoStartOnNodeReconnect?: boolean;
  autoRestartPolicy?: 'always' | 'on_crash' | 'never';
  restartOnCrash?: boolean;
  maxCrashRestarts?: number;
  crashRestartDelaySeconds?: number;
  crashCount?: number;
  lastCrashAt?: string;
  lastCrashReason?: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
  pid?: number;

  // Minecraft Runtime
  javaVersion?: string | number;
  jvmFlags?: string;
  xmsMB?: number;
  xmxMB?: number;
  serverJar?: string;
  nogui?: boolean;

  // Bot Hosting Independent Runtimes
  botRuntime?: 'nodejs' | 'python' | 'bun';
  nodeConfig?: BotRuntimeSettings;
  pythonConfig?: BotRuntimeSettings;
  bunConfig?: BotRuntimeSettings;

  // Legacy / Flat fallback fields
  nodeVersion?: string;
  entryFile?: string;
  nodeOptions?: string;
  pythonVersion?: string;
  pythonUnbuffered?: boolean;
  pythonExecutable?: string;
}

export interface ServerEnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
  isEnabled?: boolean;
  description?: string;
}

export interface Server {
  id: string;
  installationId?: string;
  name: string;
  userId: string;
  productId: string;
  planId: string;
  nodeId: string;
  templateId?: string;
  serverTypeId?: string;
  serverType?: ServerType;
  deploymentState?: ServerDeploymentState;
  status: ServerStatus;
  primaryIp: string;
  primaryPort: number;
  location: string;
  software: string; // e.g., 'Paper', 'Purpur', 'Spigot', 'Node.js', 'Python'
  version: string; // e.g. '1.20.4', 'Node 20', 'Python 3.11'
  limits: ServerResourceLimits;
  startup?: ServerStartupConfig;
  envVars?: ServerEnvVar[];
  selectedEnvPath?: string;
  createdAt: string;
  updatedAt: string;
  // Live stats cache
  cpuUsage: number; // %
  ramUsageMB: number;
  diskUsageMB: number;
  uptimeSeconds: number;
  playerCount?: number;
  maxPlayers?: number;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  country: string;
  flagCode: string;
  description?: string;
  isActive: boolean;
}

export interface Node {
  id: string;
  uuid?: string;
  installationId?: string;
  name: string;
  description?: string;
  hostname: string;
  ip: string; // Internal or primary IP
  publicIpv4?: string; // Optional!
  publicIpv6?: string; // Optional!
  fqdn?: string;
  bindAddress?: string; // Internal bind address (e.g. 0.0.0.0)
  daemonListenIp?: string; // Alias for bindAddress
  daemonPort: number; // Default 8443 (SSL) or 8080 (Internal API)
  daemonScheme?: 'http' | 'https';
  scheme?: 'http' | 'https'; // Alias for daemonScheme
  daemonSslEnabled?: boolean;
  sslEnabled?: boolean; // Alias for daemonSslEnabled
  sftpPort: number; // Default 2022
  location: string;
  locationName: string;
  flagCode: string; // ISO country code for UI flags
  totalRamMB: number;
  usedRamMB: number;
  totalCpuCores: number;
  usedCpuCores: number;
  totalDiskGB: number;
  usedDiskGB: number;
  ramOverallocatePercent: number;
  cpuOverallocatePercent: number;
  diskOverallocatePercent: number;
  maxServers: number;
  allowedProducts: string[];
  tags?: string[];
  status: 'online' | 'offline' | 'degraded' | 'maintenance' | 'installing' | 'pending' | 'error' | 'uninstalling';
  isMaintenanceMode: boolean;
  serverCount: number;
  daemonToken?: string;
  installationToken?: string;
  lastHeartbeatAt?: string;
  createdAt?: string;
  updatedAt?: string;
  isSecure?: boolean;
  isLocalNode?: boolean;
  reservedRamMB?: number;
  reservedCpuCores?: number;
  reservedDiskGB?: number;
  sftpFqdn?: string;
  playitSftpAddress?: string;
  playitSftpPort?: number;
  playitAgentInstalled?: boolean;
  playitAgentRunning?: boolean;
  playitClaimCode?: string;
  playitClaimUrl?: string;
}

export interface SftpConnectionInfo {
  host: string;
  port: number;
  username: string;
  password?: string;
  uri: string;
  isProtected: boolean;
  tunnelType: 'direct' | 'fqdn' | 'playit';
  nodeName?: string;
}

export type PlayitAgentState = 
  | 'NOT_INSTALLED'
  | 'INSTALLING'
  | 'STARTING'
  | 'RUNNING_UNCLAIMED'
  | 'CLAIMING'
  | 'RUNNING_CLAIMED'
  | 'STOPPED'
  | 'CRASHED'
  | 'ERROR';

export interface PlayitStatus {
  isInstalled: boolean;
  isRunning: boolean;
  isClaimed: boolean;
  status: PlayitAgentState;
  agentStatus: 'RUNNING' | 'STOPPED' | 'STARTING' | 'CRASHED' | 'NOT_INSTALLED' | 'ERROR';
  claimStatus: 'UNCLAIMED' | 'CLAIM_IN_PROGRESS' | 'CLAIMED';
  accountStatus: 'Connected' | 'Unlinked' | 'Pending';
  tunnelManagement: 'Managed externally';
  claimUrl?: string;
  claimCode?: string;
  agentVersion: string;
  pid?: number;
  logs?: string[];
  errorReason?: string;
  lastCheckedAt: string;
}

export interface NodePlayitStatus {
  nodeId: string;
  isInstalled: boolean;
  isRunning: boolean;
  isClaimed: boolean;
  status: PlayitAgentState;
  agentStatus: 'RUNNING' | 'STOPPED' | 'STARTING' | 'CRASHED' | 'NOT_INSTALLED' | 'ERROR';
  claimStatus: 'UNCLAIMED' | 'CLAIM_IN_PROGRESS' | 'CLAIMED';
  accountStatus: 'Connected' | 'Unlinked' | 'Pending';
  tunnelManagement: 'Managed externally';
  claimUrl?: string;
  claimCode?: string;
  agentVersion: string;
  pid?: number;
  logs?: string[];
  errorReason?: string;
  lastCheckedAt: string;
}

export interface NodeInstallToken {
  id: string;
  nodeId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  isUsed: boolean;
}

export interface Allocation {
  id: string;
  installationId?: string;
  nodeId: string;
  ip: string;
  port: number;
  alias?: string;
  notes?: string;
  serverId?: string;
  isAssigned: boolean;
  isReserved?: boolean;
  createdAt?: string;
}

export interface ServerFile {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  updatedAt: string;
  extension?: string;
}

export type BackupStatus = 'QUEUED' | 'CREATING' | 'COMPLETED' | 'FAILED' | 'RESTORING' | 'DELETING';
export type BackupType = 'manual' | 'scheduled' | 'automated';
export type BackupStorageProvider = 'local' | 'node' | 'object';

export interface ServerBackup {
  id: string;
  installationId?: string;
  serverId: string;
  serverName?: string;
  userEmail?: string;
  name: string;
  sizeMB: number;
  sizeBytes?: number;
  status: BackupStatus;
  type: BackupType;
  storageProvider: BackupStorageProvider;
  storagePath?: string;
  storageKey?: string;
  checksum?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ServerDatabase {
  id: string;
  installationId?: string;
  serverId: string;
  name: string;
  username: string;
  host: string;
  port: number;
  dbType: 'mysql' | 'postgres';
  createdAt: string;
}

export type ScheduleType = 'one-time' | 'hourly' | 'daily' | 'weekly' | 'custom_cron';
export type ScheduleAction = 'backup' | 'start' | 'stop' | 'restart' | 'command';

export interface ServerSchedule {
  id: string;
  installationId?: string;
  serverId: string;
  serverName?: string;
  name: string;
  scheduleType: ScheduleType;
  cronExpression: string; // e.g. "0 0 * * *"
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  timezone?: string;
  intervalHours?: number;
  dayOfWeek?: number; // 0=Sunday, 1=Monday...
  action: ScheduleAction;
  payload?: string; // command string if action === 'command'
  isEnabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
  createdAt: string;
}

export interface ServerActivity {
  id: string;
  installationId?: string;
  serverId: string;
  userId: string;
  username: string;
  action: string;
  details: string;
  createdAt: string;
}

export interface Order {
  id: string;
  installationId?: string;
  userId: string;
  userEmail: string;
  planId: string;
  planName: string;
  billingCycle: 'monthly' | 'yearly';
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionRef?: string;
  proofUrl?: string;
  adminNote?: string;
  createdAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  expiresAt?: string;
  status?: 'active' | 'revoked';
  scopes?: string[];
  usageLimit?: number;
  timesUsed: number;
  isActive: boolean;
}

export interface SupportTicket {
  id: string;
  installationId?: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'pending' | 'answered' | 'closed';
  messages: {
    id: string;
    senderId: string;
    senderName: string;
    senderRole: UserRole;
    message: string;
    createdAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  installationId?: string;
  title: string;
  content: string;
  type: 'info' | 'maintenance' | 'update' | 'warning';
  isPublished: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  installationId?: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetResource: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

export interface PaymentGatewaySettings {
  upi: {
    enabled: boolean;
    upiId: string;
    merchantName: string;
    qrCodeUrl: string;
    instructions: string;
  };
  bank: {
    enabled: boolean;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
    instructions: string;
  };
  crypto: {
    enabled: boolean;
    walletAddress: string;
    network: string;
    instructions: string;
  };
  stripe: {
    enabled: boolean;
    instructions: string;
  };
}

export interface BackupSettings {
  storageProvider: BackupStorageProvider;
  localStoragePath: string;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3Region?: string;
  maxBackupsPerServer: number;
  backupRetentionDays: number;
  autoCleanupEnabled: boolean;
}

export interface AuthProviderSettings {
  emailPassword: {
    enabled: boolean;
  };
  google: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    firebaseApiKey?: string;
    firebaseAuthDomain?: string;
    firebaseProjectId?: string;
    firebaseStorageBucket?: string;
    firebaseMessagingSenderId?: string;
    firebaseAppId?: string;
  };
  discord: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
  };
}

export interface CustomThemeSettings {
  activeThemeId: 'golden' | 'emerald' | 'cyberpunk' | 'midnight' | 'crimson' | 'amber' | 'sapphire' | 'custom';
  activeFontId: 'Outfit' | 'Inter' | 'Space Grotesk' | 'Plus Jakarta Sans' | 'JetBrains Mono' | 'Poppins' | 'Syne' | 'Fira Code';
  accentColor?: string;
  customColors?: {
    accent: string;
    accentHover: string;
    bgBase: string;
    bgCard: string;
    borderColor: string;
  };
  assets?: {
    logoUrl?: string;
    faviconUrl?: string;
    bgPatternUrl?: string; // Supports normal URLs, Imgur, GIF URLs
    bannerUrl?: string;
    loginBgUrl?: string;
  };
  cardStyle: 'rounded-xl' | 'rounded-2xl' | 'rounded-lg' | 'rounded-none';
  glowIntensity: 'none' | 'subtle' | 'vibrant';
  allowUserCustomization: boolean;
  backgroundBlur?: 'none' | '4px' | '8px' | '12px' | '20px' | '32px' | '40px';
  backgroundOverlayOpacity?: number; // 0 to 100 percentage
}

export interface AntiAbuseSettings {
  enabled: boolean;
  provider: 'proxycheck' | 'ipqualityscore' | 'custom';
  apiKey?: string;
  blockVpn: boolean;
  blockProxy: boolean;
  blockTor: boolean;
  blockDatacenter: boolean;
  maxRiskScore: number;
  maxRegistrationsPerIpPerDay: number;
  loginLockoutMaxAttempts: number;
  loginLockoutDurationSec: number;
}

export interface SystemSettings {
  platformName?: string;
  brandName: string;
  brandTagline: string;
  supportEmail: string;
  discordUrl: string;
  currencySymbol: string;
  currencyCode: string;
  registrationEnabled: boolean;
  emailVerificationRequired: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  defaultTheme: 'dark' | 'light' | 'system';
  accentColor: string;
  paymentGateways?: PaymentGatewaySettings;
  backupSettings?: BackupSettings;
  discordSettings?: DiscordBotSettings;
  authProviders?: AuthProviderSettings;
  themeSettings?: CustomThemeSettings;
  antiAbuse?: AntiAbuseSettings;
  enablePlayit?: boolean;
}

export interface PluginItem {
  id: string;
  name: string;
  description: string;
  author: string;
  iconUrl?: string;
  downloads: number;
  category: string;
  version: string;
  supportedVersions?: string[];
  platform?: string;
  provider: 'Modrinth' | 'Hangar';
  projectUrl?: string;
  downloadUrl?: string;
  filename?: string;
  isEnabled?: boolean;
}

export interface HealthStatus {
  status: 'operational' | 'degraded' | 'outage';
  controlPanel: 'operational' | 'degraded' | 'outage';
  api: 'operational' | 'degraded' | 'outage';
  nodesOnline: number;
  nodesTotal: number;
  activeServers: number;
  lastCheckedAt: string;
}

// Ads System Types
export type AdPlacement = 'dashboard' | 'server_list' | 'server_page' | 'file_manager' | 'billing' | 'public' | 'login';
export type AdType = 'banner' | 'card' | 'announcement' | 'sponsored';

export interface AdItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  destinationUrl: string;
  type: AdType;
  placement: AdPlacement;
  priority: number;
  frequencyCapPerSession: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export interface AdEvent {
  id: string;
  adId: string;
  type: 'impression' | 'click';
  userId?: string;
  timestamp: string;
}

// AFK Reward System Types
export interface AfkSession {
  id: string;
  userId: string;
  sessionId: string;
  startedAt: string;
  lastHeartbeatAt: string;
  earnedCredits: number;
  isCompleted: boolean;
  ipAddress?: string;
}

export type RewardTransactionType = 'AFK_REWARD' | 'ADMIN_ADJUSTMENT' | 'REDEMPTION' | 'BONUS' | 'REVERSAL';

export interface RewardTransaction {
  id: string;
  userId: string;
  amount: number;
  type: RewardTransactionType;
  description: string;
  createdAt: string;
  referenceId?: string;
}

export interface AfkSettings {
  enabled: boolean;
  creditsPerInterval: number;
  intervalMinutes: number;
  dailyMaxCredits: number;
  weeklyMaxCredits: number;
  minAccountAgeDays: number;
}

export interface UserPreferences {
  customCursorEnabled: boolean;
  animationsEnabled: boolean;
  adsEnabled: boolean;
}

// Discord Integration Types
export type DiscordNotificationEvent =
  | 'SERVER_STARTED'
  | 'SERVER_STOPPED'
  | 'SERVER_CRASHED'
  | 'SERVER_RESTARTED'
  | 'BACKUP_COMPLETED'
  | 'BACKUP_FAILED'
  | 'DEPLOYMENT_COMPLETED'
  | 'DEPLOYMENT_FAILED'
  | 'NODE_OFFLINE'
  | 'RESOURCE_WARNING'
  | 'PLAN_EXPIRING';

export interface DiscordAccount {
  discordId: string;
  username: string;
  globalName?: string;
  avatar?: string;
  email?: string;
  linkedAt: string;
}

export interface DiscordBotSettings {
  enabled: boolean;
  botToken?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  defaultWebhookUrl?: string;
  botStatus: 'online' | 'offline' | 'configured' | 'unconfigured';
  commandRateLimitPerMin: number;
  defaultNotificationEvents: DiscordNotificationEvent[];
}

export interface ServerDiscordLink {
  serverId: string;
  enabled: boolean;
  webhookUrl: string;
  botChannelId?: string;
  guildId?: string;
  guildName?: string;
  channelName?: string;
  enabledEvents: DiscordNotificationEvent[];
  mentionRoleId?: string;
  mentionUserId?: string;
  cooldownSeconds: number;
  allowServerCommands: boolean;
  lastNotifiedAt?: Record<string, string>;
  updatedAt: string;
}

export interface DiscordAuditLog {
  id: string;
  command: string; // e.g. /server status, /server start, WEBHOOK_TEST
  discordUserId: string;
  discordUsername: string;
  aetherUserId?: string;
  aetherUserEmail?: string;
  serverId?: string;
  serverName?: string;
  result: 'success' | 'denied' | 'failed';
  details: string;
  timestamp: string;
}

// Public Status, Real-Time Monitoring & Alerts Types
export type StatusComponentType = 'panel' | 'api' | 'database' | 'node' | 'storage' | 'discord' | 'custom';
export type StatusComponentState = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
export type IncidentSeverity = 'minor' | 'major' | 'critical' | 'maintenance';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved';
export type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface DayUptime {
  date: string; // YYYY-MM-DD
  status: StatusComponentState;
  uptimePercent: number;
}

export interface StatusComponent {
  id: string;
  name: string;
  type: StatusComponentType;
  description: string;
  group: 'Core Platform' | 'Compute Nodes' | 'External Integrations' | 'Storage Subsystems' | 'Other Services';
  status: StatusComponentState;
  uptimePercent90Days: number;
  lastCheckedAt: string;
  latencyMs?: number;
  details?: string;
  order: number;
  isPublic: boolean;
  nodeId?: string;
  history90Days?: DayUptime[];
}

export interface IncidentUpdate {
  id: string;
  status: IncidentStatus;
  message: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affectedComponents: string[];
  timeline: IncidentUpdate[];
  startedAt: string;
  resolvedAt?: string;
  isPublic: boolean;
}

export interface ScheduledMaintenance {
  id: string;
  title: string;
  description: string;
  affectedComponents: string[];
  scheduledStartTime: string; // ISO UTC
  scheduledEndTime: string;   // ISO UTC
  status: MaintenanceStatus;
  createdAt: string;
  completedAt?: string;
}

export interface TelemetryPoint {
  timestamp: string;
  cpuPercent: number;
  ramPercent: number;
  usedRamMB: number;
  totalRamMB: number;
  diskPercent: number;
  usedDiskGB: number;
  totalDiskGB: number;
  netInKBps: number;
  netOutKBps: number;
  latencyMs: number;
  loadAvg1m?: number;
  tps?: number;
  players?: number;
  status?: string;
}

export type AlertTargetType = 'node' | 'server' | 'api' | 'database' | 'storage';
export type AlertMetric = 'status_offline' | 'cpu_high' | 'ram_high' | 'disk_high' | 'server_crashed' | 'api_latency';

export interface AlertRule {
  id: string;
  name: string;
  targetType: AlertTargetType;
  targetId?: string; // 'all' or specific ID
  metric: AlertMetric;
  threshold: number; // e.g. 90%
  durationMinutes: number; // e.g. 5 min
  cooldownMinutes: number; // e.g. 30 min
  notificationChannel: 'discord' | 'panel' | 'email' | 'all';
  webhookUrl?: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertIncident {
  id: string;
  ruleId: string;
  ruleName: string;
  targetId: string;
  targetName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface ApiKey {
  id: string;
  installationId?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  name: string;
  description?: string;
  keyPrefix: string;
  keyHash?: string;
  role: UserRole;
  allowedIps?: string[];
  expiresAt?: string | null;
  status: 'active' | 'revoked' | 'expired';
  scopes: string[];
  lastUsedAt?: string | null;
  lastUsedIp?: string | null;
  requestCount?: number;
  createdAt: string;
  revokedAt?: string | null;
  rotatedAt?: string | null;
}

export interface ApiAuditLog {
  id: string;
  apiKeyId: string;
  userId: string;
  userEmail?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string;
  userAgent?: string;
  createdAt: string;
}

export interface ApiKeyStats {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  expiredKeys: number;
  recentlyUsed24h: number;
  lastActivityAt: string | null;
}

export interface WebhookSubscription {
  id: string;
  installationId?: string;
  userId: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isEnabled: boolean;
  lastTriggeredAt?: string;
  lastStatus?: number;
  lastError?: string;
  createdAt: string;
}

export type MarketplaceCategory = 'minecraft' | 'bot' | 'template' | 'tool' | 'utility';
export type MarketplaceInstallType = 'template_deploy' | 'resource_install' | 'one_click_setup';
export type MarketplaceBadge = 'official' | 'verified' | 'community';
export type MarketplaceStatus = 'active' | 'pending' | 'draft' | 'rejected' | 'archived';

export interface MarketplaceReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
}

export interface MarketplaceItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  longDescription?: string;
  category: MarketplaceCategory;
  icon: string; // lucide icon name or image URL
  bannerUrl?: string;
  author: string; // e.g. "AetherPanel Team" or user name
  authorId?: string; // userId if submitted by user
  badge: MarketplaceBadge; // 'official' | 'verified' | 'community'
  version: string;
  changelog?: string;
  compatibility: string; // e.g. "Minecraft 1.20.x, Paper/Purpur", "Node 18+", "Python 3.10+", "All Nodes"
  requirements: {
    minRamMB: number;
    minCpuCores: number;
    minDiskGB: number;
    notes?: string;
  };
  installType: MarketplaceInstallType;
  templateId?: string; // Links to ServerTemplate ID for template_deploy
  startupCommand?: string;
  environmentVars?: Record<string, string>;
  installScript?: string;
  configFiles?: { path: string; content: string }[];

  // Real metrics (NO FAKE METRICS!)
  downloadsCount: number; // Actual deployment/install count
  rating: number; // Calculated average rating from real reviews, 0 if no reviews
  reviewsCount: number; // Total real reviews count
  reviews?: MarketplaceReview[];

  // Admin & Approval controls
  status: MarketplaceStatus;
  isFeatured: boolean;
  securityValidated: boolean; // Marked true after safety check
  securityNotes?: string;
  rejectionReason?: string;
  submittedAt?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LegalPage {
  id: string;
  slug: 'terms' | 'privacy' | 'acceptable-use' | string;
  title: string;
  summary: string;
  content: string; // Markdown formatted text
  version: string;
  isPublished: boolean;
  lastUpdatedAt: string;
  updatedBy?: string;
}

export interface InstallationPublicInfo {
  installationId: string;
  installedAt: string;
  version: string;
  systemName?: string;
}

export type UpdateAvailability = 'YES' | 'NO' | 'UNKNOWN';
export type StepStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';

export interface UpdateStepState {
  id: string;
  name: string;
  status: StepStatus;
  message?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface PanelVersionInfo {
  currentVersion: string;
  channel: 'stable' | 'beta' | 'dev';
  commitHash: string;
  commitDate: string;
  branch: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  latestVersion: string; // 'UNKNOWN' or real version
  latestCommitHash: string; // 'UNKNOWN' or real commit hash
  isUpdateAvailable: UpdateAvailability; // 'YES' | 'NO' | 'UNKNOWN'
  upstreamReachable: boolean;
  upstreamError?: string;
  updateReleaseNotes: string;
  lastCheckedAt: string;
  isDirtyWorkingTree: boolean;
  panelServiceStatus: 'HEALTHY' | 'DEGRADED' | 'STARTING';
}

export interface UpdateJobState {
  status: 'idle' | 'in_progress' | 'completed' | 'failed';
  currentStep: string;
  progressPercent: number;
  steps: UpdateStepState[];
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  logs: string[];
}




export interface ApiAuditLog {
  id: string;
  apiKeyId: string;
  userId: string;
  endpoint: string;
  method: string;
  statusCode: number;
  ipAddress: string;
  createdAt: string;
}
