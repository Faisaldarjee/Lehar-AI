import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QueryChips } from './QueryChips';
import { Waves, Sparkles, Database, Globe2 } from 'lucide-react';
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
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">

      {/* Top Chat Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
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
            <div className="flex items-center space-x-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
              <Globe2 className="w-3 h-3 text-cyan-400" />
              <select
                value={selectedLanguage}
                onChange={(e) => onSelectLanguage(e.target.value)}
                aria-label="Select OceanVoice Language"
                className="bg-transparent text-slate-300 text-[10px] font-medium focus:outline-none cursor-pointer"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <span className="hidden md:flex items-center gap-1 bg-slate-900/90 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
            <Database className="w-3 h-3 text-cyan-400" /> {stats ? `${stats.total_profiles} Profiles (${stats.total_floats} Floats)` : '646 Profiles (97 Floats)'}
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-8 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10">
              <Waves className="w-6 h-6 animate-pulse" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-white tracking-tight font-heading">
                Welcome to Lehar AI
              </h3>
              <p className="text-xs text-cyan-300 font-semibold tracking-wide">
                Know the Sea. Know the Way.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Query global ARGO ocean float data in plain English or with native voice in Hindi, Tamil, or Telugu.
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
      <div className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-2">
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
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Groq LLaMA 3.3 70B & INCOIS Argovis Open NetCDF
          </span>
          <span className="hidden sm:inline">Press Enter to Send • Click Mic for OceanVoice</span>
        </div>
      </div>

    </div>
  );
};
