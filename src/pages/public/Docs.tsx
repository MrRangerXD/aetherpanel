import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Terminal, Code, Cpu, Shield, HelpCircle, 
  ChevronRight, Layers, Database, Lock, Globe, 
  Zap, Server, HardDrive, Share2, AlertCircle, Copy, Check,
  Search, ExternalLink, Sliders, CheckCircle2,
  FileCode, Key, LifeBuoy
} from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';

type DocSection = 'getting-started' | 'minecraft' | 'bot' | 'sftp' | 'security' | 'databases' | 'subusers' | 'api' | 'domains';

export const Docs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DocSection>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { socialLinks, discordUrl, brandName } = useBranding();
  const currentDiscord = socialLinks?.discord || discordUrl || 'https://discord.gg';
  const name = brandName || 'Aether';

  const categories = [
    { id: 'getting-started', name: 'Getting Started', icon: Zap, count: '4 guides' },
    { id: 'minecraft', name: 'Minecraft Hosting', icon: Server, count: 'Aikar flags' },
    { id: 'bot', name: 'Discord Bot Deploy', icon: Code, count: 'Node/Python' },
    { id: 'sftp', name: 'Files & SFTP', icon: HardDrive, count: 'Credentials' },
    { id: 'security', name: 'Security & 2FA', icon: Shield, count: 'Isolation' },
    { id: 'databases', name: 'Databases', icon: Database, count: 'MySQL' },
    { id: 'subusers', name: 'Subuser Access', icon: Share2, count: 'RBAC' },
    { id: 'api', name: 'Panel REST API', icon: Terminal, count: 'v1 Endpoints' },
    { id: 'domains', name: 'Custom Domains', icon: Globe, count: 'SRV & DNS' },
  ];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }, [categories, searchQuery]);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-[var(--color-ink)] anim-fade-in">
      
      {/* Top Banner & Search */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-6 pb-6 border-b border-[var(--color-line)]">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--color-accent)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
            <span>Knowledge Base & Manual</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            Documentation & Guides
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-ink-mute)] leading-relaxed">
            Optimization tutorials, SFTP credentials, startup flags, and API specs for {name} Cloud.
          </p>
        </div>

        {/* Quick Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
          <input
            type="text"
            placeholder="Search documentation..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-ink)] placeholder-[var(--color-ink-mute)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* SIDEBAR NAVIGATION */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="sticky top-6 space-y-4">
            
            <nav className="p-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-1">
              {filteredCategories.map((cat) => {
                const isActive = activeTab === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id as DocSection)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      isActive 
                        ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-l-2 border-[var(--color-accent)] pl-2.5' 
                        : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <cat.icon className={`h-3.5 w-3.5 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
                      <span>{cat.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-[var(--color-ink-mute)]">
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Need Direct Help Card */}
            <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] space-y-2.5">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                <span className="label">24/7 Support</span>
              </div>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                Stuck on a configuration file or modpack? Our engineering team and community admins are active around the clock.
              </p>
              <button 
                type="button"
                onClick={() => window.open(currentDiscord, '_blank')}
                className="w-full btn btn-ghost text-xs justify-center gap-1.5"
              >
                <span>Join Discord Server</span>
                <ExternalLink className="h-3 w-3 text-[var(--color-ink-mute)]" />
              </button>
            </div>

          </div>
        </aside>

        {/* MAIN DOCUMENTATION CONTENT */}
        <main className="flex-1 min-w-0">
          <div className="p-6 sm:p-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
            
            {/* 1. GETTING STARTED */}
            {activeTab === 'getting-started' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Setup Guide</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Welcome to {name} Cloud
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    {name} is an enterprise-grade game hosting and container control plane engineered for ultra-low latency, instant provisioning, and zero overhead.
                  </p>
                </div>

                <div className="grid gap-3">
                  {[
                    { step: '01', title: 'Create Account & Verify', desc: 'Sign up with your email and log in to your dashboard to unlock instant cloud quotas.' },
                    { step: '02', title: 'Select High-Frequency Location', desc: 'Choose between our North America, Europe, or Asia nodes for lowest ping.' },
                    { step: '03', title: 'Allocate RAM & CPU Cores', desc: 'Pick the exact resources required for your PaperMC server or Node.js discord bot.' },
                    { step: '04', title: 'One-Click Instant Launch', desc: 'Containers initialize in under 15 seconds. Connect directly using your assigned IP and port.' }
                  ].map((s) => (
                    <div key={s.step} className="p-3.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-start gap-3.5">
                      <span className="flex-shrink-0 w-7 h-7 rounded-md bg-[var(--color-surface-3)] border border-[var(--color-line)] text-[var(--color-accent)] font-mono text-xs font-semibold flex items-center justify-center">
                        {s.step}
                      </span>
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-semibold text-[var(--color-ink)]">{s.title}</h3>
                        <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/30 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-[var(--color-warn)] flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-[var(--color-ink-dim)] leading-relaxed space-y-0.5">
                    <p className="font-semibold uppercase tracking-wider text-[var(--color-warn)] font-mono text-[10px]">Performance Best Practice</p>
                    <p>Always stop your server cleanly before uploading or replacing large <code className="font-mono text-[var(--color-ink)]">.jar</code> files or modpacks via SFTP to avoid file write corruption.</p>
                  </div>
                </div>
              </section>
            )}

            {/* 2. MINECRAFT OPTIMIZATION */}
            {activeTab === 'minecraft' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Performance Tuning</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Minecraft Server Optimization
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    We deploy on high-clock AMD Ryzen processors. For highest TPS and minimum garbage-collection stutter, use optimized G1GC flags below.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="label flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      <span>Aikar Optimized G1GC Startup Flags</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(`java -Xms128M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -jar server.jar --nogui`, 'aikar')}
                      className="btn btn-ghost text-xs py-1 px-2.5 h-auto"
                    >
                      {copiedKey === 'aikar' ? (
                        <>
                          <Check className="h-3 w-3 text-[var(--color-ok)]" />
                          <span className="text-[var(--color-ok)] font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy Flags</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-4 rounded-lg bg-[var(--color-bg)] font-mono text-[11px] text-[var(--color-ink-dim)] border border-[var(--color-line)] leading-relaxed overflow-x-auto whitespace-pre-wrap">
                    <code>{`java -Xms128M -XX:+UseG1GC -XX:+ParallelRefProcEnabled \\
-XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions \\
-XX:+DisableExplicitGC -XX:+AlwaysPreTouch \\
-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 \\
-XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 \\
-XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 \\
-XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 \\
-XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 \\
-XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -jar server.jar --nogui`}</code>
                  </pre>
                </div>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div className="p-3.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                    <span className="text-xs font-mono font-medium text-[var(--color-accent)]">paper.yml view-distance</span>
                    <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                      Set <code className="text-[var(--color-ink)]">view-distance: 6</code> and <code className="text-[var(--color-ink)]">no-tick-view-distance: 10</code>. This maintains large visual render distance without loading CPU ticks.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                    <span className="text-xs font-mono font-medium text-[var(--color-ink)]">Chunky World Pre-generator</span>
                    <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                      Use the Chunky plugin to pre-generate a 5,000x5,000 radius. Pre-generated chunks eliminate disk-read lag spikes when players explore on Elytras.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* 3. DISCORD BOT DEPLOYMENT */}
            {activeTab === 'bot' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Automation & Apps</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Discord Bot & Python Services
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Deploy Discord.js (Node.js 18/20/22), Discord.py, or Bun applications with 24/7 process isolation and automatic restart on unhandled crashes.
                  </p>
                </div>

                {/* Node.js Boilerplate */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="label flex items-center gap-1.5">
                      <Code className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                      <span>Node.js / Discord.js v14 index.js</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleCopy(`require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(\`[READY] Bot logged in as \${client.user.tag}\`);
});

client.login(process.env.DISCORD_TOKEN);`, 'nodebot')}
                      className="btn btn-ghost text-xs py-1 px-2.5 h-auto"
                    >
                      {copiedKey === 'nodebot' ? (
                        <>
                          <Check className="h-3 w-3 text-[var(--color-ok)]" />
                          <span className="text-[var(--color-ok)] font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="p-4 rounded-lg bg-[var(--color-bg)] font-mono text-[11px] text-[var(--color-ink-dim)] border border-[var(--color-line)] leading-relaxed overflow-x-auto">
                    <code>{`require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(\`[READY] Bot logged in as \${client.user.tag}\`);
});

// Stored securely in Startup Variables tab
client.login(process.env.DISCORD_TOKEN);`}</code>
                  </pre>
                </div>

                <div className="p-3.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <Key className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                    <span>Handling Secrets & API Keys</span>
                  </div>
                  <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                    Never commit bot tokens or database passwords to public repositories. Set them via the <strong className="text-[var(--color-ink)]">Startup</strong> tab or in a <code className="text-[var(--color-accent)]">.env</code> file in your server file root.
                  </p>
                </div>
              </section>
            )}

            {/* 4. SFTP & FILE MANAGEMENT */}
            {activeTab === 'sftp' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">File Transfer</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    SFTP Connection & Remote Files
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Full read/write access to your server directory over SSH File Transfer Protocol (SFTP).
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-2">
                    <div className="label text-[var(--color-accent)]">FileZilla Configuration</div>
                    <ul className="text-xs text-[var(--color-ink-dim)] space-y-1 font-mono">
                      <li><strong>Protocol:</strong> SFTP - SSH File Transfer</li>
                      <li><strong>Host:</strong> sftp.aethercloud.net</li>
                      <li><strong>Port:</strong> 2022 (Default SFTP port)</li>
                      <li><strong>Logon Type:</strong> Normal</li>
                      <li><strong>User:</strong> username.serverid</li>
                    </ul>
                  </div>

                  <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-2">
                    <div className="label text-[var(--color-ink)]">Fast Archive Management</div>
                    <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                      Instead of uploading thousands of individual plugin files, upload a single <code className="text-[var(--color-ink)]">.zip</code> archive and click <strong className="text-[var(--color-ink)]">Unarchive</strong> in the web File Manager for instant 1-second extraction.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* 5. SECURITY & 2FA */}
            {activeTab === 'security' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Defense in Depth</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Security & Isolation Architecture
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Every container is secured with kernel-level cgroups, unprivileged namespaces, and always-on DDoS mitigation.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    { title: 'Isolated Container Namespaces', desc: 'Instances cannot access host filesystems, neighboring servers, or raw hardware sockets.' },
                    { title: '3.2 Tbps L3/L4 & L7 Scrubbing', desc: 'Volumetric SYN floods, UDP amplification, and Layer 7 HTTP floods are filtered inline.' },
                    { title: 'Two-Factor Authentication (2FA)', desc: 'Protect your administrator account with time-based OTP codes (Google Authenticator, Authy, 1Password).' }
                  ].map((sec, i) => (
                    <div key={i} className="p-3.5 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-start gap-3.5">
                      <div className="p-2 rounded-md bg-[var(--color-surface-3)] border border-[var(--color-line)] text-[var(--color-accent)]">
                        <Shield className="h-3.5 w-3.5" />
                      </div>
                      <div className="space-y-0.5">
                        <h3 className="text-xs font-semibold text-[var(--color-ink)]">{sec.title}</h3>
                        <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">{sec.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 6. DATABASES */}
            {activeTab === 'databases' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Structured Storage</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Free Managed MySQL & MariaDB
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Provision isolated MySQL databases for CoreProtect, LuckPerms, Discord bot persistent stores, and web apps.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-2.5">
                  <h3 className="label">Connecting from LuckPerms / CoreProtect</h3>
                  <div className="p-3.5 rounded-md bg-[var(--color-bg)] font-mono text-[11px] text-[var(--color-ink-dim)] border border-[var(--color-line)] space-y-1">
                    <p className="text-[var(--color-ink-mute)]"># configuration.yml snippet</p>
                    <p>storage-method: MySQL</p>
                    <p>data:</p>
                    <p>&nbsp;&nbsp;address: database.aethercloud.net:3306</p>
                    <p>&nbsp;&nbsp;database: s12_luckperms</p>
                    <p>&nbsp;&nbsp;username: u12_user</p>
                    <p>&nbsp;&nbsp;password: "YOUR_GENERATED_PASSWORD"</p>
                  </div>
                </div>
              </section>
            )}

            {/* 7. SUBUSERS */}
            {activeTab === 'subusers' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Team Collaboration</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Subuser Granular Permissions
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Invite staff members and co-developers to manage server console, restart processes, or edit files without sharing master credentials.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'control.start', desc: 'Power Start' },
                    { id: 'control.stop', desc: 'Power Stop' },
                    { id: 'control.restart', desc: 'Reboot Server' },
                    { id: 'console.view', desc: 'Read Console' },
                    { id: 'console.send', desc: 'Send Commands' },
                    { id: 'file.read', desc: 'Read Files' },
                    { id: 'file.write', desc: 'Edit Files' },
                    { id: 'backup.create', desc: 'Make Backups' },
                    { id: 'database.view', desc: 'View DB Info' }
                  ].map((p) => (
                    <div key={p.id} className="p-3 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-1">
                      <div className="text-xs font-semibold text-[var(--color-ink)]">{p.desc}</div>
                      <div className="text-[10px] font-mono text-[var(--color-accent)]">{p.id}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 8. PANEL API */}
            {activeTab === 'api' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">Automation</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    REST API Integration
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Automate deployments, start/stop routines, and player telemetry using standard HTTP Bearer authentication.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <span className="label">Power State Endpoint</span>
                    <pre className="p-3.5 rounded-lg bg-[var(--color-bg)] font-mono text-[11px] text-[var(--color-ink-dim)] border border-[var(--color-line)] overflow-x-auto">
                      <code>{`POST /api/servers/{id}/power
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "action": "restart" // "start" | "stop" | "restart" | "kill"
}`}</code>
                    </pre>
                  </div>
                </div>
              </section>
            )}

            {/* 9. CUSTOM DOMAINS */}
            {activeTab === 'domains' && (
              <section className="space-y-6 anim-fade-in">
                <div className="space-y-2 pb-5 border-b border-[var(--color-line)]">
                  <div className="label text-[var(--color-accent)]">DNS Configuration</div>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
                    Connecting Your Custom Domain
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--color-ink-dim)] leading-relaxed max-w-2xl">
                    Set up clean join addresses like <code className="text-[var(--color-accent)]">play.yourdomain.com</code> without exposing raw numerical ports.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] space-y-2.5">
                    <h3 className="label">Cloudflare / Namecheap SRV Record</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)]">
                        <span className="text-[var(--color-ink-mute)] block text-[10px]">Type</span>
                        <span className="text-[var(--color-ink)] font-semibold">SRV</span>
                      </div>
                      <div className="p-2.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)]">
                        <span className="text-[var(--color-ink-mute)] block text-[10px]">Name</span>
                        <span className="text-[var(--color-ink)] font-semibold">_minecraft._tcp.play</span>
                      </div>
                      <div className="p-2.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)]">
                        <span className="text-[var(--color-ink-mute)] block text-[10px]">Target</span>
                        <span className="text-[var(--color-accent)] font-semibold">node-1.aethercloud.net</span>
                      </div>
                      <div className="p-2.5 rounded-md bg-[var(--color-bg)] border border-[var(--color-line)]">
                        <span className="text-[var(--color-ink-mute)] block text-[10px]">Port</span>
                        <span className="text-[var(--color-ink)] font-semibold">25565 (or assigned)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

          </div>
        </main>
      </div>

    </div>
  );
};
