import React, { useState, useRef, useEffect } from 'react';
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
  MoreHorizontal
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
    case 'temperature':
    case 'sst':
      return <Thermometer className={iconClass} />;
    case 'waves':
    case 'salinity':
      return <Waves className={iconClass} />;
    case 'compass':
    case 'harbour':
    case 'bearing':
      return <Compass className={iconClass} />;
    case 'fish':
    case 'species':
    case 'pfz':
      return <Fish className={iconClass} />;
    case 'activity':
    case 'mld':
      return <Activity className={iconClass} />;
    case 'alert':
      return <AlertTriangle className={iconClass} />;
    default:
      return <Gauge className={iconClass} />;
  }
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onFocusMap,
  onView3D,
}) => {
  const [copied, setCopied] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isUser = message.role === 'user';

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopySql = () => {
    if (message.sql) {
      navigator.clipboard.writeText(message.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExportCSV = () => {
    if (!message.data || message.data.length === 0) return;
    const headers = Object.keys(message.data[0]);
    const csvRows = [
      headers.join(','),
      ...message.data.map(row =>
        headers
          .map(header => {
            const val = row[header];
            if (val === null || val === undefined) return '';
            const strVal = String(val);
            if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
              return `"${strVal.replace(/"/g, '""')}"`;
            }
            return strVal;
          })
          .join(',')
      ),
    ];
    const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lehar_ai_export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  // Text-to-speech reading using Web Speech API
  const handlePlayVoice = () => {
    if (isPlayingAudio) {
      window.speechSynthesis?.cancel();
      setIsPlayingAudio(false);
      return;
    }
    const textToSpeak = message.summary || message.content;
    setIsPlayingAudio(true);
    speakText(textToSpeak, message.language || 'en-IN').finally(() => {
      setIsPlayingAudio(false);
    });
  };

  const summaryText = message.summary || message.content;
  const readingCount = message.reading_count ?? (message.data ? message.data.length : 0);

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} py-2`}>
      <div className={`flex max-w-[92%] sm:max-w-[85%] space-x-2.5 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border shadow-md ${
            isUser
              ? 'bg-slate-800 border-slate-700 text-slate-200'
              : 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 shadow-cyan-950/40'
          }`}
        >
          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
        </div>

        {/* Message Bubble / Card */}
        <div
          className={`relative rounded-2xl p-4 transition-all duration-200 ${
            isUser
              ? 'bg-cyan-500 text-slate-950 font-medium rounded-tr-sm shadow-lg shadow-cyan-500/20'
              : 'bg-slate-900/90 border border-slate-800/90 text-slate-100 rounded-tl-sm shadow-xl shadow-slate-950/50 backdrop-blur-md w-full'
          }`}
        >
          {/* USER MESSAGE VIEW */}
          {isUser ? (
            <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
              {message.content}
            </p>
          ) : (
            /* ASSISTANT STRUCTURED CARD VIEW */
            <>
              {/* 1. Header with Metadata & Progressive Disclosure Meatball Menu */}
              <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/80 text-[10px] text-slate-400">
                <div className="flex items-center space-x-1.5">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span className="font-bold tracking-wider uppercase text-cyan-300 font-mono">
                    Lehar AI Ocean Intelligence
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="font-mono text-slate-500">
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  {/* Meatball More Actions Menu (SQL, CSV Export) */}
                  <div className="relative" ref={menuRef}>
                    <button
                      onClick={() => setMenuOpen(!menuOpen)}
                      title="More data actions"
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-1 w-44 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl p-1 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
                        {message.sql && (
                          <button
                            onClick={() => {
                              setShowSql(!showSql);
                              setMenuOpen(false);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer font-mono"
                          >
                            <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>{showSql ? 'Hide SQL' : 'View SQL Query'}</span>
                          </button>
                        )}
                        {message.data && message.data.length > 0 && (
                          <button
                            onClick={handleExportCSV}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-400" />
                            <span>Export as CSV</span>
                          </button>
                        )}
                        {message.sql && (
                          <button
                            onClick={() => {
                              handleCopySql();
                              setMenuOpen(false);
                            }}
                            className="w-full flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-left text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                          >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                            <span>{copied ? 'Copied' : 'Copy SQL Text'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Hero Summary Line */}
              <div className="mb-3">
                <p className="text-xs sm:text-sm text-slate-100 font-semibold leading-snug tracking-wide">
                  {summaryText}
                </p>
              </div>

              {/* 3. Hero Metric Block (Big Focus Value) */}
              {message.hero_stat && (
                <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-slate-950 via-cyan-950/40 to-slate-950 border border-cyan-500/30 shadow-inner">
                  <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-400/90 font-mono">
                    {message.hero_stat.label}
                  </div>
                  <div className="flex items-baseline space-x-2 mt-0.5">
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight font-heading">
                      {message.hero_stat.value}
                    </span>
                    {message.hero_stat.unit && (
                      <span className="text-xs font-semibold text-cyan-300/80">
                        {message.hero_stat.unit}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Three-Column Stat Chips */}
              {message.stats && message.stats.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  {message.stats.map((stat: StatItem, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-center text-left hover:border-slate-700/80 transition-colors"
                    >
                      <div className="flex items-center space-x-1.5">
                        {renderStatIcon(stat.icon)}
                        <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono tracking-wider truncate">
                          {stat.label}
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-200 mt-0.5 truncate" title={stat.value}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 5. Primary Action Row: Listen Voice + Contextual View Action */}
              <div className="grid grid-cols-2 gap-2 mb-2">
                {/* Action 1: Listen Voice */}
                <button
                  onClick={handlePlayVoice}
                  className={`flex items-center justify-center space-x-2 py-2 px-3 rounded-xl border text-xs font-semibold transition active:scale-[0.98] cursor-pointer ${
                    isPlayingAudio
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                      : 'bg-slate-950/70 hover:bg-slate-800 border-slate-800 text-slate-200 hover:text-cyan-300 hover:border-cyan-500/30'
                  }`}
                >
                  <Volume2 className="w-4 h-4 text-cyan-400" />
                  <span>{isPlayingAudio ? 'Stop Audio' : 'Listen Voice'}</span>
                </button>

                {/* Action 2: Contextual View (Show on Map OR 3D Profile) */}
                {message.chart?.chart_type === 'depth_profile' && onView3D ? (
                  <button
                    onClick={onView3D}
                    className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                  >
                    <Box className="w-4 h-4 text-cyan-400" />
                    <span>Open 3D Lens</span>
                  </button>
                ) : message.map_markers && message.map_markers.length > 0 && onFocusMap ? (
                  <button
                    onClick={() => onFocusMap(message.map_markers!)}
                    className="flex items-center justify-center space-x-2 py-2 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-500/30 hover:border-cyan-500/50 text-cyan-300 text-xs font-semibold transition active:scale-[0.98] cursor-pointer"
                  >
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <span>Show on map ({message.map_markers.length})</span>
                  </button>
                ) : (
                  <div className="flex items-center justify-center text-[10px] font-mono text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/50">
                    <Database className="w-3 h-3 mr-1 text-cyan-400" />
                    <span>{readingCount} readings</span>
                  </div>
                )}
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
