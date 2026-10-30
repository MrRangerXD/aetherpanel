import React from 'react';
import { Mail, ArrowRight } from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';

interface ContactProps {
  onNavigate?: (page: string) => void;
}

export const Contact: React.FC<ContactProps> = () => {
  const { supportEmail, discordUrl, socialLinks } = useBranding();

  const activeDiscord = socialLinks?.discord || discordUrl || 'https://discord.gg/orihost';
  const activeEmail = supportEmail || 'support@orihost.com';

  return (
    <div className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-2xl mx-auto text-center space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-ink)] tracking-tight">
          Contact Our <span className="text-[var(--color-accent)]">Engineering Team</span>
        </h1>
        <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed max-w-lg mx-auto">
          Need technical assistance, configuration guidance, or custom node allocations? Speak directly with the engineers running our network.
        </p>
      </div>

      <div className="space-y-3 max-w-lg mx-auto text-left">
        {/* Discord Community Row */}
        <a
          href={activeDiscord}
          target="_blank"
          rel="noreferrer noopener"
          className="p-4 rounded-lg surface border border-[var(--color-line)] hover:border-[var(--color-accent)] transition-colors flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md surface-2 border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </div>
            <div>
              <h2 className="text-xs font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                Discord Community
              </h2>
              <p className="text-[10px] text-[var(--color-ink-mute)] font-mono">
                &lt;15 min response
              </p>
            </div>
          </div>
          <span className="text-xs text-[var(--color-ink-mute)] group-hover:text-[var(--color-ink)] transition-colors flex items-center gap-1">
            <span>Join</span>
            <ArrowRight className="h-3 w-3" />
          </span>
        </a>

        {/* Email Inquiries Row */}
        <a
          href={`mailto:${activeEmail}`}
          className="p-4 rounded-lg surface border border-[var(--color-line)] hover:border-[var(--color-accent)] transition-colors flex items-center justify-between group cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-md surface-2 border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)] shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors">
                Email Inquiries
              </h2>
              <p className="text-[10px] text-[var(--color-ink-mute)] font-mono">
                &lt;1-2 hour response
              </p>
            </div>
          </div>
          <span className="text-xs text-[var(--color-ink-mute)] group-hover:text-[var(--color-ink)] transition-colors flex items-center gap-1">
            <span>Email</span>
            <ArrowRight className="h-3 w-3" />
          </span>
        </a>
      </div>
    </div>
  );
};
