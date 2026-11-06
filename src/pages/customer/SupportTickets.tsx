import React, { useState, useEffect } from 'react';
import {
  Server, CreditCard, User, Flag, HelpCircle, Plus, Send,
  MessageSquare, Info, Shield, CheckCircle2, ChevronRight, X, Clock
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { SupportTicket } from '../../types';

interface SupportTicketsProps {
  onNavigate?: (page: string, params?: any) => void;
}

export const SupportTickets: React.FC<SupportTicketsProps> = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  // New ticket modal
  const [showModal, setShowModal] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string>('Server issue');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reply message
  const [replyMessage, setReplyMessage] = useState('');

  const topics = [
    { id: 'Server issue', label: 'Server issue', icon: Server },
    { id: 'Premium & payment', label: 'Premium & payment', icon: CreditCard },
    { id: 'Account & suspension', label: 'Account & suspension', icon: User },
    { id: 'Report abuse', label: 'Report abuse', icon: Flag },
    { id: 'Other', label: 'Other', icon: HelpCircle }
  ];

  const fetchTickets = async () => {
    try {
      const res = await apiRequest('/support/tickets');
      if (res.success && res.data) {
        setTickets(res.data);
        if (selectedTicket) {
          const updated = res.data.find((t: SupportTicket) => t.id === selectedTicket.id);
          if (updated) setSelectedTicket(updated);
        }
      }
    } catch (e) {
      console.error('Failed to fetch tickets:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await apiRequest('/support/tickets/create', {
        method: 'POST',
        body: JSON.stringify({
          category: selectedTopic,
          subject: subject.trim(),
          message: message.trim(),
          priority: 'medium'
        })
      });
      if (res.success) {
        setSubject('');
        setMessage('');
        setShowModal(false);
        fetchTickets();
      }
    } catch (e) {
      console.error('Failed to create ticket:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;
    try {
      const res = await apiRequest(`/support/tickets/${selectedTicket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: replyMessage.trim() })
      });
      if (res.success) {
        setReplyMessage('');
        fetchTickets();
      }
    } catch (e) {
      console.error('Failed to reply:', e);
    }
  };

  const openTicketsCount = tickets.filter((t) => t.status === 'open' || t.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">

      {/* 2. Header (Orihost image_555e7f05.png) */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">How can we help?</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Pick a topic to open a ticket. We reply here and by email.
        </p>
      </div>

      {/* 3. 5 Topic Selector Cards in a Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {topics.map((topic) => {
          const Icon = topic.icon;
          const isSelected = selectedTopic === topic.id;
          return (
            <button
              key={topic.id}
              onClick={() => {
                setSelectedTopic(topic.id);
                setShowModal(true);
              }}
              className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-24 ${
                isSelected
                  ? 'bg-[#181922] border-[#f97316] text-white shadow-sm'
                  : 'bg-[#14151b] border-[#23252e] text-neutral-300 hover:text-white hover:border-[#383a48]'
              }`}
            >
              <div className="w-8 h-8 rounded-lg bg-[#0c0d12] border border-[#23252e] flex items-center justify-center text-[#f97316]">
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-xs font-semibold truncate mt-2">{topic.label}</div>
            </button>
          );
        })}
      </div>

      {/* Subtle Note */}
      <div className="text-xs text-neutral-400">
        <strong className="text-white font-medium">Premium</strong> tickets are answered first.
      </div>

      {/* 4. Your Tickets Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white">Your tickets</h3>
          <span className="text-xs text-neutral-500 font-mono">
            {openTicketsCount} of 3 open
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] p-12 text-center space-y-4">
            <div className="w-10 h-10 rounded-xl bg-[#0c0d12] border border-[#23252e] flex items-center justify-center text-neutral-500 mx-auto">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">No tickets yet</div>
              <div className="text-xs text-neutral-400 mt-1">
                Tickets you open will show up here with where they stand.
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea580c] text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>+ New ticket</span>
            </button>
          </div>
        ) : (
          <div className="rounded-xl bg-[#14151b] border border-[#23252e] divide-y divide-[#23252e]/60 overflow-hidden">
            {tickets.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedTicket(t)}
                className="p-4 flex items-center justify-between hover:bg-[#181922] transition-colors cursor-pointer"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold ${
                        t.status === 'open'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : t.status === 'answered'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-neutral-800 text-neutral-400'
                      }`}
                    >
                      {t.status}
                    </span>
                    <span className="text-xs font-bold text-white">{t.subject}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    Topic: {t.category || 'General'} · #{t.id.slice(0, 8)}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                  <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ticket Conversation Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#14151b] border border-[#23252e] rounded-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-[#23252e]">
              <div>
                <h3 className="text-sm font-bold text-white">{selectedTicket.subject}</h3>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  Category: {selectedTicket.category} · Status: {selectedTicket.status}
                </div>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {Array.isArray(selectedTicket.messages) && selectedTicket.messages.map((m, i) => {
                const isStaff = m.senderRole === 'admin' || m.senderRole === 'super_admin' || m.senderRole === 'support';
                return (
                  <div
                    key={m.id || i}
                    className={`p-3.5 rounded-xl border space-y-1 ${
                      isStaff
                        ? 'bg-amber-950/20 border-amber-500/30 ml-4'
                        : 'bg-[#0c0d12] border-[#23252e] mr-4'
                    }`}
                  >
                    <div className="text-[11px] font-mono text-neutral-400 flex items-center justify-between">
                      <span className={isStaff ? 'text-amber-400 font-bold' : 'text-neutral-300'}>
                        {m.senderName} {isStaff && '★ Staff Support'}
                      </span>
                      <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-white leading-relaxed">{m.message}</div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleSendReply} className="flex gap-2 pt-2 border-t border-[#23252e]">
              <input
                type="text"
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply..."
                className="flex-1 bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316]"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-lg bg-[#f97316] text-white text-xs font-bold hover:bg-[#ea580c] transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#14151b] border border-[#23252e] rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#23252e]">
              <div>
                <h3 className="text-sm font-bold text-white">Open a support ticket</h3>
                <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                  Topic: {selectedTopic}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your inquiry..."
                  className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1">Message</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe the issue in detail, include server ID or logs if applicable..."
                  className="w-full bg-[#0c0d12] border border-[#23252e] text-white text-xs rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-[#f97316]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#23252e]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#0c0d12] border border-[#23252e] text-neutral-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-xs font-bold hover:bg-[#ea580c] transition-colors"
                >
                  {isSubmitting ? 'Opening...' : 'Open ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
