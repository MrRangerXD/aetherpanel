import React, { useState, useEffect } from 'react';
import { Sliders, Save, Check, QrCode, CreditCard, Building, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { Order, PaymentGatewaySettings } from '../../types';

export const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'payments' | 'pending'>('general');

  // General Settings
  const [brandName, setBrandName] = useState('AetherPanel');
  const [brandTagline, setBrandTagline] = useState('Premium Minecraft & Discord Bot Hosting');
  const [supportEmail, setSupportEmail] = useState('support@aetherpanel.com');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Payment Gateway Settings
  const [gateways, setGateways] = useState<PaymentGatewaySettings>({
    upi: {
      enabled: true,
      upiId: 'aetherpay@upi',
      merchantName: 'AetherPanel Hosting',
      qrCodeUrl: 'https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?auto=format&fit=crop&w=400&q=80',
      instructions: 'Scan the QR code or send payment to the UPI ID. Enter the 12-digit UTR or Transaction Ref ID after payment.'
    },
    bank: {
      enabled: true,
      bankName: 'HDFC Bank / Global Web Bank',
      accountNumber: '918237192837',
      ifsc: 'HDFC0001234',
      accountHolder: 'Aether Cloud Infrastructure LLC',
      instructions: 'Transfer to Bank Account and submit your NEFT/IMPS/Wire Reference Number.'
    },
    crypto: {
      enabled: false,
      walletAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
      network: 'USDT (TRC20 / ERC20)',
      instructions: 'Send USDT to the wallet address and submit TX Hash.'
    },
    stripe: {
      enabled: true,
      instructions: 'Instant automatic payment via Credit/Debit Card or Wallet.'
    }
  });

  // Pending Orders
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const [saved, setSaved] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchSettings = async () => {
    const res = await apiRequest('/admin/settings');
    if (res.success && res.data) {
      setBrandName(res.data.brandName || 'AetherPanel');
      setBrandTagline(res.data.brandTagline || '');
      setSupportEmail(res.data.supportEmail || 'support@aetherpanel.com');
      setCurrencySymbol(res.data.currencySymbol || '$');
      setRegistrationEnabled(res.data.registrationEnabled ?? true);
      setMaintenanceMode(res.data.maintenanceMode ?? false);
      if (res.data.paymentGateways) {
        setGateways(res.data.paymentGateways);
      }
    }
  };

  const fetchPendingOrders = async () => {
    setLoadingOrders(true);
    const res = await apiRequest('/admin/orders?status=pending');
    if (res.success && res.data) {
      setPendingOrders(res.data);
    }
    setLoadingOrders(false);
  };

  useEffect(() => {
    fetchSettings();
    fetchPendingOrders();
  }, []);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        brandName,
        brandTagline,
        supportEmail,
        currencySymbol,
        registrationEnabled,
        maintenanceMode
      })
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleSavePayments = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/admin/payment-settings', {
      method: 'PUT',
      body: JSON.stringify(gateways)
    });
    if (res.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    const res = await apiRequest(`/admin/orders/${orderId}/approve`, { method: 'POST' });
    if (res.success) {
      setActionMsg(res.message || 'Payment approved!');
      fetchPendingOrders();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    const reason = prompt('Reason for rejecting payment:');
    if (reason === null) return;

    const res = await apiRequest(`/admin/orders/${orderId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
    if (res.success) {
      setActionMsg(res.message || 'Payment rejected.');
      fetchPendingOrders();
      setTimeout(() => setActionMsg(null), 4000);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="border-b border-amber-500/20 pb-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sliders className="h-6 w-6 text-amber-400" /> Platform Configuration & Payment Gateways
          </h1>
          <p className="text-xs text-zinc-400 mt-1">Manage brand identity, QR code payment gateways, and approve manual payment submissions.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-900 border border-zinc-800 p-1 rounded-2xl gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 rounded-xl transition-all ${activeTab === 'general' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            General Settings
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 ${activeTab === 'payments' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <QrCode className="h-3.5 w-3.5" /> Payment Gateways & QR Code
          </button>
          <button
            onClick={() => { setActiveTab('pending'); fetchPendingOrders(); }}
            className={`px-4 py-2 rounded-xl transition-all flex items-center gap-1.5 relative ${activeTab === 'pending' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-white'}`}
          >
            <Clock className="h-3.5 w-3.5 text-amber-400" /> Pending Approvals
            {pendingOrders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500 text-white font-bold">
                {pendingOrders.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
          <Check className="h-4 w-4" /> Configuration saved successfully!
        </div>
      )}

      {actionMsg && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {actionMsg}
        </div>
      )}

      {/* TAB 1: General Settings */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveGeneral} className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-5">
          <h2 className="text-base font-bold text-white border-b border-zinc-800 pb-3">Branding & System Toggles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Brand Name</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Support Email</label>
              <input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Tagline</label>
            <input
              type="text"
              value={brandTagline}
              onChange={(e) => setBrandTagline(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs font-bold text-white">Public User Registration</div>
              <div className="text-[11px] text-zinc-400">Allow new customers to create accounts.</div>
            </div>
            <input
              type="checkbox"
              checked={registrationEnabled}
              onChange={(e) => setRegistrationEnabled(e.target.checked)}
              className="h-4 w-4 accent-amber-500 rounded"
            />
          </div>

          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800">
            <div>
              <div className="text-xs font-bold text-white">Platform Maintenance Mode</div>
              <div className="text-[11px] text-zinc-400">Display maintenance banner to non-admin users.</div>
            </div>
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="h-4 w-4 accent-rose-500 rounded"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Save Settings
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Payment Gateways & QR Code Configuration */}
      {activeTab === 'payments' && (
        <form onSubmit={handleSavePayments} className="space-y-6">
          
          {/* UPI & QR CODE GATEWAY */}
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <QrCode className="h-5 w-5 text-violet-400" />
                <h3 className="text-base font-bold text-white">UPI & QR Code Gateway Settings</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-zinc-400">Enabled</span>
                <input
                  type="checkbox"
                  checked={gateways.upi.enabled}
                  onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, enabled: e.target.checked } })}
                  className="h-4 w-4 accent-violet-500 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">UPI ID (VPA)</label>
                <input
                  type="text"
                  value={gateways.upi.upiId}
                  onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, upiId: e.target.value } })}
                  placeholder="e.g. merchant@upi or 9876543210@paytm"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Merchant / Business Name</label>
                <input
                  type="text"
                  value={gateways.upi.merchantName}
                  onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, merchantName: e.target.value } })}
                  placeholder="e.g. AetherPanel Cloud Hosting"
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Payment QR Code Image URL</label>
              <input
                type="text"
                value={gateways.upi.qrCodeUrl}
                onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, qrCodeUrl: e.target.value } })}
                placeholder="Paste direct image URL for your UPI QR Code..."
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono"
              />
              <p className="text-[10px] text-zinc-500 mt-1">Provide a direct HTTPS URL to your GPay/PhonePe/Paytm QR Code image.</p>
            </div>

            {gateways.upi.qrCodeUrl && (
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center gap-4">
                <img src={gateways.upi.qrCodeUrl} alt="QR Code Preview" className="h-24 w-24 object-cover rounded-xl border border-zinc-800" />
                <div className="text-xs text-zinc-400">
                  <div className="font-bold text-white mb-1">QR Code Preview</div>
                  <div>This image will be shown to customers when they add funds via UPI / QR Scan.</div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Instructions for Customer</label>
              <textarea
                rows={2}
                value={gateways.upi.instructions}
                onChange={(e) => setGateways({ ...gateways, upi: { ...gateways.upi, instructions: e.target.value } })}
                className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2 text-xs text-white"
              />
            </div>
          </div>

          {/* BANK TRANSFER GATEWAY */}
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Bank Transfer Details</h3>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-zinc-400">Enabled</span>
                <input
                  type="checkbox"
                  checked={gateways.bank.enabled}
                  onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, enabled: e.target.checked } })}
                  className="h-4 w-4 accent-emerald-500 rounded"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={gateways.bank.bankName}
                  onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, bankName: e.target.value } })}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Account Number</label>
                <input
                  type="text"
                  value={gateways.bank.accountNumber}
                  onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, accountNumber: e.target.value } })}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">IFSC / SWIFT Code</label>
                <input
                  type="text"
                  value={gateways.bank.ifsc}
                  onChange={(e) => setGateways({ ...gateways, bank: { ...gateways.bank, ifsc: e.target.value } })}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-800 px-4 py-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md">
              <Save className="h-4 w-4" /> Save Payment Gateways
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Pending Payment Approvals */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-400" /> Pending Customer Payment Requests
            </h3>
            <button onClick={fetchPendingOrders} className="p-2 text-xs text-zinc-400 hover:text-white flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
          </div>

          {loadingOrders ? (
            <div className="p-8 text-center text-xs text-zinc-400">Loading pending requests...</div>
          ) : pendingOrders.length === 0 ? (
            <div className="p-10 text-center bg-zinc-900/60 border border-zinc-800 rounded-3xl space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">No Pending Payments</div>
              <p className="text-xs text-zinc-400">All customer manual deposits and QR Code payments have been processed.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingOrders.map((o) => (
                <div key={o.id} className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-400">#{o.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-semibold">
                        {o.paymentMethod}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-white">
                      Customer: <span className="text-zinc-300 font-normal">{o.userEmail}</span>
                    </div>

                    <div className="text-xs text-zinc-400">
                      Amount Requested: <strong className="text-emerald-400 font-mono">${o.amount.toFixed(2)}</strong>
                    </div>

                    {o.transactionRef && (
                      <div className="text-xs bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800 font-mono text-amber-300 flex items-center gap-2">
                        <span>Transaction Ref / UTR:</span>
                        <strong>{o.transactionRef}</strong>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRejectOrder(o.id)}
                      className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-semibold text-xs flex items-center gap-1.5"
                    >
                      <XCircle className="h-4 w-4" /> Reject
                    </button>
                    <button
                      onClick={() => handleApproveOrder(o.id)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Approve & Credit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

