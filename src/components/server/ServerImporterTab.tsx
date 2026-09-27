import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Upload, Server, HardDrive, Wifi, Shield, RefreshCw,
  CheckCircle2, AlertTriangle, Terminal, XCircle, FileArchive, FolderInput,
  Key, Link as LinkIcon, Lock, ArrowRight, Play, Sparkles, Copy, Check
} from 'lucide-react';
import { Server as ServerType } from '../../types';
import { apiRequest } from '../../lib/api';

interface ServerImporterTabProps {
  server: ServerType;
  onRefreshServer?: () => void;
}

export interface ImportJob {
  serverId: string;
  sourceType: 'sftp' | 'url' | 'pterodactyl';
  status: 'IDLE' | 'CONNECTING' | 'ANALYZING' | 'TRANSFERRING' | 'EXTRACTING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  progressPercent: number;
  transferredBytes: number;
  totalBytes: number;
  transferredFiles: number;
  totalFiles: number;
  currentFile: string;
  speedMBps: number;
  etaSeconds: number;
  message: string;
  logs: string[];
  error?: string;
}

export const ServerImporterTab: React.FC<ServerImporterTabProps> = ({ server, onRefreshServer }) => {
  const [activeProtocol, setActiveProtocol] = useState<'sftp' | 'url' | 'pterodactyl'>('sftp');
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isTestingSftp, setIsTestingSftp] = useState(false);
  const [testSftpResult, setTestSftpResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);
  const [isStartingImport, setIsStartingImport] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Form states
  const [sftpHost, setSftpHost] = useState('');
  const [sftpPort, setSftpPort] = useState('22');
  const [sftpUsername, setSftpUsername] = useState('');
  const [sftpPassword, setSftpPassword] = useState('');
  const [sftpPrivateKey, setSftpPrivateKey] = useState('');
  const [sftpRemotePath, setSftpRemotePath] = useState('/');
  const [sftpAutoExtract, setSftpAutoExtract] = useState(true);

  const [downloadUrl, setDownloadUrl] = useState('');
  const [urlAutoExtract, setUrlAutoExtract] = useState(true);

  const [pteroPanelUrl, setPteroPanelUrl] = useState('');
  const [pteroApiKey, setPteroApiKey] = useState('');
  const [pteroServerId, setPteroServerId] = useState('');

  const terminalRef = useRef<HTMLDivElement>(null);

  // Fetch active job status on mount & poll every 1.5s while active
  const fetchJobStatus = async () => {
    try {
      const res = await apiRequest(`/servers/${server.id}/importer/status`);
      if (res.success && res.data) {
        setJob(res.data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchJobStatus();
    const interval = setInterval(() => {
      fetchJobStatus();
    }, 1500);
    return () => clearInterval(interval);
  }, [server.id]);

  // Scroll logs to bottom automatically
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [job?.logs]);

  // Test SFTP Connection
  const handleTestSftp = async () => {
    if (!sftpHost || !sftpUsername) {
      setTestSftpResult({ success: false, error: 'SFTP Host and Username are required.' });
      return;
    }
    setIsTestingSftp(true);
    setTestSftpResult(null);

    try {
      const res = await apiRequest(`/servers/${server.id}/importer/test-sftp`, {
        method: 'POST',
        body: JSON.stringify({
          host: sftpHost,
          port: Number(sftpPort) || 22,
          username: sftpUsername,
          password: sftpPassword || undefined,
          privateKey: sftpPrivateKey || undefined,
          remotePath: sftpRemotePath || '/'
        })
      });

      if (res.success && res.data) {
        setTestSftpResult({
          success: res.data.success,
          message: res.data.message || 'Connected successfully!',
          error: res.data.error
        });
      } else {
        setTestSftpResult({ success: false, error: res.error?.message || 'Connection failed' });
      }
    } catch (err: any) {
      setTestSftpResult({ success: false, error: err.message || 'Connection error' });
    } finally {
      setIsTestingSftp(false);
    }
  };

  // Start SFTP Import
  const handleStartSftpImport = async () => {
    if (!sftpHost || !sftpUsername) return;
    setIsStartingImport(true);
    setTestSftpResult(null);

    try {
      const res = await apiRequest(`/servers/${server.id}/importer/start-sftp`, {
        method: 'POST',
        body: JSON.stringify({
          host: sftpHost,
          port: Number(sftpPort) || 22,
          username: sftpUsername,
          password: sftpPassword || undefined,
          privateKey: sftpPrivateKey || undefined,
          remotePath: sftpRemotePath || '/',
          autoExtractArchives: sftpAutoExtract
        })
      });
      if (res.success && res.data) {
        setJob(res.data);
      }
    } catch (err: any) {
      alert(`Failed to start SFTP import: ${err.message}`);
    } finally {
      setIsStartingImport(false);
    }
  };

  // Start URL Import
  const handleStartUrlImport = async () => {
    if (!downloadUrl) return;
    setIsStartingImport(true);

    try {
      const res = await apiRequest(`/servers/${server.id}/importer/start-url`, {
        method: 'POST',
        body: JSON.stringify({
          downloadUrl,
          autoExtract: urlAutoExtract
        })
      });
      if (res.success && res.data) {
        setJob(res.data);
      }
    } catch (err: any) {
      alert(`Failed to start URL import: ${err.message}`);
    } finally {
      setIsStartingImport(false);
    }
  };

  // Start Pterodactyl Import
  const handleStartPterodactylImport = async () => {
    if (!pteroPanelUrl || !pteroApiKey || !pteroServerId) return;
    setIsStartingImport(true);

    try {
      const res = await apiRequest(`/servers/${server.id}/importer/start-pterodactyl`, {
        method: 'POST',
        body: JSON.stringify({
          panelUrl: pteroPanelUrl,
          apiKey: pteroApiKey,
          serverIdentifier: pteroServerId
        })
      });
      if (res.success && res.data) {
        setJob(res.data);
      }
    } catch (err: any) {
      alert(`Failed to start Pterodactyl import: ${err.message}`);
    } finally {
      setIsStartingImport(false);
    }
  };

  // Cancel Import Job
  const handleCancelJob = async () => {
    if (!window.confirm("Are you sure you want to cancel the active import job?")) return;
    try {
      await apiRequest(`/servers/${server.id}/importer/cancel`, { method: 'POST' });
      fetchJobStatus();
    } catch {}
  };

  const isJobActive = job && ['CONNECTING', 'ANALYZING', 'TRANSFERRING', 'EXTRACTING'].includes(job.status);

  const handleCopyLogs = () => {
    if (!job?.logs) return;
    navigator.clipboard.writeText(job.logs.join('\n'));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/20 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <FolderInput className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white">Server Importer & Migration Engine</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO MIGRATION
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Migrate worlds, plugins, and full server data from external hosts (Pterodactyl, Multicraft, VPS, SFTP or Direct URL) into this server in 1-Click.
            </p>
          </div>
        </div>

        {isJobActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold animate-pulse">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Import In Progress</span>
          </div>
        )}
      </div>

      {/* Protocol Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveProtocol('sftp')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeProtocol === 'sftp'
              ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
            <Server className="h-4 w-4" /> Remote SFTP / FTP
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Pull files directly from any remote Linux VPS or game hosting SFTP server.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveProtocol('url')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeProtocol === 'url'
              ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <LinkIcon className="h-4 w-4" /> Archive URL / Link
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">Download and auto-extract `.zip`, `.tar.gz`, or `.rar` backup files directly from any URL.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveProtocol('pterodactyl')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            activeProtocol === 'pterodactyl'
              ? 'bg-amber-500/10 border-amber-500/50 text-white shadow-lg shadow-amber-500/10'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-400">
            <Sparkles className="h-4 w-4" /> Pterodactyl 1-Click
          </div>
          <p className="text-[11px] text-zinc-400 mt-1">One-click automated migration using Pterodactyl Panel API Key & Server ID.</p>
        </button>
      </div>

      {/* Protocol Configuration Cards */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-5">
        {activeProtocol === 'sftp' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Server className="h-4 w-4 text-amber-400" /> SFTP / FTP Credentials
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">Enter the SFTP host details of your previous provider or VPS.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">SFTP Host / IP</label>
                <input
                  type="text"
                  value={sftpHost}
                  onChange={(e) => setSftpHost(e.target.value)}
                  placeholder="e.g. sftp.node1.host.com or 192.168.1.100"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Port</label>
                <input
                  type="number"
                  value={sftpPort}
                  onChange={(e) => setSftpPort(e.target.value)}
                  placeholder="22 or 2022"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Username</label>
                <input
                  type="text"
                  value={sftpUsername}
                  onChange={(e) => setSftpUsername(e.target.value)}
                  placeholder="e.g. user.a1b2c3d4 or root"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Password</label>
                <input
                  type="password"
                  value={sftpPassword}
                  onChange={(e) => setSftpPassword(e.target.value)}
                  placeholder="Remote SFTP Password"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Remote Directory</label>
                <input
                  type="text"
                  value={sftpRemotePath}
                  onChange={(e) => setSftpRemotePath(e.target.value)}
                  placeholder="e.g. / or /home/container"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sftpAutoExtract"
                checked={sftpAutoExtract}
                onChange={(e) => setSftpAutoExtract(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="sftpAutoExtract" className="text-xs text-zinc-300 font-medium cursor-pointer">
                Auto-unpack `.zip`, `.tar.gz`, or `.tgz` archive backups if found on remote server.
              </label>
            </div>

            {testSftpResult && (
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 font-mono ${
                testSftpResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}>
                {testSftpResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                <span>{testSftpResult.success ? testSftpResult.message : testSftpResult.error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isTestingSftp || !sftpHost || !sftpUsername}
                onClick={handleTestSftp}
                className="px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isTestingSftp ? 'animate-spin text-amber-400' : ''}`} />
                <span>{isTestingSftp ? 'Testing SFTP...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                disabled={isStartingImport || isJobActive || !sftpHost || !sftpUsername}
                onClick={handleStartSftpImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition"
              >
                <Download className="h-4 w-4" />
                <span>Start SFTP Migration</span>
              </button>
            </div>
          </div>
        )}

        {activeProtocol === 'url' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-cyan-400" /> Direct Archive URL Download
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Provide a direct download URL for a server backup zip or tarball file.</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Archive Download URL</label>
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="https://example.com/backups/server_backup.zip or https://mediafire.com/file..."
                className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="urlAutoExtract"
                checked={urlAutoExtract}
                onChange={(e) => setUrlAutoExtract(e.target.checked)}
                className="rounded border-zinc-800 bg-zinc-950 text-amber-500 focus:ring-amber-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="urlAutoExtract" className="text-xs text-zinc-300 font-medium cursor-pointer">
                Auto-extract archive (`.zip`, `.tar.gz`, `.rar`) into server root directory after download completes.
              </label>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={isStartingImport || isJobActive || !downloadUrl}
                onClick={handleStartUrlImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition"
              >
                <Download className="h-4 w-4" />
                <span>Start Archive Download & Import</span>
              </button>
            </div>
          </div>
        )}

        {activeProtocol === 'pterodactyl' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-400" /> Pterodactyl One-Click Import
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Automated migration using your existing Pterodactyl Panel Client API Key.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Pterodactyl Panel URL</label>
                <input
                  type="text"
                  value={pteroPanelUrl}
                  onChange={(e) => setPteroPanelUrl(e.target.value)}
                  placeholder="https://panel.yourhost.com"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Server Identifier</label>
                <input
                  type="text"
                  value={pteroServerId}
                  onChange={(e) => setPteroServerId(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-mono uppercase text-zinc-400 font-semibold block">Client API Key (`ptlc_...`)</label>
                <input
                  type="password"
                  value={pteroApiKey}
                  onChange={(e) => setPteroApiKey(e.target.value)}
                  placeholder="ptlc_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="w-full bg-zinc-950 border border-zinc-800 text-white text-xs font-mono rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                disabled={isStartingImport || isJobActive || !pteroPanelUrl || !pteroApiKey || !pteroServerId}
                onClick={handleStartPterodactylImport}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition"
              >
                <Sparkles className="h-4 w-4" />
                <span>Fetch & One-Click Import</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Job Progress & Terminal Telemetry Monitor */}
      {job && job.status !== 'IDLE' && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`p-2 rounded-xl border text-xs font-bold font-mono ${
                job.status === 'COMPLETED' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                job.status === 'FAILED' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                job.status === 'CANCELED' ? 'bg-zinc-800 border-zinc-700 text-zinc-400' :
                'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse'
              }`}>
                {job.status}
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">{job.message}</h4>
                <p className="text-[10px] text-zinc-400 font-mono truncate max-w-md mt-0.5">{job.currentFile}</p>
              </div>
            </div>

            {isJobActive && (
              <button
                type="button"
                onClick={handleCancelJob}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <XCircle className="h-3.5 w-3.5" /> Cancel Job
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-zinc-400">
                {job.transferredFiles > 0 && `${job.transferredFiles} / ${job.totalFiles} files • `}
                {(job.transferredBytes / (1024 * 1024)).toFixed(2)} MB transferred
              </span>
              <span className="text-amber-400 font-bold">{job.progressPercent}%</span>
            </div>
            <div className="h-2 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
              <div
                className={`h-full transition-all duration-300 ${
                  job.status === 'COMPLETED' ? 'bg-emerald-500' :
                  job.status === 'FAILED' ? 'bg-rose-500' :
                  'bg-amber-500'
                }`}
                style={{ width: `${job.progressPercent}%` }}
              />
            </div>
            {job.speedMBps > 0 && (
              <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-2 pt-0.5">
                <span>Speed: <strong className="text-amber-300">{job.speedMBps} MB/s</strong></span>
              </div>
            )}
          </div>

          {/* Terminal Console Logs */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5"><Terminal className="h-3.5 w-3.5 text-amber-400" /> Migration Execution Log</span>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="hover:text-white flex items-center gap-1 transition"
              >
                {copiedLogs ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedLogs ? 'Copied' : 'Copy Log'}</span>
              </button>
            </div>
            <div
              ref={terminalRef}
              className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-[11px] text-zinc-300 max-h-48 overflow-y-auto space-y-1"
            >
              {job.logs && job.logs.length > 0 ? (
                job.logs.map((line, idx) => (
                  <div key={idx} className="leading-tight break-all">{line}</div>
                ))
              ) : (
                <div className="text-zinc-600 italic">Awaiting migration execution output...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
