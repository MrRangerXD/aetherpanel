import React from 'react';
import { Github, Twitter, Disc as Discord, Shield, Heart } from 'lucide-react';
import { AetherLogo } from './AetherLogo';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-zinc-800/80 bg-zinc-950 text-zinc-400">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          {/* Col 1 */}
          <div className="space-y-4 md:col-span-1">
            <AetherLogo onClick={() => onNavigate('home')} />
            <p className="text-xs text-zinc-400 leading-relaxed">
              Premium Minecraft & Discord Bot hosting infrastructure built on high-clock AMD Ryzen 9 nodes and NVMe enterprise storage.
            </p>
            <div className="flex items-center gap-3 text-zinc-400">
              <a href="https://discord.gg" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-zinc-900 hover:text-white hover:bg-zinc-800 transition-colors">
                <Discord className="h-4 w-4" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-zinc-900 hover:text-white hover:bg-zinc-800 transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2 rounded-lg bg-zinc-900 hover:text-white hover:bg-zinc-800 transition-colors">
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4 font-mono">Hosting Products</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => onNavigate('minecraft')} className="hover:text-white transition-colors">Minecraft Paper / Spigot</button>
              </li>
              <li>
                <button onClick={() => onNavigate('minecraft')} className="hover:text-white transition-colors">Forge & Fabric Modpacks</button>
              </li>
              <li>
                <button onClick={() => onNavigate('bot')} className="hover:text-white transition-colors">Discord Bot (Node.js & Python)</button>
              </li>
              <li>
                <button onClick={() => onNavigate('bot')} className="hover:text-white transition-colors">Bun & Go Bot Runtimes</button>
              </li>
              <li>
                <button onClick={() => onNavigate('pricing')} className="hover:text-white transition-colors">Enterprise Dedicated Nodes</button>
              </li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4 font-mono">Platform</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button onClick={() => onNavigate('pricing')} className="hover:text-white transition-colors">Plans & Pricing</button>
              </li>
              <li>
                <button onClick={() => onNavigate('status')} className="hover:text-white transition-colors flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  System Status (99.99%)
                </button>
              </li>
              <li>
                <button onClick={() => onNavigate('docs')} className="hover:text-white transition-colors">Documentation & Knowledgebase</button>
              </li>
              <li>
                <button onClick={() => onNavigate('docs')} className="hover:text-white transition-colors">Aikar's JVM Flags Guide</button>
              </li>
            </ul>
          </div>

          {/* Col 4 */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-4 font-mono">Security & Compliance</h4>
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
                <div className="flex items-center gap-2 text-white font-medium mb-1">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  <span>DDoS Protected Infrastructure</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Automated L3/L4/L7 mitigation filtering up to 3.2 Tbps attack traffic seamlessly.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="font-medium text-zinc-400">© 2025–2026 AetherPanel</p>
          <p className="flex items-center gap-1 text-zinc-500">
            Engineered with <Heart className="h-3 w-3 text-rose-500 fill-rose-500" /> for gaming and developer communities.
          </p>
        </div>
      </div>
    </footer>
  );
};
