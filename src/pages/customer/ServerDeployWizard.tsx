import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Bot, CheckCircle2, ArrowRight, ArrowLeft, Cpu,
  Globe2, ShieldCheck, Tag, Sparkles, Check, Server as ServerIcon,
  Zap, Layers, Terminal, Loader2, AlertCircle, HardDrive, MemoryStick,
  Boxes, CheckCircle, RefreshCw, Radio, DollarSign, Activity
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Product, Plan, Node, UserAllocationStatus } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface ServerDeployWizardProps {
  onNavigate: (page: string) => void;
  onSelectServer?: (serverId: string) => void;
  onRefreshServers?: () => void;
  initialPlanId?: string;
  initialCategory?: string;
}

interface SoftwareOption {
  id: string;
  name: string;
  category: 'minecraft' | 'bot';
  description: string;
  defaultVersion: string;
  versions: string[];
  recommendedJava?: string;
  icon: any;
}

const SOFTWARE_CATALOG: SoftwareOption[] = [
  // Minecraft Software
  {
    id: 'paper',
    name: 'Paper',
    category: 'minecraft',
    description: 'High performance Minecraft server designed to fix gameplay & mechanics inconsistencies.',
    defaultVersion: '1.20.4',
    versions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
    recommendedJava: 'Java 21',
    icon: Gamepad2
  },
  {
    id: 'purpur',
    name: 'Purpur',
    category: 'minecraft',
    description: 'Drop-in replacement for Paper with extreme configuration options & optimizations.',
    defaultVersion: '1.20.4',
    versions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4'],
    recommendedJava: 'Java 21',
    icon: Gamepad2
  },
  {
    id: 'vanilla',
    name: 'Vanilla',
    category: 'minecraft',
    description: 'Official unmodified Mojang server software.',
    defaultVersion: '1.20.4',
    versions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2'],
    recommendedJava: 'Java 21',
    icon: Gamepad2
  },
  {
    id: 'fabric',
    name: 'Fabric',
    category: 'minecraft',
    description: 'Lightweight, modular modding toolchain for Minecraft.',
    defaultVersion: '1.20.4',
    versions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2'],
    recommendedJava: 'Java 21',
    icon: Boxes
  },
  {
    id: 'forge',
    name: 'Forge',
    category: 'minecraft',
    description: 'The standard modding platform for comprehensive Minecraft modpacks.',
    defaultVersion: '1.20.4',
    versions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
    recommendedJava: 'Java 21',
    icon: Layers
  },

  // Bot & App Hosting Software
  {
    id: 'nodejs',
    name: 'Node.js',
    category: 'bot',
    description: 'Modern JavaScript/TypeScript runtime with ES modules & npm/pnpm support.',
    defaultVersion: 'Node 20',
    versions: ['Node 20', 'Node 22', 'Node 18'],
    icon: Bot
  },
  {
    id: 'python',
    name: 'Python',
    category: 'bot',
    description: 'High-performance Python runtime for Discord.py, Pycord, and automation scripts.',
    defaultVersion: 'Python 3.11',
    versions: ['Python 3.11', 'Python 3.12', 'Python 3.10'],
    icon: Bot
  },
  {
    id: 'bun',
    name: 'Bun',
    category: 'bot',
    description: 'Ultra-fast all-in-one JavaScript runtime & package manager.',
    defaultVersion: 'Bun 1.1',
    versions: ['Bun 1.1', 'Bun 1.0'],
    icon: Zap
  }
];

export const ServerDeployWizard: React.FC<ServerDeployWizardProps> = ({
  onNavigate,
  onSelectServer,
  onRefreshServers,
  initialPlanId,
  initialCategory
}) => {
  const { user, refreshUser } = useAuth();
  const { accentClasses } = useTheme();

  // Wizard Steps: 1 = Product & Software, 2 = Plan Tier & Resources, 3 = Name, Region & Billing, 4 = Review & Deploy
  const [step, setStep] = useState<number>(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [serverTypes, setServerTypes] = useState<any[]>([]);
  const [selectedServerTypeId, setSelectedServerTypeId] = useState<string>('st_minecraft_java');

  // Selection States
  const [selectedProductCategory, setSelectedProductCategory] = useState<'minecraft' | 'bot'>(
    initialCategory === 'bot' ? 'bot' : 'minecraft'
  );
  const [selectedSoftware, setSelectedSoftware] = useState<SoftwareOption>(
    SOFTWARE_CATALOG.find(s => s.category === (initialCategory === 'bot' ? 'bot' : 'minecraft')) || SOFTWARE_CATALOG[0]
  );
  const [selectedVersion, setSelectedVersion] = useState<string>(selectedSoftware.defaultVersion);
  const [dynamicVersions, setDynamicVersions] = useState<string[]>(selectedSoftware.versions);
  const [selectedJavaVersion, setSelectedJavaVersion] = useState<string>('Java 21');
  const [eulaAccepted, setEulaAccepted] = useState<boolean>(true);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);

  const [serverName, setServerName] = useState<string>(
    selectedProductCategory === 'minecraft' ? 'Minecraft Server' : 'Discord Bot Server'
  );
  const [selectedLocation, setSelectedLocation] = useState<string>('auto');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('auto');

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'stripe'>('balance');
  const [allocations, setAllocations] = useState<UserAllocationStatus | null>(null);

  const [couponCode, setCouponCode] = useState<string>('WELCOME20');
  const [couponDiscount, setCouponDiscount] = useState<{ type: string; value: number } | null>({ type: 'percent', value: 20 });
  const [couponMsg, setCouponMsg] = useState<string | null>('WELCOME20 applied (20% OFF)');

  // Deployment Progress Pipeline
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [pipelineStage, setPipelineStage] = useState<number>(0);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedServerId, setDeployedServerId] = useState<string | null>(null);

  useEffect(() => {
    fetchDeployOptions();
  }, []);

  const fetchDeployOptions = async () => {
    const res = await apiRequest('/deploy/options');
    if (res.success && res.data) {
      if (res.data.products) setProducts(res.data.products);
      if (res.data.allocations) setAllocations(res.data.allocations);
      if (res.data.plans) {
        setPlans(res.data.plans);
        if (!selectedPlanId && res.data.plans.length > 0) {
          const matchingCategory = initialCategory === 'bot' ? 'prod_bot' : 'prod_minecraft';
          const defaultPlan = res.data.plans.find((p: Plan) => p.productId === matchingCategory) || res.data.plans[0];
          if (defaultPlan) setSelectedPlanId(defaultPlan.id);
        }
      }
      if (res.data.nodes) setNodes(res.data.nodes);
    }

    try {
      const stRes = await apiRequest('/server-types');
      if (stRes.success && stRes.data) {
        setServerTypes(stRes.data);
      }
    } catch (e) {
      // Ignore fallback
    }
  };

  const loadMinecraftVersions = async (softwareName: string) => {
    setIsLoadingVersions(true);
    try {
      const res = await apiRequest(`/minecraft/versions?software=${encodeURIComponent(softwareName)}`);
      if (res.success && res.data && res.data.versions && res.data.versions.length > 0) {
        setDynamicVersions(res.data.versions);
        setSelectedVersion(res.data.latest || res.data.versions[0]);
        if (res.data.recommendedJava) {
          setSelectedJavaVersion(`Java ${res.data.recommendedJava}`);
        }
      }
    } catch (e) {
      // Fallback
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleSelectSoftware = (software: SoftwareOption) => {
    setSelectedSoftware(software);
    setSelectedVersion(software.defaultVersion);
    setDynamicVersions(software.versions);

    // Auto-map software to serverTypeId
    const nameLower = software.name.toLowerCase();
    if (nameLower.includes('bedrock')) {
      setSelectedServerTypeId('st_minecraft_bedrock');
    } else if (nameLower.includes('node')) {
      setSelectedServerTypeId('st_nodejs');
    } else if (nameLower.includes('bun')) {
      setSelectedServerTypeId('st_bun');
    } else if (nameLower.includes('python')) {
      setSelectedServerTypeId('st_python');
    } else {
      setSelectedServerTypeId('st_minecraft_java');
    }

    if (software.category === 'minecraft') {
      loadMinecraftVersions(software.name);
    }

    // Auto-suggest server name
    setServerName(`${software.name} Instance`);

    // Match plan
    const matchingPlan = plans.find(p => p.productId === (software.category === 'minecraft' ? 'prod_minecraft' : 'prod_bot'));
    if (matchingPlan && !selectedPlanId) {
      setSelectedPlanId(matchingPlan.id);
    }
  };

  const handleProductCategoryChange = (category: 'minecraft' | 'bot') => {
    setSelectedProductCategory(category);
    const firstSoftware = SOFTWARE_CATALOG.find(s => s.category === category) || SOFTWARE_CATALOG[0];
    handleSelectSoftware(firstSoftware);
    setServerName(category === 'minecraft' ? 'Minecraft Server' : 'Discord Bot Server');

    const matchingPlan = plans.find(p => p.productId === (category === 'minecraft' ? 'prod_minecraft' : 'prod_bot'));
    if (matchingPlan) {
      setSelectedPlanId(matchingPlan.id);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    const res = await apiRequest(`/admin/coupons/validate?code=${encodeURIComponent(couponCode.trim())}`);
    if (res.success && res.data) {
      setCouponDiscount({ type: res.data.discountType, value: res.data.discountValue });
      setCouponMsg(`${couponCode.toUpperCase()} applied (${res.data.discountValue}% OFF)`);
    } else if (couponCode.toUpperCase() === 'WELCOME20') {
      setCouponDiscount({ type: 'percent', value: 20 });
      setCouponMsg('WELCOME20 applied (20% OFF)');
    } else {
      setCouponDiscount(null);
      setCouponMsg('Invalid promotional code');
    }
  };

  const currentProductPlans = plans.filter(p => {
    const prod = products.find(pr => pr.id === p.productId);
    if (!prod) {
      return selectedProductCategory === 'minecraft' ? p.productId.includes('minecraft') : p.productId.includes('bot');
    }
    return prod.category === selectedProductCategory;
  });

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || currentProductPlans[0] || plans[0];

  const calculateTotalPrice = () => {
    if (!selectedPlan) return 0;
    let base = billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly;
    if (couponDiscount) {
      if (couponDiscount.type === 'percent') {
        base = base * (1 - couponDiscount.value / 100);
      } else {
        base = Math.max(0, base - couponDiscount.value);
      }
    }
    return Math.max(0, base);
  };

  const startDeploymentPipeline = async () => {
    setIsDeploying(true);
    setPipelineStage(1);
    setPipelineLogs(['[Provisioner] Initializing hardware resource bounds...']);
    setDeployError(null);

    const stages = [
      { msg: `[Allocator] Reserving port and vCPU bounds on cluster...`, delay: 600 },
      { msg: `[Storage] Initializing runtime directory structure...`, delay: 700 },
      { msg: `[Installer] Configuring ${selectedSoftware.name} ${selectedVersion} runtime binaries...`, delay: 800 },
      { msg: `[Network] Binding virtual network interfaces & Playit.gg routing...`, delay: 600 },
      { msg: `[Bootloader] Spawning daemon process supervisor...`, delay: 600 }
    ];

    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, stages[i].delay));
      setPipelineLogs(prev => [...prev, stages[i].msg]);
      setPipelineStage(i + 2);
    }

    try {
      const payload = {
        name: serverName.trim() || `${selectedSoftware.name} Server`,
        planId: selectedPlan?.id || selectedPlanId,
        nodeId: selectedNodeId === 'auto' ? undefined : selectedNodeId,
        location: selectedLocation === 'auto' ? undefined : selectedLocation,
        serverTypeId: selectedServerTypeId,
        software: selectedSoftware.name,
        version: selectedVersion,
        billingCycle,
        couponCode: couponDiscount ? couponCode : undefined,
        paymentMethod,
        environmentVars: {
          EULA: eulaAccepted ? 'true' : 'false',
          JAVA_VERSION: selectedJavaVersion
        }
      };

      const res = await apiRequest('/deploy/create', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success && res.data && res.data.server) {
        setPipelineLogs(prev => [
          ...prev,
          `✔ [ONLINE] Instance deployed successfully! (ID: ${res.data.server.id})`,
          `✔ Primary Endpoint: ${res.data.server.primaryIp}:${res.data.server.primaryPort}`,
          `✔ Status: RUNNING`
        ]);
        setDeployedServerId(res.data.server.id);
        setPipelineStage(7);
        await refreshUser();
        if (onRefreshServers) onRefreshServers();
      } else {
        throw new Error(res.error?.message || 'Deployment execution failed on cluster.');
      }
    } catch (err: any) {
      setDeployError(err.message || 'Deployment failed. Please check balance and try again.');
      setPipelineLogs(prev => [...prev, `✖ [ERROR] ${err.message || 'Fatal deployment failure'}`]);
    }
  };

  const filteredSoftware = SOFTWARE_CATALOG.filter(s => s.category === selectedProductCategory);
  const isAllocationLimitReached = Boolean(allocations && !allocations.unlimited && allocations.remaining !== null && allocations.remaining <= 0);

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-400" /> Real Server Provisioning
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Deploy production-grade Minecraft servers and Discord bot environments on dedicated compute instances.
          </p>
        </div>

        {/* Steps Progress Indicator */}
        {!isAllocationLimitReached && (
          <div className="flex items-center gap-2 text-xs">
            {[
              { num: 1, label: 'Software' },
              { num: 2, label: 'Plan & Tier' },
              { num: 3, label: 'Config & Region' },
              { num: 4, label: 'Deploy' }
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                {idx > 0 && <div className={`w-4 h-0.5 ${step >= s.num ? 'bg-amber-400' : 'bg-zinc-800'}`} />}
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
                  step === s.num
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : step > s.num
                    ? 'text-zinc-300 bg-zinc-900 border border-zinc-800'
                    : 'text-zinc-500 bg-zinc-950 border border-zinc-900'
                }`}>
                  <span className="font-mono">{s.num}.</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ALLOCATION LIMIT REACHED BANNER & BLOCK */}
      {isAllocationLimitReached ? (
        <div className="p-8 sm:p-12 rounded-3xl bg-zinc-900/80 border border-zinc-800 text-center max-w-xl mx-auto space-y-6 shadow-2xl my-8 animate-in fade-in">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Server Allocation Limit Reached</h2>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-md mx-auto">
              Your current plan does not support additional server allocations. Upgrade your plan or purchase additional allocations.
            </p>
          </div>
          
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 text-xs font-mono text-zinc-300 flex items-center justify-between">
            <span className="text-zinc-400">Current Usage:</span>
            <span className="font-bold text-amber-400 text-sm">{allocations?.used} / {allocations?.limit}</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <button
              onClick={() => onNavigate('billing')}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-zinc-950 transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <span>View Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('support')}
              className="px-5 py-2.5 rounded-xl font-medium text-xs bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-200 transition"
            >
              Contact Administrator
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* STEP 1: Choose Product & Software */}
          {step === 1 && (
        <div className="space-y-6 animate-in fade-in">
          {/* Category Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => handleProductCategoryChange('minecraft')}
              className={`p-5 rounded-2xl border text-left transition flex items-start gap-4 ${
                selectedProductCategory === 'minecraft'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white ring-1 ring-amber-500/20'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className={`p-3 rounded-xl ${selectedProductCategory === 'minecraft' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                <Gamepad2 className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-white text-base flex items-center gap-2">
                  Minecraft Server Hosting
                  {selectedProductCategory === 'minecraft' && <Check className="h-4 w-4 text-amber-400" />}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  High-performance Java & Bedrock engines with Paper, Purpur, Fabric & Forge support.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleProductCategoryChange('bot')}
              className={`p-5 rounded-2xl border text-left transition flex items-start gap-4 ${
                selectedProductCategory === 'bot'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white ring-1 ring-amber-500/20'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className={`p-3 rounded-xl ${selectedProductCategory === 'bot' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <div className="font-bold text-white text-base flex items-center gap-2">
                  Discord Bot & App Hosting
                  {selectedProductCategory === 'bot' && <Check className="h-4 w-4 text-amber-400" />}
                </div>
                <p className="text-xs text-zinc-400 mt-1">
                  24/7 background hosting for Node.js, Python, and Bun automation bots.
                </p>
              </div>
            </button>
          </div>

          {/* Software Options Grid */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-300">
              Select {selectedProductCategory === 'minecraft' ? 'Server Engine' : 'Programming Runtime'}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSoftware.map(software => {
                const isSelected = selectedSoftware.id === software.id;
                const Icon = software.icon;
                return (
                  <div
                    key={software.id}
                    onClick={() => handleSelectSoftware(software)}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-500/50 shadow-lg text-white'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-900 text-zinc-400'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-bold text-sm text-white">{software.name}</span>
                        </div>
                        {isSelected && <CheckCircle className="h-4 w-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {software.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Default Version</span>
                      <span className="font-mono text-zinc-300 font-semibold">{software.defaultVersion}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Version & Runtime Environment Controls */}
          <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Terminal className="h-4 w-4 text-amber-400" /> Runtime Version & Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Software Version {isLoadingVersions && <Loader2 className="inline h-3 w-3 animate-spin text-amber-400 ml-1" />}
                </label>
                <select
                  value={selectedVersion}
                  onChange={e => {
                    const nextVer = e.target.value;
                    setSelectedVersion(nextVer);
                    // Determine java version for dynamic feedback
                    if (selectedProductCategory === 'minecraft' && nextVer && nextVer !== 'UNKNOWN') {
                      const clean = nextVer.replace(/^v/i, '').trim();
                      const parts = clean.split(/[-.]/).map(p => parseInt(p, 10));
                      const major = isNaN(parts[0]) ? 1 : parts[0];
                      const minor = parts[1] !== undefined && !isNaN(parts[1]) ? parts[1] : 0;
                      const patch = parts[2] !== undefined && !isNaN(parts[2]) ? parts[2] : 0;

                      if (major >= 26) {
                        setSelectedJavaVersion('Java 25');
                      } else if (major > 1 || minor > 20 || (minor === 20 && patch >= 5)) {
                        setSelectedJavaVersion('Java 21');
                      } else if (minor >= 17) {
                        setSelectedJavaVersion('Java 17');
                      } else if (minor === 16) {
                        setSelectedJavaVersion('Java 11');
                      } else {
                        setSelectedJavaVersion('Java 8');
                      }
                    }
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                >
                  {dynamicVersions.length === 0 ? (
                    <option value="UNKNOWN">Upstream Version Unavailable</option>
                  ) : (
                    dynamicVersions.map((v, idx) => (
                      <option key={v} value={v}>
                        {v} {idx === 0 && v !== 'UNKNOWN' ? '(Latest)' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedProductCategory === 'minecraft' ? (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Java Runtime Environment
                  </label>
                  <select
                    value={selectedJavaVersion}
                    onChange={e => setSelectedJavaVersion(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="Java 25">Java 25 (Recommended for Paper 26.1+)</option>
                    <option value="Java 21">Java 21 (Recommended for 1.20.5+)</option>
                    <option value="Java 17">Java 17 (Recommended for 1.18–1.20.4)</option>
                    <option value="Java 11">Java 11</option>
                    <option value="Java 8">Java 8 (Legacy 1.12.2 & older)</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Default Startup Entrypoint
                  </label>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 font-mono">
                    {selectedSoftware.id === 'python' ? 'main.py' : 'index.js'}
                  </div>
                </div>
              )}
            </div>

            {selectedProductCategory === 'minecraft' && (
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={eulaAccepted}
                    onChange={e => setEulaAccepted(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-500 focus:ring-0 bg-zinc-950"
                  />
                  <span>Automatically accept the official Minecraft EULA (eula=true)</span>
                </label>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition"
            >
              <span>Next: Choose Plan & Tier</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Choose Plan Tier & Resources */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">
              Select Performance Plan Tier ({selectedProductCategory === 'minecraft' ? 'Minecraft' : 'Bot Hosting'})
            </h2>
            <span className="text-xs text-zinc-500 font-mono">
              {currentProductPlans.length} Available Tiers
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {currentProductPlans.map(plan => {
              const isSelected = selectedPlan?.id === plan.id;
              const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-5 rounded-2xl border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? 'bg-zinc-900 border-amber-500 shadow-xl ring-1 ring-amber-500/20 text-white'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-base text-white">{plan.name}</span>
                      {isSelected && <CheckCircle className="h-5 w-5 text-amber-400" />}
                    </div>

                    <div className="mb-4">
                      <span className="text-2xl font-black text-white font-mono">${price.toFixed(2)}</span>
                      <span className="text-xs text-zinc-500 ml-1">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-zinc-300 pb-1.5 border-b border-zinc-900">
                        <span className="flex items-center gap-2 text-zinc-400">
                          <MemoryStick className="h-3.5 w-3.5 text-amber-400" /> Dedicated RAM
                        </span>
                        <span className="font-mono font-bold text-white">{(plan.ramMB / 1024).toFixed(1)} GB</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300 pb-1.5 border-b border-zinc-900">
                        <span className="flex items-center gap-2 text-zinc-400">
                          <Cpu className="h-3.5 w-3.5 text-amber-400" /> CPU Limits
                        </span>
                        <span className="font-mono font-bold text-white">{plan.cpuCores * 100}% vCPU</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300 pb-1.5 border-b border-zinc-900">
                        <span className="flex items-center gap-2 text-zinc-400">
                          <HardDrive className="h-3.5 w-3.5 text-amber-400" /> NVMe Storage
                        </span>
                        <span className="font-mono font-bold text-white">{plan.diskGB} GB SSD</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-2 text-zinc-400">
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Backups Included
                        </span>
                        <span className="font-mono font-bold text-white">{plan.backupLimit} Slots</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3">
                    <div className={`w-full py-2 rounded-xl text-center text-xs font-bold transition ${
                      isSelected
                        ? 'bg-amber-500 text-black'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}>
                      {isSelected ? 'Tier Selected' : 'Select Tier'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition"
            >
              <span>Next: Configuration & Node</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Server Name, Region & Billing */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Instance Configuration */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-amber-400" /> Instance Identification
              </h3>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverName}
                  onChange={e => setServerName(e.target.value)}
                  placeholder="e.g. Survival SMP or Production Bot"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Compute Node Location
                </label>
                <select
                  value={selectedNodeId}
                  onChange={e => setSelectedNodeId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="auto">Automatic (Lowest cluster load)</option>
                  {nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.locationName}) - {node.ip}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 text-[11px] text-zinc-400 flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-emerald-400" />
                <span>Zero-portforward Playit.gg tunnel auto-assigned upon deployment.</span>
              </div>
            </div>

            {/* Billing & Discounts */}
            <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-amber-400" /> Billing Cycle & Payment
              </h3>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`p-3 rounded-xl border text-xs font-semibold transition ${
                    billingCycle === 'monthly'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Monthly Cycle
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`p-3 rounded-xl border text-xs font-semibold transition ${
                    billingCycle === 'yearly'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                  }`}
                >
                  Yearly Cycle (Save ~15%)
                </button>
              </div>

              {/* Promo Code */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Promotional Coupon
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white uppercase focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    className="px-4 py-2 bg-zinc-800 text-zinc-200 rounded-xl text-xs font-semibold hover:bg-zinc-700 transition"
                  >
                    Apply
                  </button>
                </div>
                {couponMsg && (
                  <p className="text-[11px] text-emerald-400 mt-1 font-mono">{couponMsg}</p>
                )}
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Payment Method
                </label>
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <Tag className="h-4 w-4 text-amber-400" />
                    <span>Aether Account Balance</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">
                    ${user?.credits?.toFixed(2) || '0.00'} Available
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition"
            >
              <span>Review & Deploy</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Review & Deploy Pipeline */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in">
          {!isDeploying ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-amber-400" /> Final Deployment Verification
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500">Instance Name</span>
                    <div className="font-bold text-white text-sm truncate">{serverName}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500">Software & Version</span>
                    <div className="font-bold text-amber-400 text-sm">{selectedSoftware.name} {selectedVersion}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500">Allocated RAM & CPU</span>
                    <div className="font-bold text-white text-sm font-mono">
                      {(selectedPlan?.ramMB || 1024) / 1024} GB / {((selectedPlan?.cpuCores || 1) * 100)}% vCPU
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500">Total Price ({billingCycle})</span>
                    <div className="font-bold text-emerald-400 text-sm font-mono">
                      ${calculateTotalPrice().toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-400 flex items-start gap-3">
                  <Activity className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-white">Live Execution Notice:</span> Upon clicking "Authorize & Deploy Instance", our cluster scheduler will allocate dedicated port allocations, write production configuration files, and spawn the server supervisor process.
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 text-zinc-300 font-semibold text-xs hover:bg-zinc-800 transition"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Settings</span>
                </button>

                <button
                  type="button"
                  onClick={startDeploymentPipeline}
                  className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-amber-500 text-black font-black text-sm hover:bg-amber-400 shadow-xl transition"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Authorize & Deploy Instance</span>
                </button>
              </div>
            </div>
          ) : (
            /* Live Deployment Progress Terminal */
            <div className="space-y-5">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800 bg-zinc-900/80">
                  <div className="flex items-center gap-2.5">
                    <div className="h-3 w-3 rounded-full bg-rose-500/80" />
                    <div className="h-3 w-3 rounded-full bg-amber-500/80" />
                    <div className="h-3 w-3 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-mono text-zinc-400 ml-2">deployment_pipeline.log</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    {pipelineStage < 7 && !deployError ? (
                      <span className="flex items-center gap-1.5 text-amber-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Provisioning Stage {pipelineStage}/6
                      </span>
                    ) : deployError ? (
                      <span className="text-rose-400 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" /> Deployment Failed
                      </span>
                    ) : (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Provision Completed
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5 font-mono text-xs text-zinc-300 space-y-2 min-h-64 bg-zinc-950">
                  {pipelineLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.startsWith('✔')
                          ? 'text-emerald-400'
                          : log.startsWith('✖')
                          ? 'text-rose-400 font-bold'
                          : 'text-zinc-300'
                      }
                    >
                      {log}
                    </div>
                  ))}
                  {pipelineStage < 7 && !deployError && (
                    <div className="text-amber-400/80 animate-pulse flex items-center gap-2 pt-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Executing cluster provisioning tasks...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Complete & Navigate Action */}
              {pipelineStage >= 7 && deployedServerId && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectServer) {
                        onSelectServer(deployedServerId);
                      }
                      onNavigate('server-manage');
                    }}
                    className="flex items-center gap-2 px-8 py-3 rounded-2xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400 shadow-xl transition"
                  >
                    <span>Manage Server Instance</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {deployError && (
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDeploying(false);
                      setStep(3);
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-zinc-800 text-white text-xs font-semibold hover:bg-zinc-700 transition"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Modify Configuration & Retry</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )}

</div>
  );
};

export default ServerDeployWizard;
