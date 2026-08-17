import React, { useState, useEffect } from 'react';
import {
  Gamepad2, Bot, CheckCircle2, ArrowRight, ArrowLeft, Cpu,
  Globe2, ShieldCheck, Tag, Sparkles, Check, Server as ServerIcon,
  Zap, Layers, Terminal, Loader2, AlertCircle, HardDrive, MemoryStick,
  Boxes, CheckCircle, RefreshCw
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Product, Plan, Node, ServerTemplate } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface ServerDeployWizardProps {
  onNavigate: (page: string) => void;
  onSelectServer: (serverId: string) => void;
  initialPlanId?: string;
  initialCategory?: string;
}

export const ServerDeployWizard: React.FC<ServerDeployWizardProps> = ({
  onNavigate,
  onSelectServer,
  initialPlanId,
  initialCategory
}) => {
  const { user, refreshUser } = useAuth();
  const { accentClasses } = useTheme();

  // Wizard Steps: 1 = Template, 2 = Version/Env, 3 = Name/Region, 4 = Plan, 5 = Node, 6 = Review, 7 = Deploy Pipeline
  const [step, setStep] = useState<number>(1);
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [templates, setTemplates] = useState<ServerTemplate[]>([]);

  // Selection States
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'minecraft' | 'bot' | 'other'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<ServerTemplate | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [customEnvVars, setCustomEnvVars] = useState<Record<string, string>>({});
  const [dynamicVersions, setDynamicVersions] = useState<string[]>([]);
  const [selectedJavaVersion, setSelectedJavaVersion] = useState<string>('Java 21');
  const [eulaAccepted, setEulaAccepted] = useState<boolean>(true);
  const [isLoadingVersions, setIsLoadingVersions] = useState<boolean>(false);
  
  const [serverName, setServerName] = useState<string>('My Aether Server');
  const [selectedLocation, setSelectedLocation] = useState<string>('us-east');
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || '');
  const [selectedNodeId, setSelectedNodeId] = useState<string>('auto'); // 'auto' or specific node id

  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'stripe'>('balance');

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
      if (res.data.plans) setPlans(res.data.plans);
      if (res.data.nodes) setNodes(res.data.nodes);
      if (res.data.templates) {
        setTemplates(res.data.templates);
        // Pre-select first popular or first template
        const popular = res.data.templates.find((t: ServerTemplate) => t.isPopular) || res.data.templates[0];
        if (popular) {
          setSelectedTemplate(popular);
          setSelectedVersion(popular.defaultVersion || popular.versions[0] || '');
          setCustomEnvVars(popular.environmentVars || {});
        }
      }
    }
  };

  const loadMinecraftVersions = async (software: string) => {
    setIsLoadingVersions(true);
    try {
      const res = await apiRequest(`/minecraft/versions?software=${encodeURIComponent(software)}`);
      if (res.success && res.data && res.data.versions && res.data.versions.length > 0) {
        setDynamicVersions(res.data.versions);
        setSelectedVersion(res.data.latest || res.data.versions[0]);
        if (res.data.recommendedJava) {
          setSelectedJavaVersion(`Java ${res.data.recommendedJava}`);
        }
      }
    } catch (e) {
      // Fallback to template versions
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleSelectTemplate = (tpl: ServerTemplate) => {
    setSelectedTemplate(tpl);
    setSelectedVersion(tpl.defaultVersion || tpl.versions[0] || '');
    setCustomEnvVars(tpl.environmentVars || {});
    setServerName(`${tpl.name} Instance`);

    if (tpl.category === 'minecraft') {
      loadMinecraftVersions(tpl.name);
    } else {
      setDynamicVersions(tpl.versions || []);
    }

    // Pre-select appropriate plan if available based on recommended RAM
    const matchingPlan = plans.find(p => p.productId === (tpl.category === 'minecraft' ? 'prod_minecraft' : 'prod_bot') && p.ramMB >= tpl.recommendedRamMB);
    if (matchingPlan) {
      setSelectedPlanId(matchingPlan.id);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    if (couponCode.toUpperCase() === 'WELCOME20') {
      setCouponDiscount({ type: 'percent', value: 20 });
      setCouponMsg('WELCOME20 applied (20% OFF)');
    } else {
      setCouponDiscount(null);
      setCouponMsg('Invalid promo code');
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || plans[0];

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

  // Deployment Steps Pipeline Simulation & Real API Trigger
  const triggerDeploy = async () => {
    if (!selectedPlan || !selectedTemplate) {
      setDeployError('Please complete all selection steps first.');
      return;
    }

    setIsDeploying(true);
    setStep(7); // Jump to Deployment Pipeline view
    setDeployError(null);
    setPipelineLogs([]);

    const log = (msg: string) => {
      setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      // Stage 0: Queued & Validating
      setPipelineStage(0);
      log('Stage 1/5 [QUEUED]: Validating plan restrictions and checking credit balance...');
      await new Promise(r => setTimeout(r, 900));

      // Stage 1: Node Selection & Capacity Reservation
      setPipelineStage(1);
      log(`Stage 2/5 [PROVISIONING]: Scheduling compute node (${selectedNodeId === 'auto' ? 'Automatic Capacity Balance' : selectedNodeId})...`);
      await new Promise(r => setTimeout(r, 1100));

      // Stage 2: Creating API Call to Backend
      setPipelineStage(2);
      log(`Stage 3/5 [INSTALLING]: Downloading official runtime binary for template '${selectedTemplate.name}' (${selectedVersion})...`);

      const res = await apiRequest('/deploy/create', {
        method: 'POST',
        body: JSON.stringify({
          name: serverName,
          planId: selectedPlan.id,
          templateId: selectedTemplate.id,
          nodeId: selectedNodeId === 'auto' ? undefined : selectedNodeId,
          location: selectedLocation,
          software: selectedTemplate.name,
          version: selectedVersion,
          billingCycle,
          couponCode: couponDiscount ? couponCode : undefined,
          paymentMethod,
          environmentVars: customEnvVars
        })
      });

      if (!res.success) {
        throw new Error(res.error?.message || 'Failed to deploy server');
      }

      const newServer = res.data.server;
      setDeployedServerId(newServer.id);

      // Stage 3: Configuration & Environment Setup
      setPipelineStage(3);
      log(`Stage 4/5 [CONFIGURING]: Assigning primary IPv4 port ${newServer.primaryPort} and writing environment variables...`);
      await new Promise(r => setTimeout(r, 1200));

      // Stage 4: Starting Engine
      setPipelineStage(4);
      log(`Stage 5/5 [STARTING]: Booting server process engine and checking system telemetry...`);
      await new Promise(r => setTimeout(r, 1000));

      // Stage 5: Ready!
      setPipelineStage(5);
      log('✓ [READY]: Server successfully deployed and active!');
      await refreshUser();

    } catch (err: any) {
      setDeployError(err.message || 'Deployment error occurred.');
      log(`❌ [FAILED]: ${err.message || 'Deployment failed.'}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (selectedCategory === 'all') return true;
    return t.category === selectedCategory;
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      
      {/* Wizard Header Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-amber-950/30 border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
              <Zap className="h-3.5 w-3.5" /> One-Click Instant Deployment
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Deploy Your Server in Seconds
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 max-w-xl">
              Choose an official template, customize your setup, and launch on high-speed NVMe compute nodes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('servers')}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      {/* Wizard Progress Bar (Steps 1-6) */}
      {step < 7 && (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px] text-xs">
            {[
              { num: 1, name: '1. Select Template' },
              { num: 2, name: '2. Runtime & Config' },
              { num: 3, name: '3. Name & Location' },
              { num: 4, name: '4. Choose Plan' },
              { num: 5, name: '5. Select Node' },
              { num: 6, name: '6. Review & Pay' }
            ].map((s) => (
              <button
                key={s.num}
                onClick={() => {
                  if (s.num < step) setStep(s.num);
                }}
                disabled={s.num > step}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium transition ${
                  step === s.num
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                    : s.num < step
                    ? 'text-emerald-400 cursor-pointer hover:bg-zinc-800'
                    : 'text-zinc-600 cursor-not-allowed'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === s.num ? 'bg-amber-500 text-black' : s.num < step ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'
                }`}>
                  {s.num < step ? '✓' : s.num}
                </span>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP 1: SELECT TEMPLATE */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="h-5 w-5 text-amber-400" /> Step 1: Select Server Template
              </h2>
              <p className="text-xs text-zinc-400">Choose a pre-configured, production-ready server stack.</p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
              {(['all', 'minecraft', 'bot'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-black font-semibold shadow'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat === 'bot' ? 'Bots' : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTemplates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`p-5 rounded-xl border transition cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {tpl.isPopular && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-amber-500 text-black text-[10px] font-bold rounded-full uppercase tracking-wider">
                      Popular
                    </span>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${isSelected ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-amber-400'}`}>
                        {tpl.category === 'minecraft' ? <Gamepad2 className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white">{tpl.name}</h3>
                        <span className="text-[10px] font-mono uppercase text-zinc-400">{tpl.runtime}</span>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{tpl.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                    <span>Rec: {tpl.recommendedRamMB}MB RAM</span>
                    <span className={`font-semibold flex items-center gap-1 ${isSelected ? 'text-amber-400' : 'text-zinc-300'}`}>
                      {isSelected ? <CheckCircle2 className="h-4 w-4 text-amber-400" /> : 'Select'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-800">
            <button
              disabled={!selectedTemplate}
              onClick={() => setStep(2)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/10"
            >
              Continue to Runtime Config <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: RUNTIME & CONFIG */}
      {step === 2 && selectedTemplate && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Terminal className="h-5 w-5 text-amber-400" /> Step 2: Version & Runtime Configuration
            </h2>
            <p className="text-xs text-zinc-400">Configure runtime version, Java engine, and server configuration for {selectedTemplate.name}.</p>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
            
            {/* Version Picker */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-zinc-300">
                  Select {selectedTemplate.name} Release Version *
                </label>
                {isLoadingVersions && (
                  <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Querying Upstream Releases...
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 max-h-56 overflow-y-auto pr-1">
                {((dynamicVersions.length > 0 ? dynamicVersions : selectedTemplate.versions) || ['1.21.4', '1.20.4', '1.19.4', '1.18.2']).map((ver) => (
                  <button
                    key={ver}
                    type="button"
                    onClick={() => {
                      setSelectedVersion(ver);
                      const clean = ver.replace(/[^0-9.]/g, '');
                      const parts = clean.split('.').map(p => parseInt(p, 10));
                      const minor = parts[1] || 20;
                      const patch = parts[2] || 0;
                      if (minor > 20 || (minor === 20 && patch >= 5)) setSelectedJavaVersion('Java 21');
                      else if (minor >= 17) setSelectedJavaVersion('Java 17');
                      else if (minor === 16) setSelectedJavaVersion('Java 11');
                      else setSelectedJavaVersion('Java 8');
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-semibold font-mono text-center transition ${
                      selectedVersion === ver
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 ring-1 ring-amber-500/50'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                    }`}
                  >
                    {ver}
                  </button>
                ))}
              </div>
            </div>

            {/* Java Runtime Selector for Minecraft */}
            {selectedTemplate.category === 'minecraft' && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-white">Java Runtime Engine</label>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Compatible OpenJDK container image for this Minecraft build.</p>
                  </div>
                  <select
                    value={selectedJavaVersion}
                    onChange={(e) => setSelectedJavaVersion(e.target.value)}
                    className="px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs font-semibold text-amber-400 focus:outline-none"
                  >
                    <option value="Java 21">Java 21 (Recommended for 1.20.5+)</option>
                    <option value="Java 17">Java 17 (LTS for 1.17 - 1.20.4)</option>
                    <option value="Java 11">Java 11 (Legacy 1.16)</option>
                    <option value="Java 8">Java 8 (Legacy 1.8 - 1.15)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Mojang EULA Checkbox for Minecraft */}
            {selectedTemplate.category === 'minecraft' && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={eulaAccepted}
                    onChange={(e) => setEulaAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="text-xs text-zinc-300">
                    <span className="font-bold text-white">Accept Mojang End User License Agreement (EULA)</span>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      By checking this box, you confirm agreement to the{' '}
                      <a href="https://account.mojang.com/documents/minecraft_eula" target="_blank" rel="noreferrer" className="text-amber-400 underline hover:text-amber-300">
                        Mojang Minecraft EULA
                      </a>. This writes <code className="font-mono text-zinc-300">eula=true</code> to your server directory.
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Startup Command preview */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Startup Execution Vector
              </label>
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 font-mono text-xs text-amber-400">
                {selectedTemplate.category === 'minecraft'
                  ? `java -Xms128M -Xmx{{SERVER_MEMORY}}M -XX:+UseG1GC -jar server.jar nogui`
                  : selectedTemplate.startupCommand}
              </div>
            </div>

            {/* Custom Environment Variables */}
            {Object.keys(customEnvVars).length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-2">
                  Environment Variables
                </label>
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
                  {Object.entries(customEnvVars).map(([key, val]) => (
                    <div key={key} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="text-xs font-mono text-zinc-400 flex items-center bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                        {key}
                      </div>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => setCustomEnvVars(prev => ({ ...prev, [key]: e.target.value }))}
                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              disabled={selectedTemplate.category === 'minecraft' && !eulaAccepted}
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              Next: Name & Location <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: NAME & LOCATION */}
      {step === 3 && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-amber-400" /> Step 3: Server Name & Datacenter Region
            </h2>
            <p className="text-xs text-zinc-400">Give your server an identifier and select low-latency hosting region.</p>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Server Display Name *
              </label>
              <input
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder="e.g. Survival SMP 1.20"
                className="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-3">
                Select Hosting Location *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'us-east', name: 'US East (Virginia)', ping: '<25ms', flag: '🇺🇸' },
                  { id: 'eu-central', name: 'EU Central (Frankfurt)', ping: '<35ms', flag: '🇩🇪' },
                  { id: 'ap-southeast', name: 'APAC (Singapore)', ping: '<40ms', flag: '🇸🇬' },
                  { id: 'in-south', name: 'India (Delhi/Mumbai)', ping: '<15ms', flag: '🇮🇳' }
                ].map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedLocation(loc.id)}
                    className={`p-4 rounded-xl border text-left transition ${
                      selectedLocation === loc.id
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 ring-1 ring-amber-500'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xl mb-1">{loc.flag}</div>
                    <div className="text-xs font-bold text-white">{loc.name}</div>
                    <div className="text-[10px] text-zinc-500 mt-1">Regional Ping: {loc.ping}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/10"
            >
              Next: Select Resource Plan <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PLAN SELECTION */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Cpu className="h-5 w-5 text-amber-400" /> Step 4: Choose Hardware Resource Plan
            </h2>
            <p className="text-xs text-zinc-400">
              Select RAM, CPU cores, and NVMe disk allocation for {selectedTemplate?.name}.
              {selectedTemplate && (
                <span className="text-amber-400 font-semibold ml-1">
                  (Recommended: {selectedTemplate.recommendedRamMB}MB RAM)
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans
              .filter(p => p.productId === (selectedTemplate?.category === 'minecraft' ? 'prod_minecraft' : 'prod_bot'))
              .map((p) => {
                const isSelected = selectedPlanId === p.id;
                const isRec = selectedTemplate && p.ramMB >= selectedTemplate.recommendedRamMB;

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPlanId(p.id)}
                    className={`p-6 rounded-2xl border transition cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500'
                        : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    {isRec && (
                      <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black text-[10px] font-bold rounded-full uppercase">
                        Recommended for {selectedTemplate?.name}
                      </span>
                    )}

                    <div className="space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-white">{p.name}</h3>
                        <p className="text-xs text-zinc-400 mt-1">{p.description}</p>
                      </div>

                      <div className="text-2xl font-extrabold text-amber-400">
                        ${billingCycle === 'yearly' ? (p.priceYearly / 12).toFixed(2) : p.priceMonthly.toFixed(2)}
                        <span className="text-xs text-zinc-500 font-normal"> / mo</span>
                      </div>

                      <div className="space-y-2 text-xs text-zinc-300 pt-3 border-t border-zinc-800">
                        <div className="flex items-center gap-2">
                          <MemoryStick className="h-4 w-4 text-amber-400" />
                          <span><strong>{p.ramMB >= 1024 ? `${p.ramMB / 1024}GB` : `${p.ramMB}MB`}</strong> DDR5 RAM</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Cpu className="h-4 w-4 text-amber-400" />
                          <span><strong>{p.cpuCores} vCPU</strong> High Clock Speed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <HardDrive className="h-4 w-4 text-amber-400" />
                          <span><strong>{p.diskGB}GB</strong> Gen4 NVMe SSD Storage</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-3 border-t border-zinc-800/80 text-center text-xs">
                      <span className={`font-bold ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {isSelected ? '✓ Plan Selected' : 'Click to Select Plan'}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              disabled={!selectedPlanId}
              onClick={() => setStep(5)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/10"
            >
              Next: Select Compute Node <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: NODE SELECTION */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ServerIcon className="h-5 w-5 text-amber-400" /> Step 5: Select Compute Node & Scheduler
            </h2>
            <p className="text-xs text-zinc-400">Let AetherPanel automatically pick the optimal node or choose manually.</p>
          </div>

          <div className="space-y-4">
            {/* Auto Scheduler Card */}
            <div
              onClick={() => setSelectedNodeId('auto')}
              className={`p-5 rounded-2xl border transition cursor-pointer ${
                selectedNodeId === 'auto'
                  ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500'
                  : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500 text-black rounded-xl">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      Automatic Node Scheduler <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded uppercase font-bold">Recommended</span>
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Dynamically chooses node with lowest RAM/CPU load and lowest latency in {selectedLocation}.
                    </p>
                  </div>
                </div>
                {selectedNodeId === 'auto' && <CheckCircle className="h-6 w-6 text-amber-400" />}
              </div>
            </div>

            {/* Manual Node List */}
            <div className="pt-2">
              <p className="text-xs font-semibold text-zinc-400 mb-3">Or manually pick an active node:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nodes.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => setSelectedNodeId(n.id)}
                    className={`p-4 rounded-xl border text-xs transition cursor-pointer ${
                      selectedNodeId === n.id
                        ? 'bg-amber-500/10 border-amber-500 ring-1 ring-amber-500'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{n.name} ({n.hostname})</span>
                      <span className="text-emerald-400 font-mono text-[10px]">ONLINE</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-1">{n.locationName} • RAM: {n.usedRamMB}/{n.totalRamMB}MB</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <button
              onClick={() => setStep(6)}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs rounded-xl flex items-center gap-2 transition shadow-lg shadow-amber-500/10"
            >
              Next: Review & Payment <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW & PAYMENT */}
      {step === 6 && selectedPlan && selectedTemplate && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" /> Step 6: Review Configuration & Payment
            </h2>
            <p className="text-xs text-zinc-400">Review your server specification and confirm deployment.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Configuration Summary */}
            <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Server Specification Summary</h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-zinc-500 block">Template</span>
                  <span className="font-semibold text-amber-400">{selectedTemplate.name} ({selectedVersion})</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Server Name</span>
                  <span className="font-semibold text-white">{serverName}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Plan Tier</span>
                  <span className="font-semibold text-white">{selectedPlan.name}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Location</span>
                  <span className="font-semibold text-white uppercase">{selectedLocation}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">RAM & CPU</span>
                  <span className="font-semibold text-white">{selectedPlan.ramMB}MB RAM / {selectedPlan.cpuCores} vCPU</span>
                </div>
                <div>
                  <span className="text-zinc-500 block">Compute Node</span>
                  <span className="font-semibold text-white">{selectedNodeId === 'auto' ? 'Auto-Allocated' : selectedNodeId}</span>
                </div>
              </div>

              {/* Billing Cycle Toggle */}
              <div className="pt-4 border-t border-zinc-800">
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Billing Cycle</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBillingCycle('monthly')}
                    className={`p-3 rounded-xl border text-xs font-semibold transition ${
                      billingCycle === 'monthly'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Monthly Billing (${selectedPlan.priceMonthly.toFixed(2)}/mo)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingCycle('yearly')}
                    className={`p-3 rounded-xl border text-xs font-semibold transition ${
                      billingCycle === 'yearly'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    Yearly Billing (${selectedPlan.priceYearly.toFixed(2)}/yr - Save 15%)
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-zinc-400 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('balance')}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition ${
                      paymentMethod === 'balance'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div>Aether Account Balance</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Available: ${user?.credits?.toFixed(2) || '0.00'}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('stripe')}
                    className={`p-3 rounded-xl border text-xs font-semibold text-left transition ${
                      paymentMethod === 'stripe'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <div>Credit Card / UPI</div>
                    <div className="text-[10px] text-zinc-500 mt-0.5">Instant Automatic Verification</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Price Summary Box */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Order Total</h3>

                <div className="space-y-2 text-xs text-zinc-400 mt-4">
                  <div className="flex justify-between">
                    <span>Base Plan Price:</span>
                    <span className="text-white">${(billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly).toFixed(2)}</span>
                  </div>
                  {couponDiscount && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Promo Discount (20%):</span>
                      <span>-${((billingCycle === 'yearly' ? selectedPlan.priceYearly : selectedPlan.priceMonthly) * 0.2).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-zinc-800 flex justify-between text-base font-extrabold text-amber-400">
                    <span>Total Due Now:</span>
                    <span>${calculateTotalPrice().toFixed(2)}</span>
                  </div>
                </div>

                {/* Promo Code Input */}
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <label className="block text-[11px] text-zinc-400 mb-1">Have a promo code?</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="ENTER CODE"
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleApplyCoupon}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition"
                    >
                      Apply
                    </button>
                  </div>
                  {couponMsg && <p className="text-[10px] text-emerald-400 mt-1">{couponMsg}</p>}
                </div>
              </div>

              <button
                onClick={triggerDeploy}
                className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm rounded-xl transition shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2"
              >
                <Zap className="h-5 w-5" /> Confirm & Deploy Server Now
              </button>
            </div>

          </div>

          <div className="flex justify-start pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(5)}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl flex items-center gap-2 transition"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Node Selection
            </button>
          </div>
        </div>
      )}

      {/* STEP 7: REAL-TIME DEPLOYMENT PIPELINE */}
      {step === 7 && (
        <div className="space-y-6">
          <div className="border-b border-zinc-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400 animate-pulse" /> Real-Time Server Deployment Pipeline
            </h2>
            <p className="text-xs text-zinc-400">AetherPanel node engine is provisioning your server container.</p>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 space-y-6">
            
            {/* Pipeline Stage Indicators */}
            <div className="space-y-3">
              {[
                { stage: 0, title: 'QUEUED', desc: 'Validating plan restrictions and user credits' },
                { stage: 1, title: 'PROVISIONING', desc: 'Allocating node capacity and port assignments' },
                { stage: 2, title: 'INSTALLING', desc: 'Fetching official software runtime binaries' },
                { stage: 3, title: 'CONFIGURING', desc: 'Writing startup scripts & environment variables' },
                { stage: 4, title: 'STARTING', desc: 'Booting server process and running health checks' },
                { stage: 5, title: 'READY', desc: 'Deployment complete! Server is running.' }
              ].map((s) => {
                const isCurrent = pipelineStage === s.stage;
                const isDone = pipelineStage > s.stage;

                return (
                  <div
                    key={s.stage}
                    className={`p-3.5 rounded-xl border transition flex items-center justify-between ${
                      isDone
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : isCurrent
                        ? 'bg-amber-500/10 border-amber-500/50 text-amber-400 animate-pulse'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                        {isDone ? '✓' : isCurrent ? <Loader2 className="h-4 w-4 animate-spin" /> : s.stage + 1}
                      </div>
                      <div>
                        <span className="font-bold text-xs block">{s.title}</span>
                        <span className="text-[11px] text-zinc-400">{s.desc}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono uppercase font-bold">
                      {isDone ? 'DONE' : isCurrent ? 'IN PROGRESS...' : 'WAITING'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Live Console Output Box */}
            <div>
              <label className="block text-xs font-mono font-semibold text-zinc-400 mb-2">
                Deployment Console Logs
              </label>
              <div className="bg-black/90 p-4 rounded-xl border border-zinc-800 font-mono text-xs text-amber-400 space-y-1 h-44 overflow-y-auto">
                {pipelineLogs.map((l, i) => (
                  <div key={i}>{l}</div>
                ))}
              </div>
            </div>

            {/* Completion Trigger Action */}
            {pipelineStage === 5 && deployedServerId && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-emerald-400">Deployment Complete!</h3>
                  <p className="text-xs text-zinc-300">Your server is live and running on node infrastructure.</p>
                </div>
                <button
                  onClick={() => onSelectServer(deployedServerId)}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs rounded-xl transition shadow-lg flex items-center gap-2"
                >
                  Open Server Console <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {deployError && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>{deployError}</span>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};
