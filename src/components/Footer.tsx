import React, { useState, useEffect } from 'react';
import { Github, Twitter, Shield, Heart, MousePointer } from 'lucide-react';
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

  const [cursorActive, setCursorActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('aether_custom_cursor') !== 'false';
  });

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent<{ enabled?: boolean }>;
      if (customEvent.detail && typeof customEvent.detail.enabled === 'boolean') {
        setCursorActive(customEvent.detail.enabled);
      }
    };
    window.addEventListener('aether-cursor-toggle', handleToggle);
    return () => window.removeEventListener('aether-cursor-toggle', handleToggle);
  }, []);

  return (
    <footer id="platform_footer" className="border-t border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink-dim)] select-none">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Col 1: Brand & Socials */}
          <div className="space-y-3 md:col-span-1">
            <AetherLogo onClick={() => onNavigate('home')} />
            <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
              {footerDescription || 'High-performance Minecraft & Discord Bot hosting infrastructure built on high-clock compute nodes and enterprise NVMe storage.'}
            </p>
            <div className="flex items-center gap-2 pt-1 text-[var(--color-ink-mute)]">
              {activeDiscord && (
                <a
                  id="footer_social_discord"
                  href={activeDiscord}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-line)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors flex items-center justify-center"
                  aria-label="Discord Community"
                  title="Join Discord Community"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
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
                  className="p-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-line)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors flex items-center justify-center"
                  aria-label="X / Twitter"
                  title="Follow on Twitter / X"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {activeGithub && (
                <a
                  id="footer_social_github"
                  href={activeGithub}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="p-1.5 rounded-md bg-[var(--color-surface)] border border-[var(--color-line)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] transition-colors flex items-center justify-center"
                  aria-label="GitHub"
                  title="Source on GitHub"
                >
                  <Github className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Col 2: Hosting Products */}
          <div>
            <div className="label mb-3">Hosting Products</div>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  id="footer_nav_minecraft_paper"
                  onClick={() => onNavigate('minecraft')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Minecraft Paper & Purpur
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_minecraft_forge"
                  onClick={() => onNavigate('minecraft')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Forge & Fabric Modpacks
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_bot_discord"
                  onClick={() => onNavigate('bot')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Discord Bots (Node.js & Python)
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_bot_bun"
                  onClick={() => onNavigate('bot')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Bun & Go Runtimes
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_pricing_nodes"
                  onClick={() => onNavigate('pricing')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Dedicated Compute Nodes
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Platform */}
          <div>
            <div className="label mb-3">Platform</div>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  id="footer_nav_contact_main"
                  onClick={() => onNavigate('contact')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Contact & Support
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_pricing"
                  onClick={() => onNavigate('pricing')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Plans & Pricing
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_status"
                  onClick={() => onNavigate('status')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors flex items-center gap-2"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-ok)]" />
                  <span>System Status (99.99%)</span>
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_docs"
                  onClick={() => onNavigate('docs')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Documentation & Guides
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_control_panel"
                  onClick={() => onNavigate('dashboard')}
                  className="text-left cursor-pointer text-[var(--color-accent)] hover:underline transition-colors font-medium"
                >
                  Control Panel Access →
                </button>
              </li>
            </ul>
          </div>

          {/* Col 4: Legal & Security */}
          <div>
            <div className="label mb-3">Legal & Security</div>
            <ul className="space-y-2 text-xs mb-3">
              <li>
                <button
                  id="footer_nav_terms"
                  onClick={() => onNavigate('terms')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Terms of Service
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_privacy"
                  onClick={() => onNavigate('privacy')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  id="footer_nav_aup"
                  onClick={() => onNavigate('acceptable-use')}
                  className="text-left cursor-pointer text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
                >
                  Acceptable Use Policy
                </button>
              </li>
            </ul>
            <div className="p-3 rounded-md bg-[var(--color-surface)] border border-[var(--color-line)] text-xs">
              <div className="flex items-center gap-1.5 text-[var(--color-ink)] font-medium mb-1">
                <Shield className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
                <span>DDoS Mitigation</span>
              </div>
              <p className="text-[11px] text-[var(--color-ink-mute)] leading-normal">
                Always-on automated filtering shielding games and bots against volumetric attacks.
              </p>
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="pt-6 border-t border-[var(--color-line)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--color-ink-mute)]">
          <div className="flex flex-wrap items-center gap-3">
            <span>© 2025–2026 AetherPanel. All rights reserved.</span>
            <span className="hidden sm:inline text-[var(--color-line)]">|</span>
            <button
              id="footer_bottom_terms"
              onClick={() => onNavigate('terms')}
              className="hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              Terms
            </button>
            <button
              id="footer_bottom_privacy"
              onClick={() => onNavigate('privacy')}
              className="hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              Privacy
            </button>
            <button
              id="footer_bottom_status"
              onClick={() => onNavigate('status')}
              className="hover:text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              Status
            </button>
            <span className="hidden sm:inline text-[var(--color-line)]">|</span>
            <button
              type="button"
              onClick={() => {
                const next = !cursorActive;
                setCursorActive(next);
                localStorage.setItem('aether_custom_cursor', next ? 'true' : 'false');
                window.dispatchEvent(new CustomEvent('aether-cursor-toggle', { detail: { enabled: next } }));
              }}
              className="inline-flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors cursor-pointer font-mono text-[11px]"
              title={cursorActive ? 'Disable custom cursor' : 'Enable custom cursor'}
            >
              <MousePointer className={`h-3 w-3 ${cursorActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
              <span>Cursor: {cursorActive ? 'ON' : 'OFF'}</span>
            </button>
          </div>
          <p className="flex items-center gap-1.5 text-[var(--color-ink-mute)]">
            <span>Engineered for gaming & bot communities</span>
          </p>
        </div>
      </div>
    </footer>
  );
};
