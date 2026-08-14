import React, { useState, useEffect } from 'react';
import { LifeBuoy, PlusCircle, MessageSquare, Clock, Send, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { SupportTicket } from '../../types';
import { useAuth } from '../../lib/AuthContext';
import { useTheme } from '../../lib/ThemeContext';

interface SupportTicketsProps {
  onNavigate: (page: string, params?: any) => void;
}

export const SupportTickets: React.FC<SupportTicketsProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { accentClasses } = useTheme();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">24/7 Technical Support</h1>
          <p className="text-xs text-zinc-400 mt-1">Get priority assistance from our DevOps engineers and system administrators.</p>
        </div>

        <button
          onClick={() => setShowNewTicketModal(true)}
          className={`px-5 py-2.5 rounded-xl font-semibold text-xs text-white bg-gradient-to-r ${accentClasses.gradient} shadow-md flex items-center gap-2 hover:opacity-95 transition-all`}
        >
          <PlusCircle className="h-4 w-4" /> Create Support Ticket
        </button>
      </div>

      {/* Main Grid: Ticket List + Message Thread */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket List (Left Column) */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your Ticket Queue</h3>

          {tickets.length === 0 ? (
            <div className="p-6 text-center bg-zinc-900 border border-zinc-800 rounded-2xl text-xs text-zinc-400">
              No support tickets found.
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                  selectedTicket?.id === t.id
                    ? 'bg-zinc-800/80 border-violet-500 shadow-lg shadow-violet-500/10'
                    : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono capitalize border ${
                    t.status === 'open' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    t.status === 'answered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {t.status}
                  </span>

                  <span className="text-[10px] text-zinc-500 font-mono">#{t.id.slice(0, 6)}</span>
                </div>

                <h4 className="text-sm font-bold text-white leading-tight">{t.subject}</h4>
                
                <div className="flex justify-between text-[11px] text-zinc-400 pt-1">
                  <span>{t.category}</span>
                  <span>{t.createdAt}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Ticket Thread (Right Column) */}
        <div className="lg:col-span-2 space-y-4">
          {selectedTicket ? (
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
              <div className="border-b border-zinc-800 pb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-violet-400">Ticket #{selectedTicket.id}</span>
                  <span className="text-xs text-zinc-400">{selectedTicket.createdAt}</span>
                </div>
                <h2 className="text-xl font-bold text-white">{selectedTicket.subject}</h2>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>Category: <strong className="text-white">{selectedTicket.category}</strong></span>
                  <span>Priority: <strong className="text-amber-400 uppercase">{selectedTicket.priority}</strong></span>
                </div>
              </div>

              {/* Message Feed */}
              <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2">
                {selectedTicket.messages.map((m) => {
                  const isStaff = ['admin', 'super_admin', 'support'].includes(m.senderRole);

                  return (
                    <div
                      key={m.id}
                      className={`p-4 rounded-2xl border space-y-2 ${
                        isStaff
                          ? 'bg-violet-950/30 border-violet-500/30 ml-4'
                          : 'bg-zinc-950 border-zinc-800/80 mr-4'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className={`font-semibold flex items-center gap-1.5 ${isStaff ? 'text-violet-400' : 'text-white'}`}>
                          {isStaff && <ShieldAlert className="h-3.5 w-3.5" />}
                          {m.senderName} {isStaff && '(Staff Support)'}
                        </span>
                        <span className="text-[10px] text-zinc-500">{m.createdAt}</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">{m.message}</p>
                    </div>
                  );
                })}
              </div>

              {/* Reply Box */}
              <form onSubmit={handleSendReply} className="space-y-3 border-t border-zinc-800 pt-4">
                <textarea
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Type your response to support staff..."
                  rows={3}
                  className="w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-4 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 leading-relaxed"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs flex items-center gap-2"
                  >
                    <Send className="h-3.5 w-3.5" /> Submit Reply
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-zinc-400 text-xs space-y-2">
              <LifeBuoy className="h-8 w-8 text-zinc-600 mx-auto" />
              <p>Select a support ticket from the list to view its conversation thread.</p>
            </div>
          )}
        </div>

      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <form onSubmit={handleCreateTicket} className="w-full max-w-lg bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <h3 className="text-lg font-bold text-white">Create Support Ticket</h3>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Need assistance setting up GeyserMC plugin"
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-zinc-300 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white"
                >
                  <option value="Technical Support">Technical Support</option>
                  <option value="Billing & Orders">Billing & Orders</option>
                  <option value="Node / Hardware Migration">Node Migration</option>
                  <option value="Other Enquiries">Other Enquiries</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-300 mb-1">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e: any) => setPriority(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-2.5 text-xs text-white capitalize"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-300 mb-1">Problem Description</label>
              <textarea
                value={initialMessage}
                onChange={(e) => setInitialMessage(e.target.value)}
                placeholder="Describe what issue or error you are experiencing in detail..."
                rows={4}
                className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3 text-xs text-white"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="px-4 py-2 bg-zinc-900 text-xs text-zinc-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-violet-600 text-xs text-white font-semibold rounded-xl"
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
