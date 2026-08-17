import React, { useRef, useEffect } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QueryChips } from './QueryChips';
import { Waves, Database, Sparkles, Languages } from 'lucide-react';
import type { ChatMessage as ChatMessageType, DashboardStats } from '../../types';

interface ChatPanelProps {
  messages: ChatMessageType[];
  isLoading: boolean;
  onSendMessage: (query: string, mode?: 'text' | 'voice') => void;
  onFocusMap?: (markers: any[]) => void;
  onView3D?: () => void;
  selectedLanguage?: string;
  onSelectLanguage?: (lang: string) => void;
  stats?: DashboardStats | null;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  onFocusMap,
  onView3D,
  stats,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

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
          {/* Automatic Multi-Language Indicator Badge */}
          <div className="flex items-center space-x-1.5 bg-abyssal-900/90 px-2.5 py-1 rounded-xl border border-abyssal-800 text-slate-300 shadow-sm">
            <Languages className="w-3 h-3 text-ocean-cyan" />
            <span className="text-[10px] font-medium text-ocean-cyan">Auto-Detect Lang</span>
          </div>

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
            </div>

            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-white font-heading">
                Ready for Ocean Queries
              </h3>
              <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                Ask in English, Hindi, or Hinglish via text or mic.
              </p>
            </div>

            {/* Starter Categorized Discovery Chips */}
            <div className="w-full pt-2">
              <QueryChips onSelectQuery={(q) => onSendMessage(q, 'text')} />
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onFocusMap={onFocusMap}
              onView3D={onView3D}
            />
          ))
        )}

        {isLoading && (
          <div className="flex items-center space-x-2 text-xs text-ocean-cyan p-3 bg-abyssal-900/60 rounded-xl border border-ocean-cyan/20 w-fit animate-pulse font-mono shadow-glow-cyan-sm">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>Analyzing ARGO profiles & computing telemetry...</span>
          </div>
        )}
      </div>

      {/* Input Composer Bar */}
      <div className="p-3 border-t border-abyssal-800/80 bg-abyssal-900/40">
        <ChatInput
          onSendMessage={(text, mode) => onSendMessage(text, mode)}
          isLoading={isLoading}
          language="auto"
        />
      </div>

    </div>
  );
};
