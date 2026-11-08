import React, { useState, useEffect } from 'react';
import {
  Terminal, Box, Copy, Check, Save, RotateCw, GitBranch, FolderGit2,
  Package, User, Key, Eye, EyeOff, Play, ShieldAlert, CheckCircle2,
  Sparkles, RefreshCw, Layers, Sliders, ExternalLink
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Server } from '../../types';

interface ServerStartupTabProps {
  server: Server;
  onRefreshServer?: () => void;
}

interface EggVariable {
  key: string;
  name: string;
  envName: string;
  description: string;
  type: 'text' | 'boolean' | 'password';
  defaultValue: string;
  value: string;
  placeholder?: string;
}

export const ServerStartupTab: React.FC<ServerStartupTabProps> = ({ server, onRefreshServer }) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Runtime detection
  const isMinecraft =
    /minecraft|paper|purpur|velocity|bungeecord|forge|fabric|spigot/i.test(server.software || '') ||
    (server.productId || '').includes('minecraft');
  const isPython = /python/i.test(server.software || '');
  const isBun = /bun/i.test(server.software || '');
  const isNode = !isMinecraft && !isPython && !isBun;

  // Selected Docker image / runtime version
  const resolveInitialImage = React.useCallback(() => {
    const rawVer = server.version || '';
    if (isMinecraft) {
      if (rawVer.startsWith('Java ')) return rawVer;
      return rawVer ? `Java ${rawVer} OpenJDK` : 'Java 21 OpenJDK';
    }
    if (isPython) {
      if (rawVer.startsWith('Python ')) return rawVer;
      return rawVer ? `Python ${rawVer}` : 'Python 3.13 (Latest)';
    }
    if (isBun) {
      if (rawVer.startsWith('Bun ')) return rawVer;
      return rawVer ? `Bun ${rawVer}` : 'Bun 1.2 (Latest)';
    }
    if (rawVer.startsWith('Node')) return rawVer;
    return rawVer ? `Node ${rawVer}` : 'Node 22 (LTS)';
  }, [server.version, isMinecraft, isPython, isBun]);

  const [selectedImage, setSelectedImage] = useState<string>(resolveInitialImage);

  useEffect(() => {
    setSelectedImage(resolveInitialImage());
  }, [resolveInitialImage]);

  // Egg variables matching Pterodactyl Minecraft Egg vs Bot Hosting
  const [variables, setVariables] = useState<EggVariable[]>(() => {
    if (isMinecraft) {
      return [
        {
          key: 'SERVER_JARFILE',
          name: 'Server Jar File',
          envName: 'SERVER_JARFILE',
          description: 'The name of the executable jar file to run (e.g., server.jar, paper.jar, purpur.jar).',
          type: 'text',
          defaultValue: server.startup?.serverJar || 'server.jar',
          value: server.startup?.serverJar || 'server.jar',
          placeholder: 'server.jar'
        },
        {
          key: 'MINECRAFT_VERSION',
          name: 'Minecraft Version',
          envName: 'MINECRAFT_VERSION',
          description: 'The Minecraft game version to execute. Use "latest" or specific version like 1.21.4, 1.20.4, 1.16.5.',
          type: 'text',
          defaultValue: server.version || 'latest',
          value: server.version || 'latest',
          placeholder: 'latest'
        },
        {
          key: 'BUILD_NUMBER',
          name: 'Build Number',
          envName: 'BUILD_NUMBER',
          description: 'The build number for the chosen server software jar, or "latest" to pull current stable release.',
          type: 'text',
          defaultValue: 'latest',
          value: 'latest',
          placeholder: 'latest'
        },
        {
          key: 'JAVA_VERSION',
          name: 'Java Environment Version',
          envName: 'JAVA_VERSION',
          description: 'OpenJDK runtime specification. Java 21 for 1.20.5+, Java 17 for 1.18+, Java 11 for 1.16, Java 8 for 1.8-1.12.',
          type: 'text',
          defaultValue: '21',
          value: '21',
          placeholder: '21'
        },
        {
          key: 'JVM_FLAGS',
          name: 'JVM & Aikar Flags',
          envName: 'JVM_FLAGS',
          description: 'Optimized G1GC flags for Minecraft server performance and garbage collection tuning.',
          type: 'text',
          defaultValue: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch',
          value: server.startup?.jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch',
          placeholder: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled'
        },
        {
          key: 'ONLINE_MODE',
          name: 'Online Mode Authentication',
          envName: 'ONLINE_MODE',
          description: 'Verify player accounts with Mojang session servers. Set to Disabled (0) for offline/cracked networks.',
          type: 'boolean',
          defaultValue: '1',
          value: '1'
        },
        {
          key: 'SERVER_PORT',
          name: 'Primary Port',
          envName: 'SERVER_PORT',
          description: 'Allocated game port for incoming player socket connections.',
          type: 'text',
          defaultValue: String(server.primaryPort || 25565),
          value: String(server.primaryPort || 25565),
          placeholder: '25565'
        },
        {
          key: 'VIEW_DISTANCE',
          name: 'View Distance',
          envName: 'VIEW_DISTANCE',
          description: 'Server chunk render and sync distance radius (default 10).',
          type: 'text',
          defaultValue: '10',
          value: '10',
          placeholder: '10'
        }
      ];
    }

    // Bot Hosting runtime variables (Python, Node.js, Bun)
    return [
      {
        key: 'GIT_ADDRESS',
        name: 'Git Repo Address',
        envName: 'GIT_ADDRESS',
        description: 'Git repository to clone on startup (e.g., https://github.com/username/bot-repo).',
        type: 'text',
        defaultValue: '',
        value: '',
        placeholder: 'https://github.com/username/repo'
      },
      {
        key: 'BRANCH',
        name: 'Install Branch',
        envName: 'BRANCH',
        description: 'The git branch to checkout and run.',
        type: 'text',
        defaultValue: 'main',
        value: 'main',
        placeholder: 'main'
      },
      {
        key: 'USER_UPLOAD',
        name: 'User Uploaded Files',
        envName: 'USER_UPLOAD',
        description: 'Skip git cloning if you manually uploaded source files via File Manager or SFTP. 0 = clone, 1 = skip.',
        type: 'boolean',
        defaultValue: '0',
        value: '0'
      },
      {
        key: 'AUTO_UPDATE',
        name: 'Auto Update',
        envName: 'AUTO_UPDATE',
        description: 'Execute git pull origin on every container startup.',
        type: 'boolean',
        defaultValue: '0',
        value: '0'
      },
      {
        key: isPython ? 'PYTHON_PACKAGES' : isBun ? 'BUN_PACKAGES' : 'NODE_PACKAGES',
        name: isPython ? 'Additional Python packages' : isBun ? 'Additional Bun packages' : 'Additional Node packages',
        envName: isPython ? 'PYTHON_PACKAGES' : isBun ? 'BUN_PACKAGES' : 'NODE_PACKAGES',
        description: 'Install additional packages on boot. Space separated.',
        type: 'text',
        defaultValue: '',
        value: '',
        placeholder: isPython ? 'requests discord.py pyyaml' : 'express dotenv discord.js'
      },
      {
        key: 'USERNAME',
        name: 'Git Username',
        envName: 'USERNAME',
        description: 'Username for private git repository cloning.',
        type: 'text',
        defaultValue: '',
        value: '',
        placeholder: 'git-username'
      },
      {
        key: 'ACCESS_TOKEN',
        name: 'Git Access Token',
        envName: 'ACCESS_TOKEN',
        description: 'Personal Access Token (PAT) for private repository authentication.',
        type: 'password',
        defaultValue: '',
        value: '',
        placeholder: 'ghp_xxxxxxxxxxxx'
      },
      {
        key: isPython ? 'UNINSTALL_PACKAGES' : 'UNNODE_PACKAGES',
        name: isPython ? 'Uninstall Python packages' : 'Uninstall Node packages',
        envName: isPython ? 'UNINSTALL_PACKAGES' : 'UNNODE_PACKAGES',
        description: 'Uninstall unwanted packages on startup.',
        type: 'text',
        defaultValue: '',
        value: '',
        placeholder: 'unused-package'
      },
      {
        key: 'MAIN_FILE',
        name: 'Main Entry File',
        envName: 'MAIN_FILE',
        description: 'The startup script executed by the container runtime.',
        type: 'text',
        defaultValue: isPython ? 'main.py' : isBun ? 'src/index.ts' : 'src/index.js',
        value: server.startup?.entryFile || (isPython ? 'main.py' : isBun ? 'src/index.ts' : 'src/index.js'),
        placeholder: isPython ? 'main.py' : isBun ? 'src/index.ts' : 'src/index.js'
      },
      {
        key: isPython ? 'PYTHON_ARGS' : isBun ? 'BUN_ARGS' : 'NODE_ARGS',
        name: 'Additional Runtime Arguments',
        envName: isPython ? 'PYTHON_ARGS' : isBun ? 'BUN_ARGS' : 'NODE_ARGS',
        description: 'Extra CLI flags passed directly to runtime engine.',
        type: 'text',
        defaultValue: '',
        value: '',
        placeholder: '--trace-warnings'
      }
    ];
  });

  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  const showToastMsg = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch actual variables from .env
  useEffect(() => {
    const loadEnv = async () => {
      try {
        const res = await apiRequest(`/servers/${server.id}/env`);
        if (res.success && res.data) {
          const env = res.data.env || {};
          setVariables((prev) =>
            prev.map((v) => {
              if (env[v.key] !== undefined) {
                return { ...v, value: env[v.key] };
              }
              return v;
            })
          );
        }
      } catch (err) {
        console.error('Failed to load startup env variables:', err);
      }
    };
    loadEnv();
  }, [server.id]);

  const handleVariableChange = (key: string, val: string) => {
    setVariables((prev) =>
      prev.map((v) => (v.key === key ? { ...v, value: val } : v))
    );
  };

  const mainFileVal = variables.find((v) => v.key === 'MAIN_FILE')?.value || (isPython ? 'main.py' : isBun ? 'src/index.ts' : 'src/index.js');
  const argsVal = variables.find((v) => v.key.endsWith('_ARGS'))?.value || '';

  // Generate resolved live startup command based on runtime
  const compiledStartupCommand = React.useMemo(() => {
    if (isMinecraft) {
      const jarVal = variables.find((v) => v.key === 'SERVER_JARFILE')?.value || server.startup?.serverJar || 'server.jar';
      const flagsVal = variables.find((v) => v.key === 'JVM_FLAGS')?.value || server.startup?.jvmFlags || '-XX:+UseG1GC -XX:+ParallelRefProcEnabled';
      const xmx = server.startup?.xmxMB || server.limits?.ramMB || 4096;
      const xms = server.startup?.xmsMB || 512;
      return `java -Xms${xms}M -Xmx${xmx}M ${flagsVal} -jar ${jarVal} nogui`;
    }

    if (isPython) {
      return `missing=""; [[ -z "\${GIT_ADDRESS}" ]] && missing+="GIT_ADDRESS "; if [[ -n "\${GIT_ADDRESS}" && ! -d ".git" ]]; then git clone --branch "\${BRANCH:-main}" "\${GIT_ADDRESS}" .; fi; if [[ -f "requirements.txt" ]]; then pip install -r requirements.txt; fi; python3 -u ${mainFileVal} ${argsVal}`.trim();
    }

    if (isBun) {
      return `missing=""; [[ -z "\${GIT_ADDRESS}" ]] && missing+="GIT_ADDRESS "; if [[ -n "\${GIT_ADDRESS}" && ! -d ".git" ]]; then git clone --branch "\${BRANCH:-main}" "\${GIT_ADDRESS}" .; fi; if [[ -f "package.json" && ! -d "node_modules" ]]; then bun install; fi; bun run ${mainFileVal} ${argsVal}`.trim();
    }

    // Default Node.js
    return `missing=""; [[ -z "\${GIT_ADDRESS}" ]] && missing+="GIT_ADDRESS "; [[ -z "\${BRANCH}" ]] && missing+="BRANCH "; if [[ -n "\${GIT_ADDRESS}" && ! -d ".git" ]]; then git clone --branch "\${BRANCH:-main}" "\${GIT_ADDRESS}" .; elif [[ "\${AUTO_UPDATE}" == "1" ]]; then git pull origin "\${BRANCH:-main}"; fi; if [[ -n "\${NODE_PACKAGES}" ]]; then npm install \${NODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then npm install; fi; node ${mainFileVal} ${argsVal}`.trim();
  }, [isMinecraft, isPython, isBun, mainFileVal, argsVal, server, variables]);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText(compiledStartupCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // 1. Save environment variables
      const envPayload = variables.map((v) => ({
        key: v.key,
        value: v.value,
        isEnabled: true
      }));

      await apiRequest(`/servers/${server.id}/env`, {
        method: 'PUT',
        body: JSON.stringify({ envVars: envPayload, createFile: true })
      });

      // 2. Extract software version from selectedImage
      let extractedVer = selectedImage;
      if (isMinecraft) {
        const verMatch = selectedImage.match(/(\d+(\.\d+)?)/);
        if (verMatch) extractedVer = verMatch[1];
      }

      // 3. Update server startup config
      if (isMinecraft) {
        const jarVal = variables.find((v) => v.key === 'SERVER_JARFILE')?.value || 'server.jar';
        const flagsVal = variables.find((v) => v.key === 'JVM_FLAGS')?.value || '';
        await apiRequest(`/servers/${server.id}/startup`, {
          method: 'PUT',
          body: JSON.stringify({
            version: extractedVer,
            entryFile: jarVal,
            startup: {
              compiledCommand: compiledStartupCommand,
              serverJar: jarVal,
              jvmFlags: flagsVal,
              entryFile: jarVal,
              dockerImage: selectedImage
            }
          })
        });
      } else {
        await apiRequest(`/servers/${server.id}/startup`, {
          method: 'PUT',
          body: JSON.stringify({
            version: extractedVer,
            entryFile: mainFileVal,
            startup: {
              compiledCommand: compiledStartupCommand,
              entryFile: mainFileVal,
              dockerImage: selectedImage
            }
          })
        });
      }

      showToastMsg('success', 'Startup configuration and variables saved successfully!');
      if (onRefreshServer) onRefreshServer();
    } catch (err: any) {
      showToastMsg('error', err.message || 'Failed to save startup configuration');
    } finally {
      setSaving(false);
    }
  };

  // Available Docker images for the selected runtime
  const dockerImages = React.useMemo(() => {
    if (isMinecraft) {
      return ['Java 21 OpenJDK', 'Java 17 OpenJDK', 'Java 11 OpenJDK', 'Java 8 OpenJDK'];
    }
    if (isPython) {
      return ['Python 3.13 (Latest)', 'Python 3.12 (Stable)', 'Python 3.11', 'Python 3.10'];
    }
    if (isBun) {
      return ['Bun 1.2 (Latest)', 'Bun 1.1', 'Bun 1.0'];
    }
    return ['Node 22 (LTS)', 'Node 23 (Current)', 'Node 20 (LTS)', 'Node 18 (LTS)'];
  }, [isMinecraft, isPython, isBun]);

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-semibold shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/50 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Title & Save Button Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Terminal className="h-5 w-5 text-[#f97316]" />
            <span>Startup</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            The command your server boots with, its Docker image, and egg variables.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50"
        >
          {saving ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          <span>Save Changes</span>
        </button>
      </div>

      {/* Top 2 Cards: Startup Command & Docker Image (Matching Orihost image_f10f972e.png) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Card 1: Startup command (2 cols) */}
        <div className="lg:col-span-2 rounded-xl bg-[#14151b] border border-[#23252e] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#23252e]">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#f97316]" />
                <span className="text-xs font-semibold text-white">Startup command</span>
              </div>
              <button
                type="button"
                onClick={handleCopyCommand}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#0c0d12] border border-[#23252e] text-xs text-neutral-300 hover:text-white hover:border-[#f97316] transition-colors cursor-pointer"
              >
                {copiedCmd ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-neutral-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            <div className="rounded-lg bg-[#0c0d12] border border-[#23252e] p-3.5 font-mono text-xs text-neutral-300 break-all leading-relaxed max-h-40 overflow-y-auto selection:bg-[#f97316]/30">
              {compiledStartupCommand}
            </div>
          </div>
          <div className="text-[11px] text-neutral-500 mt-3">
            Compiled dynamically from runtime environment, entrypoint, and egg variables.
          </div>
        </div>

        {/* Card 2: Docker Image (1 col) */}
        <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-[#23252e]">
              <Box className="h-4 w-4 text-[#f97316]" />
              <span className="text-xs font-semibold text-white">Docker Image</span>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-neutral-400">
                Runtime image
              </label>
              <select
                value={selectedImage}
                onChange={(e) => setSelectedImage(e.target.value)}
                className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs font-medium rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316] transition-colors cursor-pointer"
              >
                {dockerImages.map((img) => (
                  <option key={img} value={img} className="bg-[#14151b] text-white">
                    {img}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-[11px] text-neutral-500 mt-4">
            The runtime image used when this server starts.
          </p>
        </div>
      </div>

      {/* Variables Section (Matching Orihost image_f10f972e.png) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-white tracking-tight">Variables</h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#0c0d12] text-neutral-400 border border-[#23252e]">
              {variables.length} variables
            </span>
          </div>
        </div>

        {/* Grid of Variable Cards (2-column on desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {variables.map((variable) => {
            const isBool = variable.type === 'boolean';
            const isSecret = variable.type === 'password';
            const isVisible = showPassword[variable.key] || false;

            return (
              <div
                key={variable.key}
                className="rounded-xl bg-[#14151b] border border-[#23252e] p-4 flex flex-col justify-between hover:border-[#323542] transition-colors"
              >
                <div>
                  {/* Variable Name & Env Tag */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">{variable.name}</div>
                      <div className="text-[10px] font-mono text-neutral-400 uppercase mt-0.5">
                        {variable.envName}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-neutral-400 mt-2 line-clamp-2 leading-relaxed">
                    {variable.description}
                  </p>
                </div>

                {/* Input Control */}
                <div className="mt-4 pt-3 border-t border-[#23252e]/60">
                  {isBool ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-neutral-400">
                        {variable.value === '1' ? 'Enabled' : 'Disabled'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          handleVariableChange(variable.key, variable.value === '1' ? '0' : '1')
                        }
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          variable.value === '1' ? 'bg-[#f97316]' : 'bg-[#23252e]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            variable.value === '1' ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  ) : isSecret ? (
                    <div className="relative">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={variable.value}
                        onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                        placeholder={variable.placeholder}
                        className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3 py-2 pr-9 focus:outline-none focus:border-[#f97316] font-mono transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((prev) => ({ ...prev, [variable.key]: !isVisible }))
                        }
                        className="absolute right-2.5 top-2.5 text-neutral-500 hover:text-white transition-colors cursor-pointer"
                      >
                        {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(e) => handleVariableChange(variable.key, e.target.value)}
                      placeholder={variable.placeholder}
                      className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#f97316] font-mono transition-colors"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
