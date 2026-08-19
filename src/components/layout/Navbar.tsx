import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Compass,
  Radar,
  GraduationCap,
  ChevronDown,
  Smartphone,
  GitBranch,
  Sparkles,
  Activity
} from 'lucide-react';
import type { AppMode } from '../../types';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  backendOnline?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
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
    { id: 'anomaly', label: 'AnomalyRadar', icon: Radar, badge: 'LIVE', alert: true },
  ];

  const demoItems = [
    {
      id: 'whatsapp' as AppMode,
      label: 'WhatsApp Bot',
      desc: 'Vernacular voice & PFZ delivery for coastal fishermen',
      tag: 'Field Delivery',
      icon: Smartphone
    },
    {
      id: 'classroom' as AppMode,
      label: 'Classroom (NEP 2020)',
      desc: 'Adopt an ARGO Float & interactive ocean science quizzes',
      tag: 'Education',
      icon: GraduationCap
    },
    {
      id: 'pipeline' as AppMode,
      label: 'System Architecture',
      desc: '4-layer dataflow, NetCDF ingestion & Groq benchmarks',
      tag: 'For Judges',
      icon: GitBranch
    },
  ];

  const activeDemo = demoItems.find((d) => d.id === currentMode);
  const isDemoActive = Boolean(activeDemo);

  return (
    <header className="sticky top-0 z-[1200] bg-[#050e1a]/95 backdrop-blur-2xl border-b border-cyan-500/20 px-4 lg:px-8 py-2.5 shadow-2xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">

        {/* Left: Brand Identity & Tagline */}
        <div
          className="flex items-center space-x-3 cursor-pointer group shrink-0 select-none"
          onClick={() => onSelectMode('chat')}
          title="Lehar AI — SIH26040 | Team: Ctrl Alt Elites | INCOIS ARGO Intelligence"
        >
          <div className="relative ocean-breathing">
            <img
              src="/logo.png"
              alt="Lehar AI"
              className="w-9 h-9 rounded-xl object-cover border border-cyan-400/40 shadow-glow-cyan-sm ring-1 ring-cyan-400/30 group-hover:scale-105 transition-transform duration-200"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1 font-heading">
                Lehar <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-300 bg-clip-text text-transparent">AI</span>
              </h1>
            </div>
            <p className="text-[10px] text-cyan-300/80 font-medium tracking-wide">
              Know the Sea. Know the Way.
            </p>
          </div>
        </div>

        {/* Center: 3 Top-Level Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-[#091524] p-1 rounded-2xl border border-cyan-500/20 overflow-x-auto no-scrollbar shadow-inner">
          {topTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentMode === tab.id || (tab.id === 'map' && currentMode === '3d');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectMode(tab.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap active:scale-95 cursor-pointer ${isActive
                    ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-extrabold shadow-md shadow-cyan-500/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-cyan-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${isActive
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

        {/* Right Section: Offline Edge Badge & Demonstrators Dropdown */}
        <div className="flex items-center gap-2.5 shrink-0">

          {/* Real-time Offline Edge Readiness Badge */}
          <div
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-teal-950/80 border border-teal-500/40 text-[11px] font-mono text-teal-300 shadow-sm select-none"
            title="Lehar Edge Active: Local SQLite In-Situ DB + Cached NOAA Satellite Snapshot. 100% Offline Capable."
          >
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-cyan-sm animate-pulse shrink-0" />
            <span className="font-bold">Offline-Ready Edge</span>
          </div>

          {/* Demonstrators Dropdown Menu */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDemoOpen(!demoOpen)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer active:scale-95 ${isDemoActive
                  ? 'bg-cyan-950/80 border-cyan-400/60 text-cyan-300 shadow-glow-cyan-sm font-bold'
                  : 'bg-[#091524] hover:bg-[#0e2238] border-cyan-500/20 text-slate-300 hover:text-white'
                }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isDemoActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{isDemoActive ? activeDemo?.label : 'Demonstrators'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${demoOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
            </button>

            {/* Dropdown Popover (100% Solid Deep Navy Opaque Background) */}
            {demoOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#071322] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-black p-2 z-[9999] space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-cyan-500/20">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
                  <span>Target Demonstrator Modes</span>
                  <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
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
                      className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${isSelected
                          ? 'bg-cyan-950/80 border border-cyan-500/40 text-white shadow-inner font-bold'
                          : 'hover:bg-[#0c1e34] text-slate-300 hover:text-white'
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

      </div>
    </header>
  );
};
