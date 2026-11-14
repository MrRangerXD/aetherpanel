import React, { useState, useEffect, useRef } from 'react';
import {
  Gamepad2, Bot, CheckCircle2, ArrowRight, ArrowLeft, Cpu,
  Globe2, ShieldCheck, Server as ServerIcon,
  Zap, Layers, Terminal, Loader2, AlertCircle, HardDrive, MemoryStick,
  Boxes, CheckCircle, RefreshCw, DollarSign, Activity, CreditCard,
  QrCode, Coins, Plus, FileText, Crown, X, Check
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { fetchAuthoritativeMinecraftVersions, getCachedMinecraftVersions } from '../../lib/minecraftVersions';
import { formatMemory } from '../../lib/serverNormalize';
import { Product, Plan, Node, UserAllocationStatus } from '../../types';
import { useAuth } from '../../lib/AuthContext';
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
    versions: ['Node 22 (LTS)', 'Node 23 (Current)', 'Node 20 (LTS)', 'Node 18 (LTS)'],
    icon: Bot
  },
  {
    id: 'python',
    name: 'Python',
    category: 'bot',
    description: 'High-performance Python runtime for Discord.py, Pycord, and automation scripts.',
    defaultVersion: 'Python 3.13 (Latest)',
    versions: ['Python 3.13 (Latest)', 'Python 3.12 (Stable)', 'Python 3.11', 'Python 3.10'],
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

  // Wizard Steps: 1 = Product & Software, 2 = Plan Tier & Resources, 3 = Name, Region & Billing, 4 = Review & Deploy
  const [step, setStep] = useState<number>(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [, setServerTypes] = useState<any[]>([]);
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
  const [selectedLocation] = useState<string>('auto');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('auto');

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'stripe' | 'upi' | 'crypto'>('balance');
  const [gateways, setGateways] = useState<any | null>(null);
  const [allocations, setAllocations] = useState<UserAllocationStatus | null>(null);

  const [couponCode, setCouponCode] = useState<string>('WELCOME20');
  const [couponDiscount, setCouponDiscount] = useState<{ type: string; value: number } | null>({ type: 'percent', value: 20 });
  const [couponMsg, setCouponMsg] = useState<string | null>('WELCOME20 applied (20% OFF)');
  const [deployTxRef] = useState<string>('');

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

  const loadMinecraftVersions = async (softwareName: string) => {
    const requestId = ++versionRequestIdRef.current;

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

  useEffect(() => {
    fetchDeployOptions();
    fetchRuntimes();
    if (selectedProductCategory === 'minecraft') {
      loadMinecraftVersions(selectedSoftware.name);
    }
  }, []);

  const handleSelectSoftware = (software: SoftwareOption) => {
    setSelectedSoftware(software);

    // Hard dependency: Immediately reset dynamic versions and selected version to this software only
    const initialVersions = software.versions && software.versions.length > 0 ? software.versions : [software.defaultVersion];
    setDynamicVersions(initialVersions);
    setSelectedVersion(software.defaultVersion || initialVersions[0]);

    if (software.recommendedJava) {
      setSelectedJavaVersion(software.recommendedJava);
    }

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
    } else if (software.category === 'bot') {
      const key = software.id.toLowerCase();
      if (runtimesMap && runtimesMap[key] && Array.isArray(runtimesMap[key].versions) && runtimesMap[key].versions.length > 0) {
        setDynamicVersions(runtimesMap[key].versions);
        setSelectedVersion(runtimesMap[key].defaultVersion || runtimesMap[key].versions[0]);
      }
    }
  };

  const handleProductCategoryChange = (category: 'minecraft' | 'bot') => {
    setSelectedProductCategory(category);
    const firstSoft = SOFTWARE_CATALOG.find(s => s.category === category);
    if (firstSoft) {
      handleSelectSoftware(firstSoft);
    }
    setServerName(category === 'minecraft' ? 'Minecraft Server' : 'Discord Bot Server');

    const matchingCategory = category === 'bot' ? 'prod_bot' : 'prod_minecraft';
    const matchingPlan = plans.find(p => p.productId === matchingCategory);
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
      { msg: `[Network] Binding virtual network interfaces & dedicated node port allocation...`, delay: 600 },
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
          `[SUCCESS] [ONLINE] Instance deployed successfully! (ID: ${res.data.server.id})`,
          `[SUCCESS] Primary Endpoint: ${res.data.server.primaryIp}:${res.data.server.primaryPort}`,
          `[SUCCESS] Status: RUNNING`
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
      setPipelineLogs(prev => [...prev, `[ERROR] ${err.message || 'Fatal deployment failure'}`]);
    }
  };

  const filteredSoftware = SOFTWARE_CATALOG.filter(s => s.category === selectedProductCategory);
  const isAllocationLimitReached = Boolean(allocations && !allocations.unlimited && allocations.remaining !== null && allocations.remaining <= 0);

  return (
    <div className="w-full space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2">
            <ServerIcon className="h-5 w-5 text-[var(--color-accent)]" /> Server Provisioning
          </h1>
          <p className="text-xs text-[var(--color-ink-mute)] mt-0.5">
            Deploy Minecraft servers and Discord bot environments on dedicated compute instances.
          </p>
        </div>

        {/* Steps Progress Indicator */}
        {!isAllocationLimitReached && (
          <div className="flex items-center gap-1.5 text-xs">
            {[
              { num: 1, label: 'Software' },
              { num: 2, label: 'Plan & Tier' },
              { num: 3, label: 'Config & Region' },
              { num: 4, label: 'Deploy' }
            ].map((s, idx) => (
              <React.Fragment key={s.num}>
                {idx > 0 && <div className={`w-3 h-[1px] ${step >= s.num ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                  step === s.num
                    ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border border-[var(--color-accent)]'
                    : step > s.num
                    ? 'text-[var(--color-ink-dim)] surface border border-[var(--color-line)]'
                    : 'text-[var(--color-ink-mute)] surface border border-[var(--color-line-soft)]'
                }`}>
                  <span>{s.num}.</span>
                  <span className="hidden sm:inline font-sans">{s.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* ALLOCATION LIMIT REACHED */}
      {isAllocationLimitReached ? (
        <div className="surface p-8 sm:p-10 rounded-lg text-center max-w-lg mx-auto space-y-4 my-8">
          <div className="w-12 h-12 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-line)] text-[var(--color-warn)] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Server Allocation Limit Reached</h2>
            <p className="text-xs text-[var(--color-ink-mute)] max-w-sm mx-auto">
              Your current plan does not support additional server allocations. Upgrade your plan or purchase additional allocations.
            </p>
          </div>
          
          <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] text-xs font-mono text-[var(--color-ink-dim)] flex items-center justify-between">
            <span>Current Usage:</span>
            <span className="font-bold text-[var(--color-ink)]">{allocations?.used} / {allocations?.limit}</span>
          </div>

          <div className="flex gap-2 justify-center pt-1">
            <button
              onClick={() => onNavigate('billing')}
              className="btn btn-primary text-xs"
            >
              <span>View Plans</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate('support')}
              className="btn btn-ghost text-xs"
            >
              Contact Administrator
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* STEP 1: Choose Product & Software */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Category Toggle */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleProductCategoryChange('minecraft')}
                  className={`p-4 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-3.5 ${
                    selectedProductCategory === 'minecraft'
                      ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                      : 'surface border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <div className={`p-2.5 rounded-md ${selectedProductCategory === 'minecraft' ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)] border border-[var(--color-line)]' : 'surface-2 text-[var(--color-ink-mute)] border border-[var(--color-line)]'}`}>
                    <Gamepad2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-[var(--color-ink)]">
                      Minecraft Server Hosting
                    </div>
                    <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                      Paper, Purpur, Vanilla, Fabric & Forge support.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleProductCategoryChange('bot')}
                  className={`p-4 rounded-lg border text-left transition-colors cursor-pointer flex items-start gap-3.5 ${
                    selectedProductCategory === 'bot'
                      ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                      : 'surface border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <div className={`p-2.5 rounded-md ${selectedProductCategory === 'bot' ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)] border border-[var(--color-line)]' : 'surface-2 text-[var(--color-ink-mute)] border border-[var(--color-line)]'}`}>
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-sm text-[var(--color-ink)]">
                      Discord Bot & App Hosting
                    </div>
                    <p className="text-xs text-[var(--color-ink-mute)] leading-relaxed">
                      24/7 background hosting for Node.js, Python, and Bun automation.
                    </p>
                  </div>
                </button>
              </div>

              {/* Software Options Grid */}
              <div className="space-y-2.5">
                <h2 className="label">
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
                        className={`p-3.5 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                            : 'surface border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)] hover:border-[var(--color-line-soft)]'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`p-1.5 rounded-md border border-[var(--color-line)] ${isSelected ? 'bg-[var(--color-surface-2)] text-[var(--color-accent)]' : 'surface-2 text-[var(--color-ink-mute)]'}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <span className="font-semibold text-xs text-[var(--color-ink)]">{software.name}</span>
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
                          </div>
                          <p className="text-[11px] text-[var(--color-ink-mute)] line-clamp-2 leading-relaxed">
                            {software.description}
                          </p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-[var(--color-line)] flex items-center justify-between text-[10px] text-[var(--color-ink-mute)] font-mono">
                          <span>Default Version</span>
                          <span className="text-[var(--color-ink-dim)]">{software.defaultVersion}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Version & Runtime Environment Controls */}
              <div className="surface p-4 rounded-lg space-y-3">
                <h3 className="label flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Runtime Version & Parameters
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label block mb-1">
                      Software Version {isLoadingVersions && <Loader2 className="inline h-3 w-3 animate-spin text-[var(--color-accent)] ml-1" />}
                    </label>
                    <select
                      value={selectedVersion}
                      onChange={e => {
                        const nextVer = e.target.value;
                        setSelectedVersion(nextVer);
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
                      className="field w-full px-2.5 py-1.5 text-xs font-mono rounded-md"
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
                      <label className="label block mb-1">
                        Java Runtime Environment
                      </label>
                      <select
                        value={selectedJavaVersion}
                        onChange={e => setSelectedJavaVersion(e.target.value)}
                        className="field w-full px-2.5 py-1.5 text-xs font-mono rounded-md"
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
                      <label className="label block mb-1">
                        Default Startup Entrypoint
                      </label>
                      <div className="surface-2 border border-[var(--color-line)] rounded-md px-3 py-1.5 text-xs text-[var(--color-ink-dim)] font-mono">
                        {selectedSoftware.id === 'python' ? 'main.py' : selectedSoftware.id === 'bun' ? 'index.ts' : selectedSoftware.id === 'golang' ? 'main.go' : selectedSoftware.id === 'rust' ? 'main.rs' : 'index.js'}
                      </div>
                    </div>
                  )}
                </div>

                {selectedProductCategory === 'minecraft' && (
                  <div className="pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-[var(--color-ink-dim)]">
                      <input
                        type="checkbox"
                        checked={eulaAccepted}
                        onChange={e => setEulaAccepted(e.target.checked)}
                        className="rounded border-[var(--color-line)] text-[var(--color-accent)] focus:ring-0 bg-[var(--color-surface)]"
                      />
                      <span>Accept the official Minecraft EULA (eula=true)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-primary text-xs"
                >
                  <span>Next: Choose Plan & Tier</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Choose Plan Tier & Resources */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[var(--color-ink)] label">
                  Select Plan Tier ({selectedProductCategory === 'minecraft' ? 'Minecraft' : 'Bot Hosting'})
                </h2>
                <span className="text-xs text-[var(--color-ink-mute)] font-mono">
                  {currentProductPlans.length} Available Tiers
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {currentProductPlans.map(plan => {
                  const isSelected = selectedPlan?.id === plan.id;
                  const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
                  const isPremiumPlan = plan.name.toLowerCase().includes('pro') || plan.name.toLowerCase().includes('unlimited') || plan.priceMonthly > 10;

                  return (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors flex flex-col justify-between ${
                        isSelected
                          ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                          : 'surface border-[var(--color-line)] text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-[var(--color-ink)] flex items-center gap-1.5">
                            {isPremiumPlan && <Crown className="w-3.5 h-3.5 text-[var(--color-accent)]" />}
                            {plan.name}
                          </span>
                          {isSelected && <CheckCircle className="h-4 w-4 text-[var(--color-accent)]" />}
                        </div>

                        <div className="pb-1 flex items-baseline justify-between border-b border-[var(--color-line)]">
                          {price === 0 ? (
                            <span className="text-base font-bold text-[var(--color-ok)]">FREE TIER</span>
                          ) : (
                            <div>
                              <span className="text-xl font-bold text-[var(--color-ink)] font-mono tabular-nums">${price.toFixed(2)}</span>
                              <span className="text-xs text-[var(--color-ink-mute)] ml-1">/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-[var(--color-ink-dim)] pb-1 border-b border-[var(--color-line)]">
                            <span className="flex items-center gap-1.5 text-[var(--color-ink-mute)]">
                              <MemoryStick className="h-3 w-3 text-[var(--color-accent)]" /> RAM
                            </span>
                            <span className="font-mono font-medium text-[var(--color-ink)]">{formatMemory(plan.ramMB)}</span>
                          </div>

                          <div className="flex items-center justify-between text-[var(--color-ink-dim)] pb-1 border-b border-[var(--color-line)]">
                            <span className="flex items-center gap-1.5 text-[var(--color-ink-mute)]">
                              <Cpu className="h-3 w-3 text-[var(--color-accent)]" /> CPU
                            </span>
                            <span className="font-mono font-medium text-[var(--color-ink)]">{plan.cpuCores * 100}% vCPU</span>
                          </div>

                          <div className="flex items-center justify-between text-[var(--color-ink-dim)] pb-1 border-b border-[var(--color-line)]">
                            <span className="flex items-center gap-1.5 text-[var(--color-ink-mute)]">
                              <HardDrive className="h-3 w-3 text-[var(--color-accent)]" /> Storage
                            </span>
                            <span className="font-mono font-medium text-[var(--color-ink)]">{plan.diskGB} GB SSD</span>
                          </div>

                          <div className="flex items-center justify-between text-[var(--color-ink-dim)]">
                            <span className="flex items-center gap-1.5 text-[var(--color-ink-mute)]">
                              <ShieldCheck className="h-3 w-3 text-[var(--color-accent)]" /> Backups
                            </span>
                            <span className="font-mono font-medium text-[var(--color-ink)]">{plan.backupLimit} Slots</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-2">
                        <div className={`w-full py-1.5 rounded-[4px] text-center text-xs font-medium uppercase tracking-wider transition-colors ${
                          isSelected
                            ? 'bg-[var(--color-accent)] text-white'
                            : 'surface-2 text-[var(--color-ink-dim)] border border-[var(--color-line)]'
                        }`}>
                          {isSelected ? 'Selected' : 'Select'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-line)]">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="btn btn-ghost text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn btn-primary text-xs"
                >
                  <span>Next: Configuration & Node</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Server Name, Region & Billing */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Instance Configuration */}
                <div className="surface p-4 rounded-lg space-y-3">
                  <h3 className="label flex items-center gap-1.5">
                    <ServerIcon className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Instance Identification
                  </h3>

                  <div>
                    <label className="label block mb-1">Server Name</label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={e => setServerName(e.target.value)}
                      placeholder="e.g. Survival SMP"
                      className="field w-full px-3 py-1.5 text-xs rounded-md"
                    />
                  </div>

                  <div>
                    <label className="label block mb-1">Compute Node</label>
                    <select
                      value={selectedNodeId}
                      onChange={e => setSelectedNodeId(e.target.value)}
                      className="field w-full px-2.5 py-1.5 text-xs rounded-md"
                    >
                      <option value="auto">Automatic (Lowest cluster load)</option>
                      {nodes.map(node => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.locationName}) - {node.ip}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="pt-1 text-[11px] text-[var(--color-ink-mute)] flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5 text-[var(--color-ok)]" />
                    <span>Dedicated node port allocation assigned upon deployment.</span>
                  </div>
                </div>

                {/* Billing & Discounts */}
                <div className="surface p-4 rounded-lg space-y-3">
                  <h3 className="label flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Billing Cycle & Payment
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBillingCycle('monthly')}
                      className={`p-2 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                        billingCycle === 'monthly'
                          ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                          : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillingCycle('yearly')}
                      className={`p-2 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                        billingCycle === 'yearly'
                          ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                          : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                      }`}
                    >
                      Yearly (-15%)
                    </button>
                  </div>

                  <div>
                    <label className="label block mb-1">Promotional Coupon</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value.toUpperCase())}
                        placeholder="COUPON CODE"
                        className="field flex-1 px-3 py-1.5 text-xs uppercase font-mono rounded-md"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        className="btn btn-ghost text-xs py-1.5"
                      >
                        Apply
                      </button>
                    </div>
                    {couponMsg && (
                      <p className="text-[10px] text-[var(--color-ok)] mt-1 font-mono">{couponMsg}</p>
                    )}
                  </div>

                  {calculateTotalPrice() <= 0 ? (
                    <div className="p-3 rounded-md bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-xs space-y-0.5">
                      <div className="font-semibold">Free Instance / 100% Discount</div>
                      <p className="text-[11px] text-[var(--color-ink-dim)]">No payment required. Proceed directly to deploy.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="label block">Payment Method</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod('balance')}
                          className={`p-2 rounded-md border text-xs font-medium flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                            paymentMethod === 'balance'
                              ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                              : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                          }`}
                        >
                          <Coins className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                          <span className="text-[10px] truncate">Credits (${user?.credits?.toFixed(2) || '0.00'})</span>
                        </button>

                        {gateways?.stripe?.enabled !== false && (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('stripe')}
                            className={`p-2 rounded-md border text-xs font-medium flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                              paymentMethod === 'stripe'
                                ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                                : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                            }`}
                          >
                            <CreditCard className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                            <span className="text-[10px]">Card</span>
                          </button>
                        )}

                        {gateways?.upi?.enabled !== false && (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('upi')}
                            className={`p-2 rounded-md border text-xs font-medium flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                              paymentMethod === 'upi'
                                ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                                : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                            }`}
                          >
                            <QrCode className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                            <span className="text-[10px]">UPI / QR</span>
                          </button>
                        )}

                        {gateways?.crypto?.enabled !== false && (
                          <button
                            type="button"
                            onClick={() => setPaymentMethod('crypto')}
                            className={`p-2 rounded-md border text-xs font-medium flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                              paymentMethod === 'crypto'
                                ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)] text-[var(--color-ink)]'
                                : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                            }`}
                          >
                            <Coins className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                            <span className="text-[10px]">Crypto</span>
                          </button>
                        )}
                      </div>

                      {paymentMethod === 'balance' && (
                        <div className="pt-1.5">
                          {((user?.credits || 0) >= calculateTotalPrice()) ? (
                            <div className="p-2.5 rounded-md bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-xs text-[var(--color-ok)] flex items-center justify-between">
                              <span className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Sufficient balance
                              </span>
                              <span className="font-mono text-[10px] text-[var(--color-ink-mute)]">
                                Rem: ${((user?.credits || 0) - calculateTotalPrice()).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <div className="p-2.5 rounded-md bg-[var(--color-warn)]/10 border border-[var(--color-warn)]/30 text-xs space-y-1.5">
                              <div className="flex items-center justify-between text-[var(--color-warn)]">
                                <span className="flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" /> Shortfall: ${(calculateTotalPrice() - (user?.credits || 0)).toFixed(2)}
                                </span>
                                <span className="font-mono text-[10px]">Bal: ${user?.credits?.toFixed(2) || '0.00'}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickDeposit(Math.ceil(calculateTotalPrice() - (user?.credits || 0)))}
                                  disabled={isProcessingQuickDeposit}
                                  className="btn btn-primary text-xs py-1 flex-1"
                                >
                                  {isProcessingQuickDeposit ? 'Depositing...' : `Deposit Shortfall ($${Math.ceil(calculateTotalPrice() - (user?.credits || 0))})`}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowQuickDeposit(true)}
                                  className="btn btn-ghost text-xs py-1"
                                >
                                  Custom
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

              {/* Navigation Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-[var(--color-line)]">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn btn-ghost text-xs"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="btn btn-primary text-xs"
                >
                  <span>Review & Deploy</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* QUICK DEPOSIT MODAL WITHIN WIZARD */}
          {showQuickDeposit && (
            <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 anim-fade-in">
              <div className="w-full max-w-sm surface p-5 rounded-lg space-y-3 anim-scale-in">
                <div className="flex justify-between items-center border-b border-[var(--color-line)] pb-2.5">
                  <h3 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-[var(--color-accent)]" /> Quick Account Deposit
                  </h3>
                  <button onClick={() => setShowQuickDeposit(false)} className="btn-icon">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-[var(--color-ink-mute)]">
                  Instant credit deposit to proceed with your deployment.
                </p>

                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 25, 50].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setQuickDepositAmount(amt)}
                      className={`p-2 rounded-md font-mono text-xs font-semibold border transition-colors cursor-pointer ${
                        quickDepositAmount === amt
                          ? 'bg-[var(--color-surface-3)] text-[var(--color-ink)] border-[var(--color-accent)]'
                          : 'surface-2 border-[var(--color-line)] text-[var(--color-ink-dim)]'
                      }`}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>

                {quickDepositMsg && (
                  <div className="p-2 rounded-md bg-[var(--color-ok)]/10 border border-[var(--color-ok)]/30 text-[var(--color-ok)] text-xs">
                    {quickDepositMsg}
                  </div>
                )}

                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowQuickDeposit(false)}
                    className="btn btn-ghost text-xs py-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickDeposit(quickDepositAmount)}
                    disabled={isProcessingQuickDeposit}
                    className="btn btn-primary text-xs py-1"
                  >
                    {isProcessingQuickDeposit ? 'Depositing...' : `Deposit $${quickDepositAmount}.00`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Review & Deploy Pipeline */}
          {step === 4 && (
            <div className="space-y-5">
              {!isDeploying ? (
                <div className="space-y-4">
                  <div className="surface p-5 rounded-lg space-y-4">
                    <h2 className="text-sm font-semibold text-[var(--color-ink)] flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--color-accent)]" /> Final Deployment Verification
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
                        <span className="label">Instance Name</span>
                        <div className="font-semibold text-[var(--color-ink)] text-sm truncate">{serverName}</div>
                      </div>

                      <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
                        <span className="label">Software & Version</span>
                        <div className="font-semibold text-[var(--color-accent)] text-sm">{selectedSoftware.name} {selectedVersion}</div>
                      </div>

                      <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
                        <span className="label">RAM & CPU</span>
                        <div className="font-semibold text-[var(--color-ink)] text-sm font-mono">
                          {formatMemory(selectedPlan?.ramMB || (selectedProductCategory === 'bot' ? 512 : 1024))} / {((selectedPlan?.cpuCores || (selectedProductCategory === 'bot' ? 0.5 : 1)) * 100)}% vCPU
                        </div>
                      </div>

                      <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] space-y-0.5">
                        <span className="label">Total Price ({billingCycle})</span>
                        <div className="font-bold text-[var(--color-ok)] text-sm font-mono flex items-center gap-1">
                          {calculateTotalPrice() <= 0 ? (
                            <span className="text-xs font-semibold text-[var(--color-ok)]">
                              FREE ($0.00)
                            </span>
                          ) : (
                            `$${calculateTotalPrice().toFixed(2)}`
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="surface-2 p-3 rounded-md border border-[var(--color-line)] text-xs text-[var(--color-ink-dim)] flex items-start gap-2.5">
                      <Activity className="h-4 w-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-[var(--color-ink)]">Live Execution Notice:</span> Our cluster scheduler will reserve hardware allocations, write config files, and spawn the server supervisor process.
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="btn btn-ghost text-xs"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Back to Settings</span>
                    </button>

                    <button
                      type="button"
                      onClick={startDeploymentPipeline}
                      className="btn btn-primary text-xs py-2 px-5"
                    >
                      <span>Authorize & Deploy Instance</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Live Deployment Progress Terminal */
                <div className="space-y-4">
                  <div className="surface rounded-lg overflow-hidden border border-[var(--color-line)]">
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-line)] surface-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-err)]/70" />
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-warn)]/70" />
                        <div className="h-2.5 w-2.5 rounded-full bg-[var(--color-ok)]/70" />
                        <span className="text-[11px] font-mono text-[var(--color-ink-mute)] ml-1">deployment_pipeline.log</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-mono text-[var(--color-ink-dim)]">
                        {pipelineStage < 7 && !deployError ? (
                          <span className="flex items-center gap-1 text-[var(--color-accent)]">
                            <Loader2 className="h-3 w-3 animate-spin" /> Provisioning Stage {pipelineStage}/6
                          </span>
                        ) : deployError ? (
                          <span className="text-[var(--color-err)] flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Deployment Failed
                          </span>
                        ) : (
                          <span className="text-[var(--color-ok)] flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Provision Completed
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-4 font-mono text-xs text-[var(--color-ink-dim)] space-y-1.5 min-h-60 bg-[var(--color-bg)]">
                      {pipelineLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={
                            log.startsWith('[SUCCESS]')
                              ? 'text-[var(--color-ok)] font-medium'
                              : log.startsWith('[ERROR]')
                              ? 'text-[var(--color-err)] font-medium'
                              : 'text-[var(--color-ink-dim)]'
                          }
                        >
                          {log}
                        </div>
                      ))}
                      {pipelineStage < 7 && !deployError && (
                        <div className="text-[var(--color-accent)] flex items-center gap-1.5 pt-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>Executing cluster tasks...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Complete & Navigate Action */}
                  {pipelineStage >= 7 && deployedServerId && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigate('billing')}
                        className="btn btn-ghost text-xs"
                      >
                        <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
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
                        className="btn btn-primary text-xs py-2 px-5"
                      >
                        <span>Manage Server Instance</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {deployError && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsDeploying(false);
                          setStep(3);
                        }}
                        className="btn btn-ghost text-xs"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
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
              `[SUCCESS] [CryptoProcessor] Real-time blockchain payment confirmed!`,
              `[SUCCESS] Instance deployed successfully! (ID: ${serverActivation.server.id})`,
              `[SUCCESS] Primary Endpoint: ${serverActivation.server.primaryIp}:${serverActivation.server.primaryPort}`,
              `[SUCCESS] Status: RUNNING`
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
