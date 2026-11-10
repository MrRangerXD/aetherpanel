import React, { useState, useEffect, useCallback } from 'react';
import { Server, ServerPropertyField } from '../../types';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../lib/ToastContext';
import {
  Sliders, Save, RotateCcw, FileCode, Check, Search, AlertCircle,
  Lock, RefreshCw, Layers
} from 'lucide-react';

interface ServerPropertiesProps {
  server: Server;
}

export const ServerProperties: React.FC<ServerPropertiesProps> = ({ server }) => {
  const { toast } = useToast();
  const [fields, setFields] = useState<ServerPropertyField[]>([]);
  const [changes, setChanges] = useState<Record<string, string | boolean | number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Raw Editor State
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState('');
  const [loadingRaw, setLoadingRaw] = useState(false);
  const [savingRaw, setSavingRaw] = useState(false);

  // Fetch structured properties
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<ServerPropertyField[]>(
        `/servers/${server.id}/properties`
      );
      if (res.success) {
        setFields(res.data || []);
        setChanges({});
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch server properties');
    } finally {
      setLoading(false);
    }
  }, [server.id, toast]);

  // Fetch raw content
  const fetchRawContent = useCallback(async () => {
    setLoadingRaw(true);
    try {
      const res = await apiRequest<{ content: string }>(
        `/servers/${server.id}/properties/raw`
      );
      if (res.success) {
        setRawContent(res.data?.content || '');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch raw properties');
    } finally {
      setLoadingRaw(false);
    }
  }, [server.id, toast]);

  useEffect(() => {
    if (isRawMode) {
      fetchRawContent();
    } else {
      fetchProperties();
    }
  }, [isRawMode, fetchProperties, fetchRawContent]);

  // Handle field change
  const handleChange = (key: string, value: string | boolean | number) => {
    setChanges(prev => ({ ...prev, [key]: value }));
  };

  // Save structured changes
  const handleSave = async () => {
    if (Object.keys(changes).length === 0) {
      toast.info('No changes to save.');
      return;
    }

    setSaving(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/properties`,
        {
          method: 'PATCH',
          body: JSON.stringify({ changes })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) {
          toast.info('Restart server for changes to take effect.');
        }
        await fetchProperties();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save properties');
    } finally {
      setSaving(false);
    }
  };

  // Reset keys to default
  const handleResetDefaults = async () => {
    const keysToReset = fields.filter(f => !f.locked && f.default !== undefined).map(f => f.key);
    if (keysToReset.length === 0) return;

    setSaving(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string }>(
        `/servers/${server.id}/properties/reset`,
        {
          method: 'POST',
          body: JSON.stringify({ keys: keysToReset })
        }
      );
      if (res.success) {
        toast.success(res.message);
        await fetchProperties();
      }
    } catch (err: any) {
      toast.error(err.message || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  // Save raw content
  const handleSaveRaw = async () => {
    setSavingRaw(true);
    try {
      const res = await apiRequest<{ success: boolean; message: string; restartRequired: boolean }>(
        `/servers/${server.id}/properties/raw`,
        {
          method: 'POST',
          body: JSON.stringify({ content: rawContent })
        }
      );
      if (res.success) {
        toast.success(res.message);
        if (res.restartRequired) toast.info('Restart server to apply configuration changes.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save raw server.properties');
    } finally {
      setSavingRaw(false);
    }
  };

  // Categories
  const categories = ['All', 'Gameplay', 'Network', 'Performance', 'World', 'Advanced'];

  // Filter fields
  const filteredFields = fields.filter(f => {
    const matchCat = activeCategory === 'All' || f.category === activeCategory;
    const matchSearch =
      !searchQuery ||
      f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description && f.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchCat && matchSearch;
  });

  const hasUnsavedChanges = Object.keys(changes).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[var(--color-line)] pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-[var(--color-ink)]">
            <Sliders className="w-5 h-5 text-[var(--color-accent)]" />
            Server Properties Editor
          </h2>
          <p className="text-xs text-[var(--color-ink-dim)] mt-1">
            Configure server.properties with schema-driven validation, category filters, and raw file mode
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRawMode(!isRawMode)}
            className={`btn px-3 py-1.5 text-xs border border-[var(--color-line)] flex items-center gap-1.5 ${
              isRawMode ? 'bg-[var(--color-accent)] text-black font-semibold' : ''
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            {isRawMode ? 'Form Mode' : 'Raw File'}
          </button>

          {!isRawMode && (
            <>
              <button
                onClick={handleResetDefaults}
                disabled={saving || loading}
                className="btn px-3 py-1.5 text-xs border border-[var(--color-line)] flex items-center gap-1.5 hover:border-[var(--color-warn)] text-[var(--color-ink-dim)] hover:text-[var(--color-warn)]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || saving}
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors ${
                  hasUnsavedChanges
                    ? 'btn-primary'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-ink-mute)] border border-[var(--color-line)] cursor-not-allowed'
                }`}
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes ({Object.keys(changes).length})
              </button>
            </>
          )}

          {isRawMode && (
            <button
              onClick={handleSaveRaw}
              disabled={savingRaw || loadingRaw}
              className="btn-primary px-4 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            >
              {savingRaw ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Raw File
            </button>
          )}
        </div>
      </div>

      {isRawMode ? (
        <div className="surface rounded-lg border border-[var(--color-line)] overflow-hidden">
          <div className="p-3 border-b border-[var(--color-line)] bg-[var(--color-surface-2)] flex items-center justify-between text-xs text-[var(--color-ink-dim)]">
            <span className="font-mono">server.properties (raw text editor)</span>
            <span>Allocated ports are locked on save</span>
          </div>
          <textarea
            value={rawContent}
            onChange={e => setRawContent(e.target.value)}
            disabled={loadingRaw}
            rows={24}
            className="w-full p-4 font-mono text-xs bg-[var(--color-bg)] text-[var(--color-ink)] focus:outline-none resize-y"
            placeholder="# server.properties content..."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Categories and Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1 bg-[var(--color-surface-2)] p-1 rounded-lg border border-[var(--color-line)]">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                    activeCategory === cat
                      ? 'bg-[var(--color-accent)] text-black'
                      : 'text-[var(--color-ink-dim)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-dim)]" />
              <input
                type="text"
                placeholder="Search properties..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="field w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--color-surface)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
              />
            </div>
          </div>

          {/* Fields List */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="surface h-16 animate-pulse rounded-lg bg-[var(--color-surface-2)]" />
              ))}
            </div>
          ) : filteredFields.length === 0 ? (
            <div className="surface p-12 text-center rounded-lg border border-[var(--color-line)]">
              <p className="text-xs text-[var(--color-ink-dim)]">No properties match your filter.</p>
            </div>
          ) : (
            <div className="surface border border-[var(--color-line)] rounded-lg overflow-hidden divide-y divide-[var(--color-line)]">
              {filteredFields.map(field => {
                const effectiveVal = changes[field.key] !== undefined ? changes[field.key] : field.value;
                const isModified = changes[field.key] !== undefined;

                return (
                  <div
                    key={field.key}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-colors ${
                      isModified ? 'bg-[var(--color-accent)]/5' : 'hover:bg-[var(--color-surface-2)]/30'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[var(--color-ink)]">
                          {field.key}
                        </span>
                        {field.locked && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[var(--color-line)] text-[var(--color-ink-mute)] flex items-center gap-1 font-mono">
                            <Lock className="w-2.5 h-2.5" /> ALLOCATION LOCKED
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] font-mono">
                          {field.category}
                        </span>
                        {isModified && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-[var(--color-accent)]/20 text-[var(--color-accent)] font-mono font-semibold">
                            MODIFIED
                          </span>
                        )}
                      </div>
                      {field.description && (
                        <p className="text-[11px] text-[var(--color-ink-dim)] mt-1">
                          {field.description}
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 sm:w-64 flex justify-end">
                      {field.locked ? (
                        <input
                          type="text"
                          disabled
                          value={String(effectiveVal)}
                          className="field w-full px-3 py-1.5 text-xs bg-[var(--color-surface-3)] border border-[var(--color-line)] rounded-lg font-mono text-[var(--color-ink-mute)] cursor-not-allowed"
                        />
                      ) : field.type === 'boolean' ? (
                        (() => {
                          const isTrue = effectiveVal === true || String(effectiveVal).toLowerCase() === 'true';
                          return (
                            <button
                              type="button"
                              onClick={() => handleChange(field.key, !isTrue)}
                              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                                isTrue
                                  ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/40 hover:bg-[var(--color-ok)]/20'
                                  : 'bg-[var(--color-surface-2)] text-[var(--color-ink-dim)] border-[var(--color-line)] hover:bg-[var(--color-surface-3)]'
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isTrue ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-ink-mute)]'
                                }`}
                              />
                              {isTrue ? 'Enabled (True)' : 'Disabled (False)'}
                            </button>
                          );
                        })()
                      ) : field.type === 'enum' && field.options ? (
                        <select
                          value={String(effectiveVal)}
                          onChange={e => handleChange(field.key, e.target.value)}
                          className="field w-full px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                        >
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === 'number' ? (
                        <input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={Number(effectiveVal) || 0}
                          onChange={e => handleChange(field.key, Number(e.target.value))}
                          className="field w-full px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg font-mono text-[var(--color-ink)]"
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          value={String(effectiveVal || '')}
                          onChange={e => handleChange(field.key, e.target.value)}
                          className="field w-full px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)] resize-y"
                        />
                      ) : (
                        <input
                          type="text"
                          value={String(effectiveVal || '')}
                          onChange={e => handleChange(field.key, e.target.value)}
                          className="field w-full px-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-line)] rounded-lg text-[var(--color-ink)]"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default ServerProperties;
