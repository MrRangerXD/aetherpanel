import React from 'react';
import { Heart, Target, Sliders, Scale } from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';

interface AboutProps {
  onNavigate?: (page: string) => void;
}

export const About: React.FC<AboutProps> = () => {
  const { brandName } = useBranding();
  const currentBrand = brandName || 'Orihost';

  return (
    <div className="w-full py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-10">
      {/* 1. Header & Story Intro */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl sm:text-4xl font-bold text-[var(--color-ink)] tracking-tight">
          Infrastructure Expertise & Reliability
        </h1>
        <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed max-w-2xl mx-auto">
          {currentBrand} was created to deliver fast, dependable cloud compute and server hosting without artificial markups or bloated interfaces.
        </p>
      </div>

      {/* 2. Key Numbers */}
      <div className="rounded-lg surface border border-[var(--color-line)] p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-center divide-y md:divide-y-0 md:divide-x divide-[var(--color-line)]">
        <div className="space-y-0.5 pt-1 md:pt-0">
          <div className="text-2xl font-bold text-[var(--color-ink)] font-mono">2024</div>
          <div className="label">Established</div>
        </div>
        <div className="space-y-0.5 pt-2 md:pt-0">
          <div className="text-2xl font-bold text-[var(--color-ok)] font-mono">99.85%</div>
          <div className="label">Uptime SLA</div>
        </div>
        <div className="space-y-0.5 pt-2 md:pt-0">
          <div className="text-2xl font-bold text-[var(--color-ink)] font-mono">30,000+</div>
          <div className="label">Accounts</div>
        </div>
        <div className="space-y-0.5 pt-2 md:pt-0">
          <div className="text-2xl font-bold text-[var(--color-accent)] font-mono">3,000+</div>
          <div className="label">Active Containers</div>
        </div>
      </div>

      {/* 3. Detailed Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-lg surface border border-[var(--color-line)]">
          <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
            Our infrastructure is built for developers and server administrators requiring fast NVMe I/O, modern Java runtimes, containerized execution, and multi-tier DDoS filtering.
          </p>
        </div>

        <div className="p-5 rounded-lg surface border border-[var(--color-line)]">
          <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
            Supported by technical engineers who understand backend architectures, process supervision, low-latency gaming protocols, and database performance.
          </p>
        </div>
      </div>

      {/* 4. Core Principles */}
      <div className="space-y-5 pt-2">
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
            Our Principles
          </h2>
          <p className="text-xs text-[var(--color-ink-mute)]">
            Engineering excellence, honest quotas, and transparent performance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div className="p-4 rounded-lg surface border border-[var(--color-line)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-xs">
              <Heart className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
              <span>Developer-First</span>
            </div>
            <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
              Clean APIs, direct SFTP access, automated backups, and instant server management without bloated complexity.
            </p>
          </div>

          <div className="p-4 rounded-lg surface border border-[var(--color-line)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-xs">
              <Target className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
              <span>Uptime Priority</span>
            </div>
            <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
              Every minute counts. Redundant network routes and health supervisors guarantee high container availability.
            </p>
          </div>

          <div className="p-4 rounded-lg surface border border-[var(--color-line)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-xs">
              <Sliders className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
              <span>Streamlined Control</span>
            </div>
            <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
              Dense, focused interface inspired by Linear and high-productivity developer toolchains.
            </p>
          </div>

          <div className="p-4 rounded-lg surface border border-[var(--color-line)] space-y-1.5">
            <div className="flex items-center gap-2 text-[var(--color-ink)] font-semibold text-xs">
              <Scale className="h-4 w-4 text-[var(--color-accent)] shrink-0" />
              <span>Transparent Pricing</span>
            </div>
            <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
              Fair resource pricing with zero hidden charges, automated renewals, or unpredictable bill shock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
