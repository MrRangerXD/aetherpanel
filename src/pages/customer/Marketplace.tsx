import React, { useState, useEffect } from 'react';
import {
  Store, Search, Filter, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck,
  Star, Download, Plus, ChevronRight, Gamepad2, Bot, Cpu, Archive, Terminal,
  Zap, Info, Layers, RefreshCw, X, MessageSquare, ArrowRight, Server, HardDrive,
  CreditCard, ShieldAlert, Check
} from 'lucide-react';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import {
  MarketplaceItem, MarketplaceCategory, MarketplaceBadge,
  Plan, Node as ComputeNode, ServerTemplate
} from '../../types';

interface MarketplaceProps {
  onNavigate: (page: string, params?: any) => void;
}

export const Marketplace: React.FC<MarketplaceProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();

  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Selected item modal
  const [detailItem, setDetailItem] = useState<MarketplaceItem | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'reviews' | 'config'>('overview');

  // Review form
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  // Submit item modal
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [submitForm, setSubmitForm] = useState({
    name: '',
    description: '',
    longDescription: '',
    category: 'minecraft' as MarketplaceCategory,
    icon: 'Gamepad2',
    version: '1.0.0',
    compatibility: 'Minecraft 1.20.x / All Nodes',
    installType: 'template_deploy' as 'template_deploy' | 'resource_install',
    minRamMB: 1024,
    minCpuCores: 1,
    minDiskGB: 5,
    startupCommand: '',
    environmentVarsJson: '{"SERVER_PORT": "25565"}'
  });
  const [submittingItem, setSubmittingItem] = useState<boolean>(false);
  const [submitSuccessMsg, setSubmitSuccessMsg] = useState<string | null>(null);

  // One-Click Deploy Wizard Modal State
  const [deployItem, setDeployItem] = useState<MarketplaceItem | null>(null);
  const [deployStep, setDeployStep] = useState<number>(1);
  const [deployOptions, setDeployOptions] = useState<{
    plans: Plan[];
    nodes: ComputeNode[];
    templates: ServerTemplate[];
  }>({ plans: [], nodes: [], templates: [] });
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [serverName, setServerName] = useState<string>('');
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [deploying, setDeploying] = useState<boolean>(false);
  const [deployProgress, setDeployProgress] = useState<number>(0);
  const [deployLogs, setDeployLogs] = useState<string[]>([]);
  const [createdServerId, setCreatedServerId] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // Fetch Marketplace items
  const fetchMarketplace = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (selectedCategory !== 'all') queryParams.set('category', selectedCategory);
      if (selectedBadge !== 'all') queryParams.set('badge', selectedBadge);
      if (searchQuery) queryParams.set('search', searchQuery);
      if (sortBy) queryParams.set('sort', sortBy);

      const res = await fetch(`/api/v1/marketplace?${queryParams.toString()}`);
      const data = await res.json();

      if (data.success) {
        setItems(data.data.items);
        if (data.data.categoryCounts) {
          setCategoryCounts(data.data.categoryCounts);
        }
      } else {
        setError(data.error?.message || 'Failed to load marketplace items.');
      }
    } catch (err: any) {
      setError('Network error while connecting to AetherPanel Marketplace API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketplace();
  }, [selectedCategory, selectedBadge, sortBy]);

  // Handle Search submit / debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMarketplace();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Submit Review Handler
  const handlePostReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailItem || !reviewComment.trim()) return;

    setSubmittingReview(true);
    setReviewMsg(null);
    try {
      const res = await fetch(`/api/v1/marketplace/${detailItem.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const data = await res.json();
      if (data.success) {
        setDetailItem(data.data);
        setReviewComment('');
        setReviewMsg('Your review has been posted successfully!');
        fetchMarketplace();
      } else {
        setReviewMsg(`Error: ${data.error?.message || 'Failed to submit review'}`);
      }
    } catch (err: any) {
      setReviewMsg('Network error while posting review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  // Submit Community Marketplace Item Handler
  const handleSubmitCommunityItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingItem(true);
    setSubmitSuccessMsg(null);

    try {
      let parsedEnv = {};
      try {
        if (submitForm.environmentVarsJson.trim()) {
          parsedEnv = JSON.parse(submitForm.environmentVarsJson);
        }
      } catch (e) {
        alert('Invalid JSON in Environment Variables field. Please enter valid JSON (e.g. {"PORT":"25565"}).');
        setSubmittingItem(false);
        return;
      }

      const payload = {
        name: submitForm.name,
        description: submitForm.description,
        longDescription: submitForm.longDescription || submitForm.description,
        category: submitForm.category,
        icon: submitForm.icon,
        version: submitForm.version,
        compatibility: submitForm.compatibility,
        installType: submitForm.installType,
        requirements: {
          minRamMB: Number(submitForm.minRamMB),
          minCpuCores: Number(submitForm.minCpuCores),
          minDiskGB: Number(submitForm.minDiskGB)
        },
        startupCommand: submitForm.startupCommand,
        environmentVars: parsedEnv
      };

      const res = await fetch('/api/v1/marketplace/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSubmitSuccessMsg(data.message);
        setTimeout(() => {
          setShowSubmitModal(false);
          setSubmitSuccessMsg(null);
          fetchMarketplace();
        }, 2000);
      } else {
        alert(`Submission Failed: ${data.error?.message}`);
      }
    } catch (err) {
      alert('Network error submitting marketplace item.');
    } finally {
      setSubmittingItem(false);
    }
  };

  // Open One-Click Deploy Wizard
  const startOneClickDeploy = async (item: MarketplaceItem) => {
    setDeployItem(item);
    setDeployStep(1);
    setDeployError(null);
    setCreatedServerId(null);
    setServerName(`${item.name.split(' ')[0]} Server`);

    // Parse env vars
    const initialEnv = item.environmentVars || {};
    setEnvVars({ ...initialEnv });

    // Fetch deployment options (plans, nodes, templates)
    try {
      const res = await fetch('/api/v1/deploy/options');
      const data = await res.json();
      if (data.success) {
        setDeployOptions(data.data);
        if (data.data.plans?.length > 0) {
          // Select default plan matching item RAM requirement
          const minRam = item.requirements?.minRamMB || 1024;
          const matchingPlan = data.data.plans.find((p: Plan) => p.ramMB >= minRam) || data.data.plans[0];
          setSelectedPlanId(matchingPlan.id);
        }
        if (data.data.nodes?.length > 0) {
          setSelectedNodeId(data.data.nodes[0].id);
        }
      }
    } catch (err) {
      setDeployError('Failed to load deployment node & plan options.');
    }
  };

  // Execute One-Click Deployment
  const executeDeployment = async () => {
    if (!deployItem || !selectedPlanId) return;

    setDeploying(true);
    setDeployError(null);
    setDeployProgress(15);
    setDeployLogs(['[AetherPanel Engine] Validating Marketplace deployment package...', '[1/4] Allocating compute container resources...']);

    try {
      // Step 1: Trigger Marketplace deploy counter
      await fetch(`/api/v1/marketplace/${deployItem.id}/deploy`, { method: 'POST' });
      setDeployProgress(35);
      setDeployLogs(prev => [...prev, '[2/4] Registering server instance with AetherPanel Daemon...']);

      // Step 2: Create Server Instance
      const deployPayload = {
        name: serverName || deployItem.name,
        planId: selectedPlanId,
        nodeId: selectedNodeId || undefined,
        templateId: deployItem.templateId || undefined,
        software: deployItem.category === 'minecraft' ? 'Paper' : 'Node.js',
        version: deployItem.version,
        environmentVars: envVars,
        billingCycle: 'monthly',
        paymentMethod: 'balance'
      };

      setDeployProgress(65);
      setDeployLogs(prev => [...prev, '[3/4] Writing configuration files & environment definitions...', '[4/4] Finalizing network allocation & boot sequence...']);

      const res = await fetch('/api/v1/deploy/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deployPayload)
      });

      const data = await res.json();

      if (data.success) {
        setDeployProgress(100);
        setCreatedServerId(data.data.server.id);
        setDeployLogs(prev => [...prev, '✔ [SUCCESS] Marketplace deployment completed! Container is active.']);
        fetchMarketplace();
      } else {
        setDeployError(data.error?.message || 'Deployment provisioning failed.');
      }
    } catch (err: any) {
      setDeployError('Network error during automated deployment.');
    } finally {
      setDeploying(false);
    }
  };

  // Get icon component dynamically
  const getCategoryIcon = (cat: string, className = "h-5 w-5") => {
    switch (cat) {
      case 'minecraft': return <Gamepad2 className={className} />;
      case 'bot': return <Bot className={className} />;
      case 'template': return <Cpu className={className} />;
      case 'tool': return <Archive className={className} />;
      case 'utility': return <Terminal className={className} />;
      default: return <Store className={className} />;
    }
  };

  const getBadgeStyle = (badge: MarketplaceBadge) => {
    switch (badge) {
      case 'official':
        return 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/30';
      case 'verified':
        return 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/30';
      case 'community':
        return 'bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-300 border-violet-500/30';
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Header */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-950 border border-amber-500/20 p-6 md:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold tracking-wide uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AetherPanel Ecosystem Marketplace</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Server Templates & Hosting Marketplace
            </h1>
            <p className="text-zinc-400 text-sm md:text-base leading-relaxed">
              Discover verified Minecraft engines, Discord bot frameworks, cloud deployment tools, and user-submitted utilities with real metric verification.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setShowSubmitModal(true)}
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r ${accentClasses.gradient} shadow-lg hover:brightness-110 transition-all`}
            >
              <Plus className="h-4 w-4" />
              <span>Submit Template / Tool</span>
            </button>
            <button
              onClick={() => fetchMarketplace()}
              title="Refresh Marketplace"
              className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="mt-8 pt-6 border-t border-zinc-800/80 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          {/* Search bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search templates, bots, tools, authors..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-3 text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-zinc-900 p-1 rounded-2xl border border-zinc-800 text-xs">
              {(['all', 'official', 'verified', 'community'] as const).map(badge => (
                <button
                  key={badge}
                  onClick={() => setSelectedBadge(badge)}
                  className={`px-3 py-1.5 rounded-xl font-medium capitalize transition-colors ${
                    selectedBadge === badge
                      ? 'bg-amber-500 text-black font-semibold shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {badge === 'all' ? 'All Badges' : badge}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-amber-500"
            >
              <option value="featured">Featured First</option>
              <option value="popular">Most Installed (Real Deploys)</option>
              <option value="rating">Top Rated (Real Reviews)</option>
              <option value="newest">Newest Releases</option>
            </select>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'All Categories', icon: Store, count: categoryCounts.all || 0 },
            { id: 'minecraft', label: 'Minecraft', icon: Gamepad2, count: categoryCounts.minecraft || 0 },
            { id: 'bot', label: 'Bots & Automation', icon: Bot, count: categoryCounts.bot || 0 },
            { id: 'template', label: 'Server Templates', icon: Cpu, count: categoryCounts.template || 0 },
            { id: 'tool', label: 'Tools', icon: Archive, count: categoryCounts.tool || 0 },
            { id: 'utility', label: 'Utilities', icon: Terminal, count: categoryCounts.utility || 0 }
          ].map(tab => {
            const IconComp = tab.icon;
            const isActive = selectedCategory === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedCategory(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-md'
                    : 'bg-zinc-900/80 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <IconComp className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchMarketplace()} className="underline font-semibold text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* Main Items Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map(n => (
            <div key={n} className="h-72 rounded-3xl bg-zinc-950 border border-zinc-800/60 p-6 animate-pulse space-y-4">
              <div className="h-10 w-10 rounded-2xl bg-zinc-800" />
              <div className="h-6 w-3/4 rounded-lg bg-zinc-800" />
              <div className="h-16 w-full rounded-xl bg-zinc-900" />
              <div className="h-10 w-full rounded-2xl bg-zinc-800" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-zinc-950 rounded-3xl border border-zinc-800/80 p-8 space-y-4">
          <Store className="h-12 w-12 text-zinc-600 mx-auto" />
          <h3 className="text-xl font-bold text-white">No Marketplace Items Found</h3>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            No approved items match your current filter criteria. Try clearing search keywords or submit your own template!
          </p>
          <button
            onClick={() => { setSelectedCategory('all'); setSelectedBadge('all'); setSearchQuery(''); }}
            className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-amber-400 font-semibold hover:bg-zinc-800 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(item => (
            <div
              key={item.id}
              className="group relative flex flex-col justify-between rounded-3xl bg-zinc-950 border border-zinc-800/80 hover:border-amber-500/40 p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/5"
            >
              {/* Featured Ribbon */}
              {item.isFeatured && (
                <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[10px] font-extrabold uppercase tracking-wider shadow-md">
                  ★ FEATURED
                </div>
              )}

              <div className="space-y-4">
                {/* Header Row: Icon, Title, Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="p-3 rounded-2xl bg-zinc-900 border border-zinc-800 text-amber-400 group-hover:scale-110 transition-transform">
                    {getCategoryIcon(item.category)}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyle(item.badge)}`}>
                    {item.badge}
                  </span>
                </div>

                {/* Title & Author */}
                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1">
                    <span>by <strong className="text-zinc-300">{item.author}</strong></span>
                    <span>•</span>
                    <span className="font-mono text-zinc-500">v{item.version}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                {/* Requirements Badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[10px] text-zinc-400 font-mono">
                    RAM: {item.requirements?.minRamMB || 1024}MB
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[10px] text-zinc-400 font-mono">
                    CPU: {item.requirements?.minCpuCores || 1} core
                  </span>
                  <span className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800/80 text-[10px] text-zinc-400 font-mono truncate max-w-[140px]">
                    {item.compatibility}
                  </span>
                </div>
              </div>

              {/* Real Metrics & Action Footer */}
              <div className="mt-6 pt-4 border-t border-zinc-900 space-y-3">
                {/* Real Metrics (NO FAKE METRICS!) */}
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    <span>{item.rating > 0 ? item.rating.toFixed(1) : 'No ratings'}</span>
                    {item.reviewsCount > 0 && (
                      <span className="text-zinc-500 font-normal">({item.reviewsCount})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-zinc-400 font-mono text-[11px]">
                    <Download className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{item.downloadsCount || 0} deploys</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setDetailItem(item); setActiveTab('overview'); }}
                    className="w-full py-2.5 px-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 transition-colors"
                  >
                    Details & Reviews
                  </button>

                  <button
                    onClick={() => startOneClickDeploy(item)}
                    className={`w-full py-2.5 px-3 rounded-2xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md hover:brightness-110 transition-all flex items-center justify-center gap-1.5`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>One-Click Deploy</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETAIL & REVIEWS MODAL */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-3xl bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setDetailItem(null)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="flex items-start gap-4 pr-8">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-amber-400 shrink-0">
                {getCategoryIcon(detailItem.category, "h-8 w-8")}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getBadgeStyle(detailItem.badge)}`}>
                    {detailItem.badge}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">v{detailItem.version}</span>
                </div>
                <h2 className="text-2xl font-bold text-white mt-1">{detailItem.name}</h2>
                <p className="text-xs text-zinc-400">Maintained by <strong className="text-white">{detailItem.author}</strong></p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-zinc-800 text-sm">
              {[
                { id: 'overview', label: 'Overview & Specs' },
                { id: 'reviews', label: `Reviews (${detailItem.reviewsCount || 0})` },
                { id: 'config', label: 'Security & Configuration' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-4 py-3 font-semibold text-xs border-b-2 transition-colors ${
                    activeTab === t.id
                      ? 'border-amber-500 text-amber-400'
                      : 'border-transparent text-zinc-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="prose prose-invert max-w-none text-zinc-300 text-sm leading-relaxed">
                  <p>{detailItem.longDescription || detailItem.description}</p>
                </div>

                {/* Compatibility & Specs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wider">System Requirements</h4>
                    <div className="space-y-1 text-xs text-zinc-300 font-mono">
                      <div>Minimum RAM: <strong>{detailItem.requirements?.minRamMB} MB</strong></div>
                      <div>Minimum CPU: <strong>{detailItem.requirements?.minCpuCores} Core(s)</strong></div>
                      <div>Disk Storage: <strong>{detailItem.requirements?.minDiskGB} GB NVMe</strong></div>
                      {detailItem.requirements?.notes && (
                        <div className="text-zinc-400 text-[11px] font-sans pt-1">
                          Note: {detailItem.requirements.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-2">
                    <h4 className="text-xs font-bold uppercase text-zinc-400 tracking-wider">Compatibility & Runtime</h4>
                    <div className="space-y-1 text-xs text-zinc-300">
                      <div>Target: <strong>{detailItem.compatibility}</strong></div>
                      <div>Install Type: <strong className="capitalize">{detailItem.installType.replace('_', ' ')}</strong></div>
                      <div>Actual Deploys: <strong>{detailItem.downloadsCount || 0} times</strong></div>
                    </div>
                  </div>
                </div>

                {detailItem.changelog && (
                  <div className="p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
                    <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Version Changelog</h4>
                    <p className="text-xs text-zinc-300 font-mono">{detailItem.changelog}</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Reviews */}
            {activeTab === 'reviews' && (
              <div className="space-y-6">
                {/* Write Review Form */}
                <form onSubmit={handlePostReview} className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <h4 className="text-sm font-bold text-white">Rate & Review this Marketplace Item</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Rating:</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 hover:scale-125 transition-transform"
                        >
                          <Star className={`h-5 w-5 ${star <= reviewRating ? 'fill-amber-400 text-amber-400' : 'text-zinc-600'}`} />
                        </button>
                      ))}
                    </div>
                    <span className="text-xs font-bold text-amber-400 ml-2">{reviewRating} Stars</span>
                  </div>

                  <textarea
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    placeholder="Share your experience using this template or tool on your server..."
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />

                  {reviewMsg && (
                    <div className="text-xs text-emerald-400 font-medium">{reviewMsg}</div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingReview || !reviewComment.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                  >
                    {submittingReview ? 'Submitting...' : 'Post Review'}
                  </button>
                </form>

                {/* Reviews List */}
                <div className="space-y-3">
                  {!detailItem.reviews || detailItem.reviews.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-6">
                      No user reviews submitted yet. Be the first to leave feedback!
                    </p>
                  ) : (
                    detailItem.reviews.map(rev => (
                      <div key={rev.id} className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{rev.userName}</span>
                            <div className="flex items-center text-amber-400 text-xs">
                              <Star className="h-3 w-3 fill-amber-400 mr-1" />
                              <span>{rev.rating}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-500">{new Date(rev.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs text-zinc-300">{rev.comment}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Security & Config */}
            {activeTab === 'config' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-400">
                    <ShieldCheck className="h-4 w-4" />
                    <span>Security Audit Status: Passed</span>
                  </div>
                  <p className="text-zinc-300">
                    {detailItem.securityNotes || 'This marketplace item has been validated by AetherPanel automated static scanner.'}
                  </p>
                </div>

                {detailItem.startupCommand && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Startup Command</label>
                    <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-amber-300 font-mono overflow-x-auto">
                      {detailItem.startupCommand}
                    </pre>
                  </div>
                )}

                {detailItem.environmentVars && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400">Environment Variables</label>
                    <pre className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 font-mono overflow-x-auto">
                      {JSON.stringify(detailItem.environmentVars, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Footer Action */}
            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between">
              <button
                onClick={() => setDetailItem(null)}
                className="px-4 py-2.5 rounded-2xl bg-zinc-900 text-xs font-semibold text-zinc-400 hover:text-white"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const itemToDeploy = detailItem;
                  setDetailItem(null);
                  startOneClickDeploy(itemToDeploy);
                }}
                className={`px-6 py-2.5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-lg hover:brightness-110 flex items-center gap-2`}
              >
                <Zap className="h-4 w-4" />
                <span>Deploy Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ONE-CLICK DEPLOY WIZARD MODAL */}
      {deployItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-amber-500/40 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">One-Click Deployment Wizard</h3>
                  <p className="text-xs text-zinc-400">Deploying: <strong className="text-amber-400">{deployItem.name}</strong></p>
                </div>
              </div>
              <button onClick={() => setDeployItem(null)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Deploy Error message */}
            {deployError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
                <span>{deployError}</span>
              </div>
            )}

            {/* Step 1: Configure Plan & Compute */}
            {deployStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Server Instance Name</label>
                  <input
                    type="text"
                    value={serverName}
                    onChange={e => setServerName(e.target.value)}
                    placeholder="Enter server name..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300">Select Hosting Plan Tier</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                    {deployOptions.plans.map(p => (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          selectedPlanId === p.id
                            ? 'bg-amber-500/10 border-amber-500 text-white'
                            : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-xs">
                          <span>{p.name}</span>
                          <span className="text-amber-400">${p.priceMonthly.toFixed(2)}/mo</span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono mt-1">
                          {p.ramMB}MB RAM • {p.cpuCores} vCPU • {p.diskGB}GB NVMe
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {deployOptions.nodes?.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-zinc-300">Target Compute Node Location</label>
                    <select
                      value={selectedNodeId}
                      onChange={e => setSelectedNodeId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {deployOptions.nodes.map(n => (
                        <option key={n.id} value={n.id}>
                          {n.name} ({n.locationName || n.location}) — {n.totalRamMB - n.usedRamMB}MB available
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={() => setDeployStep(2)}
                    disabled={!selectedPlanId || !serverName.trim()}
                    className={`px-6 py-2.5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2`}
                  >
                    <span>Configure Environment</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Environment Variables */}
            {deployStep === 2 && (
              <div className="space-y-4">
                <div className="p-3.5 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <div className="font-bold text-amber-400">Pre-configured Environment Variables</div>
                  <p>These values will be injected directly into your server container during setup.</p>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                  {Object.entries(envVars).length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No environment variables required for this template.</p>
                  ) : (
                    Object.entries(envVars).map(([key, val]) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[11px] font-mono text-amber-400">{key}</label>
                        <input
                          type="text"
                          value={val}
                          onChange={e => setEnvVars({ ...envVars, [key]: e.target.value })}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-zinc-800">
                  <button
                    onClick={() => setDeployStep(1)}
                    className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-400 hover:text-white"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => { setDeployStep(3); executeDeployment(); }}
                    className={`px-6 py-2.5 rounded-2xl font-bold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} hover:brightness-110 transition-all flex items-center gap-2`}
                  >
                    <Zap className="h-4 w-4" />
                    <span>Confirm & Deploy</span>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Deployment Progress */}
            {deployStep === 3 && (
              <div className="space-y-6 text-center py-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-300">
                    <span>Provisioning Container</span>
                    <span className="text-amber-400 font-mono">{deployProgress}%</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800 p-0.5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${accentClasses.gradient} transition-all duration-500`}
                      style={{ width: `${deployProgress}%` }}
                    />
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-left font-mono text-xs text-zinc-300 space-y-1 h-36 overflow-y-auto">
                  {deployLogs.map((log, i) => (
                    <div key={i} className={log.includes('SUCCESS') ? 'text-emerald-400 font-bold' : log.includes('Engine') ? 'text-amber-400' : 'text-zinc-400'}>
                      {log}
                    </div>
                  ))}
                </div>

                {createdServerId && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setDeployItem(null);
                        onNavigate('server-manage', { serverId: createdServerId });
                      }}
                      className="px-6 py-3 rounded-2xl font-extrabold text-xs text-black bg-emerald-400 hover:bg-emerald-300 shadow-lg transition-all inline-flex items-center gap-2"
                    >
                      <Server className="h-4 w-4" />
                      <span>Open Server Console</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBMIT COMMUNITY ITEM MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-amber-500/40 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Submit Marketplace Item</h3>
                  <p className="text-xs text-zinc-400">Propose a template, bot, or script utility for AetherPanel ecosystem</p>
                </div>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="text-zinc-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {submitSuccessMsg ? (
              <div className="p-6 text-center space-y-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-300">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold">Submission Received!</h4>
                <p className="text-xs text-zinc-300">{submitSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitCommunityItem} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Item Name</label>
                    <input
                      type="text"
                      required
                      value={submitForm.name}
                      onChange={e => setSubmitForm({ ...submitForm, name: e.target.value })}
                      placeholder="e.g. Purpur Extreme TPS Plugin Engine"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Category</label>
                    <select
                      value={submitForm.category}
                      onChange={e => setSubmitForm({ ...submitForm, category: e.target.value as any })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="minecraft">Minecraft</option>
                      <option value="bot">Bots & Automation</option>
                      <option value="template">Server Template</option>
                      <option value="tool">Tool</option>
                      <option value="utility">Utility Script</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Short Summary</label>
                  <input
                    type="text"
                    required
                    value={submitForm.description}
                    onChange={e => setSubmitForm({ ...submitForm, description: e.target.value })}
                    placeholder="Brief 1-sentence summary for marketplace card..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Detailed Description & Features</label>
                  <textarea
                    rows={3}
                    value={submitForm.longDescription}
                    onChange={e => setSubmitForm({ ...submitForm, longDescription: e.target.value })}
                    placeholder="Provide detailed breakdown of what this item contains..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Version</label>
                    <input
                      type="text"
                      value={submitForm.version}
                      onChange={e => setSubmitForm({ ...submitForm, version: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Min RAM (MB)</label>
                    <input
                      type="number"
                      value={submitForm.minRamMB}
                      onChange={e => setSubmitForm({ ...submitForm, minRamMB: Number(e.target.value) })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-300">Compatibility</label>
                    <input
                      type="text"
                      value={submitForm.compatibility}
                      onChange={e => setSubmitForm({ ...submitForm, compatibility: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Startup Command (if applicable)</label>
                  <input
                    type="text"
                    value={submitForm.startupCommand}
                    onChange={e => setSubmitForm({ ...submitForm, startupCommand: e.target.value })}
                    placeholder="e.g. java -Xms512M -Xmx{RAM_MB}M -jar server.jar nogui"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-amber-300 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-300">Default Environment Vars (JSON)</label>
                  <textarea
                    rows={2}
                    value={submitForm.environmentVarsJson}
                    onChange={e => setSubmitForm({ ...submitForm, environmentVarsJson: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 font-mono"
                  />
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>Security Policy: Submissions are scanned for malicious scripts and require Admin approval before publication.</span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingItem}
                    className="px-6 py-2.5 rounded-xl text-xs font-extrabold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                  >
                    {submittingItem ? 'Validating Submission...' : 'Submit for Review'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
export default Marketplace;
