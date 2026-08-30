import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Key, Copy, Check, RefreshCw, Shield, AlertTriangle,
  ExternalLink, Play, Square, Wifi, Terminal, CheckCircle2,
  Lock, Download, ChevronDown, ChevronUp, RotateCw, Server as ServerIcon,
  HelpCircle, AlertCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server as ServerType, SftpConnectionInfo, PlayitStatus } from '../../types';
import { useBranding } from '../../lib/BrandingContext';

interface ServerNetworkPlayitTabProps {
  server: ServerType;
  onRefreshServer: () => void;
}

export const ServerNetworkPlayitTab: React.FC<ServerNetworkPlayitTabProps> = ({ server, onRefreshServer }) => {
  const { enablePlayit } = useBranding();
  const [playit, setPlayit] = useState<PlayitStatus | null>(null);
  const [loadingPlayit, setLoadingPlayit] = useState<boolean>(true);
  const [installingPlayit, setInstallingPlayit] = useState<boolean>(false);
  const [togglingAgent, setTogglingAgent] = useState<boolean>(false);
  const [restartingAgent, setRestartingAgent] = useState<boolean>(false);
  const [repairingAgent, setRepairingAgent] = useState<boolean>(false);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Advanced Manual Secret
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [secretInput, setSecretInput] = useState<string>('');
  const [submittingSecret, setSubmittingSecret] = useState<boolean>(false);
  const [secretMsg, setSecretMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // SFTP state
  const [sftpInfo, setSftpInfo] = useState<SftpConnectionInfo | null>((server as any).sftp || null);
  const [loadingSftp, setLoadingSftp] = useState<boolean>(!((server as any).sftp));
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [resettingPassword, setResettingPassword] = useState<boolean>(false);

  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccessMsg, setClaimSuccessMsg] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState<boolean>(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const fetchSftpInfo = async () => {
    try {
      setLoadingSftp(true);
      const res = await apiRequest(`/servers/${server.id}/sftp`);
      if (res.success && res.data) {
        setSftpInfo(res.data);
      }
    } catch {
      // fallback
    } finally {
      setLoadingSftp(false);
    }
  };

  const fetchPlayitStatus = async () => {
    if (!enablePlayit) {
      setLoadingPlayit(false);
      return;
    }
    setLoadingPlayit(true);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit`);
      if (res.success && res.data) {
        setPlayit(res.data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingPlayit(false);
    }
  };

  useEffect(() => {
    fetchSftpInfo();
    if (enablePlayit) {
      fetchPlayitStatus();

      // Periodic heartbeat polling for claim detection
      const interval = setInterval(() => {
        fetchPlayitStatus();
      }, 6000);

      return () => clearInterval(interval);
    }
  }, [server.id, enablePlayit]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleInstallPlayit = async () => {
    setInstallingPlayit(true);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit/install`, { method: 'POST' });
      if (res.success && res.data) {
        setPlayit(res.data);
        fetchSftpInfo();
      }
    } finally {
      setInstallingPlayit(false);
    }
  };

  const handleToggleAgent = async (enable: boolean) => {
    setTogglingAgent(true);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enable })
      });
      if (res.success && res.data) {
        setPlayit(res.data);
      }
    } finally {
      setTogglingAgent(false);
    }
  };

  const handleRestartAgent = async () => {
    setRestartingAgent(true);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit/restart`, { method: 'POST' });
      if (res.success && res.data) {
        setPlayit(res.data);
      }
    } finally {
      setRestartingAgent(false);
    }
  };

  const handleRepairAgent = async () => {
    setRepairingAgent(true);
    setRepairMsg(null);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit/repair`, { method: 'POST' });
      if (res.success && res.data) {
        if (res.data.status) setPlayit(res.data.status);
        const count = res.data.diagnostics?.filter((d: any) => d.status === 'REPAIRED').length || 0;
        setRepairMsg(count > 0 ? `Repair completed: ${count} issue(s) fixed.` : 'Repair complete. Diagnostics passed.');
        fetchPlayitStatus();
      }
    } catch (err: any) {
      setRepairMsg(`Repair failed: ${err.message || 'Unknown error'}`);
    } finally {
      setRepairingAgent(false);
    }
  };

  const handleProvisionSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secretInput.trim()) return;
    setSubmittingSecret(true);
    setSecretMsg(null);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit/secret`, {
        method: 'POST',
        body: JSON.stringify({ secretKey: secretInput.trim() })
      });
      if (res.success && res.data) {
        setPlayit(res.data);
        setSecretMsg({ type: 'success', text: 'Playit secret applied successfully!' });
        setSecretInput('');
        fetchSftpInfo();
      } else {
        setSecretMsg({ type: 'error', text: res.error?.message || 'Failed to apply secret key.' });
      }
    } catch (err: any) {
      setSecretMsg({ type: 'error', text: err.message || 'Error communicating with server.' });
    } finally {
      setSubmittingSecret(false);
    }
  };

  const handleClaimAgent = async () => {
    if (isClaiming) return;
    setIsClaiming(true);
    setClaimError(null);
    setClaimSuccessMsg(null);
    setLoadingPlayit(true);

    try {
      const res = await apiRequest<{ claimUrl: string | null; claimCode: string | null; claimStatus: string }>(`/servers/${server.id}/playit/claim`, {
        method: 'POST'
      });

      if (res.success && res.data) {
        setPlayit(prev => prev ? {
          ...prev,
          claimUrl: res.data.claimUrl || prev.claimUrl,
          claimCode: res.data.claimCode || prev.claimCode,
          claimStatus: (res.data.claimStatus as any) || prev.claimStatus
        } : prev);

        if (res.data.claimUrl) {
          setClaimSuccessMsg('Official Playit claim URL generated. Opening claim window...');
          try {
            window.open(res.data.claimUrl, '_blank');
          } catch {
            setClaimError('Popup blocked by browser. Please use the "Open Claim Page" button below.');
          }
        } else {
          setClaimError('Playit daemon is starting or has not generated a claim URL yet. Please refresh in a moment.');
        }

        await fetchPlayitStatus();
      } else {
        const errorMsg = res.error?.message || res.message || 'Playit daemon claim service returned an error.';
        setClaimError(errorMsg);
      }
    } catch (err: any) {
      console.error('Failed to claim Playit agent:', err);
      setClaimError(err.message || 'Failed to connect to Playit claim endpoint.');
    } finally {
      setIsClaiming(false);
      setLoadingPlayit(false);
    }
  };

  const handleResetSftpPassword = async () => {
    if (!confirm('Are you sure you want to regenerate your SFTP access password? Any active FTP client connections will be disconnected.')) return;
    setResettingPassword(true);
    try {
      const res = await apiRequest(`/servers/${server.id}/sftp/reset-password`, { method: 'POST' });
      if (res.success && res.data?.sftpPassword) {
        if (sftpInfo) {
          setSftpInfo({ ...sftpInfo, password: res.data.sftpPassword });
        }
        setShowPassword(true);
        onRefreshServer();
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const isMinecraft = server.productId === 'prod_minecraft' || server.software.toLowerCase().includes('paper') || server.software.toLowerCase().includes('forge') || server.software.toLowerCase().includes('spigot');

  const sftpHost = sftpInfo?.host || (window.location.hostname || 'panel.aether.internal');
  const sftpPort = sftpInfo?.port || 2022;
  const sftpUser = sftpInfo?.username || `srv_${server.id.substring(0, 10)}`;
  const sftpPass = sftpInfo?.password || (server as any).sftpPassword || '••••••••••••••••';
  const sftpUri = sftpInfo?.uri || `sftp://${sftpUser}@${sftpHost}:${sftpPort}`;

  const isClaimed = playit?.isClaimed || playit?.claimStatus === 'CLAIMED';
  const isRunning = playit?.isRunning || playit?.agentStatus === 'RUNNING';

  return (
    <div className="space-y-6">
      {/* Network Allocations Header */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-amber-400" /> Network Allocations & Public Ports
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Assigned IP endpoints and direct network binding addresses for this container instance.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            Dedicated Ingress Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Primary Port Box */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Primary Connection Address</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Primary (Default)
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800/80 font-mono text-xs">
              <span className="text-white font-bold">{server.primaryIp}:{server.primaryPort}</span>
              <button
                onClick={() => handleCopy(`${server.primaryIp}:${server.primaryPort}`, 'primary_ip')}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
                title="Copy Address"
              >
                {copiedKey === 'primary_ip' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              {isMinecraft ? 'Direct Minecraft client multiplayer connection endpoint.' : 'Application HTTP/WebSocket port.'}
            </p>
          </div>

          {/* Node Location & Hostname */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">Compute Node Host & Region</span>
              <span className="text-xs font-mono text-zinc-400">{server.location}</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800/80 font-mono text-xs">
              <span className="text-zinc-300">{server.primaryIp}</span>
              <span className="text-[10px] text-zinc-500 font-sans">Node Gateway</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Low-latency node routing with automatic DDoS filtering enabled.
            </p>
          </div>
        </div>
      </div>

      {/* SFTP Credentials */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-violet-400" /> SFTP (Secure File Transfer Protocol)
              </h3>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Connect desktop FTP clients (FileZilla, WinSCP, Cyberduck) with high-speed encrypted transfers.
            </p>
          </div>
          <button
            onClick={handleResetSftpPassword}
            disabled={resettingPassword}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resettingPassword ? 'animate-spin' : ''}`} />
            <span>Reset SFTP Password</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">SFTP Host</span>
            <div className="flex items-center justify-between font-mono text-xs text-white">
              <span className="truncate">{sftpHost}</span>
              <button onClick={() => handleCopy(sftpHost, 'sftp_host')} className="text-zinc-400 hover:text-white shrink-0 ml-1">
                {copiedKey === 'sftp_host' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">SFTP Port</span>
            <div className="flex items-center justify-between font-mono text-xs text-white">
              <span>{sftpPort}</span>
              <button onClick={() => handleCopy(String(sftpPort), 'sftp_port')} className="text-zinc-400 hover:text-white shrink-0 ml-1">
                {copiedKey === 'sftp_port' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Username</span>
            <div className="flex items-center justify-between font-mono text-xs text-white">
              <span className="truncate">{sftpUser}</span>
              <button onClick={() => handleCopy(sftpUser, 'sftp_user')} className="text-zinc-400 hover:text-white shrink-0 ml-1">
                {copiedKey === 'sftp_user' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Password</span>
            <div className="flex items-center justify-between font-mono text-xs text-white">
              <span className="truncate">{showPassword ? sftpPass : '••••••••••••••••'}</span>
              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[10px] text-zinc-400 hover:text-zinc-200"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
                <button onClick={() => handleCopy(sftpPass, 'sftp_pass')} className="text-zinc-400 hover:text-white">
                  {copiedKey === 'sftp_pass' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/20 text-xs text-violet-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <Shield className="h-4 w-4 text-violet-400 shrink-0" />
            <span className="truncate">Direct Launch URI: <code className="font-mono text-white bg-zinc-950 px-2 py-0.5 rounded text-[11px]">{sftpUri}</code></span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleCopy(sftpUri, 'sftp_uri')}
              className="px-3 py-1 rounded-lg bg-violet-600/30 hover:bg-violet-600/50 text-white font-medium text-xs transition-colors"
            >
              {copiedKey === 'sftp_uri' ? 'Copied' : 'Copy SFTP Link'}
            </button>
            <a
              href={sftpUri}
              className="px-3 py-1 rounded-lg bg-violet-600 text-white font-semibold text-xs hover:bg-violet-500 transition-colors inline-flex items-center gap-1"
            >
              <span>Connect Client</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Playit.GG Agent Manager Card */}
      {!enablePlayit ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 text-center space-y-2">
          <div className="p-3 rounded-full bg-zinc-800/80 text-zinc-500 w-fit mx-auto">
            <Globe className="h-5 w-5" />
          </div>
          <h4 className="text-xs font-bold text-zinc-300">Playit.GG Agent Integration Disabled</h4>
          <p className="text-[11px] text-zinc-500 max-w-md mx-auto">
            Playit.GG agent management and tunnel connectivity have been globally disabled by the platform administrator in System Settings.
          </p>
        </div>
      ) : (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Playit.GG Agent Manager</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Agent Manager Only
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Install and manage the real Playit agent daemon. Claim the agent with your Playit account to configure tunnels directly on playit.gg.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPlayitStatus}
              disabled={loadingPlayit}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh Playit Status"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingPlayit ? 'animate-spin text-amber-400' : ''}`} />
              <span className="hidden sm:inline">Refresh Status</span>
            </button>
            {playit?.isInstalled && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isRunning
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : playit.status === 'STARTING'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : playit.status === 'CRASHED'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : playit.status === 'STARTING' ? 'bg-amber-400 animate-spin' : playit.status === 'CRASHED' ? 'bg-rose-400' : 'bg-zinc-500'}`} />
                <span>
                  {isRunning ? 'RUNNING' : playit.status === 'STARTING' ? 'STARTING' : playit.status === 'CRASHED' ? 'CRASHED' : 'STOPPED'}
                </span>
              </span>
            )}
          </div>
        </div>

        {loadingPlayit && !playit ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            <span>Checking Playit agent status...</span>
          </div>
        ) : !playit?.isInstalled ? (
          /* Not Installed State */
          <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-center space-y-4">
            <div className="max-w-md mx-auto space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
                <Download className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-bold text-white">Install Playit.GG Agent Daemon</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                AetherPanel will download and start the official Playit agent on this node. Once running, you will receive a claim link to bind this agent to your Playit.GG account.
              </p>
            </div>
            <button
              onClick={handleInstallPlayit}
              disabled={installingPlayit}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 mx-auto disabled:opacity-50 transition-all"
            >
              {installingPlayit ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Installing & Starting Agent...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Install Playit Agent</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Installed State */
          <div className="space-y-5">
            {/* Playit Agent Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Agent Status</span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  {isRunning ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      RUNNING
                    </span>
                  ) : playit.status === 'STARTING' ? (
                    <span className="text-amber-400">STARTING...</span>
                  ) : playit.status === 'CRASHED' ? (
                    <span className="text-rose-400">CRASHED</span>
                  ) : (
                    <span className="text-zinc-400">STOPPED</span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Claim Status</span>
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  {isClaimed ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> CLAIMED
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" /> UNCLAIMED
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Agent Version</span>
                <div className="font-mono text-xs text-zinc-200 font-semibold">
                  v{playit.agentVersion || '1.0.10'}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-semibold">Process PID</span>
                <div className="font-mono text-xs text-zinc-300">
                  {playit.pid ? `PID ${playit.pid}` : 'None'}
                </div>
              </div>
            </div>

            {/* Repair Message Notice if any */}
            {repairMsg && (
              <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>{repairMsg}</span>
                </div>
                <button onClick={() => setRepairMsg(null)} className="text-xs text-zinc-400 hover:text-white">Dismiss</button>
              </div>
            )}

            {/* Error / Crash Notice if any */}
            {playit.errorReason && (
              <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold">Agent Issue Detected:</span>
                  <p className="text-rose-200 text-[11px] font-mono">{playit.errorReason}</p>
                </div>
              </div>
            )}

            {/* Claim Section: UNCLAIMED FLOW */}
            {!isClaimed && (
              <div className={`p-5 rounded-xl border space-y-4 ${
                isRunning 
                  ? 'bg-amber-950/20 border-amber-500/30' 
                  : playit.status === 'CRASHED'
                  ? 'bg-rose-950/20 border-rose-500/30'
                  : 'bg-zinc-900/60 border-zinc-800'
              }`}>
                <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 ${
                  isRunning ? 'border-amber-500/20' : 'border-zinc-800'
                }`}>
                  <div className={`flex items-center gap-2 ${
                    isRunning ? 'text-amber-300' : playit.status === 'CRASHED' ? 'text-rose-400' : 'text-zinc-400'
                  }`}>
                    <AlertCircle className={`h-5 w-5 shrink-0 ${
                      isRunning ? 'text-amber-400' : playit.status === 'CRASHED' ? 'text-rose-400' : 'text-zinc-500'
                    }`} />
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {isRunning
                          ? 'Your Playit agent is running and ready to be claimed'
                          : playit.status === 'STARTING'
                          ? 'Playit agent is starting...'
                          : playit.status === 'CRASHED'
                          ? 'Playit agent crashed and is offline'
                          : 'Playit agent is stopped'}
                      </h4>
                      <p className={`text-xs ${isRunning ? 'text-amber-200/80' : 'text-zinc-400'}`}>
                        {isRunning
                          ? 'Link this agent to your Playit.GG account to enable secure network access.'
                          : 'Start the agent daemon above to generate or refresh your claim link.'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase self-start sm:self-auto ${
                    isRunning
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {isRunning ? 'Awaiting Claim' : playit.status}
                  </span>
                </div>

                {/* Claim Error / Notice */}
                {claimError && (
                  <div className="p-3.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                    <span>{claimError}</span>
                  </div>
                )}
                {claimSuccessMsg && (
                  <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{claimSuccessMsg}</span>
                  </div>
                )}

                {playit.claimUrl ? (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Official Claim URL</span>
                        <div className="font-mono text-xs text-amber-300 truncate max-w-lg">
                          {playit.claimUrl}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleCopy(playit.claimUrl!, 'claim_url')}
                          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1"
                        >
                          {copiedKey === 'claim_url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                          <span>{copiedKey === 'claim_url' ? 'Copied' : 'Copy URL'}</span>
                        </button>
                        <a
                          href={playit.claimUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md shadow-amber-500/20 inline-flex items-center gap-1.5"
                        >
                          <span>Open Claim Page</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>

                    {playit.claimCode && (
                      <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                        <span>Agent Claim Code: <strong className="font-mono text-white bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">{playit.claimCode}</strong></span>
                        <button
                          onClick={fetchPlayitStatus}
                          className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                        >
                          <RefreshCw className={`h-3 w-3 ${loadingPlayit ? 'animate-spin' : ''}`} />
                          <span>Refresh Claim Status</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-400">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span>{isRunning ? 'Agent active. Click Claim Agent to open official setup page.' : 'Start the agent or click Claim Agent below.'}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleClaimAgent}
                        disabled={loadingPlayit || isClaiming}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20"
                      >
                        {isClaiming ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>Claiming...</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Claim Agent</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={fetchPlayitStatus}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-semibold flex items-center gap-1"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${loadingPlayit ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Claim Section: CLAIMED FLOW */}
            {isClaimed && (
              <div className="p-5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      Agent Claimed & Account Connected
                    </h4>
                    <p className="text-xs text-emerald-200/80 mt-0.5">
                      This agent daemon is authenticated and linked with your Playit.GG account.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    Connected
                  </span>
                </div>
              </div>
            )}

            {/* Tunnel Management: Managed Externally Card */}
            <div className="p-5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Tunnel Management
                    </h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Managed externally
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    After claiming the agent, create and manage your Playit tunnels directly from your Playit dashboard.
                  </p>
                </div>
                <a
                  href="https://playit.gg/account/tunnels"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                >
                  <span>Open Playit Dashboard</span>
                  <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
                </a>
              </div>
            </div>

            {/* Agent Action Controls */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-zinc-200">Agent Daemon Lifecycle</span>
                <p className="text-[11px] text-zinc-500">Restart or stop the local Playit process on this node.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRepairAgent}
                  disabled={repairingAgent}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  title="Run Diagnostics & Repair Playit Agent"
                >
                  <Shield className={`h-3.5 w-3.5 ${repairingAgent ? 'animate-spin' : ''}`} />
                  <span>{repairingAgent ? 'Diagnosing...' : 'Repair Agent'}</span>
                </button>

                <button
                  onClick={handleRestartAgent}
                  disabled={restartingAgent || !isRunning}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                  title="Restart Playit Agent"
                >
                  <RotateCw className={`h-3.5 w-3.5 ${restartingAgent ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{restartingAgent ? 'Restarting...' : 'Restart Agent'}</span>
                </button>

                <button
                  onClick={() => handleToggleAgent(!isRunning)}
                  disabled={togglingAgent}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isRunning
                      ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md shadow-emerald-500/20'
                  }`}
                >
                  {togglingAgent ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : isRunning ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop Agent</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Start Agent</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Agent Live Console Logs */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-zinc-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">Agent Output Logs</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Live Daemon Buffer</span>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-zinc-300 max-h-52 overflow-y-auto space-y-1 select-text">
                {!playit.logs || playit.logs.length === 0 ? (
                  <div className="text-zinc-600 italic py-2">No agent logs recorded yet.</div>
                ) : (
                  playit.logs.map((line, idx) => (
                    <div key={idx} className="whitespace-pre-wrap leading-relaxed hover:bg-zinc-900/50 px-1 rounded transition-colors">
                      {line}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* Advanced / Manual Configuration (Collapsed Accordion) */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full p-3.5 text-left flex items-center justify-between text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Manual Recovery: Provision Playit Secret Key</span>
                </span>
                {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showAdvanced && (
                <form onSubmit={handleProvisionSecret} className="p-4 pt-0 space-y-3 border-t border-zinc-900 mt-2">
                  <p className="text-[11px] text-zinc-400">
                    If you have an existing Playit agent secret key from your account dashboard, enter it below to bypass the interactive claim flow.
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={secretInput}
                      onChange={(e) => setSecretInput(e.target.value)}
                      placeholder="Enter secret key from playit.gg..."
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={submittingSecret || !secretInput.trim()}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1"
                    >
                      {submittingSecret ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                      <span>Apply Secret</span>
                    </button>
                  </div>
                  {secretMsg && (
                    <p className={`text-[11px] ${secretMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {secretMsg.text}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
};
