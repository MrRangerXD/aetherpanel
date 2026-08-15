import React, { useState, useEffect } from 'react';
import { Shield, FileText, Lock, Scale, Printer, ArrowLeft, CheckCircle2, Clock, Calendar } from 'lucide-react';
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <button
            onClick={() => onNavigate('home')}
            className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-medium border border-zinc-800 transition"
            >
              <Printer className="h-3.5 w-3.5 text-zinc-400" />
              <span>Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 rounded-2xl bg-zinc-900/80 border border-zinc-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentSlug === tab.slug;
            return (
              <button
                key={tab.slug}
                onClick={() => setCurrentSlug(tab.slug)}
                className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Document Content Card */}
        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 sm:p-10 relative overflow-hidden backdrop-blur-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <p className="text-xs font-medium">Loading document...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-rose-400 space-y-2">
              <p className="text-sm font-semibold">{error}</p>
              <button
                onClick={() => fetchDoc(currentSlug)}
                className="text-xs text-amber-400 underline"
              >
                Retry
              </button>
            </div>
          ) : document ? (
            <div className="space-y-6">
              
              {/* Document Meta Header */}
              <div className="border-b border-zinc-800 pb-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono font-semibold">
                      v{document.version}
                    </span>
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Legally Active</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Last updated: {new Date(document.lastUpdatedAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>

                {document.summary && (
                  <p className="text-sm text-zinc-400 leading-relaxed italic bg-zinc-950/40 p-3.5 rounded-xl border border-zinc-800/60">
                    "{document.summary}"
                  </p>
                )}
              </div>

              {/* Markdown Content */}
              <div className="pt-2">
                <MarkdownRenderer content={document.content} />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Support Banner */}
        <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-400">
          <div>
            <span className="font-semibold text-white">Have questions about our legal policies?</span>
            <p className="text-zinc-400 mt-0.5">Our support and compliance team is available 24/7 to assist you.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('support')}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-medium transition"
            >
              Contact Support
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
