import React, { useState, useEffect } from 'react';
import {
  Globe, Key, Copy, Check, RefreshCw, Shield, AlertTriangle,
  ExternalLink, Play, Square, Wifi, Terminal, Server, CheckCircle2,
  Lock, ArrowRight, Download, Radio, Network, FolderSync
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server as ServerType, SftpConnectionInfo } from '../../types';

interface PlayitData {
  isInstalled: boolean;
  isRunning: boolean;
  status: 'uninstalled' | 'installed' | 'claiming' | 'connected' | 'disconnected' | 'error';
  claimUrl?: string;
  claimCode?: string;
  tunnelAddress?: string;
  tunnelPort?: number;
  tunnelType: string;
  agentVersion: string;
}

interface ServerNetworkPlayitTabProps {
  server: ServerType;
  onRefreshServer: () => void;
}

export const ServerNetworkPlayitTab: React.FC<ServerNetworkPlayitTabProps> = ({ server, onRefreshServer }) => {
  const [playit, setPlayit] = useState<PlayitData | null>(null);
  const [loadingPlayit, setLoadingPlayit] = useState<boolean>(true);
  const [installingPlayit, setInstallingPlayit] = useState<boolean>(false);
  const [togglingTunnel, setTogglingTunnel] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [secretInput, setSecretInput] = useState<string>('');
  const [submittingSecret, setSubmittingSecret] = useState<boolean>(false);
  const [secretMsg, setSecretMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // SFTP state
  const [sftpInfo, setSftpInfo] = useState<SftpConnectionInfo | null>((server as any).sftp || null);
  const [loadingSftp, setLoadingSftp] = useState<boolean>(!((server as any).sftp));
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [resettingPassword, setResettingPassword] = useState<boolean>(false);

  const fetchSftpInfo = async () => {
    try {
      setLoadingSftp(true);
      const res = await apiRequest(`/servers/${server.id}/sftp`);
      if (res.success && res.data) {
        setSftpInfo(res.data);
      }
    } catch {
      // fallback to basic
    } finally {
      setLoadingSftp(false);
    }
  };

  const fetchPlayitStatus = async () => {
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
    fetchPlayitStatus();
  }, [server.id]);

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

  const handleTogglePlayit = async (enable: boolean) => {
    setTogglingTunnel(true);
    try {
      const res = await apiRequest(`/servers/${server.id}/playit/toggle`, {
        method: 'POST',
        body: JSON.stringify({ enable })
      });
      if (res.success && res.data) {
        setPlayit(res.data);
      }
    } finally {
      setTogglingTunnel(false);
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
  const sftpUri = sftpInfo?.connectionUri || `sftp://${sftpUser}@${sftpHost}:${sftpPort}`;

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

      {/* SFTP Secure File Transfer Credentials with Real Resolver */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-violet-400" /> SFTP (Secure File Transfer Protocol)
              </h3>
              {sftpInfo?.endpointMode === 'playit_tunnel' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Playit Tunnel Secured
                </span>
              )}
              {sftpInfo?.endpointMode === 'node_fqdn' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Node FQDN
                </span>
              )}
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

      {/* Playit.gg Tunnel Integration Card */}
      <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/20 p-6 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Playit.gg Tunnel & Custom Domain</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Zero Port-Forwarding
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate a permanent public IP address and custom domain for players and remote connectivity without port forwarding.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchPlayitStatus}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
              title="Refresh Playit Status"
            >
              <RefreshCw className={`h-4 w-4 ${loadingPlayit ? 'animate-spin' : ''}`} />
            </button>
            {playit?.isInstalled && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                playit.isRunning
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                <span className={`h-2 w-2 rounded-full ${playit.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span>{playit.isRunning ? 'Tunnel Online' : 'Tunnel Paused'}</span>
              </span>
            )}
          </div>
        </div>

        {loadingPlayit ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-amber-400" />
            <span>Loading Playit.gg agent status...</span>
          </div>
        ) : !playit?.isInstalled ? (
          <div className="p-6 rounded-xl bg-zinc-950 border border-zinc-800 text-center space-y-4">
            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-sm font-bold text-white">Install Playit.gg Agent Daemon</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Connect your server through the Playit.gg global network to receive a free custom subdomain (e.g., <code className="text-amber-300">yourserver.auto.playit.gg</code>) with automatic DDoS mitigation.
              </p>
            </div>
            <button
              onClick={handleInstallPlayit}
              disabled={installingPlayit}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center gap-2 mx-auto disabled:opacity-50"
            >
              {installingPlayit ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Configuring Agent...</span>
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  <span>Install Playit.gg Agent</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] text-zinc-400 uppercase font-semibold">Playit Public Subdomain</span>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-amber-300 font-bold truncate">{playit.tunnelAddress || 'Generating...'}</span>
                  {playit.tunnelAddress && (
                    <button onClick={() => handleCopy(playit.tunnelAddress!, 'playit_domain')} className="text-zinc-400 hover:text-white">
                      {copiedKey === 'playit_domain' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] text-zinc-400 uppercase font-semibold">Tunnel Port</span>
                <div className="flex items-center justify-between font-mono text-xs">
                  <span className="text-white font-bold">{playit.tunnelPort || 25565}</span>
                  <span className="text-[10px] text-zinc-500 font-sans">Public Port</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="text-[11px] text-zinc-400 uppercase font-semibold">Tunnel Action</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTogglePlayit(!playit.isRunning)}
                    disabled={togglingTunnel}
                    className={`w-full py-1.5 px-3 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-colors ${
                      playit.isRunning
                        ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30'
                    }`}
                  >
                    {playit.isRunning ? (
                      <>
                        <Square className="h-3 w-3 fill-current" /> Pause Tunnel
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 fill-current" /> Start Tunnel
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {playit.claimUrl && (
              <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-amber-300">
                  <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>Claim Code: <strong className="font-mono text-white">{playit.claimCode}</strong></span>
                </div>
                <a
                  href={playit.claimUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 text-zinc-950 font-bold hover:bg-amber-400 transition-colors"
                >
                  <span>Link to Playit.gg Account</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Secret Key Provisioning Box */}
            <form onSubmit={handleProvisionSecret} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-amber-400" /> Provision Playit Secret Key
                </span>
                <span className="text-[10px] text-zinc-500">Optional Manual Agent Configuration</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={secretInput}
                  onChange={(e) => setSecretInput(e.target.value)}
                  placeholder="Enter secret key from playit.gg..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono"
                />
                <button
                  type="submit"
                  disabled={submittingSecret || !secretInput.trim()}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition-colors disabled:opacity-50 shrink-0 flex items-center gap-1"
                >
                  {submittingSecret ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  <span>Apply Key</span>
                </button>
              </div>
              {secretMsg && (
                <p className={`text-[11px] ${secretMsg.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {secretMsg.text}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
