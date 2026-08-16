import React, { useState } from 'react';
import { 
  Bot, 
  User, 
  Code2, 
  Check, 
  Copy, 
  MapPin, 
  Ruler,
  Calendar,
  Thermometer,
  Waves,
  Compass,
  Fish,
  Activity,
  Database,
  AlertTriangle,
  Gauge,
  Sparkles,
  Download,
  Volume2,
  Box,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import type { ChatMessage as ChatMessageType, StatItem } from '../../types';
import { speakText } from '../../services/voiceSynthesis';

interface ChatMessageProps {
  message: ChatMessageType;
  onFocusMap?: (markers: any[]) => void;
  onView3D?: () => void;
}

// Icon resolver for dynamic stat chips
function renderStatIcon(iconName: string) {
  const iconClass = "w-3.5 h-3.5 text-slate-400 mb-1";
  switch (iconName.toLowerCase()) {
    case 'map-pin':
    case 'mappin':
    case 'location':
      return <MapPin className={iconClass} />;
    case 'ruler':
    case 'depth':
      return <Ruler className={iconClass} />;
    case 'calendar':
    case 'date':
    case 'time':
      return <Calendar className={iconClass} />;
    case 'thermometer':
    case 'temp':
      return <Thermometer className={iconClass} />;
    case 'waves':
    case 'salinity':
      return <Waves className={iconClass} />;
    case 'compass':
    case 'sector':
    case 'region':
      return <Compass className={iconClass} />;
    case 'fish':
      return <Fish className={iconClass} />;
    case 'activity':
    case 'float':
      return <Activity className={iconClass} />;
    case 'database':
    case 'readings':
      return <Database className={iconClass} />;
    case 'alert-triangle':
    case 'alert':
      return <AlertTriangle className={iconClass} />;
    default:
      return <Gauge className={iconClass} />;
  }
}

// Defensive number formatter for frontend safety
function formatSafeValue(val: string | number): string {
  if (typeof val === 'number') {
    return Number.isInteger(val) ? val.toString() : val.toFixed(2);
  }
  return val;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onFocusMap, onView3D }) => {
  const [showSql, setShowSql] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const isUser = message.role === 'user';

  const handleCopySql = () => {
    if (message.sql) {
      navigator.clipboard.writeText(message.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = async () => {
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    // Speak the summary or full answer
    const textToSpeak = message.summary || message.content;
    await speakText(textToSpeak, message.language || 'en-IN');
    setIsPlayingAudio(false);
  };

  const handleExportCSV = () => {
    if (!message.data || message.data.length === 0) return;
    const headers = Object.keys(message.data[0]);
    const csvRows = [
      headers.join(','),
      ...message.data.map((row) => headers.map((h) => {
        const val = row[h];
        if (typeof val === 'number') {
          return Number.isInteger(val) ? val : val.toFixed(2);
        }
        return JSON.stringify(val ?? '');
      }).join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lehar_ai_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Reading count resolution
  const readingCount = message.reading_count || (message.data ? message.data.length : 0);

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} my-2`}>
      <div className={`flex items-start gap-3 max-w-2xl w-full ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
            isUser
              ? 'bg-gradient-to-tr from-cyan-600 to-teal-600 text-slate-950 font-bold'
              : 'bg-slate-900 border border-cyan-500/30 text-cyan-400 shadow-cyan-950/20'
          }`}
        >
          {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4" />}
        </div>

        {/* Bubble / Card Container */}
        <div
          className={`flex flex-col space-y-3 rounded-2xl p-4 sm:p-5 border transition-all ${
            isUser
              ? 'bg-cyan-950/40 border-cyan-500/30 text-cyan-50 rounded-tr-none shadow-lg shadow-cyan-950/20 max-w-lg'
              : 'bg-slate-900/95 border-slate-800/90 text-slate-100 rounded-tl-none shadow-xl w-full'
          }`}
        >
          {/* 1. Header Row */}
          <div className="flex items-center justify-between text-xs pb-1">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span className="font-semibold text-slate-400">
                {isUser ? 'You' : 'Lehar AI Ocean Intelligence'}
              </span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Loading State */}
          {message.isLoading ? (
            <div className="flex items-center space-x-2.5 py-3 text-cyan-400 font-mono text-xs">
              <Sparkles className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Analyzing Indian Ocean ARGO profiles and compiling metrics...</span>
            </div>
          ) : isUser ? (
            /* User Message Content */
            <div className="text-slate-100 text-sm whitespace-pre-wrap leading-relaxed font-normal">
              {message.content}
            </div>
          ) : (
            /* Assistant Structured Ocean Intelligence Card */
            <>
              {/* 2. Summary Line */}
              <p className="text-[15px] font-normal leading-[1.6] text-slate-200">
                {message.summary || message.content}
              </p>

              {/* 3. Hero Stat Block */}
              {message.hero_stat && (
                <div className="bg-cyan-950/30 border border-cyan-500/15 rounded-xl p-3.5 flex flex-col justify-center">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-1">
                    {message.hero_stat.label}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-bold tracking-tight text-cyan-400">
                      {formatSafeValue(message.hero_stat.value)}
                    </span>
                    {message.hero_stat.unit && (
                      <span className="text-xs font-semibold text-slate-400">
                        {message.hero_stat.unit}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Stat Chips Row (3-Column Grid) */}
              {message.stats && message.stats.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-0.5">
                  {message.stats.map((st: StatItem, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-950/80 rounded-lg p-2.5 flex flex-col justify-between border border-slate-800/60"
                    >
                      <div className="flex items-center justify-between">
                        {renderStatIcon(st.icon)}
                      </div>
                      <span className="text-[13px] font-medium text-slate-100 truncate leading-snug">
                        {formatSafeValue(st.value)}
                      </span>
                      <span className="text-[11px] text-slate-400 mt-0.5">
                        {st.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* 5. Primary Actions Row (Max 2 Buttons) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {/* Action 1: Voice Listen */}
                <button
                  onClick={handleSpeak}
                  className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-xl text-xs font-semibold border transition active:scale-[0.98] cursor-pointer ${
                    isPlayingAudio
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-200 hover:text-cyan-300 hover:border-cyan-500/30'
                  }`}
                >
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>{isPlayingAudio ? 'Stop Audio' : 'Listen Voice'}</span>
                </button>

                {/* Action 2: Show on Map (if markers exist) */}
                {message.map_markers && message.map_markers.length > 0 && onFocusMap ? (
                  <button
                    onClick={() => onFocusMap(message.map_markers!)}
                    className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>Show on map ({message.map_markers.length})</span>
                  </button>
                ) : (
                  /* Fallback button if no map markers (e.g. general info) */
                  <button
                    onClick={handleCopySql}
                    disabled={!message.sql}
                    className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition active:scale-[0.98] cursor-pointer disabled:opacity-40"
                  >
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    <span>View SQL Source</span>
                  </button>
                )}
              </div>

              {/* 6. Secondary Utility Row (Below Thin Divider) */}
              <div className="pt-2.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                {/* Left: Reading count */}
                <div className="flex items-center space-x-1.5 text-[11px] font-mono text-slate-400">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{readingCount} readings retrieved</span>
                </div>

                {/* Right: Ghost utility buttons */}
                <div className="flex items-center space-x-2">
                  {/* 3D OceanLens View */}
                  {message.chart?.chart_type === 'depth_profile' && onView3D && (
                    <button
                      onClick={onView3D}
                      title="Inspect in 3D WebGL Cylinder"
                      className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 text-xs font-medium transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800/60"
                    >
                      <Box className="w-3.5 h-3.5 text-cyan-400" />
                      <span>3D View</span>
                    </button>
                  )}

                  {/* SQL Toggle */}
                  {message.sql && (
                    <button
                      onClick={() => setShowSql(!showSql)}
                      className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-xs font-mono transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800/60"
                    >
                      <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>SQL</span>
                      {showSql ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  )}

                  {/* CSV Export */}
                  {message.data && message.data.length > 0 && (
                    <button
                      onClick={handleExportCSV}
                      title="Download query results as CSV"
                      className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-xs font-medium transition cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800/60"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      <span>CSV</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Collapsible SQL Block */}
              {showSql && message.sql && (
                <div className="mt-2 p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto">
                  <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800/80 text-[10px] text-slate-400">
                    <span className="uppercase tracking-wider font-bold text-cyan-400">Safe SELECT Query:</span>
                    <button
                      onClick={handleCopySql}
                      className="flex items-center space-x-1 text-slate-400 hover:text-white transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap leading-relaxed text-slate-300 font-mono text-[11px]">
                    {message.sql}
                  </pre>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
