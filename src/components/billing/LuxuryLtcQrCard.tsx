import React, { useState } from 'react';
import {
  QrCode, Copy, Check, Download, ExternalLink, Sparkles,
  Coins, ArrowRight, ShieldCheck, Zap
} from 'lucide-react';

interface LuxuryLtcQrCardProps {
  amountUsd?: number;
  walletAddress?: string;
  onLaunchProcessor?: () => void;
}

export const LuxuryLtcQrCard: React.FC<LuxuryLtcQrCardProps> = ({
  amountUsd = 25,
  walletAddress = 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l',
  onLaunchProcessor
}) => {
  const [selectedCoin, setSelectedCoin] = useState<'LTC' | 'USDT' | 'BTC' | 'ETH' | 'SOL'>('LTC');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Exchange rates against USD
  const coinRates: Record<string, { rate: number; symbol: string; network: string; address: string }> = {
    LTC: {
      rate: 70.0,
      symbol: 'LTC',
      network: 'Litecoin Mainnet (Sub-Cent Fees)',
      address: walletAddress || 'ltc1q3w4e5r6t7y8u9i0o1p2a3s4d5f6g7h8j9k0l'
    },
    USDT: {
      rate: 1.0,
      symbol: 'USDT',
      network: 'TRC-20 Network (Tether)',
      address: 'TX9d8h7g6f5e4d3c2b1a0z9y8x7w6v5u4t3s2r1q'
    },
    BTC: {
      rate: 65000.0,
      symbol: 'BTC',
      network: 'Bitcoin Native SegWit',
      address: 'bc1q9v8t7w6x5y4z3a2b1c0d9e8f7g6h5j4k3m2n1'
    },
    ETH: {
      rate: 2600.0,
      symbol: 'ETH',
      network: 'Ethereum ERC-20 Mainnet',
      address: '0x71C56538B1D42916857723fF7463A0F1283c7490'
    },
    SOL: {
      rate: 150.0,
      symbol: 'SOL',
      network: 'Solana High Speed Network',
      address: 'SoL99AetherPanelCryptoDepositNodeWallet88XyZ'
    }
  };

  const activeInfo = coinRates[selectedCoin];
  const cryptoAmount = (amountUsd / activeInfo.rate).toFixed(6);

  // Generate dynamic QR code URI
  const payUri = selectedCoin === 'LTC'
    ? `litecoin:${activeInfo.address}?amount=${cryptoAmount}&label=AetherCloud`
    : `${activeInfo.address}`;

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payUri)}`;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadQr = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `AetherCloud_${selectedCoin}_Payment_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-6 rounded-3xl bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.12)] space-y-6 relative overflow-hidden text-zinc-100">
      {/* Metallic Gold Top Accent Border */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.5)]" />

      {/* Title & Currency Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Coins className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                Luxury Crypto & LTC Payment Hub
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/30">
                  Sub-Cent LTC Fees
                </span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Generate instant copy-ready QR codes & pay directly with Litecoin or major cryptocurrencies.
              </p>
            </div>
          </div>
        </div>

        {/* Coin Selector Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1.5 rounded-2xl border border-zinc-800">
          {(['LTC', 'USDT', 'BTC', 'ETH', 'SOL'] as const).map((coin) => (
            <button
              key={coin}
              type="button"
              onClick={() => setSelectedCoin(coin)}
              className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold transition-all ${
                selectedCoin === coin
                  ? 'bg-amber-400 text-black shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {coin}
            </button>
          ))}
        </div>
      </div>

      {/* Main QR Code & Address Generator Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
        {/* Left Column: Copy-to-Clipboard QR Box */}
        <div className="md:col-span-5 flex flex-col items-center justify-center p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-3 relative group">
          <div className="p-3 bg-white rounded-2xl shadow-xl border border-zinc-200 relative">
            <img
              src={qrCodeUrl}
              alt={`${selectedCoin} Payment QR Code`}
              className="w-44 h-44 object-contain rounded-lg"
            />
            {selectedCoin === 'LTC' && (
              <div className="absolute top-2 right-2 bg-amber-500 text-black font-extrabold text-[9px] px-1.5 py-0.5 rounded-md shadow-md">
                LTC FAST
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 w-full pt-1">
            <button
              type="button"
              onClick={() => handleCopy(payUri, 'qr_link')}
              className="flex-1 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-xs font-semibold text-zinc-200 hover:text-white transition flex items-center justify-center gap-1.5"
            >
              {copiedField === 'qr_link' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
              <span>{copiedField === 'qr_link' ? 'QR Copied!' : 'Copy QR Link'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadQr}
              className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 hover:text-white transition"
              title="Download QR Code PNG"
            >
              <Download className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Right Column: Amount & Wallet Addresses with Copy */}
        <div className="md:col-span-7 space-y-4">
          {/* Amount Display */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 space-y-1">
            <div className="text-xs text-zinc-400 font-medium flex items-center justify-between">
              <span>Required Payment Amount:</span>
              <span className="font-mono text-amber-400 text-[11px]">{activeInfo.network}</span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">{cryptoAmount}</span>
                <span className="text-base font-bold text-amber-400">{activeInfo.symbol}</span>
                <span className="text-xs text-zinc-400 font-mono">(${amountUsd.toFixed(2)} USD)</span>
              </div>

              <button
                type="button"
                onClick={() => handleCopy(cryptoAmount, 'amount')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold transition flex items-center gap-1"
              >
                {copiedField === 'amount' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedField === 'amount' ? 'Copied' : 'Copy Amount'}</span>
              </button>
            </div>
          </div>

          {/* Wallet Address Input/Box with Copy */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
              <span>Recipient {activeInfo.symbol} Deposit Address</span>
              <span className="text-[10px] text-zinc-500 font-mono">256-Bit Encrypted Address</span>
            </label>

            <div className="flex items-center gap-2 p-3 rounded-2xl bg-zinc-950 border border-zinc-800/90">
              <code className="text-xs text-amber-300 font-mono break-all flex-1 select-all">
                {activeInfo.address}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(activeInfo.address, 'address')}
                className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-amber-500/10"
              >
                {copiedField === 'address' ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedField === 'address' ? 'Copied!' : 'Copy Address'}</span>
              </button>
            </div>
          </div>

          {/* Real-time Gateway Launch CTA */}
          {onLaunchProcessor && (
            <div className="pt-2 flex items-center justify-between gap-3">
              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Instant transaction detection on Blockchain nodes</span>
              </div>
              <button
                type="button"
                onClick={onLaunchProcessor}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-extrabold text-xs transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 shrink-0"
              >
                <Zap className="w-4 h-4 fill-black" />
                Launch Live Processor →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
