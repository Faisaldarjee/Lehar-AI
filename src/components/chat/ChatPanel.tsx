import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QueryChips } from './QueryChips';
import { Waves, Sparkles, Database, ShieldCheck } from 'lucide-react';
import type { ChatMessage as ChatMessageType, DashboardStats } from '../../types';

interface ChatPanelProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onSendMessage: (query: string, mode?: 'text' | 'voice') => void;
  onFocusMap?: (markers: any[]) => void;
  onView3D?: () => void;
  selectedLanguage: string;
  stats?: DashboardStats | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onFocusMap,
  onView3D,
  selectedLanguage,
  stats,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-full bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md">

      {/* Top Chat Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/80 bg-slate-900/50">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              Ocean Intelligence Conversational Console
            </h2>
            <p className="text-[11px] text-slate-400">Natural Language to Read-Only SQL Engine</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" /> Safe SELECT Execution
          </span>
          <span className="flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded-md text-slate-300">
            <Database className="w-3 h-3 text-cyan-400" /> {stats ? `${stats.total_profiles} Profiles (${stats.total_floats} Floats)` : '646 Profiles'}
          </span>
        </div>
      </div>

      {/* Messages Stream */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto py-12 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl shadow-cyan-500/10">
              <Waves className="w-8 h-8 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight font-heading">
                Welcome to Lehar AI
              </h3>
              <p className="text-xs text-cyan-300 font-semibold tracking-wide">
                Know the Sea. Know the Way.
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Query 4,000+ global Argo ocean floats using plain English or your native voice in Hindi, Tamil, or Telugu. No coding or oceanography background needed.
              </p>
            </div>

            <div className="w-full pt-2">
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
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/80 space-y-2">
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
            Powered by Groq Llama 3.3 70B & INCOIS Argovis Open NetCDF
          </span>
          <span className="hidden sm:inline">Press Enter to Send • Click Mic for OceanVoice</span>
        </div>
      </div>

    </div>
  );
};
