import React, { useState } from 'react';
import { BookOpen, Terminal, Code, Cpu, Shield, HelpCircle, ChevronRight } from 'lucide-react';

export const Docs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'getting-started' | 'minecraft' | 'bot' | 'sftp'>('getting-started');

  return (
    <div className="space-y-8 py-8 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">AetherPanel Documentation</h1>
        </div>
        <p className="text-xs text-zinc-400 mt-1">Guides, setup instructions, and configuration reference for server owners.</p>
      </div>

      {/* Navigation tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('getting-started')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'getting-started' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-900'
          }`}
        >
          Getting Started
        </button>
        <button
          onClick={() => setActiveTab('minecraft')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'minecraft' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-900'
          }`}
        >
          Minecraft Server Setup
        </button>
        <button
          onClick={() => setActiveTab('bot')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'bot' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-900'
          }`}
        >
          Discord Bot Deploy
        </button>
        <button
          onClick={() => setActiveTab('sftp')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'sftp' ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white bg-zinc-900'
          }`}
        >
          SFTP & File Manager
        </button>
      </div>

      {/* Content */}
      {activeTab === 'getting-started' && (
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-base font-bold text-white">Quick Start Guide</h2>
          <ol className="list-decimal list-inside space-y-3 text-zinc-400">
            <li><strong className="text-white">Create an Account:</strong> Register your account or use your existing credentials.</li>
            <li><strong className="text-white">Choose a Plan:</strong> Navigate to the "Deploy Server" wizard and select your product category (Minecraft vs Discord Bot).</li>
            <li><strong className="text-white">Configure Server:</strong> Choose your server name, software (Paper, Spigot, Node.js, Python), and node location.</li>
            <li><strong className="text-white">Automated Deployment:</strong> The container engine allocates memory, IP address, and port in under 30 seconds.</li>
            <li><strong className="text-white">Connect:</strong> Copy your IP:Port from the server console or server card and start playing!</li>
          </ol>
        </div>
      )}

      {activeTab === 'minecraft' && (
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-base font-bold text-white">Minecraft Java & Bedrock Configuration</h2>
          <p className="text-zinc-400">
            AetherPanel supports all major server jars with Java 17 and Java 21 pre-installed.
          </p>

          <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-violet-300 border border-zinc-800 space-y-1">
            <p># Recommended Paper JVM Flags (Aikar's Flags)</p>
            <p>-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions</p>
            <p>-XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40</p>
          </div>
        </div>
      )}

      {activeTab === 'bot' && (
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-base font-bold text-white">Discord Bot Deployment Guide</h2>
          <p className="text-zinc-400">
            Ensure your bot script reads environment variables using <code className="text-cyan-400">process.env.DISCORD_TOKEN</code> or <code className="text-cyan-400">os.getenv("DISCORD_TOKEN")</code>.
          </p>

          <div className="p-4 rounded-xl bg-zinc-950 font-mono text-[11px] text-cyan-300 border border-zinc-800 space-y-1">
            <p>// Node.js entry point index.js</p>
            <p>const &#123; Client &#125; = require('discord.js');</p>
            <p>const client = new Client(&#123; intents: [] &#125;);</p>
            <p>client.login(process.env.DISCORD_TOKEN);</p>
          </div>
        </div>
      )}

      {activeTab === 'sftp' && (
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800">
          <h2 className="text-base font-bold text-white">Web File Manager & SFTP Access</h2>
          <p className="text-zinc-400">
            You can upload plugins, mods, world files, and scripts directly through the built-in Web File Manager or connect via FileZilla / Cyberduck using your SFTP credentials.
          </p>
        </div>
      )}
    </div>
  );
};
