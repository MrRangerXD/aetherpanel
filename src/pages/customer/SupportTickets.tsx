import React, { useState, useEffect } from 'react';
import { LifeBuoy, PlusCircle, Send, ShieldAlert, X } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { SupportTicket } from '../../types';
import { PanelScrollReveal } from '../../components/PanelScrollReveal';

interface SupportTicketsProps {
  onNavigate: (page: string, params?: any) => void;
}

export const SupportTickets: React.FC<SupportTicketsProps> = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [, setLoading] = useState(true);

  // New ticket modal state
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Technical Support');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [initialMessage, setInitialMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply message
  const [replyMessage, setReplyMessage] = useState('');

  const fetchTickets = async () => {
    const res = await apiRequest('/support/tickets');
    if (res.success && res.data) {
      setTickets(res.data);
      if (selectedTicket) {
        const updated = res.data.find((t: SupportTicket) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !initialMessage.trim()) return;

    setIsSubmitting(true);
    const res = await apiRequest('/support/tickets/create', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        category,
        priority,
        message: initialMessage
      })
    });

    if (res.success) {
      setSubject('');
      setInitialMessage('');
      setShowNewTicketModal(false);
      fetchTickets();
    }
    setIsSubmitting(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    const res = await apiRequest(`/support/tickets/${selectedTicket.id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message: replyMessage.trim() })
    });

    if (res.success) {
      setReplyMessage('');
      fetchTickets();
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <PanelScrollReveal delayMs={0}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)] tracking-tight">Technical Support</h1>
            <p className="text-xs text-[var(--color-ink-mute)] mt-1">Get priority assistance from our DevOps engineers and system administrators.</p>
          </div>

          <button
            onClick={() => setShowNewTicketModal(true)}
            className="btn btn-primary"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Support Ticket</span>
          </button>
        </div>
      </PanelScrollReveal>

      {/* Main Grid: Ticket List + Message Thread */}
      <PanelScrollReveal delayMs={40}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Ticket List (Left Column) */}
          <div className="space-y-2.5">
            <h3 className="label">Your Ticket Queue</h3>

            {tickets.length === 0 ? (
              <div className="surface p-8 text-center rounded-lg text-xs text-[var(--color-ink-mute)]">
                No support tickets found.
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className={`p-3.5 rounded-lg border transition-colors cursor-pointer space-y-1.5 ${
                    selectedTicket?.id === t.id
                      ? 'bg-[var(--color-surface-3)] border-[var(--color-accent)]'
                      : 'surface border-[var(--color-line)] hover:border-[var(--color-line-soft)]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono capitalize border ${
                      t.status === 'open' ? 'bg-[var(--color-warn)]/10 text-[var(--color-warn)] border-[var(--color-warn)]/30' :
                      t.status === 'answered' ? 'bg-[var(--color-ok)]/10 text-[var(--color-ok)] border-[var(--color-ok)]/30' :
                      'surface-2 text-[var(--color-ink-mute)] border-[var(--color-line)]'
                    }`}>
                      {t.status}
                    </span>

                    <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">#{t.id.slice(0, 6)}</span>
                  </div>

                  <h4 className="text-xs font-semibold text-[var(--color-ink)] leading-tight">{t.subject}</h4>
                  
                  <div className="flex justify-between text-[11px] text-[var(--color-ink-dim)] pt-0.5">
                    <span>{t.category}</span>
                    <span className="font-mono text-[10px]">{t.createdAt}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected Ticket Thread (Right Column) */}
          <div className="lg:col-span-2 space-y-4">
            {selectedTicket ? (
              <div className="surface p-5 sm:p-6 rounded-lg space-y-5">
                <div className="border-b border-[var(--color-line)] pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[var(--color-accent)] font-semibold">Ticket #{selectedTicket.id}</span>
                    <span className="text-xs text-[var(--color-ink-mute)] font-mono">{selectedTicket.createdAt}</span>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--color-ink)] tracking-tight">{selectedTicket.subject}</h2>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-ink-dim)]">
                    <span>Category: <strong className="text-[var(--color-ink)]">{selectedTicket.category}</strong></span>
                    <span>Priority: <strong className="text-[var(--color-accent)] uppercase">{selectedTicket.priority}</strong></span>
                  </div>
                </div>

                {/* Message Feed */}
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {selectedTicket.messages.map((m) => {
                    const isStaff = ['admin', 'super_admin', 'support'].includes(m.senderRole);

                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-lg border space-y-1.5 ${
                          isStaff
                            ? 'surface-2 border-[var(--color-accent)]/40 ml-4'
                            : 'surface border-[var(--color-line)] mr-4'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span className={`font-semibold flex items-center gap-1.5 ${isStaff ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>
                            {isStaff && <ShieldAlert className="h-3.5 w-3.5" />}
                            {m.senderName} {isStaff && '(Staff Support)'}
                          </span>
                          <span className="text-[10px] text-[var(--color-ink-mute)] font-mono">{m.createdAt}</span>
                        </div>
                        <p className="text-xs text-[var(--color-ink-dim)] leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Reply Box */}
                <form onSubmit={handleSendReply} className="space-y-2.5 border-t border-[var(--color-line)] pt-4">
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your response to support staff..."
                    rows={3}
                    className="field w-full p-3 text-xs rounded-md leading-relaxed resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      className="btn btn-primary text-xs"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit Reply</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="surface p-12 text-center rounded-lg text-[var(--color-ink-mute)] text-xs space-y-2">
                <LifeBuoy className="h-8 w-8 text-[var(--color-ink-mute)] mx-auto" />
                <p>Select a support ticket from the list to view its conversation thread.</p>
              </div>
            )}
          </div>

        </div>
      </PanelScrollReveal>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 anim-fade-in">
          <form onSubmit={handleCreateTicket} className="w-full max-w-lg surface p-5 sm:p-6 rounded-lg space-y-4 anim-scale-in">
            <div className="flex justify-between items-center border-b border-[var(--color-line)] pb-3">
              <h3 className="text-sm font-semibold text-[var(--color-ink)]">Create Support Ticket</h3>
              <button type="button" onClick={() => setShowNewTicketModal(false)} className="btn-icon">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label block mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Assistance setting up GeyserMC plugin"
                className="field w-full px-3 py-1.5 text-xs rounded-md"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="field w-full px-2.5 py-1.5 text-xs rounded-md"
                >
                  <option value="Technical Support">Technical Support</option>
                  <option value="Billing & Orders">Billing & Orders</option>
                  <option value="Node / Hardware Migration">Node Migration</option>
                  <option value="Other Enquiries">Other Enquiries</option>
                </select>
              </div>

              <div>
                <label className="label block mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="field w-full px-2.5 py-1.5 text-xs rounded-md capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label block mb-1">Problem Description</label>
              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Describe what issue or error you are experiencing in detail..."
                rows={4}
                className="field w-full p-3 text-xs rounded-md resize-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="btn btn-ghost text-xs py-1.5"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary text-xs py-1.5"
              >
                {isSubmitting ? 'Submitting...' : 'Open Ticket'}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};
