import React, { useState, useEffect } from 'react';
import {
  FileText, Scale, Lock, Shield, Save, Eye, Edit3, CheckCircle2,
  AlertCircle, Clock, ExternalLink, RefreshCw, Sparkles, HelpCircle,
  Heading1, Heading2, Bold, List, Code, SplitSquareVertical
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { LegalPage } from '../../types';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';

export const AdminLegal: React.FC = () => {
  const [documents, setDocuments] = useState<LegalPage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('terms');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Active form state
  const [title, setTitle] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [version, setVersion] = useState<string>('1.0.0');
  const [isPublished, setIsPublished] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [updatedBy, setUpdatedBy] = useState<string>('');

  // Editor mode: 'split' | 'edit' | 'preview'
  const [viewMode, setViewMode] = useState<'split' | 'edit' | 'preview'>('split');

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/admin/legal');
      if (res.success && res.data) {
        setDocuments(res.data);
        const current = res.data.find((d: LegalPage) => d.slug === selectedSlug) || res.data[0];
        if (current) {
          loadDocIntoForm(current);
        }
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load legal documents');
    } finally {
      setLoading(false);
    }
  };

  const loadDocIntoForm = (doc: LegalPage) => {
    setSelectedSlug(doc.slug);
    setTitle(doc.title);
    setSummary(doc.summary || '');
    setContent(doc.content);
    setVersion(doc.version);
    setIsPublished(doc.isPublished);
    setLastUpdatedAt(doc.lastUpdatedAt);
    setUpdatedBy(doc.updatedBy || 'Administrator');
  };

  const handleSelectDoc = (slug: string) => {
    const doc = documents.find(d => d.slug === slug);
    if (doc) {
      loadDocIntoForm(doc);
    }
  };

  const handleSave = async (publishStatus: boolean = isPublished) => {
    setSaving(true);
    try {
      const res = await apiRequest(`/admin/legal/${selectedSlug}`, {
        method: 'PUT',
        body: JSON.stringify({
          title,
          summary,
          content,
          version,
          isPublished: publishStatus
        })
      });

      if (res.success && res.data) {
        setIsPublished(publishStatus);
        setLastUpdatedAt(res.data.lastUpdatedAt);
        setUpdatedBy(res.data.updatedBy || 'Administrator');
        showToast('success', `Document '${title}' saved successfully!`);
        // Update local list
        setDocuments(prev => prev.map(d => d.slug === selectedSlug ? res.data : d));
      } else {
        showToast('error', res.error?.message || 'Failed to save document');
      }
    } catch (err: any) {
      showToast('error', err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const insertSnippet = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('legal-content-editor') as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selection = content.substring(start, end) || 'Sample text';
    const updated = content.substring(0, start) + prefix + selection + suffix + content.substring(end);
    setContent(updated);
  };

  const bumpVersion = (type: 'patch' | 'minor') => {
    const parts = version.split('.').map(n => parseInt(n, 10) || 0);
    if (parts.length < 3) parts.push(0, 0);
    if (type === 'minor') {
      parts[1] += 1;
      parts[2] = 0;
    } else {
      parts[2] += 1;
    }
    const newVer = parts.join('.');
    setVersion(newVer);
    showToast('success', `Version bumped to ${newVer}`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold animate-in fade-in slide-in-from-top-3 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-950/90 border-rose-500/40 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-2">
            <Scale className="h-3.5 w-3.5" /> Content Management & Compliance
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Legal Pages & Policies Editor
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Manage terms of service, privacy policies, and acceptable use guidelines in Markdown with live preview.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={`/terms`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-700/60 transition"
          >
            <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
            <span>Public View</span>
          </a>

          <button
            onClick={() => handleSave(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span>Save & Publish</span>
          </button>
        </div>
      </div>

      {/* Document Selector Pills */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { slug: 'terms', label: 'Terms of Service', icon: Scale },
          { slug: 'privacy', label: 'Privacy Policy', icon: Lock },
          { slug: 'acceptable-use', label: 'Acceptable Use Policy', icon: Shield }
        ].map(doc => {
          const Icon = doc.icon;
          const isSelected = selectedSlug === doc.slug;
          const matchingData = documents.find(d => d.slug === doc.slug);

          return (
            <button
              key={doc.slug}
              onClick={() => handleSelectDoc(doc.slug)}
              className={`p-4 rounded-xl border text-left transition relative overflow-hidden flex items-start gap-3.5 ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
              }`}
            >
              <div className={`p-2 rounded-lg ${isSelected ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-400'}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>
                    {doc.label}
                  </h3>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700">
                    v{matchingData?.version || '1.0.0'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 truncate mt-1">
                  Slug: /{doc.slug}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Editor Card */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 space-y-6">
        
        {/* Metadata Fields */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-zinc-950/60 p-4 rounded-xl border border-zinc-800/80">
          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Document Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs focus:border-amber-500 focus:outline-none"
              placeholder="e.g. Terms of Service"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Version</label>
              <div className="flex items-center gap-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => bumpVersion('patch')}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  +Patch
                </button>
                <button
                  type="button"
                  onClick={() => bumpVersion('minor')}
                  className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  +Minor
                </button>
              </div>
            </div>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs font-mono focus:border-amber-500 focus:outline-none"
              placeholder="2.4.0"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Publish Status</label>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                isPublished
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{isPublished ? 'Published & Live' : 'Draft / Hidden'}</span>
            </button>
          </div>

          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Short Summary / Subtitle</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs focus:border-amber-500 focus:outline-none"
              placeholder="Brief explanation of this document's scope"
            />
          </div>
        </div>

        {/* Toolbar & View Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
          {/* Quick Markdown Inserts */}
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => insertSnippet('## ', '')}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
              title="Heading 2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('**', '**')}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
              title="Bold text"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('- ', '')}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
              title="Bullet list"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('`', '`')}
              className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white"
              title="Inline code"
            >
              <Code className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => insertSnippet('\n---\n')}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-[11px] font-mono"
              title="Horizontal rule"
            >
              ---
            </button>
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('edit')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'edit' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Edit3 className="h-3 w-3 inline mr-1" />
              Editor
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'split' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <SplitSquareVertical className="h-3 w-3 inline mr-1" />
              Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'preview' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Eye className="h-3 w-3 inline mr-1" />
              Preview
            </button>
          </div>
        </div>

        {/* Editor & Preview Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Markdown Textarea */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className={`space-y-2 ${viewMode === 'edit' ? 'lg:col-span-2' : ''}`}>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">Markdown Source</span>
                <span>{content.length} characters</span>
              </div>
              <textarea
                id="legal-content-editor"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={22}
                className="w-full p-4 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs leading-relaxed focus:border-amber-500 focus:outline-none resize-y"
                placeholder="Enter markdown content here..."
              />
            </div>
          )}

          {/* Live Formatted Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`space-y-2 ${viewMode === 'preview' ? 'lg:col-span-2' : ''}`}>
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">Live Rendered Document</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Realtime
                </span>
              </div>
              <div className="p-6 rounded-xl bg-zinc-950/80 border border-zinc-800 max-h-[500px] overflow-y-auto">
                <MarkdownRenderer content={content} />
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-800/80 text-xs text-zinc-500">
          <div className="flex items-center gap-4">
            {lastUpdatedAt && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-500" />
                <span>Last updated: {new Date(lastUpdatedAt).toLocaleString()}</span>
              </div>
            )}
            {updatedBy && (
              <span>by <strong className="text-zinc-400">{updatedBy}</strong></span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition"
            >
              Save as Draft
            </button>
            <button
              type="button"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition"
            >
              Save & Publish
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
