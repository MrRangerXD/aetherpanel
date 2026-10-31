import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Cpu, Zap, ShieldCheck, HardDrive,
  ArrowRight, Clock, ChevronDown, Shield,
  Check, ChevronRight, Star, FolderTree, History
} from 'lucide-react';
import { useBranding } from '../../lib/BrandingContext';
import { apiRequest } from '../../lib/api';
import { Plan, Product } from '../../types';
import { Marquee } from '../../components/ui/Marquee';
import { RotatingHero } from '../../components/home/RotatingHero';

interface HomeProps {
  onNavigate: (page: string, params?: any) => void;
}

const ScrollReveal: React.FC<{ children: React.ReactNode; className?: string; delayMs?: number }> = ({
  children,
  className = '',
  delayMs = 0
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export const Home: React.FC<HomeProps> = ({ onNavigate }) => {
  const { heroDescription, brandName, homepageConfig = {} } = useBranding();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState<string>('€');
  const [faqs, setFaqs] = useState<any[]>([]);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [plansRes, prodRes, setRes] = await Promise.all([
          apiRequest('/public/plans'),
          apiRequest('/public/products'),
          apiRequest('/public/settings')
        ]);

        if (plansRes.success && Array.isArray(plansRes.data)) {
          setPlans(plansRes.data);
        }
        if (prodRes.success && Array.isArray(prodRes.data)) {
          setProducts(prodRes.data.filter((p: Product) => p.isActive));
        }
        if (setRes.success && setRes.data?.currencySymbol) {
          setCurrencySymbol(setRes.data.currencySymbol);
        }
      } catch (err: any) {
        console.error('Failed to load public data:', err);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    const loadFaqs = async () => {
      try {
        const res = await apiRequest('/public/faqs');
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          setFaqs(res.data);
          setOpenFaqId(res.data[0].id);
        } else {
          const defaultFaqs = [
            {
              id: 'faq-1',
              category: 'plans',
              question: 'Can I upgrade my plan later?',
              answer: 'Yes, you can upgrade your plan at any time through our control panel with instant resource allocation and zero downtime.'
            },
            {
              id: 'faq-2',
              category: 'free',
              question: 'How can I get more server slots on the free panel?',
              answer: 'You can earn more server slots by completing community milestones, participating in Discord events, or upgrading to any of our affordable plans.'
            },
            {
              id: 'faq-3',
              category: 'auth',
              question: "How can I know my account's password if I logged in with Discord on the free panel?",
              answer: 'If you logged in via Discord OAuth, you can set a custom account password at any time via Account Settings or using the reset password feature.'
            },
            {
              id: 'faq-4',
              category: 'infrastructure',
              question: 'Where are your servers located?',
              answer: 'Our high-performance nodes are located in premier Tier-3 datacenters across North America and Europe, optimized for ultra-low ping and 99.99% uptime.'
            },
            {
              id: 'faq-5',
              category: 'billing',
              question: 'What payment methods do you accept?',
              answer: 'We accept all major credit/debit cards, PayPal, Google Pay, Apple Pay, and popular cryptocurrencies.'
            },
            {
              id: 'faq-6',
              category: 'free',
              question: 'What are the current max limits for resources when creating a server on the free tier?',
              answer: 'Free tier resources include up to 2GB DDR5 RAM, 1 shared vCPU core, and 10GB high-speed NVMe Gen4 storage with automated DDoS mitigation.'
            },
            {
              id: 'faq-7',
              category: 'policy',
              question: 'What are the most common reasons for server suspension?',
              answer: 'Common reasons include cryptocurrency mining, port scanning or stress testing, hosting malicious files, and repeated Terms of Service violations.'
            }
          ];
          setFaqs(defaultFaqs);
          setOpenFaqId(defaultFaqs[0].id);
        }
      } catch (err) {
        console.error('Failed to load FAQs:', err);
      }
    };
    loadFaqs();
  }, []);

  const userTestimonials = useMemo(() => [
    {
      id: 'rev-1',
      name: 'Clover Jordan',
      role: 'CUSTOMER',
      quote: 'Honestly, this is one of the better server hosting sites that I have used! Easy, good support when something breaks, and always is fixed within one hour! All good!'
    },
    {
      id: 'rev-2',
      name: 'propilot5000',
      role: 'CUSTOMER',
      quote: 'They offer a really fair amount of resources for free and they have an active support team!'
    },
    {
      id: 'rev-3',
      name: 'Yusuf Enes Keleş',
      role: 'CUSTOMER',
      quote: 'In one word, it is an excellent hosting provider, I recommend it to everyone to use it.'
    }
  ], []);

  const availableCategories = useMemo(() => {
    if (products.length > 0) {
      return products.map(p => ({
        id: p.category || (p.slug === 'bot' ? 'bot' : 'minecraft'),
        name: p.name,
        slug: p.slug,
        productId: p.id,
        description: p.description
      }));
    }
    return [
      { id: 'minecraft', name: 'Minecraft', slug: 'minecraft', productId: 'prod_minecraft', description: 'Single-thread dominance powered by AMD Ryzen 9 7950X silicon and PCIe Gen4 NVMe arrays for zero TPS drops.' },
      { id: 'bot', name: 'Bot', slug: 'bot', productId: 'prod_bot', description: 'Deploy your bots on high-performance nodes with dedicated resources and 24/7 uptime.' }
    ];
  }, [products]);

  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('minecraft');

  const currentCategoryMeta = useMemo(() => {
    return availableCategories.find(c => c.id === activeCategoryTab) || availableCategories[0];
  }, [availableCategories, activeCategoryTab]);

  const categoryPlans = useMemo(() => {
    const isBot = activeCategoryTab === 'bot';
    const filtered = plans.filter(p => {
      if (isBot) return p.productId === 'prod_bot' || p.id.startsWith('plan_bot');
      return p.productId === 'prod_minecraft' || p.id.startsWith('plan_mc');
    });

    if (filtered.length > 0) {
      return filtered.sort((a, b) => a.ramMB - b.ramMB);
    }

    if (isBot) {
      return [
        { id: 'plan_bot_free', name: 'Free Bot Tier', description: 'Small bots & testing.', priceMonthly: 0.00, ramMB: 512, cpuCores: 0.5, diskGB: 10, isFree: true },
        { id: 'plan_bot_starter', name: 'Tier 1', description: 'Small bots.', priceMonthly: 1.00, ramMB: 1024, cpuCores: 1, diskGB: 10 },
        { id: 'plan_bot_basic', name: 'Tier 2', description: 'Medium community bot.', priceMonthly: 2.20, ramMB: 2048, cpuCores: 1.5, diskGB: 20 },
        { id: 'plan_bot_pro', name: 'Tier 3', description: 'Multi-shard active bot.', priceMonthly: 4.50, ramMB: 4096, cpuCores: 2, diskGB: 35 },
        { id: 'plan_bot_cluster', name: 'Tier 4', description: 'High-throughput cluster.', priceMonthly: 8.90, ramMB: 8192, cpuCores: 3, diskGB: 60 }
      ];
    } else {
      return [
        { id: 'plan_mc_free', name: 'Free Tier', description: 'Testing, small worlds & vanilla testing.', priceMonthly: 0.00, ramMB: 1024, cpuCores: 1, diskGB: 15, isFree: true },
        { id: 'plan_mc_starter', name: 'Dirt Tier', description: 'Vanilla / Small SMP with friends.', priceMonthly: 2.99, ramMB: 2048, cpuCores: 1, diskGB: 20 },
        { id: 'plan_mc_basic', name: 'Iron Tier', description: 'Paper / Purpur 1.21.4 with plugins.', priceMonthly: 5.50, ramMB: 3072, cpuCores: 2, diskGB: 30 },
        { id: 'plan_mc_pro', name: 'Diamond Tier', description: 'Heavily modded Forge or Fabric server.', priceMonthly: 9.99, ramMB: 4096, cpuCores: 3, diskGB: 50 },
        { id: 'plan_mc_ultra', name: 'Netherite Tier', description: 'Public SMP with high concurrent players.', priceMonthly: 18.99, ramMB: 6144, cpuCores: 4, diskGB: 75 },
        { id: 'plan_mc_network', name: 'Bedrock Tier', description: 'Velocity / BungeeCord network hub.', priceMonthly: 34.99, ramMB: 8192, cpuCores: 6, diskGB: 120 }
      ];
    }
  }, [plans, activeCategoryTab]);

  const ramSteps = useMemo(() => {
    return categoryPlans.map(p => p.ramMB);
  }, [categoryPlans]);

  const minRam = ramSteps.length > 0 ? ramSteps[0] : 1024;
  const maxRam = ramSteps.length > 0 ? ramSteps[ramSteps.length - 1] : 8192;

  const [selectedRamMB, setSelectedRamMB] = useState<number>(minRam);

  useEffect(() => {
    if (ramSteps.length > 0) {
      const defaultTier = categoryPlans.find(p => p.priceMonthly > 0) || categoryPlans[0];
      setSelectedRamMB(defaultTier ? defaultTier.ramMB : ramSteps[0]);
    }
  }, [activeCategoryTab, categoryPlans, ramSteps]);

  const activeSelectedPlan = useMemo(() => {
    const found = categoryPlans.find(p => p.ramMB === selectedRamMB);
    if (found) return found;
    let closest = categoryPlans[0];
    let minDiff = Math.abs(closest.ramMB - selectedRamMB);
    for (const p of categoryPlans) {
      const diff = Math.abs(p.ramMB - selectedRamMB);
      if (diff < minDiff) {
        closest = p;
        minDiff = diff;
      }
    }
    return closest;
  }, [categoryPlans, selectedRamMB]);

  const categoryFeatureChecks = useMemo(() => {
    if (activeCategoryTab === 'bot') {
      return ['DDoS Protection', 'Daily Backups', 'SFTP Access', 'Database'];
    }
    return ['3.2 Tbps DDoS Scrubbing', 'Automated Daily S3 Backups', 'Web SFTP & Fast Unzip', 'Free MySQL Database'];
  }, [activeCategoryTab]);

  const formatRamString = (ramMB: number) => {
    if (ramMB < 1024) return `${ramMB} MB`;
    const gb = ramMB / 1024;
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)} GB`;
  };

  return (
    <div className="relative overflow-x-hidden bg-[var(--color-bg)] min-h-screen text-[var(--color-ink)] selection:bg-[var(--color-accent)] selection:text-white">

      {/* ─────────────────────────────────────────────────────────────────────────────
          1. ROTATING HERO BACKGROUND & SERVICE CAROUSEL (ORIHOST STYLE)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="relative w-full">
        <RotatingHero
          onNavigate={onNavigate}
          onSelectCategory={(cat) => {
            if (cat === 'minecraft') setActiveCategoryTab('minecraft');
            else setActiveCategoryTab('bot');
          }}
        />
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          2. MARQUEE STRIP (PARTNER / FEATURE TEXT UNDER HERO)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section className="border-b border-[var(--color-line)] bg-[var(--color-surface)] py-3">
        <Marquee speed={32}>
          <div className="flex items-center gap-8 text-xs font-mono text-[var(--color-ink-mute)]">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
              AMD Ryzen 9 7950X
            </span>
            <span>·</span>
            <span>PCIe Gen4 NVMe 7,000 MB/s</span>
            <span>·</span>
            <span className="text-[var(--color-ok)]">99.99% Uptime SLA</span>
            <span>·</span>
            <span>3.2 Tbps Anycast DDoS Scrubbing</span>
            <span>·</span>
            <span>Automated S3 Backups</span>
            <span>·</span>
            <span>Pterodactyl Daemon</span>
            <span>·</span>
            <span>&lt;30s Provisioning</span>
            <span>·</span>
            <span>Global Tier-3 Nodes</span>
          </div>
        </Marquee>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          3. INTERACTIVE PRODUCT & TIER SLIDER SHOWCASE
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="pricing" className="scroll-mt-14">
        <div id="plans-showcase" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <ScrollReveal>
            <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-6 sm:p-8">
              
              {/* Category Tabs */}
              <div className="flex justify-center mb-8">
                <div className="inline-flex p-1 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)]">
                  {availableCategories.map((cat) => {
                    const isActive = activeCategoryTab === cat.id;
                    const cleanName = cat.name.replace(/\s*Hosting\s*$/i, '');
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setActiveCategoryTab(cat.id)}
                        className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border border-[var(--color-line)]'
                            : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)]'
                        }`}
                      >
                        {cleanName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2-Column Showcase */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                {/* Left Column: Title, Subtitle, Features & RAM Slider */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-ink)] tracking-tight">
                      {currentCategoryMeta.name.replace(/\s*Hosting\s*$/i, '')} Hosting
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--color-ink-mute)] leading-relaxed mt-2 max-w-lg font-normal">
                      {currentCategoryMeta.description}
                    </p>
                  </div>

                  {/* 2x2 Feature Checks */}
                  <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs text-[var(--color-ink-dim)]">
                    {categoryFeatureChecks.map((chk, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" />
                        <span>{chk}</span>
                      </div>
                    ))}
                  </div>

                  {/* RAM Range Slider */}
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="label">RAM</span>
                      <span className="text-xl font-bold text-[var(--color-ink)] font-mono">
                        {formatRamString(activeSelectedPlan.ramMB)}
                      </span>
                    </div>

                    {(() => {
                      const currentIndex = ramSteps.indexOf(activeSelectedPlan.ramMB) !== -1 ? ramSteps.indexOf(activeSelectedPlan.ramMB) : 0;
                      const maxIndex = Math.max(1, ramSteps.length - 1);
                      const percent = (currentIndex / maxIndex) * 100;

                      const updateFromClientX = (clientX: number, target: HTMLElement) => {
                        const rect = target.getBoundingClientRect();
                        const clickX = clientX - rect.left;
                        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
                        const targetIdx = Math.round(ratio * maxIndex);
                        if (ramSteps[targetIdx] !== undefined) {
                          setSelectedRamMB(ramSteps[targetIdx]);
                        }
                      };

                      const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId);
                        } catch {}
                        updateFromClientX(e.clientX, e.currentTarget);
                      };

                      const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
                        if (e.buttons === 1) {
                          updateFromClientX(e.clientX, e.currentTarget);
                        }
                      };

                      const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
                        try {
                          e.currentTarget.releasePointerCapture(e.pointerId);
                        } catch {}
                      };

                      return (
                        <div className="relative pt-1 pb-1">
                          <div
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={handlePointerUp}
                            className="relative h-2 w-full rounded-full bg-[var(--color-surface-2)] border border-[var(--color-line)] cursor-pointer select-none touch-none"
                          >
                            <div
                              className="absolute top-0 left-0 h-full rounded-full bg-[var(--color-accent)] pointer-events-none"
                              style={{ width: `${percent}%` }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border border-[var(--color-line)] pointer-events-none"
                              style={{ left: `${percent}%` }}
                            />
                          </div>

                          <input
                            type="range"
                            min={0}
                            max={maxIndex}
                            step={1}
                            value={currentIndex}
                            onChange={(e) => {
                              const index = parseInt(e.target.value, 10);
                              if (ramSteps[index] !== undefined) {
                                setSelectedRamMB(ramSteps[index]);
                              }
                            }}
                            className="sr-only"
                            aria-label="Select RAM allocation"
                          />
                        </div>
                      );
                    })()}

                    <div className="flex justify-between text-[11px] font-mono text-[var(--color-ink-mute)]">
                      <span>{formatRamString(minRam)}</span>
                      <span>{formatRamString(maxRam)}</span>
                    </div>
                  </div>

                </div>

                {/* Right Column: Spec Card */}
                <div className="lg:col-span-5">
                  <div className="rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-line)] p-5 space-y-4">
                    
                    <div className="flex items-baseline justify-between border-b border-[var(--color-line)] pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-[var(--color-ink)]">
                            {activeSelectedPlan.name}
                          </h3>
                          {activeSelectedPlan.priceMonthly === 0 && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30">
                              FREE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--color-ink-mute)] mt-0.5">
                          {activeSelectedPlan.description || 'Dedicated container instance'}
                        </p>
                      </div>

                      <div className="text-right">
                        {activeSelectedPlan.priceMonthly === 0 ? (
                          <span className="text-2xl font-bold text-[var(--color-ok)]">FREE</span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold text-[var(--color-ink)] font-mono">
                              {currencySymbol}{activeSelectedPlan.priceMonthly.toFixed(2)}
                            </span>
                            <span className="text-[11px] text-[var(--color-ink-mute)] font-mono">/mo</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Specs List */}
                    <div className="space-y-2.5 text-xs font-mono">
                      <div className="flex items-center justify-between text-[var(--color-ink-dim)]">
                        <span className="label">CPU</span>
                        <strong className="text-[var(--color-ink)] font-medium">
                          {activeSelectedPlan.cpuCores} vCPU ({activeCategoryTab === 'minecraft' ? '5.7GHz' : 'Dedicated'})
                        </strong>
                      </div>
                      <div className="h-px bg-[var(--color-line)]" />

                      <div className="flex items-center justify-between text-[var(--color-ink-dim)]">
                        <span className="label">RAM</span>
                        <strong className="text-[var(--color-ink)] font-medium">
                          {formatRamString(activeSelectedPlan.ramMB)} DDR5
                        </strong>
                      </div>
                      <div className="h-px bg-[var(--color-line)]" />

                      <div className="flex items-center justify-between text-[var(--color-ink-dim)]">
                        <span className="label">Storage</span>
                        <strong className="text-[var(--color-ink)] font-medium">
                          {activeSelectedPlan.diskGB} GB NVMe
                        </strong>
                      </div>
                      <div className="h-px bg-[var(--color-line)]" />

                      <div className="flex items-center justify-between text-[var(--color-ink-dim)]">
                        <span className="label">Uptime</span>
                        <strong className="text-[var(--color-ok)] font-medium">99.99%</strong>
                      </div>
                    </div>

                    {/* Deploy CTA */}
                    <div className="pt-2 space-y-2">
                      <button
                        type="button"
                        onClick={() => onNavigate('register', { planId: activeSelectedPlan.id })}
                        className="btn btn-primary h-9 w-full text-xs"
                      >
                        <span>Deploy {activeSelectedPlan.name}</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>

                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <button
                          type="button"
                          onClick={() => onNavigate('pricing')}
                          className="text-[var(--color-accent)] hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
                        >
                          <span>All Plans</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const freePlan = categoryPlans.find(p => p.priceMonthly === 0);
                            if (freePlan) setSelectedRamMB(freePlan.ramMB);
                            else onNavigate('register');
                          }}
                          className="text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                        >
                          Start for Free
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          4. INFRASTRUCTURE HIGHLIGHTS (FLAT BENTO CARDS)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="infrastructure" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[var(--color-line)] scroll-mt-14">
        <ScrollReveal>
          <div className="max-w-2xl mb-10 text-left">
            <h2 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
              Hardware & Network
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-ink-mute)] mt-1.5 leading-relaxed">
              No oversold CPU cores or congested shared hypervisors. Pure bare-metal throughput for seamless gameplay and 24/7 bots.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ScrollReveal delayMs={30}>
            <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-2.5">
              <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
                <Cpu className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">5.7GHz Single-Core Boost</h3>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                Game loops execute on a single core. AMD Ryzen 9 7950X silicon guarantees zero tick drops during heavy player loads and TNT physics.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={60}>
            <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-2.5">
              <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
                <HardDrive className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">7,000 MB/s Gen4 NVMe</h3>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                PCIe 4.0 storage arrays eliminate chunk generation stutter and save-world lag. Load 100+ modpacks without freezing.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={90}>
            <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-2.5">
              <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-ok)]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">3.2 Tbps Always-On DDoS Filter</h3>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                Automated hardware Anycast filters absorb volumetric attacks instantly. Never get null-routed or disconnected mid-game.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={120}>
            <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-2.5">
              <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
                <FolderTree className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">In-Browser SFTP File Manager</h3>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                Drag-and-drop world folders, edit config files in browser with syntax highlighting, and extract massive ZIP modpacks in 3 seconds.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={150}>
            <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-2.5">
              <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
                <History className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Automated Offsite Snapshots</h3>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                Scheduled daily and weekly backups replicated offsite to secure S3 vaults with 1-click instant rollback.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal delayMs={180}>
            <div className="p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-2.5">
              <div className="h-8 w-8 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] flex items-center justify-center text-[var(--color-accent)]">
                <Zap className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">1.2s Auto-Restart Watchdog</h3>
              <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                Process-level supervisor detects memory leaks or crash exits and revives terminated bots or game servers within seconds.
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          5. TESTIMONIALS (FLAT MONOCHROME CARDS)
      ───────────────────────────────────────────────────────────────────────────── */}
      <section id="reviews" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[var(--color-line)]">
        <ScrollReveal>
          <div className="text-left mb-8">
            <h2 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
              Customer Feedback
            </h2>
            <p className="text-xs text-[var(--color-ink-mute)] mt-1">
              Verified server owners running on our infrastructure.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {userTestimonials.slice(0, 3).map((t, index) => (
            <ScrollReveal key={t.id} delayMs={index * 40}>
              <div className="h-full flex flex-col justify-between p-5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] hover:bg-[var(--color-surface-2)] transition-colors space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-[var(--color-warn)]">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current text-[var(--color-warn)]" />
                    ))}
                  </div>
                  <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed">
                    "{t.quote}"
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--color-line)]">
                  <div className="text-xs font-semibold text-[var(--color-ink)]">{t.name}</div>
                  <div className="label mt-0.5">{t.role}</div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────────
          6. FAQ SECTION (CLEAN HAIRLINE ACCORDION)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showFaqSection !== false && (
        <section id="faq" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[var(--color-line)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-2">
              <ScrollReveal>
                <h2 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
                  Frequently Asked Questions
                </h2>
                <p className="text-xs text-[var(--color-ink-mute)] mt-1 leading-relaxed">
                  Common questions regarding infrastructure, resources, and billing.
                </p>
              </ScrollReveal>
            </div>

            <div className="lg:col-span-7 divide-y divide-[var(--color-line)] border-t border-b border-[var(--color-line)]">
              {faqs.map((faq, index) => {
                const isOpen = openFaqId === faq.id;
                return (
                  <ScrollReveal key={faq.id} delayMs={index * 20}>
                    <div className="py-0.5">
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        className="w-full py-3.5 flex items-center justify-between text-left text-xs sm:text-sm font-medium text-[var(--color-ink)] hover:text-white transition-colors cursor-pointer gap-4"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 text-[var(--color-ink-mute)] shrink-0 transition-transform duration-150 ${
                            isOpen ? 'rotate-180 text-[var(--color-accent)]' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="pb-3.5 text-xs text-[var(--color-ink-mute)] leading-relaxed pr-4 anim-fade-up">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────────────────
          7. FINAL CALL TO ACTION (FLAT SURFACE, SHARP BORDERS)
      ───────────────────────────────────────────────────────────────────────────── */}
      {homepageConfig.showCtaSection !== false && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-[var(--color-line)]">
          <ScrollReveal>
            <div className="rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] p-8 sm:p-12 text-center">
              <div className="max-w-md mx-auto space-y-3">
                <span className="label block">
                  {homepageConfig.ctaEyebrow || 'Ready to Deploy?'}
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-[var(--color-ink)] tracking-tight">
                  {homepageConfig.ctaHeading || 'Start hosting on bare-metal infrastructure.'}
                </h2>
                <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                  {homepageConfig.ctaDescription || 'Get your server deployed in under 30 seconds with 99.99% verified SLA.'}
                </p>

                <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate(homepageConfig.ctaPrimaryPage || 'register')}
                    className="btn btn-primary h-9 px-5 text-xs w-full sm:w-auto"
                  >
                    <span>{homepageConfig.ctaPrimaryText || 'Get Started'}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(homepageConfig.ctaSecondaryPage || 'pricing')}
                    className="btn btn-ghost h-9 px-5 text-xs border border-[var(--color-line)] w-full sm:w-auto"
                  >
                    <span>{homepageConfig.ctaSecondaryText || 'View Plans'}</span>
                  </button>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </section>
      )}

    </div>
  );
};
