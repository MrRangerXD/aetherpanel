import React, { useState, useEffect, useRef } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import { ImportPreflightResponse, ImportJob } from '../../types';
import {
  DownloadCloud, Server, ArrowRight, CheckCircle2, AlertTriangle,
  RefreshCw, Terminal, StopCircle, HardDrive, Cpu, Shield,
  Globe, Link, Check, X, FileArchive, Layers
} from 'lucide-react';

interface ServerImporterProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const ServerImporter: React.FC<ServerImporterProps> = ({ onNavigate }) => {
  const { toast } = useToast();

  // Wizard Step: 'config' | 'running' | 'completed'
  const [step, setStep] = useState<'config' | 'running' | 'completed'>('config');

  // Source Type
  const [source, setSource] = useState<'pterodactyl' | 'sftp' | 'url' | 'upload'>('pterodactyl');

  // Pterodactyl Fields
  const [pteroUrl, setPteroUrl] = useState('');
  const [pteroKey, setPteroKey] = useState('');
  const [pteroIdentifier, setPteroIdentifier] = useState('');

  // SFTP Fields
  const [sftpHost, setSftpHost] = useState('');
  const [sftpPort, setSftpPort] = useState('22');
  const [sftpUser, setSftpUser] = useState('');
  const [sftpPass, setSftpPass] = useState('');
  const [sftpPath, setSftpPath] = useState('/');

  // URL Field
  const [downloadUrl, setDownloadUrl] = useState('');

  // Target Server Provisioning Specs
  const [serverName, setServerName] = useState('Imported Minecraft Server');
  const [software, setSoftware] = useState('paper');
  const [version, setVersion] = useState('1.21.4');
  const [memoryMB, setMemoryMB] = useState(2048);
  const [diskMB, setDiskMB] = useState(10240);
  const [cpuPercent, setCpuPercent] = useState(100);

  // Preflight State
  const [preflightData, setPreflightData] = useState<ImportPreflightResponse | null>(null);
  const [runningPreflight, setRunningPreflight] = useState(false);

  // Active Job State
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const [startingImport, setStartingImport] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  // Run Preflight Check
  const handlePreflight = async () => {
    setRunningPreflight(true);
    setPreflightData(null);

    let config: Record<string, any> = {};
    if (source === 'pterodactyl') {
      config = { panelUrl: pteroUrl.trim(), apiKey: pteroKey.trim(), serverIdentifier: pteroIdentifier.trim() };
    } else if (source === 'sftp') {
      config = { host: sftpHost.trim(), port: Number(sftpPort) || 22, username: sftpUser.trim(), password: sftpPass, remotePath: sftpPath };
    } else if (source === 'url') {
      config = { downloadUrl: downloadUrl.trim() };
    }

    try {
      const res = await apiRequest<ImportPreflightResponse>(
        '/admin/import/preflight',
        {
          method: 'POST',
          body: JSON.stringify({ source, config })
        }
      );
      if (res.success && res.data) {
        setPreflightData(res.data);
        if (res.data.serverName && !serverName.startsWith('Custom')) {
          setServerName(res.data.serverName);
        }
        if (res.data.diskRequiredMB && res.data.diskRequiredMB > diskMB) {
          setDiskMB(res.data.diskRequiredMB);
        }
        if (res.data.reachable) {
          toast.success('Preflight connection verified successfully!');
        } else {
          toast.warning('Preflight checks encountered warnings or connection failures.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Preflight check failed');
    } finally {
      setRunningPreflight(false);
    }
  };

  // Run Pipeline Import
  const handleStartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartingImport(true);

    let config: Record<string, any> = {};
    if (source === 'pterodactyl') {
      config = { panelUrl: pteroUrl.trim(), apiKey: pteroKey.trim(), serverIdentifier: pteroIdentifier.trim() };
    } else if (source === 'sftp') {
      config = { host: sftpHost.trim(), port: Number(sftpPort) || 22, username: sftpUser.trim(), password: sftpPass, remotePath: sftpPath };
    } else if (source === 'url') {
      config = { downloadUrl: downloadUrl.trim() };
    }

    try {
      const res = await apiRequest<ImportJob>(
        '/admin/import/run',
        {
          method: 'POST',
          body: JSON.stringify({
            source,
            config,
            serverConfig: {
              name: serverName.trim(),
              memory: Number(memoryMB),
              disk: Number(diskMB),
              cpu: Number(cpuPercent),
              software,
              version
            }
          })
        }
      );

      if (res.success && res.data) {
        setCurrentJob(res.data);
        setStep('running');
        toast.success(`Import pipeline initiated for '${serverName}'.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start import pipeline');
    } finally {
      setStartingImport(false);
    }
  };

  // Poll Active Job
  useEffect(() => {
    if (step !== 'running' || !currentJob?.id) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiRequest<ImportJob>(
          `/admin/import/${currentJob.id}`
        );
        if (res.success && res.data) {
          setCurrentJob(res.data);
          if (res.data.status === 'completed') {
            setStep('completed');
            toast.success('Server import finished successfully!');
            clearInterval(interval);
          } else if (res.data.status === 'failed' || res.data.status === 'cancelled') {
            toast.error(`Import ${res.data.status}: ${res.data.error || 'Stopped by user'}`);
            clearInterval(interval);
          }
        }
      } catch (err) {
        // network polling error
      }
    }, 1200);

    return () => clearInterval(interval);
  }, [step, currentJob?.id, toast]);

  // Auto-scroll log terminal
  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [currentJob?.log]);

  // Cancel Job
  const handleCancelJob = async () => {
    if (!currentJob) return;
    setCancelling(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/admin/import/${currentJob.id}/cancel`,
        { method: 'POST' }
      );
      if (res.success) {
        toast.info(res.message);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel job');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <DownloadCloud className="w-6 h-6 text-[var(--color-accent)]" />
            Server Migration & Importer
          </h1>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Automated migration pipeline from Pterodactyl, remote SFTP servers, or raw zip archives
          </p>
        </div>

        {step !== 'config' && (
          <button
            onClick={() => {
              setStep('config');
              setCurrentJob(null);
            }}
            className="btn px-3 py-1.5 text-xs border border-[var(--color-line)]"
          >
            Start New Import
          </button>
        )}
      </div>

      {/* CONFIGURATION STEP */}
      {step === 'config' && (
        <form onSubmit={handleStartImport} className="space-y-6">
          {/* Source Selection */}
          <div className="space-y-2">
            <label className="label text-xs font-semibold block">Migration Source</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setSource('pterodactyl')}
                className={`p-4 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                  source === 'pterodactyl'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="p-2 rounded bg-[var(--color-surface-2)] text-[var(--color-accent)]">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-ink)]">Pterodactyl Panel</h4>
                  <p className="text-xs text-[var(--color-ink-dim)] mt-1">Direct API migration via Client API Key</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSource('sftp')}
                className={`p-4 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                  source === 'sftp'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="p-2 rounded bg-[var(--color-surface-2)] text-[var(--color-accent)]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-ink)]">Remote SFTP</h4>
                  <p className="text-xs text-[var(--color-ink-dim)] mt-1">Connect to any remote host or VPS</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSource('url')}
                className={`p-4 rounded-lg border text-left transition-colors flex items-start gap-3 ${
                  source === 'url'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                    : 'border-[var(--color-line)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <div className="p-2 rounded bg-[var(--color-surface-2)] text-[var(--color-accent)]">
                  <Link className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--color-ink)]">Archive URL</h4>
                  <p className="text-xs text-[var(--color-ink-dim)] mt-1">Direct HTTP/HTTPS download (.zip)</p>
                </div>
              </button>
            </div>
          </div>

          {/* Source Specific Inputs */}
          <div className="surface p-5 rounded-lg border border-[var(--color-line)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)] border-b border-[var(--color-line)] pb-2">
              Source Credentials & Configuration
            </h3>

            {source === 'pterodactyl' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs block mb-1">Pterodactyl Panel URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://panel.example.com"
                    value={pteroUrl}
                    onChange={e => setPteroUrl(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="label text-xs block mb-1">Client API Key (Bearer)</label>
                  <input
                    type="password"
                    required
                    placeholder="ptlc_xxxxxxxxxxxx"
                    value={pteroKey}
                    onChange={e => setPteroKey(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div>
                  <label className="label text-xs block mb-1">Server Identifier / UUID Short</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 748a1cb2"
                    value={pteroIdentifier}
                    onChange={e => setPteroIdentifier(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                  />
                </div>
              </div>
            )}

            {source === 'sftp' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="label text-xs block mb-1">Remote Host</label>
                  <input
                    type="text"
                    required
                    placeholder="sftp.example.com or 192.168.1.50"
                    value={sftpHost}
                    onChange={e => setSftpHost(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                  />
                </div>
                <div>
                  <label className="label text-xs block mb-1">Port</label>
                  <input
                    type="number"
                    value={sftpPort}
                    onChange={e => setSftpPort(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div>
                  <label className="label text-xs block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    placeholder="user.server"
                    value={sftpUser}
                    onChange={e => setSftpUser(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label text-xs block mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="SFTP Password"
                    value={sftpPass}
                    onChange={e => setSftpPass(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label text-xs block mb-1">Remote Directory Path</label>
                  <input
                    type="text"
                    value={sftpPath}
                    onChange={e => setSftpPath(e.target.value)}
                    className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                  />
                </div>
              </div>
            )}

            {source === 'url' && (
              <div>
                <label className="label text-xs block mb-1">Direct Archive Download URL (.zip, .tar.gz)</label>
                <input
                  type="url"
                  required
                  placeholder="https://downloads.example.com/server_backup.zip"
                  value={downloadUrl}
                  onChange={e => setDownloadUrl(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                />
              </div>
            )}

            {/* Preflight Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-[var(--color-ink-dim)]">
                Validate credentials and verify source availability before importing
              </span>
              <button
                type="button"
                onClick={handlePreflight}
                disabled={runningPreflight}
                className="btn px-4 py-1.5 text-xs border border-[var(--color-line)] hover:border-[var(--color-accent)] flex items-center gap-1.5"
              >
                {runningPreflight ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                Run Preflight Check
              </button>
            </div>

            {/* Preflight Results Banner */}
            {preflightData && (
              <div className={`p-3 rounded-lg border text-xs space-y-1 ${
                preflightData.reachable
                  ? 'border-[var(--color-ok)]/40 bg-[var(--color-ok)]/5 text-[var(--color-ok)]'
                  : 'border-[var(--color-err)]/40 bg-[var(--color-err)]/5 text-[var(--color-err)]'
              }`}>
                <div className="font-semibold flex items-center gap-1.5">
                  {preflightData.reachable ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {preflightData.reachable ? 'Source verified and reachable' : 'Source unreachable or validation failed'}
                </div>
                {preflightData.serverName && (
                  <div className="text-[var(--color-ink)] font-mono">Detected server: {preflightData.serverName}</div>
                )}
                {preflightData.diskRequiredMB && (
                  <div className="text-[var(--color-ink-dim)] font-mono">Estimated Disk Needed: {preflightData.diskRequiredMB} MB</div>
                )}
                {preflightData.warnings && preflightData.warnings.length > 0 && (
                  <ul className="list-disc pl-4 text-[var(--color-warn)] text-[11px] mt-1 space-y-0.5">
                    {preflightData.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Provisioning Specs */}
          <div className="surface p-5 rounded-lg border border-[var(--color-line)] space-y-4">
            <h3 className="text-sm font-bold text-[var(--color-ink)] border-b border-[var(--color-line)] pb-2">
              Target Server Specs & Allocations
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="label text-xs block mb-1">Server Name</label>
                <input
                  type="text"
                  required
                  value={serverName}
                  onChange={e => setServerName(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                />
              </div>

              <div>
                <label className="label text-xs block mb-1">Software Framework</label>
                <select
                  value={software}
                  onChange={e => setSoftware(e.target.value)}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                >
                  <option value="paper">Paper (Minecraft)</option>
                  <option value="purpur">Purpur (Minecraft)</option>
                  <option value="fabric">Fabric (Modded)</option>
                  <option value="nodejs">Node.js Bot</option>
                  <option value="python">Python Bot</option>
                </select>
              </div>

              <div>
                <label className="label text-xs block mb-1">Memory Allocation (MB)</label>
                <input
                  type="number"
                  min={512}
                  max={65536}
                  value={memoryMB}
                  onChange={e => setMemoryMB(Number(e.target.value))}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                />
              </div>

              <div>
                <label className="label text-xs block mb-1">Disk Allocation (MB)</label>
                <input
                  type="number"
                  min={1024}
                  max={262144}
                  value={diskMB}
                  onChange={e => setDiskMB(Number(e.target.value))}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                />
              </div>

              <div>
                <label className="label text-xs block mb-1">CPU Limit (%)</label>
                <input
                  type="number"
                  min={25}
                  max={800}
                  value={cpuPercent}
                  onChange={e => setCpuPercent(Number(e.target.value))}
                  className="field w-full px-3 py-2 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] font-mono"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={startingImport}
              className="btn-primary px-6 py-2.5 text-xs font-semibold flex items-center gap-2"
            >
              {startingImport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Launch Migration Pipeline
            </button>
          </div>
        </form>
      )}

      {/* RUNNING / MONITORING STEP */}
      {(step === 'running' || step === 'completed') && currentJob && (
        <div className="space-y-6">
          {/* Progress Banner */}
          <div className="surface p-6 rounded-lg border border-[var(--color-line)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                  <span className="font-mono">{currentJob.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                      currentJob.status === 'completed'
                        ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border border-[var(--color-ok)]/30'
                        : currentJob.status === 'failed' || currentJob.status === 'cancelled'
                        ? 'bg-[var(--color-err)]/10 text-[var(--color-err)] border border-[var(--color-err)]/30'
                        : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
                    }`}
                  >
                    {currentJob.status}
                  </span>
                </h3>
                <p className="text-xs text-[var(--color-ink-dim)] mt-1">
                  Active Stage: <strong className="text-[var(--color-ink)] uppercase font-mono">{currentJob.stage}</strong>
                </p>
              </div>

              {currentJob.status === 'running' && (
                <button
                  onClick={handleCancelJob}
                  disabled={cancelling}
                  className="btn-danger px-3 py-1.5 text-xs flex items-center gap-1.5 self-start"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Cancel Import
                </button>
              )}

              {currentJob.status === 'completed' && onNavigate && currentJob.createdServerId && (
                <button
                  onClick={() => onNavigate('server', { id: currentJob.createdServerId })}
                  className="btn-primary px-4 py-2 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Server className="w-4 h-4" />
                  Go to Server Console
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-[var(--color-ink-dim)]">
                <span>Migration Progress</span>
                <span className="font-bold text-[var(--color-ink)]">{currentJob.percent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-accent)] transition-all duration-300"
                  style={{ width: `${currentJob.percent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Real-time Terminal Log */}
          <div className="surface rounded-lg border border-[var(--color-line)] overflow-hidden">
            <div className="p-3 border-b border-[var(--color-line)] bg-[var(--color-surface-2)] flex items-center justify-between text-xs text-[var(--color-ink-dim)] font-mono">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                Pipeline Execution Stream
              </span>
              <span>{currentJob.log.length} events</span>
            </div>
            <div
              ref={logTerminalRef}
              className="p-4 bg-[var(--color-bg)] font-mono text-xs text-[var(--color-ink)] max-h-96 overflow-y-auto space-y-1"
            >
              {currentJob.log.map((line, idx) => (
                <div key={idx} className="leading-relaxed">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default ServerImporter;
