import React, { useState, useEffect } from 'react';
import {
  X,
  Send,
  ExternalLink,
  Sparkles,
  Check,
  Copy,
  Radio,
  ShieldCheck
} from 'lucide-react';
import axios from 'axios';

interface TelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TelegramBotStatus {
  status: 'online' | 'standby' | 'not_configured';
  bot_username: string;
  token_configured: boolean;
  active_worker: boolean;
  messages_handled: number;
  qr_url: string;
}

export const TelegramModal: React.FC<TelegramModalProps> = ({ isOpen, onClose }) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [botStatus, setBotStatus] = useState<TelegramBotStatus>({
    status: 'standby',
    bot_username: '@LeharAIBot',
    token_configured: false,
    active_worker: false,
    messages_handled: 0,
    qr_url: 'https://t.me/LeharAIBot'
  });

  useEffect(() => {
    if (!isOpen) return;

    // Fetch live bot status from backend
    axios.get('http://127.0.0.1:8000/api/telegram/status')
      .then((res) => {
        if (res.data) setBotStatus(res.data);
      })
      .catch(() => {
        // Fallback default
        setBotStatus((prev) => ({ ...prev, status: 'standby' }));
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const botLink = botStatus.qr_url || 'https://t.me/LeharAIBot';
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    botLink
  )}&bgcolor=050e1a&color=06b6d4&margin=2`;

  const samplePrompts = [
    {
      title: '📍 Share Live GPS Location',
      query: 'Send Location via Telegram 📎',
      desc: 'Calculates nearest ARGO Float, ocean temp, and returns native Map Pin'
    },
    {
      title: '🐟 Vernacular PFZ Fish Advisory',
      query: 'Mumbai ke paas machhli pakadne ke liye samundar kaisa hai?',
      desc: 'Returns optimal SST, chlorophyll fronts & Surmai/Bangda viability'
    },
    {
      title: '🌊 Ocean Science & MLD',
      query: 'What is the Mixed Layer Depth and surface salinity in Arabian Sea?',
      desc: 'Subsurface CTD depth telemetry down to 2,000m'
    },
    {
      title: '🚨 Proactive Watchdog Check',
      query: '/start',
      desc: 'Interactive button menu with storm warnings & Hindi advisory'
    }
  ];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-[1500] flex items-center justify-center p-4 bg-abyssal-950/80 backdrop-blur-md animate-in fade-in duration-200">
      
      {/* Modal Card */}
      <div 
        className="relative w-full max-w-2xl bg-gradient-to-b from-[#071322] via-[#050e1a] to-[#030810] border border-cyan-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-cyan-950/50 space-y-5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow ambient background element */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-cyan-500/20 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-400/40 shadow-glow-cyan-sm">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-white font-heading">
                  Live Telegram Bot: <span className="text-cyan-400">{botStatus.bot_username}</span>
                </h3>
                <span className="px-2 py-0.5 text-[9px] font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Grand Finale Live Demo</span>
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scan with any smartphone camera to interact with Lehar AI in real-time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-abyssal-900 hover:bg-abyssal-800 text-slate-400 hover:text-white transition cursor-pointer border border-abyssal-750 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Core Content: QR Code + Quick Instructions */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center relative z-10">
          
          {/* Left: QR Code Box */}
          <div className="sm:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-[#030912]/90 border border-cyan-500/30 text-center space-y-3 shadow-inner">
            <div className="relative p-2 rounded-xl bg-[#050e1a] border border-cyan-400/50 shadow-glow-cyan-sm">
              <img
                src={qrImageSrc}
                alt="Scan to open Telegram Bot"
                className="w-40 h-40 object-contain rounded-lg"
              />
              <div className="absolute inset-0 border border-cyan-400/20 rounded-xl pointer-events-none" />
            </div>

            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-abyssal-950 font-black text-xs transition active:scale-95 cursor-pointer shadow-md shadow-cyan-500/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Open in Telegram App</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>

          {/* Right: Quick Instructions & Recommended Judge Tests */}
          <div className="sm:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Recommended Judge Test Queries</span>
              </span>
              <span className="text-[10px] text-cyan-400 font-mono">Tap to copy</span>
            </div>

            <div className="space-y-2">
              {samplePrompts.map((p, idx) => (
                <div
                  key={idx}
                  onClick={() => handleCopy(p.query)}
                  className="group p-2.5 rounded-xl bg-[#040c17]/90 hover:bg-[#07172b] border border-abyssal-800 hover:border-cyan-500/40 transition cursor-pointer flex items-center justify-between gap-2"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="text-xs font-bold text-cyan-300 font-heading truncate group-hover:text-cyan-200">
                      {p.title}
                    </div>
                    <div className="text-[11px] text-slate-300 font-mono truncate">
                      "{p.query}"
                    </div>
                    <div className="text-[9px] text-slate-400 font-sans">
                      {p.desc}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="p-1.5 rounded-lg bg-abyssal-900 text-slate-400 group-hover:text-cyan-400 group-hover:bg-cyan-500/20 transition shrink-0"
                    title="Copy query text"
                  >
                    {copiedText === p.query ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Footer Gateway Bar */}
        <div className="pt-3 border-t border-abyssal-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-slate-400 relative z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero-Install • Supports 9 Indic Languages + GPS Pins</span>
          </div>

          <div className="flex items-center gap-1.5 text-cyan-400">
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            <span>Response Latency: &lt;350ms</span>
          </div>
        </div>

      </div>

    </div>
  );
};
