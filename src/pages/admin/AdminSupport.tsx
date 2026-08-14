import React, { useState, useEffect } from 'react';
import { LifeBuoy, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { SupportTicket } from '../../types';

export const AdminSupport: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    const res = await apiRequest('/admin/support/tickets');
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

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !reply.trim()) return;

    await apiRequest(`/admin/support/tickets/${selectedTicket.id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message: reply.trim() })
    });
    setReply('');
    fetchTickets();
  };

  const handleCloseTicket = async (id: string) => {
    await apiRequest(`/admin/support/tickets/${id}/close`, { method: 'PATCH' });
    fetchTickets();
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="border-b border-amber-500/20 pb-5">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <LifeBuoy className="h-6 w-6 text-amber-400" /> Staff Support Desk Queue
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Answer customer tickets, assist with server issues, adjust priorities.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Ticket List */}
        <div className="space-y-3">
          {tickets.map((t) => (
            <div
              key={t.id}
              onClick={() => setSelectedTicket(t)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                selectedTicket?.id === t.id ? 'bg-amber-500/10 border-amber-500' : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white">{t.userName}</span>
                <span className="text-amber-400 font-mono text-[10px]">{t.status}</span>
              </div>
              <h4 className="text-xs font-semibold text-zinc-200">{t.subject}</h4>
              <div className="text-[10px] text-zinc-500">{t.createdAt}</div>
            </div>
          ))}
        </div>

        {/* Selected Thread */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-6">
              <div className="flex justify-between items-start border-b border-zinc-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedTicket.subject}</h2>
                  <p className="text-xs text-zinc-400 mt-0.5">User: {selectedTicket.userName} ({selectedTicket.userEmail})</p>
                </div>
                <button
                  onClick={() => handleCloseTicket(selectedTicket.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-400 text-xs font-semibold"
                >
                  Close Ticket
                </button>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto">
                {selectedTicket.messages.map((m) => (
                  <div key={m.id} className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-1 text-xs">
                    <div className="flex justify-between text-zinc-400 font-semibold">
                      <span>{m.senderName} ({m.senderRole})</span>
                      <span className="text-[10px] text-zinc-500">{m.createdAt}</span>
                    </div>
                    <p className="text-zinc-200">{m.message}</p>
                  </div>
                ))}
              </div>

              <form onSubmit={handleSendReply} className="space-y-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Write staff response..."
                  rows={3}
                  className="w-full rounded-2xl bg-zinc-950 border border-zinc-800 p-3 text-xs text-white"
                />
                <button type="submit" className="px-5 py-2.5 bg-amber-500 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Send Staff Response
                </button>
              </form>
            </div>
          ) : (
            <div className="p-12 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl text-zinc-400 text-xs">
              Select a support ticket to respond.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
