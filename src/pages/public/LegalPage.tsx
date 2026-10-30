import React, { useState, useEffect } from 'react';
import { Shield, Lock, Scale, Printer, ArrowLeft, CheckCircle2, Calendar } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { LegalPage as LegalDocType } from '../../types';
import { MarkdownRenderer } from '../../components/MarkdownRenderer';

interface LegalPageProps {
  initialSlug?: string;
  onNavigate: (page: string) => void;
}

export const LegalPage: React.FC<LegalPageProps> = ({ initialSlug = 'terms', onNavigate }) => {
  const [currentSlug, setCurrentSlug] = useState<string>(initialSlug);
  const [document, setDocument] = useState<LegalDocType | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { slug: 'terms', label: 'Terms of Service', icon: Scale },
    { slug: 'privacy', label: 'Privacy Policy', icon: Lock },
    { slug: 'acceptable-use', label: 'Acceptable Use Policy', icon: Shield }
  ];

  useEffect(() => {
    fetchDoc(currentSlug);
  }, [currentSlug]);

  const fetchDoc = async (slug: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest(`/public/legal/${slug}`);
      if (res.success && res.data) {
        setDocument(res.data);
      } else {
        setError(res.error?.message || 'Failed to load document');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load legal document');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen text-[var(--color-ink)] py-8 px-4 sm:px-6 lg:px-8 anim-fade-in">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-xs font-medium text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="btn btn-ghost text-xs gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 p-1 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentSlug === tab.slug;
            return (
              <button
                key={tab.slug}
                onClick={() => setCurrentSlug(tab.slug)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-ink)] border-b-2 border-[var(--color-accent)]'
                    : 'text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-mute)]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Document Content Card */}
        <div className="p-6 sm:p-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)]">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-[var(--color-ink-mute)]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-accent)] border-t-transparent" />
              <p className="text-xs">Loading document...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-[var(--color-err)] space-y-2">
              <p className="text-xs font-semibold">{error}</p>
              <button
                onClick={() => fetchDoc(currentSlug)}
                className="text-xs text-[var(--color-accent)] underline hover:opacity-80"
              >
                Retry
              </button>
            </div>
          ) : document ? (
            <div className="space-y-6">
              
              {/* Document Meta Header */}
              <div className="border-b border-[var(--color-line)] pb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium text-[var(--color-accent)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10">
                      v{document.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[var(--color-ok)] text-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Legally Active</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--color-ink-mute)]">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <Calendar className="h-3.5 w-3.5 text-[var(--color-ink-mute)]" />
                      <span>Updated: {new Date(document.lastUpdatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {document.summary && (
                  <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed italic bg-[var(--color-surface-2)] p-3 rounded-md border border-[var(--color-line)]">
                    "{document.summary}"
                  </p>
                )}
              </div>

              {/* Markdown Content */}
              <div className="pt-2 text-xs leading-relaxed text-[var(--color-ink)]">
                <MarkdownRenderer content={document.content} />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Support Banner */}
        <div className="p-4 rounded-lg bg-[var(--color-surface)] border border-[var(--color-line)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-ink-mute)]">
          <div>
            <span className="font-semibold text-[var(--color-ink)]">Have questions about our legal policies?</span>
            <p className="mt-0.5">Our compliance team is available 24/7 to assist you.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('support')}
              className="btn btn-ghost text-xs"
            >
              Contact Support
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
