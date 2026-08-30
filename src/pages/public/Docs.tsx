import React, { useState } from 'react';
import { 
  BookOpen, Terminal, Code, Cpu, Shield, HelpCircle, 
  ChevronRight, Layers, Database, Lock, Globe, 
  Zap, Server, HardDrive, Share2, AlertCircle
} from 'lucide-react';

type DocSection = 'getting-started' | 'minecraft' | 'bot' | 'sftp' | 'security' | 'databases' | 'subusers' | 'api' | 'domains';

export const Docs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DocSection>('getting-started');

  const categories = [
    { id: 'getting-started', name: 'Getting Started', icon: Zap },
    { id: 'minecraft', name: 'Minecraft Hosting', icon: Server },
    { id: 'bot', name: 'Discord Bot Deploy', icon: Code },
    { id: 'sftp', name: 'Files & SFTP', icon: HardDrive },
    { id: 'security', name: 'Security & Auth', icon: Shield },
    { id: 'databases', name: 'Databases', icon: Database },
    { id: 'subusers', name: 'Subuser Access', icon: Share2 },
    { id: 'api', name: 'Panel API', icon: Terminal },
    { id: 'domains', name: 'Custom Domains', icon: Globe },
  ];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar Navigation */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="sticky top-8 space-y-6">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-violet-600 rounded-lg">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-white tracking-tight">Documentation</h1>
              </div>
              <p className="text-xs text-zinc-500 mb-8 px-1 leading-relaxed">
                Comprehensive guides and references for the AetherPanel ecosystem.
              </p>
            </div>

            <nav className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveTab(cat.id as DocSection)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === cat.id 
                      ? 'bg-violet-600/10 text-violet-400 border border-violet-600/20 shadow-[0_0_20px_-5px_rgba(139,92,246,0.1)]' 
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50 border border-transparent'
                  }`}
                >
                  <cat.icon className={`h-4 w-4 ${activeTab === cat.id ? 'text-violet-400' : 'text-zinc-500'}`} />
                  {cat.name}
                </button>
              ))}
            </nav>

            <div className="pt-8 border-t border-zinc-800/50">
              <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <HelpCircle className="h-4 w-4 text-violet-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Need Help?</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">
                  Our community discord is active 24/7 for technical support.
                </p>
                <button 
                  onClick={() => window.open('https://discord.gg', '_blank')}
                  className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  Join Discord
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 max-w-3xl">
          <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-8 sm:p-10 backdrop-blur-sm">
            {activeTab === 'getting-started' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white">Welcome to AetherPanel</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    AetherPanel is a next-generation control plane designed for high-performance game hosting and application deployment. This guide will help you get your first instance running in minutes.
                  </p>
                </div>

                <div className="grid gap-6">
                  {[
                    { title: 'Create Account', desc: 'Register with your email and set up your dashboard preferences.' },
                    { title: 'Select Location', desc: 'Choose from our global high-frequency nodes for lowest latency.' },
                    { title: 'Instance Config', desc: 'Customize RAM, CPU, and Disk allocations for your specific workload.' },
                    { title: 'Go Live', desc: 'Our automated container engine deploys and starts your server instantly.' }
                  ].map((step, i) => (
                    <div key={i} className="flex gap-5 group">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-violet-400 group-hover:bg-violet-600 group-hover:text-white transition-colors border border-zinc-700">
                        {i + 1}
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">{step.title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex gap-4">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-xs text-amber-200/70 leading-relaxed italic">
                    <strong className="text-amber-500 not-italic uppercase font-bold tracking-wider mr-2">Note:</strong>
                    Ensure your node has sufficient resources before deploying large Minecraft modpacks or resource-heavy bots.
                  </p>
                </div>
              </section>
            )}

            {activeTab === 'minecraft' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Minecraft Server Optimization</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    AetherPanel automates the deployment of Paper, Spigot, Forge, and BungeeCord. We recommend using **PaperMC** for the best performance-to-feature ratio.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-violet-400" />
                    Recommended Startup Flags
                  </h3>
                  <div className="relative group">
                    <pre className="p-6 rounded-2xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50 leading-relaxed overflow-x-auto">
                      <code>{`# Optimization for 4GB+ RAM instances
java -Xms128M -XX:+UseG1GC -XX:+ParallelRefProcEnabled 
-XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions 
-XX:+DisableExplicitGC -XX:+AlwaysPreTouch 
-XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 
-XX:G1HeapRegionSize=8M -XX:G1ReservePercent=20 
-XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 
-XX:InitiatingHeapOccupancyPercent=15 -jar server.jar`}</code>
                    </pre>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Network Settings</h3>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-3 text-xs text-zinc-400">
                      <ChevronRight className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      <span><strong>Port Allocation:</strong> Every server receives a unique public port. Update your `server.properties` only if you know what you are doing.</span>
                    </li>
                    <li className="flex items-start gap-3 text-xs text-zinc-400">
                      <ChevronRight className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      <span><strong>Dedicated IP:</strong> Business plans include a dedicated IPv4 address for standard port 25565 access.</span>
                    </li>
                  </ul>
                </div>
              </section>
            )}

            {activeTab === 'bot' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Discord Bot Deployment</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Deploy bots built with Discord.js (Node.js) or Discord.py (Python). Our runtime environment handles lifecycle management automatically.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code className="h-4 w-4 text-cyan-400" />
                    Environment Variables
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Always use environment variables for sensitive tokens. You can set these in the <strong className="text-white">Startup</strong> tab of your server console.
                  </p>
                  <div className="p-6 rounded-2xl bg-zinc-950 font-mono text-[11px] text-cyan-400/80 border border-zinc-800/50 leading-relaxed">
                    <code>{`// Recommended Node.js Boilerplate
require('dotenv').config();
const { Client } = require('discord.js');

const client = new Client({ intents: [] });

// Reads from your Panel Startup configuration
client.login(process.env.BOT_TOKEN);`}</code>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'sftp' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">File Management & SFTP</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    AetherPanel features a real-time web file manager and full SFTP support for batch uploads and large file transfers.
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 space-y-3">
                    <Globe className="h-5 w-5 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">Web Manager</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Perfect for quick edits, log viewing, and folder organization directly in your browser.
                    </p>
                  </div>
                  <div className="p-6 rounded-2xl bg-zinc-800/40 border border-zinc-700/50 space-y-3">
                    <Zap className="h-5 w-5 text-violet-400" />
                    <h3 className="text-sm font-bold text-white">SFTP Protocol</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Connect via FileZilla or Cyberduck for high-speed uploads. Find credentials in the <strong className="text-white">Settings</strong> tab.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'security' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Security Standards</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    AetherPanel utilizes isolation at every layer to protect your data and the stability of our global node infrastructure.
                  </p>
                </div>

                <div className="space-y-6">
                  {[
                    { title: 'Docker Isolation', icon: Shield, desc: 'Every instance runs in its own isolated container with capped resources and limited network access.' },
                    { title: 'Encrypted Data', icon: Lock, desc: 'All credentials, API keys, and sensitive node telemetry are encrypted at rest using AES-256.' },
                    { title: 'Audit Logging', icon: Terminal, desc: 'Every administrative action is logged for accountability and security forensics.' }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-6 p-6 rounded-2xl bg-zinc-800/20 border border-zinc-800/50">
                      <div className="p-3 bg-zinc-800 rounded-xl flex-shrink-0 h-fit">
                        <item.icon className="h-5 w-5 text-violet-400" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-white">{item.title}</h3>
                        <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {activeTab === 'databases' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Database Management</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Integrated MySQL and PostgreSQL databases are available for plugins and applications requiring structured data persistence.
                  </p>
                </div>

                <div className="p-6 rounded-2xl bg-zinc-950/50 border border-zinc-800/50">
                  <h3 className="text-sm font-bold text-white mb-4">Quick Setup Guide</h3>
                  <ol className="space-y-4 text-xs text-zinc-400 leading-relaxed">
                    <li className="flex gap-3">
                      <span className="text-violet-400 font-bold">1.</span>
                      <span>Navigate to the **Databases** tab in your server console.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-violet-400 font-bold">2.</span>
                      <span>Click **Create Database** to generate unique credentials.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="text-violet-400 font-bold">3.</span>
                      <span>Use the provided host, database name, and password in your plugin config files.</span>
                    </li>
                  </ol>
                </div>
              </section>
            )}

            {activeTab === 'subusers' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Subuser Permissions</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Collaborate with your team safely. Grant specific access levels without sharing your primary account credentials.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white">Available Permissions</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      'server.view', 'server.start', 'server.stop', 
                      'console.view', 'console.send', 'files.edit',
                      'files.view', 'files.upload', 'backups.manage'
                    ].map((perm) => (
                      <div key={perm} className="px-3 py-2 rounded-lg bg-zinc-800/40 border border-zinc-700/50 text-[10px] font-mono text-zinc-300">
                        {perm}
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'api' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Panel API Reference</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Automate your infrastructure management with our RESTful API. Every panel feature is exposed via our secure endpoint.
                  </p>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-400" />
                    Authentication
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Include your API key in the `Authorization` header for all requests.
                  </p>
                  <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50">
                    <code>Authorization: Bearer ap_live_xxxxxxxxxxxx</code>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code className="h-4 w-4 text-violet-400" />
                    Get Server Status
                  </h3>
                  <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50">
                    <code>GET /api/v1/servers/&#123;id&#125;/status</code>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'domains' && (
              <section className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">Custom Domain Setup</h2>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    Point your own domain name to your game server for a professional appearance.
                  </p>
                </div>

                <div className="space-y-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white">SRV Record (Minecraft)</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Recommended for Minecraft Java Edition. Allows connection without specifying a port.
                    </p>
                    <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50 space-y-1">
                      <p>Type: SRV</p>
                      <p>Name: _minecraft._tcp.play</p>
                      <p>Target: your-node-ip.aetherpanel.com</p>
                      <p>Port: Your assigned port</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-white">A Record (Bots & Direct IP)</h3>
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Used for direct IP mapping. Note that port specification is still required for connection.
                    </p>
                    <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-zinc-400 border border-zinc-800/50 space-y-1">
                      <p>Type: A</p>
                      <p>Name: bot</p>
                      <p>Value: Node Public IPv4</p>
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

