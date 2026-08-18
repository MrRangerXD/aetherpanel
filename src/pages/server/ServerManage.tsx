import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal as TerminalIcon, Folder, Database, HardDrive, Clock,
  Settings as SettingsIcon, Play, Square, RotateCw, Skull, Copy, Check,
  Cpu, Activity, RefreshCw, FileText, Plus, Trash2, Download, Edit3,
  Save, PlayCircle, Shield, AlertTriangle, ArrowLeft, Key, ExternalLink,
  Layers, CheckCircle2, ChevronRight, Zap, RefreshCcw, Upload, FileArchive,
  Eye, EyeOff, Search, Box, Package, AlertOctagon, Archive, AlertCircle, MessageSquare,
  Globe, Wifi, Sliders
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server, ServerFile, ServerBackup, ServerDatabase, ServerSchedule, ServerActivity, PluginItem, ServerStartupConfig, ServerEnvVar } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';
import { ServerDiscordTab } from '../../components/server/ServerDiscordTab';
import { ServerMonitoringTab } from '../../components/server/ServerMonitoringTab';
import { ServerNetworkPlayitTab } from '../../components/server/ServerNetworkPlayitTab';
import { ServerConsoleTab } from '../../components/server/ServerConsoleTab';

interface ServerManageProps {
  serverId: string;
  initialTab?: string;
  onNavigate: (page: string, params?: any) => void;
}

export const ServerManage: React.FC<ServerManageProps> = ({ serverId, initialTab, onNavigate }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();

  const [server, setServer] = useState<Server | null>(null);
  const [activeTab, setActiveTab] = useState<'console' | 'monitoring' | 'network' | 'files' | 'plugins' | 'properties' | 'env' | 'backups' | 'databases' | 'schedules' | 'discord' | 'settings' | 'activity'>(
    (initialTab as any) || 'console'
  );

  useEffect(() => {
    if (initialTab && ['console', 'monitoring', 'network', 'files', 'plugins', 'properties', 'env', 'backups', 'databases', 'schedules', 'discord', 'settings', 'activity'].includes(initialTab)) {
      setActiveTab(initialTab as any);
    }
  }, [initialTab]);

  const handleTabSelect = (tab: 'console' | 'monitoring' | 'network' | 'files' | 'plugins' | 'properties' | 'env' | 'backups' | 'databases' | 'schedules' | 'discord' | 'settings' | 'activity') => {
    setActiveTab(tab);
    setIsEditingFile(false);
    onNavigate('server-manage', { serverId, initialTab: tab });
  };

  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Console state
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Files state
  const [currentPath, setCurrentPath] = useState('/');
  const [files, setFiles] = useState<ServerFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<ServerFile | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditingFile, setIsEditingFile] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renameOldPath, setRenameOldPath] = useState('');
  const [renameNewPath, setRenameNewPath] = useState('');
  const [showRenameModal, setShowRenameModal] = useState(false);

  // Plugins state
  const [installedPlugins, setInstalledPlugins] = useState<PluginItem[]>([]);
  const [pluginQuery, setPluginQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PluginItem[]>([]);
  const [isSearchingPlugins, setIsSearchingPlugins] = useState(false);
  const [pluginTab, setPluginTab] = useState<'installed' | 'search'>('installed');
  const [selectedPluginDetails, setSelectedPluginDetails] = useState<PluginItem | null>(null);
  const [installingPluginId, setInstallingPluginId] = useState<string | null>(null);
  const [installProgressStep, setInstallProgressStep] = useState<string | null>(null);
  const [isUploadingPlugin, setIsUploadingPlugin] = useState(false);

  // Environment state (.env)
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>([]);
  const [showEnvValues, setShowEnvValues] = useState<Record<number, boolean>>({});
  const [envSavedMessage, setEnvSavedMessage] = useState(false);

  // Backups state
  const [backups, setBackups] = useState<ServerBackup[]>([]);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupName, setBackupName] = useState('');
  const [restoreModalBackup, setRestoreModalBackup] = useState<ServerBackup | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupErrorModal, setBackupErrorModal] = useState<ServerBackup | null>(null);

  // Databases state
  const [databases, setDatabases] = useState<ServerDatabase[]>([]);
  const [dbName, setDbName] = useState('');
  const [isCreatingDb, setIsCreatingDb] = useState(false);

  // Schedules state
  const [schedules, setSchedules] = useState<ServerSchedule[]>([]);
  const [schedName, setSchedName] = useState('');
  const [schedType, setSchedType] = useState<'hourly' | 'daily' | 'weekly' | 'one-time' | 'custom_cron'>('daily');
  const [schedCron, setSchedCron] = useState('0 4 * * *');
  const [schedTime, setSchedTime] = useState('04:00');
  const [schedIntervalHours, setSchedIntervalHours] = useState('6');
  const [schedDayOfWeek, setSchedDayOfWeek] = useState('1'); // Monday
  const [schedDate, setSchedDate] = useState('');
  const [schedAction, setSchedAction] = useState<'start' | 'stop' | 'restart' | 'backup' | 'command'>('restart');
  const [schedPayload, setSchedPayload] = useState('');
  const [showNewSchedModal, setShowNewSchedModal] = useState(false);
  const [runningSchedId, setRunningSchedId] = useState<string | null>(null);

  // Activity state
  const [activities, setActivities] = useState<ServerActivity[]>([]);

  // Settings & Startup Config & Lifecycle state
  const [serverNameEdit, setServerNameEdit] = useState('');
  const [startupFlags, setStartupFlags] = useState('');
  const [javaVersion, setJavaVersion] = useState('Java 21');
  const [startupConfig, setStartupConfig] = useState<ServerStartupConfig>({
    javaVersion: 'Java 21',
    jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    xmsMB: 128,
    xmxMB: 1024,
    serverJar: 'server.jar',
    nogui: true,
    customFlags: '',
    entryFile: 'index.js',
    nodeOptions: '',
    pythonExecutable: 'python3',
    pythonUnbuffered: true,
    autoStartOnBoot: false,
    autoStartOnNodeReconnect: false,
    restartOnCrash: true,
    autoRestartPolicy: 'on_crash',
    maxCrashRestarts: 5,
    crashRestartDelaySeconds: 5
  });
  const [preflightResult, setPreflightResult] = useState<{ ok: boolean; code?: string; reason?: string } | null>(null);
  const [isCheckingPreflight, setIsCheckingPreflight] = useState(false);
  const [botRuntime, setBotRuntime] = useState('Node.js');
  const [botVersion, setBotVersion] = useState('Node 20 LTS');
  const [botEntryPoint, setBotEntryPoint] = useState('index.js');
  const [autoRestart, setAutoRestart] = useState('always');
  const [isInstallingDeps, setIsInstallingDeps] = useState(false);
  const [depsInstallResult, setDepsInstallResult] = useState<{ success: boolean; message: string } | null>(null);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showReinstallModal, setShowReinstallModal] = useState(false);
  const [isReinstalling, setIsReinstalling] = useState(false);
  const [reinstallSoftware, setReinstallSoftware] = useState('Paper');
  const [reinstallVersion, setReinstallVersion] = useState('1.21.4');
  const [reinstallVersionsList, setReinstallVersionsList] = useState<string[]>([]);
  const [reinstallPreserveData, setReinstallPreserveData] = useState(true);
  const [isLoadingReinstallVersions, setIsLoadingReinstallVersions] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Minecraft Properties state
  const [mcProps, setMcProps] = useState<any>({
    motd: '§bAetherPanel §7- High Performance Minecraft Host',
    serverPort: 25565,
    serverIp: '',
    gamemode: 'survival',
    difficulty: 'easy',
    maxPlayers: 20,
    onlineMode: true,
    pvp: true,
    viewDistance: 10,
    simulationDistance: 8,
    allowFlight: false,
    enableCommandBlock: true,
    spawnProtection: 16,
    whiteList: false,
    hardcore: false,
    levelName: 'world',
    levelSeed: ''
  });
  const [isLoadingProps, setIsLoadingProps] = useState(false);
  const [isSavingProps, setIsSavingProps] = useState(false);
  const [propsSavedMsg, setPropsSavedMsg] = useState(false);

  const fetchMinecraftProps = async () => {
    setIsLoadingProps(true);
    const res = await apiRequest(`/minecraft/${serverId}/properties`);
    if (res.success && res.data && res.data.properties) {
      setMcProps(res.data.properties);
    }
    setIsLoadingProps(false);
  };

  const handleSaveMinecraftProps = async () => {
    setIsSavingProps(true);
    const res = await apiRequest(`/minecraft/${serverId}/properties`, {
      method: 'PUT',
      body: JSON.stringify({ properties: mcProps })
    });
    setIsSavingProps(false);
    if (res.success) {
      setPropsSavedMsg(true);
      setTimeout(() => setPropsSavedMsg(false), 3000);
    }
  };

  const loadReinstallVersions = async (software: string) => {
    setIsLoadingReinstallVersions(true);
    try {
      const res = await apiRequest(`/minecraft/versions?software=${encodeURIComponent(software)}`);
      if (res.success && res.data && res.data.versions && res.data.versions.length > 0) {
        setReinstallVersionsList(res.data.versions);
        setReinstallVersion(res.data.latest || res.data.versions[0]);
      }
    } catch (e) {}
    setIsLoadingReinstallVersions(false);
  };

  const handleInstallDependencies = async () => {
    setIsInstallingDeps(true);
    setDepsInstallResult(null);
    try {
      const res = await apiRequest(`/servers/${serverId}/install-dependencies`, { method: 'POST' });
      if (res.success) {
        setDepsInstallResult({ success: true, message: 'Dependencies installed successfully!' });
        fetchConsoleLogs();
      } else {
        setDepsInstallResult({ success: false, message: res.error?.message || 'Failed to install dependencies' });
      }
    } catch (err: any) {
      setDepsInstallResult({ success: false, message: err.message || 'Network error' });
    } finally {
      setIsInstallingDeps(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Run Preflight Check
  const runPreflightCheck = async () => {
    setIsCheckingPreflight(true);
    try {
      const res = await apiRequest(`/servers/${serverId}/preflight`);
      if (res.success && res.data) {
        setPreflightResult(res.data);
      }
    } catch {}
    setIsCheckingPreflight(false);
  };

  // Fetch Server Data
  const fetchServerDetails = async () => {
    const res = await apiRequest(`/servers/${serverId}`);
    if (res.success && res.data) {
      const s = res.data.server || res.data;
      setServer(s);
      setServerNameEdit(s.name);
      if (s.startup) {
        setStartupConfig(prev => ({
          ...prev,
          ...s.startup,
          xmxMB: s.startup.xmxMB || s.limits?.ramMB || prev.xmxMB
        }));
        setStartupFlags(s.startup.jvmFlags || s.startup.customFlags || '');
        if (s.startup.javaVersion) setJavaVersion(s.startup.javaVersion);
      } else {
        setStartupFlags('-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200');
      }
    }
  };

  // Fetch Console Logs
  const fetchConsoleLogs = async () => {
    const res = await apiRequest(`/servers/${serverId}/console`);
    if (res.success && res.data?.logs) {
      setLogs(res.data.logs);
    }
  };

  // Fetch Files
  const fetchFiles = async (pathStr: string) => {
    const res = await apiRequest(`/servers/${serverId}/files?path=${encodeURIComponent(pathStr)}`);
    if (res.success && res.data?.files) {
      setFiles(res.data.files);
    }
  };

  // Fetch Plugins
  const fetchPlugins = async () => {
    const res = await apiRequest(`/servers/${serverId}/plugins`);
    if (res.success && res.data) {
      setInstalledPlugins(res.data);
    }
  };

  const handleSearchPlugins = async (queryStr: string = pluginQuery) => {
    setIsSearchingPlugins(true);
    try {
      const res = await apiRequest(`/servers/${serverId}/plugins/search`, {
        method: 'POST',
        body: JSON.stringify({ query: queryStr })
      });
      if (res.success && res.data) {
        setSearchResults(res.data);
      } else {
        setSearchResults([]);
      }
    } catch (e) {
      setSearchResults([]);
    } finally {
      setIsSearchingPlugins(false);
    }
  };

  const handleInstallPlugin = async (item: PluginItem) => {
    setInstallingPluginId(item.id);
    setInstallProgressStep('Contacting repository & resolving download URL...');

    try {
      setInstallProgressStep(`Downloading ${item.name} .jar package from ${item.provider || 'provider'}...`);
      const res = await apiRequest(`/servers/${serverId}/plugins/install`, {
        method: 'POST',
        body: JSON.stringify({
          name: item.name,
          downloadUrl: item.downloadUrl,
          projectId: item.id,
          provider: item.provider
        })
      });

      if (res.success) {
        setInstallProgressStep('Writing plugin .jar to server plugins/ directory...');
        setTimeout(() => {
          fetchPlugins();
          setPluginTab('installed');
          setInstallingPluginId(null);
          setInstallProgressStep(null);
          setSelectedPluginDetails(null);
        }, 600);
      } else {
        alert(res.error?.message || 'Plugin installation failed.');
        setInstallingPluginId(null);
        setInstallProgressStep(null);
      }
    } catch (err: any) {
      alert(err.message || 'Installation failed.');
      setInstallingPluginId(null);
      setInstallProgressStep(null);
    }
  };

  const handleUploadPluginJar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingPlugin(true);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const token = localStorage.getItem('aether_token');
      const response = await fetch(`/api/v1/servers/${serverId}/files/upload?path=plugins`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const res = await response.json();
      if (res.success) {
        fetchPlugins();
        setPluginTab('installed');
      } else {
        alert(res.error?.message || 'Failed to upload plugin file.');
      }
    } catch (err: any) {
      alert(err.message || 'Error uploading plugin file.');
    } finally {
      setIsUploadingPlugin(false);
      e.target.value = '';
    }
  };

  const handleTogglePlugin = async (filename: string) => {
    await apiRequest(`/servers/${serverId}/plugins/toggle`, {
      method: 'POST',
      body: JSON.stringify({ filename })
    });
    fetchPlugins();
  };

  const handleDeletePlugin = async (filename: string) => {
    await apiRequest(`/servers/${serverId}/plugins/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    fetchPlugins();
  };

  // Fetch Environment Variables
  const fetchEnvVars = async () => {
    const res = await apiRequest(`/servers/${serverId}/env`);
    if (res.success && res.data) {
      const respData = res.data;
      if (Array.isArray(respData.envVars) && respData.envVars.length > 0) {
        setEnvVars(respData.envVars);
      } else if (respData.env && Object.keys(respData.env).length > 0) {
        const entries = Object.entries(respData.env).map(([key, value]) => ({
          key,
          value: String(value),
          isSecret: /token|secret|key|password|auth/i.test(key),
          isEnabled: true
        }));
        setEnvVars(entries);
      } else if (typeof respData === 'object' && !respData.env && Object.keys(respData).length > 0) {
        const entries = Object.entries(respData).map(([key, value]) => ({
          key,
          value: String(value),
          isSecret: /token|secret|key|password|auth/i.test(key),
          isEnabled: true
        }));
        setEnvVars(entries);
      } else {
        setEnvVars([
          { key: 'PORT', value: '3000', isSecret: false, isEnabled: true },
          { key: 'NODE_ENV', value: 'production', isSecret: false, isEnabled: true },
          { key: 'DISCORD_TOKEN', value: '', isSecret: true, isEnabled: true }
        ]);
      }
    }
  };

  const handleSaveEnvVars = async () => {
    const cleanList = envVars.filter(item => item.key && item.key.trim().length > 0);
    const envObj: Record<string, string> = {};
    cleanList.forEach(item => {
      if (item.isEnabled !== false) {
        envObj[item.key.trim()] = item.value || '';
      }
    });

    await apiRequest(`/servers/${serverId}/env`, {
      method: 'PUT',
      body: JSON.stringify({ env: envObj, envVars: cleanList })
    });

    setEnvSavedMessage(true);
    setTimeout(() => setEnvSavedMessage(false), 3000);
    fetchServerDetails();
  };

  // Fetch Backups
  const fetchBackups = async () => {
    const res = await apiRequest(`/servers/${serverId}/backups`);
    if (res.success && res.data) {
      setBackups(res.data);
    }
  };

  // Fetch Databases
  const fetchDatabases = async () => {
    const res = await apiRequest(`/servers/${serverId}/databases`);
    if (res.success && res.data) {
      setDatabases(res.data);
    }
  };

  // Fetch Schedules
  const fetchSchedules = async () => {
    const res = await apiRequest(`/servers/${serverId}/schedules`);
    if (res.success && res.data) {
      setSchedules(res.data);
    }
  };

  // Fetch Activity
  const fetchActivities = async () => {
    const res = await apiRequest(`/servers/${serverId}/activity`);
    if (res.success && res.data) {
      setActivities(res.data);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchServerDetails().then(() => setLoading(false));
  }, [serverId]);

  useEffect(() => {
    if (!server) return;
    if (activeTab === 'console') {
      fetchConsoleLogs();

      // Establish Real-time WebSocket connection for streaming console
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const token = localStorage.getItem('aether_token') || '';
      const wsUrl = `${protocol}//${window.location.host}/ws/console/${serverId}?token=${encodeURIComponent(token)}`;
      let ws: WebSocket | null = null;
      let pollInterval: NodeJS.Timeout | null = null;

      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          console.log('[AetherConsole] Connected to live WebSocket stream');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'backlog' && Array.isArray(data.logs)) {
              setLogs(data.logs);
            } else if (data.type === 'log' && typeof data.line === 'string') {
              setLogs((prev) => [...prev, data.line]);
            }
          } catch {}
        };

        ws.onerror = () => {
          // Fallback to polling if WebSocket fails
          if (!pollInterval) {
            pollInterval = setInterval(fetchConsoleLogs, 3000);
          }
        };

        ws.onclose = () => {
          if (!pollInterval) {
            pollInterval = setInterval(fetchConsoleLogs, 3000);
          }
        };
      } catch (err) {
        pollInterval = setInterval(fetchConsoleLogs, 3000);
      }

      return () => {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          ws.close();
        }
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    } else if (activeTab === 'files') {
      fetchFiles(currentPath);
    } else if (activeTab === 'plugins') {
      fetchPlugins();
      handleSearchPlugins('');
    } else if (activeTab === 'properties') {
      fetchMinecraftProps();
    } else if (activeTab === 'env') {
      fetchEnvVars();
    } else if (activeTab === 'backups') {
      fetchBackups();
    } else if (activeTab === 'databases') {
      fetchDatabases();
    } else if (activeTab === 'schedules') {
      fetchSchedules();
    } else if (activeTab === 'activity') {
      fetchActivities();
    }
  }, [activeTab, serverId, currentPath]);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Power Actions
  const handlePowerAction = async (action: 'start' | 'stop' | 'restart' | 'kill') => {
    const res = await apiRequest(`/servers/${serverId}/power`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    if (action === 'start' && res.success === false) {
      runPreflightCheck();
    }
    fetchServerDetails();
    fetchConsoleLogs();
  };

  // Command Send
  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    const cmdToSend = command.trim();
    setCommand('');
    setLogs(prev => [...prev, `[USER COMMAND]: ${cmdToSend}`]);

    await apiRequest(`/servers/${serverId}/command`, {
      method: 'POST',
      body: JSON.stringify({ command: cmdToSend })
    });

    setTimeout(fetchConsoleLogs, 800);
  };

  // File Upload Handling
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = event.target.files;
    if (!filesList || filesList.length === 0) return;

    setIsUploading(true);
    setUploadProgress(20);

    const formData = new FormData();
    for (let i = 0; i < filesList.length; i++) {
      formData.append('files', filesList[i]);
    }

    const token = localStorage.getItem('aether_token');
    try {
      setUploadProgress(60);
      const res = await fetch(`/api/v1/servers/${serverId}/files/upload?path=${encodeURIComponent(currentPath)}`, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      setUploadProgress(100);
      if (data.success) {
        fetchFiles(currentPath);
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // File Read
  const handleOpenFile = async (file: ServerFile) => {
    if (file.isDir) {
      const newP = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      setCurrentPath(newP);
    } else {
      setSelectedFile(file);
      const filePath = currentPath === '/' ? file.name : `${currentPath}/${file.name}`;
      const res = await apiRequest(`/servers/${serverId}/files/content?path=${encodeURIComponent(filePath)}`);
      if (res.success && res.data) {
        setFileContent(res.data.content);
        setIsEditingFile(true);
      }
    }
  };

  // Save File
  const handleSaveFile = async () => {
    if (!selectedFile) return;
    const filePath = currentPath === '/' ? selectedFile.name : `${currentPath}/${selectedFile.name}`;
    await apiRequest(`/servers/${serverId}/files/content`, {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content: fileContent })
    });
    setIsEditingFile(false);
    fetchFiles(currentPath);
  };

  // Create File
  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;
    const filePath = currentPath === '/' ? newFileName.trim() : `${currentPath}/${newFileName.trim()}`;
    await apiRequest(`/servers/${serverId}/files/content`, {
      method: 'POST',
      body: JSON.stringify({ path: filePath, content: '# New Configuration File\n' })
    });
    setNewFileName('');
    setShowNewFileModal(false);
    fetchFiles(currentPath);
  };

  // Create Folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const folderPath = currentPath === '/' ? newFolderName.trim() : `${currentPath}/${newFolderName.trim()}`;
    await apiRequest(`/servers/${serverId}/files/mkdir`, {
      method: 'POST',
      body: JSON.stringify({ path: folderPath })
    });
    setNewFolderName('');
    setShowNewFolderModal(false);
    fetchFiles(currentPath);
  };

  // Rename File / Folder
  const handleRenameItem = async () => {
    if (!renameOldPath || !renameNewPath) return;
    await apiRequest(`/servers/${serverId}/files/rename`, {
      method: 'POST',
      body: JSON.stringify({ oldPath: renameOldPath, newPath: renameNewPath })
    });
    setShowRenameModal(false);
    fetchFiles(currentPath);
  };

  // Compress to ZIP
  const handleCompress = async (fileName: string) => {
    const relPath = currentPath === '/' ? fileName : `${currentPath}/${fileName}`;
    await apiRequest(`/servers/${serverId}/files/compress`, {
      method: 'POST',
      body: JSON.stringify({ path: relPath })
    });
    fetchFiles(currentPath);
  };

  // Decompress ZIP
  const handleDecompress = async (fileName: string) => {
    const relPath = currentPath === '/' ? fileName : `${currentPath}/${fileName}`;
    await apiRequest(`/servers/${serverId}/files/decompress`, {
      method: 'POST',
      body: JSON.stringify({ path: relPath })
    });
    fetchFiles(currentPath);
  };

  // Delete File / Folder
  const handleDeleteFile = async (fileName: string) => {
    const filePath = currentPath === '/' ? fileName : `${currentPath}/${fileName}`;
    await apiRequest(`/servers/${serverId}/files?path=${encodeURIComponent(filePath)}`, {
      method: 'DELETE'
    });
    fetchFiles(currentPath);
  };

  // Create Backup
  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    await apiRequest(`/servers/${serverId}/backups`, {
      method: 'POST',
      body: JSON.stringify({ name: backupName || `backup-${new Date().toISOString().slice(0, 10)}.zip` })
    });
    setBackupName('');
    setIsCreatingBackup(false);
    fetchBackups();
  };

  // Restore Backup
  const handleRestoreBackup = async (backupId: string) => {
    setIsRestoring(true);
    const res = await apiRequest(`/servers/${serverId}/backups/${backupId}/restore`, {
      method: 'POST'
    });
    setIsRestoring(false);
    setRestoreModalBackup(null);
    if (res.success) {
      fetchServerDetails();
      fetchBackups();
    }
  };

  // Delete Backup
  const handleDeleteBackup = async (backupId: string) => {
    await apiRequest(`/servers/${serverId}/backups/${backupId}`, { method: 'DELETE' });
    fetchBackups();
  };

  // Create DB
  const handleCreateDatabase = async () => {
    setIsCreatingDb(true);
    await apiRequest(`/servers/${serverId}/databases`, {
      method: 'POST',
      body: JSON.stringify({ name: dbName || 'app_db' })
    });
    setDbName('');
    setIsCreatingDb(false);
    fetchDatabases();
  };

  // Create Schedule
  const handleCreateSchedule = async () => {
    if (!schedName.trim()) return;

    let computedCron = schedCron;
    if (schedType === 'hourly') {
      computedCron = `0 */${schedIntervalHours || 1} * * *`;
    } else if (schedType === 'daily') {
      const [h, m] = (schedTime || '04:00').split(':');
      computedCron = `${m || '0'} ${h || '4'} * * *`;
    } else if (schedType === 'weekly') {
      const [h, m] = (schedTime || '04:00').split(':');
      computedCron = `${m || '0'} ${h || '4'} * * ${schedDayOfWeek || '1'}`;
    }

    await apiRequest(`/servers/${serverId}/schedules`, {
      method: 'POST',
      body: JSON.stringify({
        name: schedName,
        scheduleType: schedType,
        cronExpression: computedCron,
        timeOfDay: schedTime,
        intervalHours: parseInt(schedIntervalHours) || undefined,
        dayOfWeek: parseInt(schedDayOfWeek) || undefined,
        oneTimeAt: schedDate || undefined,
        action: schedAction,
        payload: schedPayload
      })
    });
    setSchedName('');
    setShowNewSchedModal(false);
    fetchSchedules();
  };

  // Toggle Schedule Enabled
  const handleToggleSchedule = async (scheduleId: string) => {
    await apiRequest(`/servers/${serverId}/schedules/${scheduleId}/toggle`, {
      method: 'PATCH'
    });
    fetchSchedules();
  };

  // Run Schedule Now
  const handleRunScheduleNow = async (scheduleId: string) => {
    setRunningSchedId(scheduleId);
    await apiRequest(`/servers/${serverId}/schedules/${scheduleId}/run`, {
      method: 'POST'
    });
    setRunningSchedId(null);
    fetchSchedules();
  };

  // Delete Schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    await apiRequest(`/servers/${serverId}/schedules/${scheduleId}`, {
      method: 'DELETE'
    });
    fetchSchedules();
  };

  // Save Settings & Startup Config
  const handleSaveSettings = async () => {
    const mergedStartup: ServerStartupConfig = {
      ...startupConfig,
      javaVersion,
      jvmFlags: isMinecraft ? startupFlags : undefined,
      customFlags: !isMinecraft ? startupFlags : startupConfig.customFlags
    };

    const res = await apiRequest(`/servers/${serverId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: serverNameEdit,
        startup: mergedStartup
      })
    });

    if (res.success) {
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
      fetchServerDetails();
    }
  };

  // Reinstall Server
  const handleReinstallServer = async () => {
    setIsReinstalling(true);
    if (isMinecraft) {
      await apiRequest(`/minecraft/${serverId}/reinstall`, {
        method: 'POST',
        body: JSON.stringify({
          software: reinstallSoftware,
          version: reinstallVersion,
          preserveData: reinstallPreserveData
        })
      });
    } else {
      await apiRequest(`/servers/${serverId}/reinstall`, { method: 'POST' });
    }
    setIsReinstalling(false);
    setShowReinstallModal(false);
    fetchServerDetails();
    fetchConsoleLogs();
  };

  // Delete Server
  const handleDeleteServer = async () => {
    if (deleteConfirmInput !== server?.name) return;
    setIsDeleting(true);
    const res = await apiRequest(`/servers/${serverId}`, { method: 'DELETE' });
    setIsDeleting(false);
    if (res.success) {
      onNavigate('dashboard');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-zinc-400 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-violet-400" />
        <p>Connecting to server container runtime...</p>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="p-12 text-center space-y-4">
        <h2 className="text-lg font-bold text-white">Server not found</h2>
        <button onClick={() => onNavigate('dashboard')} className="px-4 py-2 bg-zinc-800 text-xs text-white rounded-xl">
          Return to Dashboard
        </button>
      </div>
    );
  }

  const fullIp = `${server.primaryIp}:${server.primaryPort}`;
  const isRunning = server.status === 'running';
  const isMinecraft = server.productId === 'prod_minecraft' || server.software.toLowerCase().includes('paper') || server.software.toLowerCase().includes('spigot') || server.software.toLowerCase().includes('forge') || server.software.toLowerCase().includes('minecraft');
  const isPython = server.software.toLowerCase().includes('python') || (server.startup?.entryFile && server.startup.entryFile.endsWith('.py'));
  const isBun = server.software.toLowerCase().includes('bun') || (server.startup?.entryFile && server.startup.entryFile.endsWith('.ts'));
  const isNode = !isMinecraft && !isPython && !isBun;
  const isBot = server.productId === 'prod_bot' || server.software.toLowerCase().includes('node') || isPython || isBun || isNode;

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      
      {/* Top Breadcrumb & Hero Banner with Server-Type Wallpaper */}
      <div className={`relative overflow-hidden p-6 rounded-2xl border transition-all ${
        isMinecraft
          ? 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/30 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]'
          : isPython
          ? 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-blue-950/30 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.08)]'
          : 'bg-gradient-to-r from-zinc-950 via-zinc-900 to-amber-950/20 border-zinc-800'
      }`}>
        {/* Subtle Background Pattern Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-10 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:16px_16px]" />
        {isMinecraft && (
          <div className="absolute top-0 right-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-500/15 via-transparent to-transparent pointer-events-none" />
        )}
        {isPython && (
          <div className="absolute top-0 right-0 w-80 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/15 via-transparent to-transparent pointer-events-none" />
        )}

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <button
              onClick={() => onNavigate('dashboard')}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 mb-2 font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-amber-400" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-extrabold text-white font-sans tracking-tight">{server.name}</h1>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                server.status === 'running'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}>
                <span className={`h-2 w-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                <span className="capitalize">{server.status}</span>
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase border ${
                isMinecraft
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : isPython
                  ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}>
                {isMinecraft ? 'MINECRAFT SERVER' : isPython ? 'PYTHON BOT' : 'NODE.JS BOT'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1.5 flex items-center gap-2">
              <span className="font-medium text-zinc-300">{server.software} ({server.version})</span>
              <span>•</span>
              <span className="font-mono text-zinc-400">Node: {server.location}</span>
            </p>
          </div>

          {/* IP & Power Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-950/90 border border-zinc-800 text-xs font-mono text-zinc-300 shadow-inner">
              <span>IP: <strong className="text-white">{fullIp}</strong></span>
              <button
                onClick={() => handleCopy(fullIp)}
                className="p-1 hover:text-white text-zinc-400 transition-colors"
                title="Copy Server IP"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {!isRunning ? (
                <button
                  onClick={() => handlePowerAction('start')}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>Start Server</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handlePowerAction('restart')}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span>Restart</span>
                  </button>
                  <button
                    onClick={() => handlePowerAction('stop')}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-rose-500/20"
                  >
                    <Square className="h-3.5 w-3.5 fill-white" />
                    <span>Stop</span>
                  </button>
                  <button
                    onClick={() => handlePowerAction('kill')}
                    title="Kill Process Immediately"
                    className="p-2 rounded-xl bg-zinc-900 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-all"
                  >
                    <Skull className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Resource Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>CPU Load</span>
            <Cpu className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="text-base font-bold text-white font-mono">{isRunning ? `${server.cpuUsage}%` : '0%'}</div>
          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${isRunning ? Math.min(100, server.cpuUsage * 2) : 0}%` }} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>RAM Memory</span>
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <div className="text-base font-bold text-white font-mono">
            {isRunning ? `${(server.ramUsageMB / 1024).toFixed(1)}GB` : '0GB'} / {(server.limits.ramMB / 1024).toFixed(0)}GB
          </div>
          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${isRunning ? Math.min(100, (server.ramUsageMB / server.limits.ramMB) * 100) : 0}%` }} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>NVMe Disk</span>
            <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-white font-mono">
            {(server.diskUsageMB / 1024).toFixed(1)}GB / {server.limits.diskGB}GB
          </div>
          <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, (server.diskUsageMB / (server.limits.diskGB * 1024)) * 100)}%` }} />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-1">
          <div className="text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Container Uptime</span>
            <Clock className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-base font-bold text-white font-mono">
            {isRunning ? `${Math.floor(server.uptimeSeconds / 3600)}h ${Math.floor((server.uptimeSeconds % 3600) / 60)}m` : 'Offline'}
          </div>
          <span className="text-[10px] text-zinc-500">Auto-watchdog active</span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 overflow-x-auto pb-2 text-xs">
        <button
          onClick={() => handleTabSelect('console')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'console' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <TerminalIcon className="h-4 w-4" />
          <span>Console Logs</span>
        </button>

        <button
          onClick={() => handleTabSelect('monitoring')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'monitoring' ? 'bg-amber-500 text-zinc-950 font-bold shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <Activity className="h-4 w-4 text-amber-400" />
          <span>Monitoring & Metrics</span>
        </button>

        <button
          onClick={() => handleTabSelect('network')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'network' ? 'bg-amber-500 text-zinc-950 font-bold shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <Globe className="h-4 w-4 text-amber-400" />
          <span>Network, SFTP & Playit</span>
        </button>

        <button
          onClick={() => handleTabSelect('files')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'files' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <Folder className="h-4 w-4" />
          <span>File Manager</span>
        </button>

        {isMinecraft && (
          <button
            onClick={() => handleTabSelect('plugins')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'plugins' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
            }`}
          >
            <Box className="h-4 w-4" />
            <span>Plugins Manager</span>
          </button>
        )}

        {isMinecraft && (
          <button
            onClick={() => handleTabSelect('properties')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'properties' ? 'bg-amber-500 text-zinc-950 font-bold shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
            }`}
          >
            <Sliders className="h-4 w-4 text-amber-400" />
            <span>Server Properties</span>
          </button>
        )}

        {isBot && (
          <button
            onClick={() => handleTabSelect('env')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'env' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
            }`}
          >
            <Key className="h-4 w-4" />
            <span>Environment Variables</span>
          </button>
        )}

        <button
          onClick={() => handleTabSelect('backups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'backups' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <HardDrive className="h-4 w-4" />
          <span>Backups ({backups.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('databases')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'databases' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <Database className="h-4 w-4" />
          <span>Databases ({databases.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('schedules')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'schedules' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Schedules ({schedules.length})</span>
        </button>

        <button
          onClick={() => handleTabSelect('discord')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'discord' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <MessageSquare className="h-4 w-4 text-indigo-400" />
          <span>Discord Bot & Alerts</span>
        </button>

        <button
          onClick={() => handleTabSelect('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'settings' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <SettingsIcon className="h-4 w-4" />
          <span>Startup & Settings</span>
        </button>

        <button
          onClick={() => handleTabSelect('activity')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === 'activity' ? 'bg-violet-600 text-white shadow-md' : 'text-zinc-400 hover:text-white bg-zinc-900/60'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Audit Log</span>
        </button>
      </div>

      {/* TAB 1: CONSOLE LOGS */}
      {activeTab === 'console' && (
        <ServerConsoleTab
          server={server}
          onRefreshServer={fetchServerDetails}
          onPowerAction={handlePowerAction}
        />
      )}

      {/* TAB: MONITORING & REAL-TIME TELEMETRY */}
      {activeTab === 'monitoring' && (
        <ServerMonitoringTab server={server} />
      )}

      {/* TAB: NETWORK, SFTP & PLAYIT.GG */}
      {activeTab === 'network' && (
        <ServerNetworkPlayitTab server={server} onRefreshServer={fetchServerDetails} />
      )}

      {/* TAB 2: FILE MANAGER */}
      {activeTab === 'files' && (

        <div className="space-y-4">
          {isEditingFile ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono text-violet-400">
                  <FileText className="h-4 w-4" />
                  <span>Editing: {selectedFile?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsEditingFile(false)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 text-xs text-zinc-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFile}
                    className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-semibold text-white flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Save File
                  </button>
                </div>
              </div>

              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={18}
                className="w-full rounded-2xl bg-black border border-zinc-800 p-4 font-mono text-xs text-emerald-400 focus:outline-none focus:border-violet-500 leading-relaxed"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Path Breadcrumbs & Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
                <div className="flex items-center gap-1 text-zinc-300">
                  <span className="text-zinc-500">Directory:</span>
                  <button onClick={() => setCurrentPath('/')} className="hover:underline text-violet-400 font-bold">
                    root
                  </button>
                  {currentPath !== '/' && <span>{currentPath}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold flex items-center gap-1.5 shadow-md"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>{isUploading ? 'Uploading...' : 'Upload Files'}</span>
                  </button>

                  <button
                    onClick={() => setShowNewFolderModal(true)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold flex items-center gap-1"
                  >
                    <Folder className="h-3.5 w-3.5 text-amber-400" /> New Folder
                  </button>

                  <button
                    onClick={() => setShowNewFileModal(true)}
                    className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5 text-cyan-400" /> New File
                  </button>

                  <button
                    onClick={() => fetchFiles(currentPath)}
                    className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Upload Progress Bar */}
              {isUploading && (
                <div className="p-3 bg-violet-500/10 border border-violet-500/20 rounded-xl space-y-1.5">
                  <div className="flex justify-between text-xs text-violet-300 font-semibold">
                    <span>Uploading server files...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Files Table */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Last Modified</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {files.map((file, i) => (
                      <tr key={i} className="hover:bg-zinc-900 transition-colors">
                        <td className="p-3">
                          <button
                            onClick={() => handleOpenFile(file)}
                            className="flex items-center gap-2 font-mono text-zinc-200 hover:text-violet-400 transition-colors"
                          >
                            {file.isDir ? (
                              <Folder className="h-4 w-4 text-amber-400 fill-amber-400/10" />
                            ) : file.name.endsWith('.zip') || file.name.endsWith('.tar.gz') ? (
                              <FileArchive className="h-4 w-4 text-rose-400" />
                            ) : (
                              <FileText className="h-4 w-4 text-cyan-400" />
                            )}
                            <span className="font-semibold">{file.name}</span>
                          </button>
                        </td>
                        <td className="p-3 font-mono text-zinc-400">
                          {file.isDir ? 'DIR' : `${(file.size / 1024).toFixed(1)} KB`}
                        </td>
                        <td className="p-3 text-zinc-500">{file.updatedAt}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!file.isDir && (
                              <a
                                href={`/api/v1/servers/${serverId}/files/download?path=${encodeURIComponent(currentPath === '/' ? file.name : `${currentPath}/${file.name}`)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-zinc-400 hover:text-emerald-400"
                                title="Download File"
                              >
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            )}
                            {file.name.endsWith('.zip') && (
                              <button
                                onClick={() => handleDecompress(file.name)}
                                className="p-1 text-zinc-400 hover:text-amber-400"
                                title="Extract ZIP"
                              >
                                <Zap className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                const oldP = currentPath === '/' ? file.name : `${currentPath}/${file.name}`;
                                setRenameOldPath(oldP);
                                setRenameNewPath(oldP);
                                setShowRenameModal(true);
                              }}
                              className="p-1 text-zinc-400 hover:text-violet-400"
                              title="Rename Item"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.name)}
                              className="p-1 text-zinc-400 hover:text-rose-400"
                              title="Delete Item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: MINECRAFT PLUGINS MANAGER */}
      {activeTab === 'plugins' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 gap-3">
            <div className="flex border-b sm:border-b-0 border-zinc-800 gap-4 text-xs font-semibold">
              <button
                onClick={() => setPluginTab('installed')}
                className={`pb-2 transition-colors ${pluginTab === 'installed' ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-white'}`}
              >
                Installed Plugins ({installedPlugins.length})
              </button>
              <button
                onClick={() => setPluginTab('search')}
                className={`pb-2 transition-colors ${pluginTab === 'search' ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-400 hover:text-white'}`}
              >
                Plugin Repository & Search
              </button>
            </div>

            {pluginTab === 'installed' && (
              <label className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer shrink-0 shadow-md transition-all">
                <Upload className="h-3.5 w-3.5" />
                <span>{isUploadingPlugin ? 'Uploading .jar...' : 'Upload Plugin .jar'}</span>
                <input
                  type="file"
                  accept=".jar"
                  onChange={handleUploadPluginJar}
                  disabled={isUploadingPlugin}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {pluginTab === 'installed' ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                    <tr>
                      <th className="p-3">Plugin Name</th>
                      <th className="p-3">File</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {installedPlugins.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-zinc-500 space-y-2">
                          <Box className="h-8 w-8 text-zinc-600 mx-auto" />
                          <p className="font-semibold text-zinc-400">No plugins installed in <code className="text-violet-400 font-mono">plugins/</code> folder yet.</p>
                          <p className="text-xs text-zinc-500">Search the repository or upload a custom <code className="font-mono text-zinc-400">.jar</code> file to get started.</p>
                        </td>
                      </tr>
                    ) : (
                      installedPlugins.map((plug, idx) => (
                        <tr key={idx} className="hover:bg-zinc-900 transition-colors">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            <Box className="h-4 w-4 text-violet-400" />
                            <span>{plug.name}</span>
                          </td>
                          <td className="p-3 font-mono text-zinc-400 text-[11px]">{plug.filename}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              plug.isEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {plug.isEnabled ? 'Enabled' : 'Disabled'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleTogglePlugin(plug.filename!)}
                                className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
                              >
                                {plug.isEnabled ? 'Disable' : 'Enable'}
                              </button>
                              <button
                                onClick={() => handleDeletePlugin(plug.filename!)}
                                className="p-1.5 text-zinc-400 hover:text-rose-400"
                                title="Delete Plugin"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={pluginQuery}
                    onChange={(e) => {
                      setPluginQuery(e.target.value);
                      handleSearchPlugins(e.target.value);
                    }}
                    placeholder="Search LuckPerms, EssentialsX, WorldEdit, GeyserMC, Vault..."
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500"
                  />
                </div>
                <button
                  onClick={() => handleSearchPlugins(pluginQuery)}
                  className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-semibold"
                >
                  Search
                </button>
              </div>

              {installingPluginId && installProgressStep && (
                <div className="p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300 font-mono flex items-center gap-3 animate-pulse">
                  <RefreshCw className="h-4 w-4 animate-spin text-violet-400" />
                  <span>{installProgressStep}</span>
                </div>
              )}

              {isSearchingPlugins ? (
                <div className="p-12 text-center text-xs text-zinc-400 space-y-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-violet-400 mx-auto" />
                  <p>Searching Modrinth and Hangar plugin repositories...</p>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-12 text-center text-zinc-500 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3">
                  <Box className="h-10 w-10 text-zinc-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-zinc-300 text-sm">No compatible plugins found.</p>
                    <p className="text-xs text-zinc-500">Try searching for keywords like "LuckPerms", "Essentials", or "Geyser".</p>
                  </div>
                  <button
                    onClick={() => handleSearchPlugins('LuckPerms')}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 font-semibold"
                  >
                    Retry Default Search
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((item, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-2xl bg-zinc-900 border border-zinc-800 flex justify-between gap-4 hover:border-zinc-700 transition-all cursor-pointer group"
                      onClick={() => setSelectedPluginDetails(item)}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {item.iconUrl ? (
                            <img src={item.iconUrl} alt={item.name} className="h-5 w-5 rounded object-contain shrink-0" />
                          ) : (
                            <Box className="h-4 w-4 text-violet-400 shrink-0" />
                          )}
                          <span className="text-sm font-bold text-white group-hover:text-violet-400 transition-colors truncate">{item.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-violet-500/10 text-violet-400 font-mono shrink-0">{item.provider}</span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{item.description}</p>
                        <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-3">
                          <span>By {item.author}</span>
                          <span>•</span>
                          <span>{(item.downloads || 0).toLocaleString()} downloads</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInstallPlugin(item);
                        }}
                        disabled={installingPluginId === item.id}
                        className="self-center px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-xs shrink-0 shadow-md transition-all"
                      >
                        {installingPluginId === item.id ? 'Installing...' : 'Install'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Plugin Details Modal */}
          {selectedPluginDetails && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {selectedPluginDetails.iconUrl ? (
                      <img src={selectedPluginDetails.iconUrl} alt={selectedPluginDetails.name} className="h-10 w-10 rounded-xl object-contain bg-zinc-950 p-1" />
                    ) : (
                      <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                        <Box className="h-6 w-6" />
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-white">{selectedPluginDetails.name}</h3>
                      <p className="text-xs text-zinc-400 font-mono">Provider: {selectedPluginDetails.provider} • Author: {selectedPluginDetails.author}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPluginDetails(null)}
                    className="p-1 text-zinc-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-4 rounded-2xl border border-zinc-800/80">
                  {selectedPluginDetails.description}
                </p>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[10px]">Total Downloads</span>
                    <p className="text-white font-bold">{(selectedPluginDetails.downloads || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[10px]">Version</span>
                    <p className="text-white font-bold">{selectedPluginDetails.version || 'Latest'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[10px]">Platform</span>
                    <p className="text-white font-bold">{selectedPluginDetails.platform || 'Paper / Spigot'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                    <span className="text-zinc-500 text-[10px]">Category</span>
                    <p className="text-white font-bold">{selectedPluginDetails.category}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
                  {selectedPluginDetails.projectUrl && (
                    <a
                      href={selectedPluginDetails.projectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold"
                    >
                      View Source Project
                    </a>
                  )}
                  <button
                    onClick={() => handleInstallPlugin(selectedPluginDetails)}
                    disabled={installingPluginId === selectedPluginDetails.id}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-xs shadow-md"
                  >
                    {installingPluginId === selectedPluginDetails.id ? 'Installing...' : 'Install Plugin to Server'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: MINECRAFT PROPERTIES */}
      {activeTab === 'properties' && isMinecraft && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-amber-400" /> Minecraft Server Configuration (server.properties)
              </h3>
              <p className="text-xs text-zinc-400">Directly modify and validate in-game gameplay parameters, world seeds, and networking rules.</p>
            </div>
            <button
              onClick={handleSaveMinecraftProps}
              disabled={isSavingProps}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{isSavingProps ? 'Saving Properties...' : 'Save Configuration'}</span>
            </button>
          </div>

          {propsSavedMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Server properties saved! Restart server to apply changes to the live Minecraft instance.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Gameplay Rules */}
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">Gameplay & World Parameters</h4>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Server MOTD (Message of the Day)</label>
                <input
                  type="text"
                  value={mcProps.motd || ''}
                  onChange={(e) => setMcProps({ ...mcProps, motd: e.target.value })}
                  placeholder="§bAetherPanel Minecraft Server"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Gamemode</label>
                  <select
                    value={mcProps.gamemode || 'survival'}
                    onChange={(e) => setMcProps({ ...mcProps, gamemode: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white"
                  >
                    <option value="survival">Survival</option>
                    <option value="creative">Creative</option>
                    <option value="adventure">Adventure</option>
                    <option value="spectator">Spectator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Difficulty</label>
                  <select
                    value={mcProps.difficulty || 'easy'}
                    onChange={(e) => setMcProps({ ...mcProps, difficulty: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white"
                  >
                    <option value="peaceful">Peaceful</option>
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Max Player Slots</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={mcProps.maxPlayers || 20}
                    onChange={(e) => setMcProps({ ...mcProps, maxPlayers: parseInt(e.target.value, 10) || 20 })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Spawn Protection (Blocks)</label>
                  <input
                    type="number"
                    min={0}
                    max={128}
                    value={mcProps.spawnProtection ?? 16}
                    onChange={(e) => setMcProps({ ...mcProps, spawnProtection: parseInt(e.target.value, 10) || 0 })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">World / Level Name</label>
                  <input
                    type="text"
                    value={mcProps.levelName || 'world'}
                    onChange={(e) => setMcProps({ ...mcProps, levelName: e.target.value })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Custom World Seed</label>
                  <input
                    type="text"
                    value={mcProps.levelSeed || ''}
                    onChange={(e) => setMcProps({ ...mcProps, levelSeed: e.target.value })}
                    placeholder="Leave empty for random"
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

            {/* In-Game Flags & Security */}
            <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">In-Game Flags & Authentication</h4>

              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">Online Mode (Mojang Authentication)</div>
                    <div className="text-[11px] text-zinc-400">Enforce official Minecraft account authentication. Disable for offline/cracked.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcProps.onlineMode !== false}
                    onChange={(e) => setMcProps({ ...mcProps, onlineMode: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">PvP Combat (Player vs Player)</div>
                    <div className="text-[11px] text-zinc-400">Allow players to deal damage and engage in combat with each other.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcProps.pvp !== false}
                    onChange={(e) => setMcProps({ ...mcProps, pvp: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">Command Blocks Enabled</div>
                    <div className="text-[11px] text-zinc-400">Enable execution of custom server command blocks.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcProps.enableCommandBlock !== false}
                    onChange={(e) => setMcProps({ ...mcProps, enableCommandBlock: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">Allow Flight (Survival Flight)</div>
                    <div className="text-[11px] text-zinc-400">Prevents auto-kicking players using jetpacks, elytra mods, or flying glitches.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcProps.allowFlight === true}
                    onChange={(e) => setMcProps({ ...mcProps, allowFlight: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-950 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">Enforce White-List</div>
                    <div className="text-[11px] text-zinc-400">Only players listed in whitelist.json can connect to the server.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={mcProps.whiteList === true}
                    onChange={(e) => setMcProps({ ...mcProps, whiteList: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">View Distance (Chunks)</label>
                  <input
                    type="number"
                    min={4}
                    max={32}
                    value={mcProps.viewDistance || 10}
                    onChange={(e) => setMcProps({ ...mcProps, viewDistance: parseInt(e.target.value, 10) || 10 })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Simulation Distance</label>
                  <input
                    type="number"
                    min={4}
                    max={32}
                    value={mcProps.simulationDistance || 8}
                    onChange={(e) => setMcProps({ ...mcProps, simulationDistance: parseInt(e.target.value, 10) || 8 })}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: ENVIRONMENT VARIABLES (.ENV) */}
      {activeTab === 'env' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-violet-400" /> Environment Variables & Secrets (.env)
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Configure runtime environment flags, secret tokens, database credentials, and port bindings.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleSaveEnvVars}
                className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-violet-600/20"
              >
                <Save className="h-4 w-4" /> Save Variables
              </button>
            </div>
          </div>

          {envSavedMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Saved environment variables to server instance & .env file!
            </div>
          )}

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl bg-zinc-950/60 border border-zinc-800/80">
            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider px-1">Quick Add:</span>
            <button
              onClick={() => {
                if (!envVars.some(v => v.key === 'DISCORD_TOKEN')) {
                  setEnvVars([...envVars, { key: 'DISCORD_TOKEN', value: '', isSecret: true, isEnabled: true, description: 'Bot authentication token' }]);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-[11px] text-zinc-300 hover:text-white font-mono transition-colors"
            >
              + DISCORD_TOKEN
            </button>
            <button
              onClick={() => {
                if (!envVars.some(v => v.key === 'CLIENT_ID')) {
                  setEnvVars([...envVars, { key: 'CLIENT_ID', value: '', isSecret: false, isEnabled: true, description: 'Discord Application ID' }]);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-[11px] text-zinc-300 hover:text-white font-mono transition-colors"
            >
              + CLIENT_ID
            </button>
            <button
              onClick={() => {
                if (!envVars.some(v => v.key === 'PREFIX')) {
                  setEnvVars([...envVars, { key: 'PREFIX', value: '!', isSecret: false, isEnabled: true, description: 'Bot command prefix' }]);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-[11px] text-zinc-300 hover:text-white font-mono transition-colors"
            >
              + PREFIX
            </button>
            <button
              onClick={() => {
                if (!envVars.some(v => v.key === 'NODE_ENV')) {
                  setEnvVars([...envVars, { key: 'NODE_ENV', value: 'production', isSecret: false, isEnabled: true, description: 'Runtime environment mode' }]);
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/60 text-[11px] text-zinc-300 hover:text-white font-mono transition-colors"
            >
              + NODE_ENV
            </button>
          </div>

          <div className="space-y-3">
            {envVars.map((item, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
                <div className="flex items-center gap-2 sm:w-1/3">
                  <input
                    type="checkbox"
                    checked={item.isEnabled !== false}
                    onChange={(e) => {
                      const copy = [...envVars];
                      copy[idx].isEnabled = e.target.checked;
                      setEnvVars(copy);
                    }}
                    title="Enable / Disable variable"
                    className="h-4 w-4 rounded bg-zinc-900 border-zinc-700 text-violet-500 focus:ring-violet-500 shrink-0"
                  />
                  <input
                    type="text"
                    value={item.key}
                    onChange={(e) => {
                      const copy = [...envVars];
                      copy[idx].key = e.target.value;
                      setEnvVars(copy);
                    }}
                    placeholder="KEY_NAME"
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-mono text-violet-300 focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div className="relative flex-1">
                  <input
                    type={showEnvValues[idx] || (!item.isSecret && !/token|secret|key|password|auth/i.test(item.key)) ? 'text' : 'password'}
                    value={item.value}
                    onChange={(e) => {
                      const copy = [...envVars];
                      copy[idx].value = e.target.value;
                      setEnvVars(copy);
                    }}
                    placeholder="Value..."
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 pl-3 pr-10 py-1.5 text-xs font-mono text-emerald-400 focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEnvValues(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className="absolute right-2.5 top-2 text-zinc-500 hover:text-white"
                    title={showEnvValues[idx] ? 'Hide value' : 'Reveal value'}
                  >
                    {showEnvValues[idx] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const copy = [...envVars];
                      copy[idx].isSecret = !copy[idx].isSecret;
                      setEnvVars(copy);
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                      item.isSecret || /token|secret|key|password|auth/i.test(item.key)
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                    }`}
                    title="Mark as sensitive secret"
                  >
                    {item.isSecret || /token|secret|key|password|auth/i.test(item.key) ? 'SECRET' : 'PLAIN'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnvVars(envVars.filter((_, i) => i !== idx))}
                    className="p-1.5 text-zinc-500 hover:text-rose-400 transition-colors"
                    title="Delete variable"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}

            <div className="pt-2">
              <button
                onClick={() => setEnvVars([...envVars, { key: '', value: '', isSecret: false, isEnabled: true }])}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Variable
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BACKUPS */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Archive className="h-5 w-5 text-amber-400" /> Real Server Filesystem Backups
              </h3>
              <p className="text-xs text-zinc-400">Create real ZIP filesystem snapshots, restore previous states, or download compressed archives.</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={backupName}
                onChange={(e) => setBackupName(e.target.value)}
                placeholder="Backup label (optional)"
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white w-full sm:w-48"
              />
              <button
                onClick={handleCreateBackup}
                disabled={isCreatingBackup}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-xs shrink-0 flex items-center gap-1.5 shadow-md"
              >
                <Archive className="h-4 w-4" />
                {isCreatingBackup ? 'Snapshotting...' : 'Create Backup'}
              </button>
            </div>
          </div>

          {backups.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <Archive className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-zinc-300">No Backups Created Yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Create a manual backup snapshot above or schedule automated recurring backups in the Schedules tab.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {backups.map((b) => (
                <div key={b.id} className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                        <span>{b.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700 uppercase">
                          {b.type || 'manual'}
                        </span>
                      </h4>
                      <span className="text-[11px] text-zinc-400 font-mono mt-0.5 block">
                        {new Date(b.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        b.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        b.status === 'CREATING' || b.status === 'RESTORING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse' :
                        b.status === 'FAILED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>
                        {b.status}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {b.sizeMB} MB
                      </span>
                    </div>
                  </div>

                  <div className="text-[10px] font-mono text-zinc-500 truncate bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 flex items-center justify-between">
                    <span className="truncate">SHA-256: {b.checksum || 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}</span>
                  </div>

                  {b.status === 'FAILED' && b.errorDetails && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 font-mono">
                      <strong>Error:</strong> {b.errorDetails}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/v1/servers/${serverId}/backups/${b.id}/download`}
                        download
                        className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                      <button
                        onClick={() => setRestoreModalBackup(b)}
                        disabled={b.status !== 'COMPLETED'}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 disabled:opacity-40 text-xs font-semibold flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Restore
                      </button>
                    </div>

                    <button
                      onClick={() => handleDeleteBackup(b.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Restore Confirmation Modal */}
          {restoreModalBackup && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-zinc-950 border border-amber-500/30 p-6 rounded-3xl space-y-4 shadow-2xl">
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <AlertCircle className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Restore Server Backup</h3>
                    <p className="text-xs text-zinc-400 font-mono">{restoreModalBackup.name}</p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
                  <p className="font-bold">⚠️ Warning: Active Files Replacement</p>
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    Restoring this backup will stop the server and extract all backup contents directly into your server root filesystem directory, replacing existing server configuration and world files.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setRestoreModalBackup(null)}
                    disabled={isRestoring}
                    className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 font-semibold rounded-xl hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRestoreBackup(restoreModalBackup.id)}
                    disabled={isRestoring}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl shadow-lg flex items-center gap-2"
                  >
                    <RefreshCw className={`h-4 w-4 ${isRestoring ? 'animate-spin' : ''}`} />
                    {isRestoring ? 'Restoring Backup...' : 'Confirm & Restore Now'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: DATABASES */}
      {activeTab === 'databases' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white">Managed MySQL / Postgres Databases</h3>
              <p className="text-xs text-zinc-400">Isolated database schemas for LuckPerms, Vault, CoreProtect, or custom bot persistence.</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                value={dbName}
                onChange={(e) => setDbName(e.target.value)}
                placeholder="Database name"
                className="rounded-xl bg-zinc-950 border border-zinc-800 px-3.5 py-2 text-xs text-white"
              />
              <button
                onClick={handleCreateDatabase}
                disabled={isCreatingDb}
                className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shrink-0"
              >
                {isCreatingDb ? 'Provisioning...' : 'New Database'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {databases.map((db) => (
              <div key={db.id} className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-white font-mono">{db.name}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                    {db.dbType}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs font-mono bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-zinc-300">
                  <div>Host: <strong className="text-white">{db.host}</strong></div>
                  <div>Port: <strong className="text-white">{db.port}</strong></div>
                  <div>User: <strong className="text-white">{db.username}</strong></div>
                  <div>Password: <strong className="text-violet-400 font-bold">••••••••••••</strong></div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleCopy(`mysql://${db.username}:secret@${db.host}:${db.port}/${db.name}`)}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:text-white"
                  >
                    Copy Connection URI
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: SCHEDULES / CRON */}
      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-400" /> Automated Cron Schedules & Tasks
              </h3>
              <p className="text-xs text-zinc-400">Automate server restarts, world backups, or in-game console commands.</p>
            </div>
            <button
              onClick={() => setShowNewSchedModal(true)}
              className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md"
            >
              <Plus className="h-4 w-4" /> New Schedule
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3">
              <Clock className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-bold text-zinc-300">No Automated Schedules Active</p>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Create custom recurring schedules for nightly reboots, hourly backups, or automated server commands.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{s.name}</span>
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20 font-bold">
                        {s.cronExpression}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 uppercase">
                        {s.scheduleType || 'custom'}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 flex items-center gap-3">
                      <span>Action: <strong className="text-amber-400 uppercase font-mono">{s.action}</strong> {s.payload && `("${s.payload}")`}</span>
                      {s.nextRunAt && (
                        <span className="text-zinc-500 text-[11px] font-mono">Next: {new Date(s.nextRunAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end border-t sm:border-t-0 border-zinc-800/80 pt-3 sm:pt-0">
                    <button
                      onClick={() => handleToggleSchedule(s.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono border transition-all ${
                        s.isEnabled
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                      }`}
                    >
                      {s.isEnabled ? 'Enabled' : 'Disabled'}
                    </button>

                    <button
                      onClick={() => handleRunScheduleNow(s.id)}
                      disabled={runningSchedId === s.id}
                      className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${runningSchedId === s.id ? 'animate-spin' : ''}`} /> Run Now
                    </button>

                    <button
                      onClick={() => handleDeleteSchedule(s.id)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New Schedule Modal */}
          {showNewSchedModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4 shadow-2xl">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" /> Create Automated Task
                </h3>
                
                <div>
                  <label className="block text-xs text-zinc-300 mb-1">Task Name</label>
                  <input
                    type="text"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    placeholder="e.g. Daily Restart @ 4AM"
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Frequency / Type</label>
                    <select
                      value={schedType}
                      onChange={(e: any) => setSchedType(e.target.value)}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-medium"
                    >
                      <option value="daily">Daily Task</option>
                      <option value="hourly">Hourly Interval</option>
                      <option value="weekly">Weekly Task</option>
                      <option value="custom_cron">Custom Cron</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Action Type</label>
                    <select
                      value={schedAction}
                      onChange={(e: any) => setSchedAction(e.target.value)}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-medium"
                    >
                      <option value="restart">Server Restart</option>
                      <option value="backup">Create Backup</option>
                      <option value="start">Start Server</option>
                      <option value="stop">Stop Server</option>
                      <option value="command">Send Console Command</option>
                    </select>
                  </div>
                </div>

                {schedType === 'daily' && (
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Time of Day (HH:MM)</label>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                    />
                  </div>
                )}

                {schedType === 'hourly' && (
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Interval (Every X Hours)</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={schedIntervalHours}
                      onChange={(e) => setSchedIntervalHours(e.target.value)}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                    />
                  </div>
                )}

                {schedType === 'weekly' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-300 mb-1">Day of Week</label>
                      <select
                        value={schedDayOfWeek}
                        onChange={(e) => setSchedDayOfWeek(e.target.value)}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                      >
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                        <option value="0">Sunday</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-300 mb-1">Time of Day</label>
                      <input
                        type="time"
                        value={schedTime}
                        onChange={(e) => setSchedTime(e.target.value)}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}

                {schedType === 'custom_cron' && (
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Cron Expression</label>
                    <input
                      type="text"
                      value={schedCron}
                      onChange={(e) => setSchedCron(e.target.value)}
                      placeholder="0 4 * * *"
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                    />
                  </div>
                )}

                {schedAction === 'command' && (
                  <div>
                    <label className="block text-xs text-zinc-300 mb-1">Command String</label>
                    <input
                      type="text"
                      value={schedPayload}
                      onChange={(e) => setSchedPayload(e.target.value)}
                      placeholder="say Server is restarting in 5 minutes!"
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                  <button onClick={() => setShowNewSchedModal(false)} className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 font-semibold rounded-xl hover:text-white">
                    Cancel
                  </button>
                  <button onClick={handleCreateSchedule} className="px-5 py-2 bg-violet-600 hover:bg-violet-500 text-xs text-white font-bold rounded-xl shadow-md">
                    Save Schedule
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 8: STARTUP & SETTINGS */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Section 1: Server Configuration & General Settings */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4 text-violet-400" /> Server Configuration & Runtime Profile
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Tune startup parameters, memory heap bounds, runtime versions, and failure recovery.
                </p>
              </div>
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-md shadow-violet-600/20 shrink-0 flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" /> Save Configuration
              </button>
            </div>

            {settingsSaved && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> Server startup profile, memory flags, and recovery rules updated!
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Server Name
                </label>
                <input
                  type="text"
                  value={serverNameEdit}
                  onChange={(e) => setServerNameEdit(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  {isMinecraft ? 'Runtime Build / Java Version' : 'Runtime Engine & Version'}
                </label>
                <select
                  value={javaVersion}
                  onChange={(e) => setJavaVersion(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  {isMinecraft ? (
                    <>
                      <option value="Java 25">Java 25 (Recommended for Paper 26.1+)</option>
                      <option value="Java 21">Java 21 (Recommended for 1.20+)</option>
                      <option value="Java 17">Java 17 (LTS for 1.18 - 1.19)</option>
                      <option value="Java 11">Java 11 (Legacy 1.16 - 1.17)</option>
                      <option value="Java 8">Java 8 (Legacy 1.8 - 1.12)</option>
                    </>
                  ) : (
                    <>
                      <option value="Node.js 20">Node.js 20 LTS (Recommended)</option>
                      <option value="Node.js 22">Node.js 22 Current</option>
                      <option value="Python 3.11">Python 3.11 LTS</option>
                      <option value="Python 3.12">Python 3.12</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Preflight & Process Diagnostics Panel */}
            <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/60 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Runtime Preflight & Process Diagnostics</span>
                </div>
                <button
                  onClick={runPreflightCheck}
                  disabled={isCheckingPreflight}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px] font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${isCheckingPreflight ? 'animate-spin' : ''}`} />
                  <span>{isCheckingPreflight ? 'Checking...' : 'Run Preflight Check'}</span>
                </button>
              </div>

              {preflightResult && (
                <div className={`p-3 rounded-lg text-xs font-mono flex items-start gap-2.5 ${
                  preflightResult.ok
                    ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                }`}>
                  {preflightResult.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
                  <div>
                    <div className="font-bold">{preflightResult.ok ? 'PREFLIGHT PASSED' : `PREFLIGHT FAILED [${preflightResult.code}]`}</div>
                    <div className="text-[11px] opacity-90">{preflightResult.ok ? 'All runtime binaries, allocations, ports, and permissions are verified and ready.' : preflightResult.reason}</div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Process PID</div>
                  <div className="font-mono font-bold text-white mt-1">{server?.startup?.pid || 'None (Inactive)'}</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Crash Restarts</div>
                  <div className="font-mono font-bold text-amber-400 mt-1">{server?.startup?.crashCount || 0} / {startupConfig.maxCrashRestarts || 5}</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Last Started</div>
                  <div className="font-mono text-zinc-300 text-[11px] mt-1 truncate">{server?.startup?.lastStartedAt ? new Date(server.startup.lastStartedAt).toLocaleTimeString() : 'N/A'}</div>
                </div>
                <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] uppercase font-bold text-zinc-400">Last Stopped</div>
                  <div className="font-mono text-zinc-300 text-[11px] mt-1 truncate">{server?.startup?.lastStoppedAt ? new Date(server.startup.lastStoppedAt).toLocaleTimeString() : 'N/A'}</div>
                </div>
              </div>

              {server?.startup?.lastCrashReason && (
                <div className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span><strong>Last Crash ({server.startup.lastCrashAt ? new Date(server.startup.lastCrashAt).toLocaleTimeString() : 'Recent'}):</strong> {server.startup.lastCrashReason}</span>
                </div>
              )}
            </div>

            {/* Startup Command Dynamic Generator & Preview */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                  <TerminalIcon className="h-3.5 w-3.5 text-violet-400" /> Compiled Startup Execution Command
                </span>
                <span className="text-[10px] font-mono text-zinc-400 font-medium uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-cyan-400">
                  {isMinecraft ? 'Minecraft Java VM' : isPython ? 'Python Runtime' : isBun ? 'Bun Engine' : 'Node.js Runtime'}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800/80 font-mono text-xs text-emerald-400 break-all select-all">
                {isMinecraft
                  ? `java -Xms${startupConfig.xmsMB || 128}M -Xmx${startupConfig.xmxMB || server?.limits?.ramMB || 1024}M ${startupFlags} -jar ${startupConfig.serverJar || 'server.jar'} ${startupConfig.nogui !== false ? 'nogui' : ''}`
                  : isPython
                  ? `${startupConfig.pythonExecutable || 'python3'} ${startupConfig.pythonUnbuffered !== false ? '-u' : ''} ${startupFlags} ${startupConfig.entryFile || 'main.py'}`
                  : isBun
                  ? `bun run ${startupFlags} ${startupConfig.entryFile || 'index.ts'}`
                  : `node --max-old-space-size=${server?.limits?.ramMB || 512} ${startupConfig.nodeOptions || ''} ${startupFlags} ${startupConfig.entryFile || 'index.js'}`
                }
              </div>
            </div>

            {/* Runtime-Specific Configuration Parameters */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-zinc-800/60 pb-2">
                <Sliders className="h-3.5 w-3.5 text-amber-400" />
                {isMinecraft ? 'Minecraft Java & Heap Allocation' : isPython ? 'Python Interpreter & Entry Settings' : isBun ? 'Bun Runtime Settings' : 'Node.js V8 Engine & Entry Settings'}
              </h4>

              {/* 1. MINECRAFT CONFIGURATION */}
              {isMinecraft && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Initial Heap Allocation (-Xms MB)
                      </label>
                      <input
                        type="number"
                        min={64}
                        step={64}
                        value={startupConfig.xmsMB || 128}
                        onChange={(e) => setStartupConfig({ ...startupConfig, xmsMB: parseInt(e.target.value, 10) || 128 })}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Max Heap Allocation (-Xmx MB)
                      </label>
                      <input
                        type="number"
                        min={256}
                        step={128}
                        max={server?.limits?.ramMB || 8192}
                        value={startupConfig.xmxMB || server?.limits?.ramMB || 1024}
                        onChange={(e) => setStartupConfig({ ...startupConfig, xmxMB: parseInt(e.target.value, 10) || 1024 })}
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Server JAR File Name
                      </label>
                      <input
                        type="text"
                        value={startupConfig.serverJar || 'server.jar'}
                        onChange={(e) => setStartupConfig({ ...startupConfig, serverJar: e.target.value })}
                        placeholder="server.jar"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Custom JVM Optimization Flags
                    </label>
                    <textarea
                      value={startupFlags}
                      onChange={(e) => setStartupFlags(e.target.value)}
                      placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
                      rows={2}
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-violet-300 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 2. PYTHON CONFIGURATION */}
              {isPython && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Application Entry File (.py)
                      </label>
                      <input
                        type="text"
                        value={startupConfig.entryFile || 'main.py'}
                        onChange={(e) => setStartupConfig({ ...startupConfig, entryFile: e.target.value })}
                        placeholder="main.py or bot.py"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Python Interpreter Binary
                      </label>
                      <input
                        type="text"
                        value={startupConfig.pythonExecutable || 'python3'}
                        onChange={(e) => setStartupConfig({ ...startupConfig, pythonExecutable: e.target.value })}
                        placeholder="python3"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Custom Command Arguments & Flags
                    </label>
                    <input
                      type="text"
                      value={startupFlags}
                      onChange={(e) => setStartupFlags(e.target.value)}
                      placeholder="-u"
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-violet-300 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 3. BUN CONFIGURATION */}
              {isBun && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                      Application Entry File (.ts or .js)
                    </label>
                    <input
                      type="text"
                      value={startupConfig.entryFile || 'index.ts'}
                      onChange={(e) => setStartupConfig({ ...startupConfig, entryFile: e.target.value })}
                      placeholder="index.ts or main.ts"
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Custom Bun Command Flags
                    </label>
                    <input
                      type="text"
                      value={startupFlags}
                      onChange={(e) => setStartupFlags(e.target.value)}
                      placeholder="--watch"
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-violet-300 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* 4. NODE.JS CONFIGURATION */}
              {isNode && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Application Entry File (.js)
                      </label>
                      <input
                        type="text"
                        value={startupConfig.entryFile || 'index.js'}
                        onChange={(e) => setStartupConfig({ ...startupConfig, entryFile: e.target.value })}
                        placeholder="index.js or app.js"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                        Node Engine Options & V8 Flags
                      </label>
                      <input
                        type="text"
                        value={startupConfig.nodeOptions || ''}
                        onChange={(e) => setStartupConfig({ ...startupConfig, nodeOptions: e.target.value })}
                        placeholder="--max-old-space-size=1024"
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Custom Command Arguments & Flags
                    </label>
                    <input
                      type="text"
                      value={startupFlags}
                      onChange={(e) => setStartupFlags(e.target.value)}
                      placeholder="--experimental-modules"
                      className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs font-mono text-violet-300 focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lifecycle, Auto-Start & Crash Recovery */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-4">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 border-b border-zinc-800/60 pb-2">
                <Shield className="h-3.5 w-3.5 text-blue-400" /> Automation & Crash Recovery Policies
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">Auto-Start on Panel Boot</div>
                    <div className="text-[11px] text-zinc-400">Start container automatically when AetherPanel daemon starts.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={startupConfig.autoStartOnBoot === true}
                    onChange={(e) => setStartupConfig({ ...startupConfig, autoStartOnBoot: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-violet-500 focus:ring-violet-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-white">Auto-Start on Node Reconnect</div>
                    <div className="text-[11px] text-zinc-400">Restart server when its host node daemon reconnects.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={startupConfig.autoStartOnNodeReconnect === true}
                    onChange={(e) => setStartupConfig({ ...startupConfig, autoStartOnNodeReconnect: e.target.checked })}
                    className="h-4 w-4 rounded bg-zinc-800 border-zinc-700 text-violet-500 focus:ring-violet-500"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Auto-Restart Policy
                  </label>
                  <select
                    value={startupConfig.autoRestartPolicy || 'on_crash'}
                    onChange={(e) => setStartupConfig({ ...startupConfig, autoRestartPolicy: e.target.value as any })}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white"
                  >
                    <option value="on_crash">Restart on Crash (Exit != 0)</option>
                    <option value="always">Always Restart (Any Exit)</option>
                    <option value="never">Never Auto-Restart</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Max Crash Restarts (15 min window)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={startupConfig.maxCrashRestarts || 5}
                    onChange={(e) => setStartupConfig({ ...startupConfig, maxCrashRestarts: parseInt(e.target.value, 10) || 5 })}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                    Restart Delay (Seconds)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={startupConfig.crashRestartDelaySeconds || 5}
                    onChange={(e) => setStartupConfig({ ...startupConfig, crashRestartDelaySeconds: parseInt(e.target.value, 10) || 5 })}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>

            {/* Dependency Installer for Bots */}
            {isBot && (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-2">
                      <Package className="h-4 w-4 text-violet-400" /> Package Dependency Manager
                    </h4>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Executes <code className="font-mono text-zinc-300">npm install</code> or <code className="font-mono text-zinc-300">pip install -r requirements.txt</code> in the server root.
                    </p>
                  </div>
                  <button
                    onClick={handleInstallDependencies}
                    disabled={isInstallingDeps}
                    className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md flex items-center gap-2 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 ${isInstallingDeps ? 'animate-spin' : ''}`} />
                    <span>{isInstallingDeps ? 'Installing Packages...' : 'Install Dependencies'}</span>
                  </button>
                </div>

                {depsInstallResult && (
                  <div className={`p-3 rounded-lg text-xs font-medium flex items-center gap-2 ${
                    depsInstallResult.success ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                  }`}>
                    {depsInstallResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                    <span>{depsInstallResult.message} Check Console Logs for full terminal output.</span>
                  </div>
                )}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={handleSaveSettings}
                className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs shadow-md flex items-center gap-1.5"
              >
                <Save className="h-4 w-4" /> Save Configuration
              </button>
            </div>
          </div>

          {/* Reinstall & Danger Zone */}
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 space-y-4">
            <h3 className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Danger Zone
            </h3>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
              <div>
                <div className="text-sm font-bold text-white">Reinstall Server</div>
                <div className="text-xs text-zinc-400">Wipes files and re-applies default templates for the current software.</div>
              </div>
              <button
                onClick={() => setShowReinstallModal(true)}
                className="px-4 py-2 rounded-xl bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/30 font-semibold text-xs shrink-0"
              >
                Reinstall Server
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950 border border-zinc-800">
              <div>
                <div className="text-sm font-bold text-rose-400">Delete Server</div>
                <div className="text-xs text-zinc-400">Permanently removes this server container, allocations, backups, and databases.</div>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shrink-0 shadow-md shadow-rose-600/20"
              >
                Delete Server
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DISCORD INTEGRATION */}
      {activeTab === 'discord' && (
        <ServerDiscordTab serverId={server.id} serverName={server.name} />
      )}

      {/* TAB 9: AUDIT LOG */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-mono text-[11px]">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Details</th>
                  <th className="p-3">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {activities.map((a) => (
                  <tr key={a.id} className="hover:bg-zinc-900 transition-colors">
                    <td className="p-3 font-semibold text-white">{a.username}</td>
                    <td className="p-3 font-mono text-violet-400">{a.action}</td>
                    <td className="p-3 text-zinc-300">{a.details}</td>
                    <td className="p-3 text-zinc-500">{a.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}

      {/* New File Modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">Create New File</h3>
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="e.g. server.properties, index.js"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewFileModal(false)} className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                Cancel
              </button>
              <button onClick={handleCreateFile} className="px-4 py-2 bg-violet-600 text-xs text-white font-semibold rounded-xl">
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">Create New Folder</h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. plugins, worlds, scripts"
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                Cancel
              </button>
              <button onClick={handleCreateFolder} className="px-4 py-2 bg-violet-600 text-xs text-white font-semibold rounded-xl">
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-base font-bold text-white">Rename File / Folder</h3>
            <input
              type="text"
              value={renameNewPath}
              onChange={(e) => setRenameNewPath(e.target.value)}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRenameModal(false)} className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                Cancel
              </button>
              <button onClick={handleRenameItem} className="px-4 py-2 bg-violet-600 text-xs text-white font-semibold rounded-xl">
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reinstall Modal */}
      {showReinstallModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" /> Reinstall & Change Software
              </h3>
              <button
                onClick={() => setShowReinstallModal(false)}
                className="p-1 text-zinc-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {isMinecraft ? (
              <div className="space-y-4">
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Switch server software or Minecraft version for <strong className="text-white font-mono">{server.name}</strong>. Real official JARs will be downloaded from upstream APIs.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Target Software</label>
                  <select
                    value={reinstallSoftware}
                    onChange={(e) => {
                      setReinstallSoftware(e.target.value);
                      loadReinstallVersions(e.target.value);
                    }}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs text-white"
                  >
                    <option value="Paper">Paper (High Performance & Plugins)</option>
                    <option value="Purpur">Purpur (Extremely Optimized Paper Fork)</option>
                    <option value="Vanilla">Vanilla Mojang (Official Snapshot / Release)</option>
                    <option value="Fabric">Fabric (Modern Lightweight Modded)</option>
                    <option value="Spigot">Spigot (Classic Plugin Engine)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span>Minecraft Version</span>
                    {isLoadingReinstallVersions && <span className="text-[10px] text-amber-400 font-mono">Fetching latest builds...</span>}
                  </label>
                  <select
                    value={reinstallVersion}
                    onChange={(e) => setReinstallVersion(e.target.value)}
                    disabled={isLoadingReinstallVersions}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-2 text-xs font-mono text-white"
                  >
                    {reinstallVersionsList.length > 0 ? (
                      reinstallVersionsList.map((ver) => (
                        <option key={ver} value={ver}>
                          {ver} {ver === reinstallVersionsList[0] ? '(Latest Stable)' : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1.21.4">1.21.4 (Latest)</option>
                        <option value="1.21.3">1.21.3</option>
                        <option value="1.21.1">1.21.1</option>
                        <option value="1.20.4">1.20.4</option>
                        <option value="1.20.1">1.20.1</option>
                        <option value="1.19.4">1.19.4</option>
                        <option value="1.18.2">1.18.2</option>
                        <option value="1.16.5">1.16.5</option>
                        <option value="1.12.2">1.12.2</option>
                      </>
                    )}
                  </select>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reinstallPreserveData}
                    onChange={(e) => setReinstallPreserveData(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-white">Preserve World Data & Plugin Configs</div>
                    <div className="text-[11px] text-zinc-400">Keeps existing worlds, player inventory data, and configs while replacing server.jar with the new build.</div>
                  </div>
                </label>
              </div>
            ) : (
              <p className="text-xs text-zinc-300 leading-relaxed">
                Are you sure you want to reinstall <strong>{server.name}</strong>? This process will stop the server, reset files to defaults, and re-apply fresh server templates.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowReinstallModal(false)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs text-zinc-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleReinstallServer}
                disabled={isReinstalling}
                className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-xs text-black font-bold rounded-xl shadow-lg shadow-amber-500/10 disabled:opacity-50"
              >
                {isReinstalling ? 'Downloading & Provisioning...' : 'Confirm Reinstall'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Server Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950 border border-rose-500/30 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-rose-400 flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-rose-500" /> Delete Server Permanently
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              This action cannot be undone. To confirm deletion, please type the exact server name <strong className="text-white font-mono">{server.name}</strong> below:
            </p>
            <input
              type="text"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder={server.name}
              className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white font-mono"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl">
                Cancel
              </button>
              <button
                onClick={handleDeleteServer}
                disabled={deleteConfirmInput !== server.name || isDeleting}
                className={`px-4 py-2 rounded-xl text-xs text-white font-semibold transition-all ${
                  deleteConfirmInput === server.name ? 'bg-rose-600 hover:bg-rose-500' : 'bg-rose-900/50 text-zinc-500 cursor-not-allowed'
                }`}
              >
                {isDeleting ? 'Deleting...' : 'Delete Server'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
