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
      <div className="surface rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-surface-2 border border-line text-accent">
            <FolderInput className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Server Importer & Migration Engine</h2>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-surface-2 border border-line text-accent">
                MIGRATION
              </span>
            </div>
            <p className="text-xs text-ink-mute mt-0.5">
              Transfer worlds, plugins, and configuration files from external hosts or remote SFTP endpoints.
            </p>
          </div>
        </div>

        {isJobActive && (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-warn/10 border border-warn/25 text-warn text-xs font-mono">
            <RefreshCw className="h-3 w-3 animate-spin" />
            <span>Import In Progress</span>
          </div>
        )}
      </div>

      {/* Protocol Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setActiveProtocol('sftp')}
          className={`p-3.5 rounded-lg border text-left transition-colors ${
            activeProtocol === 'sftp'
              ? 'bg-surface-2 border-accent text-ink'
              : 'surface text-ink-mute hover:text-ink hover:bg-surface-2'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Server className={`h-3.5 w-3.5 ${activeProtocol === 'sftp' ? 'text-accent' : 'text-ink-mute'}`} />
            <span>Remote SFTP / FTP</span>
          </div>
          <p className="text-[11px] text-ink-mute mt-1">Directly pull files from an external VPS or game host via SFTP stream.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveProtocol('url')}
          className={`p-3.5 rounded-lg border text-left transition-colors ${
            activeProtocol === 'url'
              ? 'bg-surface-2 border-accent text-ink'
              : 'surface text-ink-mute hover:text-ink hover:bg-surface-2'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <LinkIcon className={`h-3.5 w-3.5 ${activeProtocol === 'url' ? 'text-accent' : 'text-ink-mute'}`} />
            <span>Archive URL Download</span>
          </div>
          <p className="text-[11px] text-ink-mute mt-1">Download and auto-unpack `.zip` or `.tar.gz` backup bundles from direct URLs.</p>
        </button>

        <button
          type="button"
          onClick={() => setActiveProtocol('pterodactyl')}
          className={`p-3.5 rounded-lg border text-left transition-colors ${
            activeProtocol === 'pterodactyl'
              ? 'bg-surface-2 border-accent text-ink'
              : 'surface text-ink-mute hover:text-ink hover:bg-surface-2'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Sparkles className={`h-3.5 w-3.5 ${activeProtocol === 'pterodactyl' ? 'text-accent' : 'text-ink-mute'}`} />
            <span>Pterodactyl 1-Click</span>
          </div>
          <p className="text-[11px] text-ink-mute mt-1">Automated panel-to-panel sync using Client API Key and Server Identifier.</p>
        </button>
      </div>

      {/* Protocol Configuration Cards */}
      <div className="surface rounded-lg p-5 space-y-4">
        {activeProtocol === 'sftp' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-line">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-accent" /> Remote SFTP Host Credentials
              </h3>
              <p className="text-xs text-ink-mute mt-0.5">Enter the remote server credentials of your previous provider.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="label">Host / IP</label>
                <input
                  type="text"
                  value={sftpHost}
                  onChange={(e) => setSftpHost(e.target.value)}
                  placeholder="e.g. sftp.node1.host.com or 192.168.1.100"
                  className="field w-full font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Port</label>
                <input
                  type="number"
                  value={sftpPort}
                  onChange={(e) => setSftpPort(e.target.value)}
                  placeholder="22"
                  className="field w-full font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Username</label>
                <input
                  type="text"
                  value={sftpUsername}
                  onChange={(e) => setSftpUsername(e.target.value)}
                  placeholder="e.g. user.a1b2c3d4 or root"
                  className="field w-full font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Password</label>
                <input
                  type="password"
                  value={sftpPassword}
                  onChange={(e) => setSftpPassword(e.target.value)}
                  placeholder="Remote SFTP Password"
                  className="field w-full font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Remote Directory</label>
                <input
                  type="text"
                  value={sftpRemotePath}
                  onChange={(e) => setSftpRemotePath(e.target.value)}
                  placeholder="e.g. / or /home/container"
                  className="field w-full font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sftpAutoExtract"
                checked={sftpAutoExtract}
                onChange={(e) => setSftpAutoExtract(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent rounded"
              />
              <label htmlFor="sftpAutoExtract" className="text-xs text-ink cursor-pointer">
                Auto-unpack `.zip` or `.tar.gz` archives discovered in remote directory.
              </label>
            </div>

            {testSftpResult && (
              <div className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 font-mono ${
                testSftpResult.success
                  ? 'bg-ok/10 border-ok/25 text-ok'
                  : 'bg-err/10 border-err/25 text-err'
              }`}>
                {testSftpResult.success ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                <span>{testSftpResult.success ? testSftpResult.message : testSftpResult.error}</span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isTestingSftp || !sftpHost || !sftpUsername}
                onClick={handleTestSftp}
                className="btn btn-ghost border-line"
              >
                <RefreshCw className={`h-3 w-3 ${isTestingSftp ? 'animate-spin text-accent' : ''}`} />
                <span>{isTestingSftp ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="button"
                disabled={isStartingImport || isJobActive || !sftpHost || !sftpUsername}
                onClick={handleStartSftpImport}
                className="btn btn-primary"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Start SFTP Migration</span>
              </button>
            </div>
          </div>
        )}

        {activeProtocol === 'url' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-line">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5 text-accent" /> Direct Archive URL Download
              </h3>
              <p className="text-xs text-ink-mute mt-0.5">Provide a direct HTTPS download link for an archive or world backup.</p>
            </div>

            <div className="space-y-1">
              <label className="label">Archive Download URL</label>
              <input
                type="text"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="https://example.com/backups/server_backup.zip"
                className="field w-full font-mono text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="urlAutoExtract"
                checked={urlAutoExtract}
                onChange={(e) => setUrlAutoExtract(e.target.checked)}
                className="w-3.5 h-3.5 accent-accent rounded"
              />
              <label htmlFor="urlAutoExtract" className="text-xs text-ink cursor-pointer">
                Auto-extract archive into server root directory after download completes.
              </label>
            </div>

            <div className="pt-1">
              <button
                type="button"
                disabled={isStartingImport || isJobActive || !downloadUrl}
                onClick={handleStartUrlImport}
                className="btn btn-primary"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Start Download & Extract</span>
              </button>
            </div>
          </div>
        )}

        {activeProtocol === 'pterodactyl' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-line">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-mute flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-accent" /> Pterodactyl 1-Click Migration
              </h3>
              <p className="text-xs text-ink-mute mt-0.5">Automated sync using your source panel Client API Key and Server Identifier.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="label">Pterodactyl Panel URL</label>
                <input
                  type="text"
                  value={pteroPanelUrl}
                  onChange={(e) => setPteroPanelUrl(e.target.value)}
                  placeholder="https://panel.example.com"
                  className="field w-full font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="label">Server Identifier</label>
                <input
                  type="text"
                  value={pteroServerId}
                  onChange={(e) => setPteroServerId(e.target.value)}
                  placeholder="e.g. a1b2c3d4"
                  className="field w-full font-mono text-xs"
                />
              </div>

              <div className="sm:col-span-3 space-y-1">
                <label className="label">Client API Key</label>
                <input
                  type="password"
                  value={pteroApiKey}
                  onChange={(e) => setPteroApiKey(e.target.value)}
                  placeholder="ptlc_xxxxxxxxxxxxxxxxxxxxxxxx"
                  className="field w-full font-mono text-xs"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                disabled={isStartingImport || isJobActive || !pteroPanelUrl || !pteroApiKey || !pteroServerId}
                onClick={handleStartPterodactylImport}
                className="btn btn-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fetch & One-Click Import</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live Job Progress & Terminal Telemetry Monitor */}
      {job && job.status !== 'IDLE' && (
        <div className="surface rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                job.status === 'COMPLETED' ? 'bg-ok/10 border-ok/25 text-ok' :
                job.status === 'FAILED' ? 'bg-err/10 border-err/25 text-err' :
                job.status === 'CANCELED' ? 'bg-surface-2 border-line text-ink-mute' :
                'bg-accent/10 border-accent/25 text-accent'
              }`}>
                {job.status}
              </div>
              <div>
                <h4 className="text-xs font-semibold text-ink">{job.message}</h4>
                <p className="text-[10px] text-ink-mute font-mono truncate max-w-md mt-0.5">{job.currentFile}</p>
              </div>
            </div>

            {isJobActive && (
              <button
                type="button"
                onClick={handleCancelJob}
                className="btn btn-ghost border-err/25 text-err hover:bg-err/10 text-xs"
              >
                <XCircle className="h-3 w-3" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] font-mono">
              <span className="text-ink-mute">
                {job.transferredFiles > 0 && `${job.transferredFiles} / ${job.totalFiles} files • `}
                {(job.transferredBytes / (1024 * 1024)).toFixed(2)} MB transferred
              </span>
              <span className="text-accent font-semibold">{job.progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden border border-line">
              <div
                className={`h-full transition-all duration-300 ${
                  job.status === 'COMPLETED' ? 'bg-ok' :
                  job.status === 'FAILED' ? 'bg-err' :
                  'bg-accent'
                }`}
                style={{ width: `${job.progressPercent}%` }}
              />
            </div>
            {job.speedMBps > 0 && (
              <div className="text-[10px] font-mono text-ink-mute pt-0.5">
                Speed: <span className="text-ink font-semibold">{job.speedMBps} MB/s</span>
              </div>
            )}
          </div>

          {/* Terminal Console Logs */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs text-ink-mute font-mono">
              <span className="flex items-center gap-1.5">
                <Terminal className="h-3 w-3 text-accent" /> Migration Output Log
              </span>
              <button
                type="button"
                onClick={handleCopyLogs}
                className="hover:text-ink flex items-center gap-1 transition-colors text-[11px]"
              >
                {copiedLogs ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
                <span>{copiedLogs ? 'Copied' : 'Copy Log'}</span>
              </button>
            </div>
            <div
              ref={terminalRef}
              className="bg-black border border-line rounded-md p-3 font-mono text-[11px] text-ink-dim max-h-48 overflow-y-auto space-y-0.5"
            >
              {job.logs && job.logs.length > 0 ? (
                job.logs.map((line, idx) => (
                  <div key={idx} className="leading-tight break-all">{line}</div>
                ))
              ) : (
                <div className="text-ink-mute italic">Awaiting migration execution output...</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
