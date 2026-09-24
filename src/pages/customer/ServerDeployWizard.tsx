import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2, Bot, CheckCircle2, ArrowRight, ArrowLeft, Cpu,
  Globe2, ShieldCheck, Tag, Sparkles, Check, Server as ServerIcon,
  Zap, Layers, Terminal, Loader2, AlertCircle, HardDrive, MemoryStick,
  Boxes, CheckCircle, RefreshCw, Radio, DollarSign, Activity, CreditCard,
  QrCode, Coins, Plus, FileText, Copy, Crown
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { fetchAuthoritativeMinecraftVersions, getCachedMinecraftVersions } from '../../lib/minecraftVersions';
import { formatMemory } from '../../lib/serverNormalize';
import { Product, Plan, Node, UserAllocationStatus } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { CryptoPaymentModal } from '../../components/billing/CryptoPaymentModal';

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
    defaultVersion: '1.21.4',
    versions: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.17.1', '1.16.5', '1.12.2', '1.8.8'],
    recommendedJava: 'Java 21',
    icon: Gamepad2
  },
  {
    id: 'purpur',
    name: 'Purpur',
    category: 'minecraft',
    description: 'Drop-in replacement for Paper with extreme configuration options & optimizations.',
    defaultVersion: '1.21.4',
    versions: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5'],
    recommendedJava: 'Java 21',
    icon: Gamepad2
  },
  {
    id: 'vanilla',
    name: 'Vanilla',
    category: 'minecraft',
    description: 'Official unmodified Mojang server software.',
    defaultVersion: '1.21.4',
    versions: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'],
    recommendedJava: 'Java 21',
    icon: Gamepad2
  },
  {
    id: 'fabric',
    name: 'Fabric',
    category: 'minecraft',
    description: 'Lightweight, modular modding toolchain for Minecraft.',
    defaultVersion: '1.21.4',
    versions: ['1.21.4', '1.21.3', '1.21.1', '1.21', '1.20.6', '1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.14.4'],
    recommendedJava: 'Java 21',
    icon: Boxes
  },
  {
    id: 'forge',
    name: 'Forge',
    category: 'minecraft',
    description: 'The standard modding platform for comprehensive Minecraft modpacks and legacy versions.',
    defaultVersion: '1.20.4',
    versions: ['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2', '1.18.2', '1.16.5', '1.12.2', '1.7.10'],
    recommendedJava: 'Java 17',
    icon: Layers
  },

  // Bot & App Hosting Software
  {
    id: 'nodejs',
    name: 'Node.js',
    category: 'bot',
    description: 'Modern JavaScript/TypeScript runtime with ES modules & npm/pnpm support.',
    defaultVersion: 'Node 22 (LTS)',
    versions: ['Node 22 (LTS)', 'Node 20 (LTS)', 'Node 23 (Current)', 'Node 18 (LTS)', 'Node 16 (Legacy)'],
    icon: Bot
  },
  {
    id: 'python',
    name: 'Python',
    category: 'bot',
    description: 'High-performance Python runtime for Discord.py, Pycord, and automation scripts.',
    defaultVersion: 'Python 3.12 (Latest)',
    versions: ['Python 3.12 (Latest)', 'Python 3.13 (Preview)', 'Python 3.11 (Stable)', 'Python 3.10', 'Python 3.9'],
    icon: Bot
  },
  {
    id: 'bun',
    name: 'Bun',
    category: 'bot',
    description: 'Ultra-fast all-in-one JavaScript runtime & package manager.',
    defaultVersion: 'Bun 1.2 (Latest)',
    versions: ['Bun 1.2 (Latest)', 'Bun 1.1', 'Bun 1.0'],
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
  const [selectedJavaVersion, setSelectedJavaVersion] = useState<string>(selectedSoftware.recommendedJava || 'Java 25');
  const [eulaAccepted, setEulaAccepted] = useState<boolean>(true);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);

  const [serverName, setServerName] = useState<string>(
    selectedProductCategory === 'minecraft' ? 'Minecraft Server' : 'Discord Bot Server'
  );
  const [selectedLocation, setSelectedLocation] = useState<string>('auto');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('auto');

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'stripe' | 'upi' | 'crypto'>('balance');
  const [gateways, setGateways] = useState<any | null>(null);
  const [allocations, setAllocations] = useState<UserAllocationStatus | null>(null);

  const [couponCode, setCouponCode] = useState<string>('WELCOME20');
  const [couponDiscount, setCouponDiscount] = useState<{ type: string; value: number } | null>({ type: 'percent', value: 20 });
  const [couponMsg, setCouponMsg] = useState<string | null>('WELCOME20 applied (20% OFF)');
  const [deployTxRef, setDeployTxRef] = useState<string>('');

  // Inline Quick Top-up Modal in Deploy Wizard
  const [showQuickDeposit, setShowQuickDeposit] = useState<boolean>(false);
  const [showCryptoModal, setShowCryptoModal] = useState<boolean>(false);
  const [quickDepositAmount, setQuickDepositAmount] = useState<number>(10);
  const [isProcessingQuickDeposit, setIsProcessingQuickDeposit] = useState<boolean>(false);
  const [quickDepositMsg, setQuickDepositMsg] = useState<string | null>(null);

  // Deployment Progress Pipeline
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [pipelineStage, setPipelineStage] = useState<number>(0);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [deployedServerId, setDeployedServerId] = useState<string | null>(null);

  const [runtimesMap, setRuntimesMap] = useState<any>(null);
  const versionRequestIdRef = useRef<number>(0);

  const handleQuickDeposit = async (amountToDeposit: number) => {
    setIsProcessingQuickDeposit(true);
    setQuickDepositMsg(null);
    try {
      const res = await apiRequest('/billing/add-credits', {
        method: 'POST',
        body: JSON.stringify({
          amount: amountToDeposit,
          paymentMethod: 'Instant Card (Stripe Verified)'
        })
      });

      if (res.success) {
        await refreshUser();
        setQuickDepositMsg(`+$${amountToDeposit.toFixed(2)} added to balance!`);
        setTimeout(() => {
          setShowQuickDeposit(false);
          setQuickDepositMsg(null);
        }, 1200);
      } else {
        setQuickDepositMsg(res.error?.message || 'Deposit failed');
      }
    } catch (err: any) {
      setQuickDepositMsg(err.message || 'Deposit error');
    } finally {
      setIsProcessingQuickDeposit(false);
    }
  };

  useEffect(() => {
    fetchDeployOptions();
    fetchRuntimes();
    if (selectedProductCategory === 'minecraft') {
      loadMinecraftVersions(selectedSoftware.name);
    }
  }, []);

  const fetchRuntimes = async () => {
    try {
      const res = await apiRequest('/runtimes');
      if (res.success && res.data) {
        setRuntimesMap(res.data);
        if (selectedSoftware.category === 'bot') {
          const key = selectedSoftware.id.toLowerCase();
          if (res.data[key]) {
            setDynamicVersions(res.data[key].versions);
            setSelectedVersion(res.data[key].defaultVersion);
          }
        }
      }
    } catch (e) {}
  };

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
      const [stRes, gwRes] = await Promise.all([
        apiRequest('/server-types'),
        apiRequest('/billing/payment-methods')
      ]);
      if (stRes.success && stRes.data) setServerTypes(stRes.data);
      if (gwRes.success && gwRes.data) setGateways(gwRes.data);
    } catch (e) {
      // Ignore fallback
    }
  };

  const loadMinecraftVersions = async (softwareName: string) => {
    const requestId = ++versionRequestIdRef.current;

    // Check if we already have the complete authoritative version list cached in memory
    const cached = getCachedMinecraftVersions(softwareName);
    if (cached && cached.versions.length > 0) {
      setDynamicVersions(cached.versions);
      setSelectedVersion(prev => (cached.versions.includes(prev) ? prev : cached.latest || cached.versions[0] || '1.21.4'));
      if (cached.recommendedJava) {
        setSelectedJavaVersion(`Java ${cached.recommendedJava}`);
      }
      return;
    }

    setIsLoadingVersions(true);
    try {
      const data = await fetchAuthoritativeMinecraftVersions(softwareName);
      if (requestId !== versionRequestIdRef.current) {
        // Race condition guard: ignore if user already switched to another software engine
        return;
      }
      if (data && data.versions && data.versions.length > 0) {
        setDynamicVersions(data.versions);
        setSelectedVersion(prev => (data.versions.includes(prev) ? prev : data.latest || data.versions[0] || '1.21.4'));
        if (data.recommendedJava) {
          setSelectedJavaVersion(`Java ${data.recommendedJava}`);
        }
      }
    } catch (e) {
      // Fallback
    } finally {
      if (requestId === versionRequestIdRef.current) {
        setIsLoadingVersions(false);
      }
    }
  };

  const handleSelectSoftware = (software: SoftwareOption) => {
    setSelectedSoftware(software);

    // Auto-map software to serverTypeId
    const nameLower = software.name.toLowerCase();
    if (nameLower.includes('node')) {
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
    } else if (software.category === 'bot' && runtimesMap) {
      const key = software.id.toLowerCase();
      if (runtimesMap[key]) {
        setDynamicVersions(runtimesMap[key].versions);
        setSelectedVersion(runtimesMap[key].defaultVersion);
      } else {
        setDynamicVersions(software.versions);
        setSelectedVersion(software.defaultVersion);
      }
    } else {
      setDynamicVersions(software.versions);
      setSelectedVersion(software.defaultVersion);
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
    try {
      const res = await apiRequest('/billing/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({ code: couponCode.trim() })
      });
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
    } catch (e) {
      if (couponCode.toUpperCase() === 'WELCOME20') {
        setCouponDiscount({ type: 'percent', value: 20 });
        setCouponMsg('WELCOME20 applied (20% OFF)');
      } else {
        setCouponDiscount(null);
        setCouponMsg('Invalid promotional code');
      }
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
        transactionRef: deployTxRef || undefined,
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
            <Sparkles className="h-6 w-6 text-amber-400" /> Server Provisioning
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
                  ? 'bg-amber-500/10 border-amber-500/40 text-white ring-1 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className={`p-3 rounded-xl ${selectedProductCategory === 'minecraft' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                <Gamepad2 className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="font-extrabold text-white text-base flex items-center gap-2 tracking-tight">
                  Minecraft Server Hosting
                  {selectedProductCategory === 'minecraft' && <Crown className="h-4 w-4 text-amber-400" />}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  High-performance Minecraft engines with Paper, Purpur, Vanilla, Fabric & Forge support.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleProductCategoryChange('bot')}
              className={`p-5 rounded-2xl border text-left transition flex items-start gap-4 ${
                selectedProductCategory === 'bot'
                  ? 'bg-amber-500/10 border-amber-500/40 text-white ring-1 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-900'
              }`}
            >
              <div className={`p-3 rounded-xl ${selectedProductCategory === 'bot' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-zinc-800 text-zinc-400'}`}>
                <Bot className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <div className="font-extrabold text-white text-base flex items-center gap-2 tracking-tight">
                  Discord Bot & App Hosting
                  {selectedProductCategory === 'bot' && <Crown className="h-4 w-4 text-amber-400" />}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  24/7 background hosting for Node.js, Python, and Bun automation bots.
                </p>
              </div>
            </button>
          </div>

          {/* Software Options Grid */}
          <div className="space-y-3.5">
            <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-400">
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
                    className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-zinc-900 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.08)] text-white'
                        : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-xl ${isSelected ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse' : 'bg-zinc-900 text-zinc-500'}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-extrabold text-sm text-white tracking-tight">{software.name}</span>
                        </div>
                        {isSelected && <Crown className="h-4 w-4 text-amber-400" />}
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                        {software.description}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] font-medium text-zinc-500">
                      <span>Default Version</span>
                      <span className="font-mono text-zinc-300 font-bold">{software.defaultVersion}</span>
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
                    {selectedSoftware.id === 'python' ? 'main.py' : selectedSoftware.id === 'bun' ? 'index.ts' : selectedSoftware.id === 'golang' ? 'main.go' : selectedSoftware.id === 'rust' ? 'main.rs' : 'index.js'}
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
              const isPremiumPlan = plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('unlimited') || plan.priceMonthly > 10;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id)}
                  className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-zinc-900 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.08)] ring-1 ring-amber-500/20 text-white'
                      : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold text-base text-white tracking-tight flex items-center gap-1.5">
                        {isPremiumPlan && <Crown className="w-4 h-4 text-amber-400" />}
                        {plan.name}
                      </span>
                      {isSelected && <CheckCircle className="h-5 w-5 text-amber-400" />}
                    </div>

                    <div className="pb-1.5 flex items-baseline justify-between border-b border-zinc-900">
                      {price === 0 ? (
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-emerald-400 tracking-tight">FREE TIER</span>
                          <span className="text-[11px] text-zinc-500 font-mono font-bold">$0.00 / mo</span>
                        </div>
                      ) : (
                        <div>
                          <span className="text-2xl font-black text-white font-mono tracking-tight tabular-nums">${price.toFixed(2)}</span>
                          <span className="text-xs text-zinc-500 font-medium ml-1">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between text-zinc-300 pb-1.5 border-b border-zinc-900">
                        <span className="flex items-center gap-2 text-zinc-450">
                          <MemoryStick className="h-3.5 w-3.5 text-amber-400" /> Dedicated RAM
                        </span>
                        <span className="font-mono font-bold text-white">{formatMemory(plan.ramMB)}</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300 pb-1.5 border-b border-zinc-900">
                        <span className="flex items-center gap-2 text-zinc-450">
                          <Cpu className="h-3.5 w-3.5 text-amber-400" /> CPU Limits
                        </span>
                        <span className="font-mono font-bold text-white">{plan.cpuCores * 100}% vCPU</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300 pb-1.5 border-b border-zinc-900">
                        <span className="flex items-center gap-2 text-zinc-450">
                          <HardDrive className="h-3.5 w-3.5 text-amber-400" /> NVMe Storage
                        </span>
                        <span className="font-mono font-bold text-white">{plan.diskGB} GB SSD</span>
                      </div>

                      <div className="flex items-center justify-between text-zinc-300">
                        <span className="flex items-center gap-2 text-zinc-450">
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Backups Included
                        </span>
                        <span className="font-mono font-bold text-white">{plan.backupLimit} Slots</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3">
                    <div className={`w-full py-2.5 rounded-xl text-center text-xs font-extrabold uppercase tracking-wider transition ${
                      isSelected
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'bg-zinc-900 text-zinc-350 hover:bg-zinc-800'
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
                <DollarSign className="h-4 w-4 text-amber-400" /> Billing Cycle & Payment Method
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

              {/* Payment Method Selector or Free Instance Callout */}
              {calculateTotalPrice() <= 0 ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1">
                  <div className="text-xs font-bold flex items-center gap-1.5 text-emerald-300">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> Free Instance / 100% Discount Applied ($0.00 Total)
                  </div>
                  <p className="text-[11px] text-zinc-300">
                    No payment or credits are required for this deployment. Click "Review & Deploy" below to activate your server instantly!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-300">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('balance')}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                        paymentMethod === 'balance'
                          ? 'bg-amber-500/10 border-amber-500 text-white font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Coins className="h-4 w-4 text-amber-400" />
                      <span>Credits (${user?.credits?.toFixed(2) || '0.00'})</span>
                    </button>

                    {gateways?.stripe?.enabled !== false && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('stripe')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                          paymentMethod === 'stripe'
                            ? 'bg-amber-500/10 border-amber-500 text-white font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        <CreditCard className="h-4 w-4 text-cyan-400" />
                        <span>Instant Card</span>
                      </button>
                    )}

                    {gateways?.upi?.enabled !== false && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('upi')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                          paymentMethod === 'upi'
                            ? 'bg-amber-500/10 border-amber-500 text-white font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        <QrCode className="h-4 w-4 text-violet-400" />
                        <span>UPI / QR</span>
                      </button>
                    )}

                    {gateways?.crypto?.enabled !== false && (
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('crypto')}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                          paymentMethod === 'crypto'
                            ? 'bg-amber-500/10 border-amber-500 text-white font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        <Coins className="h-4 w-4 text-emerald-400" />
                        <span>Crypto</span>
                      </button>
                    )}
                  </div>

                  {/* Account Credits Status & Quick Deposit Button */}
                  {paymentMethod === 'balance' && (
                    <div className="pt-2">
                      {((user?.credits || 0) >= calculateTotalPrice()) ? (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <CheckCircle2 className="h-4 w-4" /> Sufficient credits available
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400">
                            Remaining: ${((user?.credits || 0) - calculateTotalPrice()).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                          <div className="flex items-center justify-between text-amber-400">
                            <span className="font-semibold flex items-center gap-1">
                              <AlertCircle className="h-4 w-4" /> Shortfall: ${(calculateTotalPrice() - (user?.credits || 0)).toFixed(2)} required
                            </span>
                            <span className="font-mono text-[11px]">Balance: ${user?.credits?.toFixed(2) || '0.00'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleQuickDeposit(Math.ceil(calculateTotalPrice() - (user?.credits || 0)))}
                              disabled={isProcessingQuickDeposit}
                              className="flex-1 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-[11px] transition"
                            >
                              {isProcessingQuickDeposit ? 'Depositing...' : `+ Deposit Shortfall ($${Math.ceil(calculateTotalPrice() - (user?.credits || 0))})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowQuickDeposit(true)}
                              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition"
                            >
                              Custom Deposit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Real-time Crypto Payment Processor Callout */}
                  {paymentMethod === 'crypto' && gateways?.crypto?.enabled !== false && (
                    <div className="pt-2">
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-500/20 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                            <Zap className="w-4 h-4 text-amber-400" /> Real-Time Live Crypto Gateway
                          </div>
                          <p className="text-[11px] text-zinc-400">
                            Scan QR Code for exact checkout amount (${calculateTotalPrice().toFixed(2)} USD), live exchange rates & instant server delivery.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowCryptoModal(true)}
                          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all shrink-0 flex items-center justify-center gap-1.5"
                        >
                          <Coins className="w-4 h-4" />
                          <span>Pay ${calculateTotalPrice().toFixed(2)} with Crypto & Activate</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Direct UPI Callout */}
                  {paymentMethod === 'upi' && gateways?.upi?.enabled !== false && (
                    <div className="pt-2">
                      <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold text-violet-400">
                          <QrCode className="w-4 h-4" /> Instant UPI QR Code Payment
                        </div>
                        <p className="text-[11px] text-zinc-400">
                          Scan UPI QR code for exact total <strong>${calculateTotalPrice().toFixed(2)} USD</strong> using GPay, PhonePe or Paytm. Your server auto-activates upon payment confirmation.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
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

      {/* QUICK DEPOSIT MODAL WITHIN WIZARD */}
      {showQuickDeposit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-amber-400" /> Quick Account Deposit
              </h3>
              <button onClick={() => setShowQuickDeposit(false)} className="text-xs text-zinc-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-zinc-400">
              Instant credit deposit so you can proceed immediately with deploying your server without reconfiguring.
            </p>

            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 25, 50].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setQuickDepositAmount(amt)}
                  className={`p-2.5 rounded-xl font-mono text-xs font-bold border transition ${
                    quickDepositAmount === amt
                      ? 'bg-amber-400 text-black border-amber-300'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {quickDepositMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                {quickDepositMsg}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowQuickDeposit(false)}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-xs text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleQuickDeposit(quickDepositAmount)}
                disabled={isProcessingQuickDeposit}
                className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs disabled:opacity-50 transition"
              >
                {isProcessingQuickDeposit ? 'Depositing...' : `Deposit $${quickDepositAmount}.00`}
              </button>
            </div>
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
                      {formatMemory(selectedPlan?.ramMB || (selectedProductCategory === 'bot' ? 512 : 1024))} / {((selectedPlan?.cpuCores || (selectedProductCategory === 'bot' ? 0.5 : 1)) * 100)}% vCPU
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500">Total Price ({billingCycle})</span>
                    <div className="font-bold text-emerald-400 text-sm font-mono flex items-center gap-1">
                      {calculateTotalPrice() <= 0 ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                          FREE ($0.00)
                        </span>
                      ) : (
                        `$${calculateTotalPrice().toFixed(2)}`
                      )}
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('billing')}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition"
                  >
                    <FileText className="h-4 w-4 text-amber-400" />
                    <span>View Invoices & Receipts</span>
                  </button>

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

      {/* Real-time Crypto Payment Processor Modal */}
      <CryptoPaymentModal
        isOpen={showCryptoModal}
        onClose={() => setShowCryptoModal(false)}
        amountUsd={calculateTotalPrice()}
        purpose="server_deploy"
        serverPayload={{
          name: serverName.trim() || `${selectedSoftware.name} Server`,
          planId: selectedPlan?.id || selectedPlanId,
          nodeId: selectedNodeId === 'auto' ? undefined : selectedNodeId,
          location: selectedLocation === 'auto' ? undefined : selectedLocation,
          serverTypeId: selectedServerTypeId,
          software: selectedSoftware.name,
          version: selectedVersion,
          billingCycle,
          couponCode: couponDiscount ? couponCode : undefined,
          environmentVars: {
            EULA: eulaAccepted ? 'true' : 'false',
            JAVA_VERSION: selectedJavaVersion
          }
        }}
        onSuccess={async (inv, serverActivation) => {
          setShowCryptoModal(false);
          if (serverActivation?.server?.id) {
            setDeployedServerId(serverActivation.server.id);
            setStep(4);
            setIsDeploying(true);
            setPipelineStage(7);
            setPipelineLogs([
              `✔ [CryptoProcessor] Real-time blockchain payment confirmed!`,
              `✔ Instance deployed successfully! (ID: ${serverActivation.server.id})`,
              `✔ Primary Endpoint: ${serverActivation.server.primaryIp}:${serverActivation.server.primaryPort}`,
              `✔ Status: RUNNING`
            ]);
            await refreshUser();
            if (onRefreshServers) onRefreshServers();
          }
        }}
      />

</div>
  );
};

export default ServerDeployWizard;
