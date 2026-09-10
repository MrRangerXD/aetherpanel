import React from 'react';
import { Github, Twitter, Shield, Heart, ExternalLink, Activity, BookOpen, Terminal, Sparkles } from 'lucide-react';
import { AetherLogo } from './AetherLogo';
import { useBranding } from '../lib/BrandingContext';

interface FooterProps {
  onNavigate: (page: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const { brandName, discordUrl, socialLinks, footerDescription } = useBranding();

  const activeDiscord = socialLinks?.discord || discordUrl;
  const activeTwitter = socialLinks?.twitter;
  const activeGithub = socialLinks?.github;

  return (
    <footer id="platform_footer" className="border-t border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md text-zinc-400 select-none">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          
          {/* Col 1: Brand & Socials */}
          <div className="space-y-4 md:col-span-1">
            <AetherLogo onClick={() => onNavigate('home')} />
            <p className="text-xs text-zinc-400 leading-relaxed">
              {footerDescription || 'High-performance Minecraft & Discord Bot hosting infrastructure built on high-clock compute nodes and enterprise NVMe storage.'}
            </p>
            <div className="flex items-center gap-3 text-zinc-400 pt-1">
              {activeDiscord && (
                <a
                  id="footer_social_discord"
                  href={activeDiscord}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-indigo-500/40 hover:text-indigo-400 hover:bg-zinc-850 transition-all flex items-center justify-center group"
                  aria-label="Discord Community"
                  title="Join Discord Community"
                >
                  <svg className="h-4 w-4 fill-current transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
              )}
              {activeTwitter && (
                <a
                  id="footer_social_twitter"
                  href={activeTwitter}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-sky-500/40 hover:text-sky-400 hover:bg-zinc-850 transition-all flex items-center justify-center group"
                  aria-label="X / Twitter"
                  title="Follow on Twitter / X"
                >
                  <Twitter className="h-4 w-4 transition-transform group-hover:scale-110" />
                </a>
              )}
              {activeGithub && (
                <a
                  id="footer_social_github"
                  href={activeGithub}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-500/40 hover:text-white hover:bg-zinc-850 transition-all flex items-center justify-center group"
                  aria-label="GitHub"
                  title="Source on GitHub"
                >
                  <Github className="h-4 w-4 transition-transform group-hover:scale-110" />
                </a>
              )}
            </div>
          </div>

          {/* Col 2: Hosting Products */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 font-mono">Hosting Products</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  id="footer_nav_minecraft_paper"
                  onClick={() => onNavigate('minecraft')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Minecraft Paper & Purpur</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_minecraft_forge"
                  onClick={() => onNavigate('minecraft')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Forge & Fabric Modpacks</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_bot_discord"
                  onClick={() => onNavigate('bot')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Discord Bots (Node.js & Python)</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_bot_bun"
                  onClick={() => onNavigate('bot')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Bun & Go Runtimes</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_pricing_nodes"
                  onClick={() => onNavigate('pricing')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Dedicated Compute Nodes</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 font-mono">Platform</h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <button
                  id="footer_nav_pricing"
                  onClick={() => onNavigate('pricing')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Plans & Pricing</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_status"
                  onClick={() => onNavigate('status')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>System Status (99.99%)</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_docs"
                  onClick={() => onNavigate('docs')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Documentation & Guides</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_jvm_flags"
                  onClick={() => onNavigate('docs')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Aikar's JVM Flags Guide</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_control_panel"
                  onClick={() => onNavigate('dashboard')}
                  className="text-left cursor-pointer text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5 font-semibold"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>Control Panel Access</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Security */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 font-mono">Legal & Security</h4>
            <ul className="space-y-2.5 text-xs mb-4">
              <li>
                <button
                  id="footer_nav_terms"
                  onClick={() => onNavigate('terms')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_privacy"
                  onClick={() => onNavigate('privacy')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_aup"
                  onClick={() => onNavigate('acceptable-use')}
                  className="text-left cursor-pointer text-zinc-400 hover:text-white transition-colors"
                >
                  Acceptable Use Policy
                </button>
              </li>
            </ul>
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
                <div className="flex items-center gap-2 text-white font-semibold mb-1">
                  <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>DDoS Mitigation</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Always-on L3/L4/L7 automated filtering shielding games and bots against volumetric attacks.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-zinc-400 font-medium">
            <span>© 2025–2026 {brandName || 'AetherPanel'}. All rights reserved.</span>
            <span className="text-zinc-700 hidden sm:inline">•</span>
            <button
              id="footer_bottom_terms"
              onClick={() => onNavigate('terms')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Terms
            </button>
            <button
              id="footer_bottom_privacy"
              onClick={() => onNavigate('privacy')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <button
              id="footer_bottom_aup"
              onClick={() => onNavigate('acceptable-use')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              AUP
            </button>
            <button
              id="footer_bottom_status"
              onClick={() => onNavigate('status')}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Status
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-zinc-500">
            <span>Engineered with</span>
            <Heart className="h-3 w-3 text-rose-500 fill-rose-500" />
            <span>for gaming & bot communities</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

