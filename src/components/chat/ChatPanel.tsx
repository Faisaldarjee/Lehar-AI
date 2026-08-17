import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QueryChips } from './QueryChips';
import { Waves, Database, Globe2, Activity } from 'lucide-react';
import type { ChatMessage as ChatMessageType, DashboardStats } from '../../types';

interface ChatPanelProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onSendMessage: (query: string, mode?: 'text' | 'voice') => void;
  onFocusMap?: (markers: any[]) => void;
  onView3D?: () => void;
  selectedLanguage: string;
  onSelectLanguage?: (lang: string) => void;
  stats?: DashboardStats | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onFocusMap,
  onView3D,
  selectedLanguage,
  onSelectLanguage,
  stats,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'en-IN', label: 'English (IN)' },
    { code: 'hi-IN', label: 'हिंदी (Hindi)' },
    { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
    { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  ];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-abyssal-950/85 border border-abyssal-800/90 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-2xl">

      {/* Top Chat Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-abyssal-800/80 bg-abyssal-900/60 shadow-inner">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-xl bg-ocean-cyan/10 text-ocean-cyan border border-ocean-cyan/25 shadow-glow-cyan-sm">
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 font-heading">
              Ocean Intelligence Console
            </h2>
            <p className="text-[10px] text-slate-400">Natural Language to Read-Only SQL Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-[10px] font-mono">
          {/* Language Selector in Chat Console */}
          {onSelectLanguage && (
            <div className="flex items-center space-x-1 bg-abyssal-900/90 px-2.5 py-1 rounded-xl border border-abyssal-800 text-slate-300 shadow-sm">
              <Globe2 className="w-3 h-3 text-ocean-cyan" />
              <select
                value={selectedLanguage}
                onChange={(e) => onSelectLanguage(e.target.value)}
                aria-label="Select OceanVoice Language"
                className="bg-transparent text-slate-200 text-[10px] font-medium focus:outline-none cursor-pointer"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-abyssal-950 text-white">
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="hidden md:flex items-center gap-1 bg-abyssal-900/90 px-2.5 py-1 rounded-xl border border-abyssal-800 text-slate-300 shadow-sm">
            <Database className="w-3 h-3 text-ocean-cyan" /> 
            <span>{stats ? `${stats.total_profiles} Profiles (${stats.total_floats} Floats)` : '646 Profiles (97 Floats)'}</span>
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-4">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-ocean-cyan/20 via-teal-500/10 to-abyssal-900 border border-ocean-cyan/30 flex items-center justify-center text-ocean-cyan shadow-glow-cyan">
                <Waves className="w-7 h-7 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ocean-cyan opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-ocean-cyan"></span>
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight font-heading">
                Welcome to Lehar AI
              </h3>
              <p className="text-xs text-ocean-cyan font-semibold tracking-wide">
                Know the Sea. Know the Way.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Query 646 ARGO ocean profiles in natural Hindi or English. Request spatial fleet maps, depth curves, or 3D bathymetry.
              </p>
            </div>

            <div className="w-full pt-1">
              <QueryChips onSelectQuery={(q) => onSendMessage(q, 'text')} />
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onFocusMap={onFocusMap}
              onView3D={onView3D}
            />
          ))
        )}
      </div>

      {/* Footer / Input Area */}
      <div className="p-3 sm:p-4 border-t border-abyssal-800/80 bg-abyssal-950/90 space-y-2">
        {messages.length > 0 && (
          <QueryChips onSelectQuery={(q) => onSendMessage(q, 'text')} />
        )}

        <ChatInput
          onSendMessage={onSendMessage}
          isLoading={isLoading}
          selectedLanguage={selectedLanguage}
        />

        <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
          <span className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-ocean-cyan" />
            Groq LLaMA 3.3 70B & INCOIS Argovis Open NetCDF
          </span>
          <span className="hidden sm:inline">Press Enter to Send • Click Mic for OceanVoice</span>
        </div>
      </div>

    </div>
  );
};
