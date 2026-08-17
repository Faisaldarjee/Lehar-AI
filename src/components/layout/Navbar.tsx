import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, 
  Compass, 
  Radar, 
  GraduationCap, 
  ChevronDown,
  Smartphone,
  GitBranch,
  Sparkles
} from 'lucide-react';
import type { AppMode } from '../../types';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  backendOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  backendOnline,
}) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDemoOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const topTabs: { id: AppMode; label: string; icon: any; badge?: string; alert?: boolean }[] = [
    { id: 'chat', label: 'AI Console', icon: MessageSquare },
    { id: 'map', label: 'Ocean Explorer', icon: Compass },
    { id: 'anomaly', label: 'AnomalyRadar', icon: Radar, badge: '9 Alerts', alert: true },
  ];

  const demoItems: { id: AppMode; label: string; desc: string; icon: any; tag: string }[] = [
    { 
      id: 'whatsapp', 
      label: 'WhatsApp Bot', 
      desc: 'Vernacular voice & PFZ delivery for coastal fishermen', 
      icon: Smartphone, 
      tag: 'Field Delivery' 
    },
    { 
      id: 'classroom', 
      label: 'Classroom (NEP 2020)', 
      desc: 'Adopt an ARGO Float & interactive ocean science quiz', 
      icon: GraduationCap, 
      tag: 'Education' 
    },
    { 
      id: 'pipeline', 
      label: 'System Architecture', 
      desc: '4-layer dataflow, NetCDF ingestion & Groq benchmark specs', 
      icon: GitBranch, 
      tag: 'For Judges' 
    },
  ];

  const activeDemo = demoItems.find((d) => d.id === currentMode);
  const isDemoActive = Boolean(activeDemo);

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        
        {/* Left: Brand Identity & Tagline */}
        <div 
          className="flex items-center space-x-3 cursor-pointer group shrink-0"
          onClick={() => onSelectMode('chat')}
          title="Lehar AI — SIH26040 | Team: Ctrl Alt Elites | INCOIS ARGO Intelligence"
        >
          <div className="relative">
            <img 
              src="/logo.png" 
              alt="Lehar AI" 
              className="w-9 h-9 rounded-xl object-cover border border-cyan-500/40 shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-500/30 group-hover:scale-105 transition-transform"
            />
            <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${backendOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1 font-heading">
                Lehar <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">AI</span>
              </h1>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[10px] font-bold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded">
                SIH26040
              </span>
            </div>
            <p className="text-[10px] text-cyan-300 font-medium tracking-wide">
              Know the Sea. Know the Way.
            </p>
          </div>
        </div>

        {/* Center: 3 Top-Level Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-2xl border border-slate-800/90 overflow-x-auto no-scrollbar">
          {topTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentMode === tab.id || (tab.id === 'map' && currentMode === '3d');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectMode(tab.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap active:scale-98 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-cyan-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : tab.alert
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Demonstrators Dropdown Menu */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDemoOpen(!demoOpen)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-150 cursor-pointer ${
              isDemoActive
                ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/30'
                : 'bg-slate-900/80 hover:bg-slate-850 border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isDemoActive ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span>{isDemoActive ? activeDemo?.label : 'Demonstrators'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${demoOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
          </button>

          {/* Dropdown Popover */}
          {demoOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-slate-900/98 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl p-2 z-[100] space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Target Demonstrator Modes
              </div>
              {demoItems.map((item) => {
                const Icon = item.icon;
                const isSelected = currentMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectMode(item.id);
                      setDemoOpen(false);
                    }}
                    className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/15 border border-cyan-500/30 text-white shadow-inner'
                        : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-cyan-400'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white leading-snug font-heading">{item.label}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-cyan-300">
                          {item.tag}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-tight mt-0.5 truncate">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </header>
  );
};
