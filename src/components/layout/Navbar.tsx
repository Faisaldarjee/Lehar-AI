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
  Activity,
  Palette
} from 'lucide-react';
import type { AppMode } from '../../types';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  backendOnline?: boolean;
}

export const THEME_OPTIONS = [
  { id: 'abyssal', label: '🌊 Abyssal Bio-Glow', desc: 'Deep Navy & Bioluminescent Cyan', dot: '#20d6c7' },
  { id: 'command', label: '🛰️ NASA / INCOIS Ops', desc: 'Stealth Obsidian & Arctic Blue', dot: '#38bdf8' },
  { id: 'mariana', label: '🌌 Mariana Trench', desc: 'Pitch Black & Emerald Phosphor', dot: '#10b981' },
  { id: 'pelagic', label: '💎 Royal Sapphire', desc: 'Deep Cobalt Marine & Aqua Crystal', dot: '#06b6d4' },
];

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
}) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>('abyssal');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Initialize theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('lehar_theme') || 'abyssal';
    setCurrentTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const handleSelectTheme = (themeId: string) => {
    setCurrentTheme(themeId);
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('lehar_theme', themeId);
    setThemeOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDemoOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeOpen(false);
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
    <header className="sticky top-0 z-[1200] bg-abyssal-950/95 backdrop-blur-2xl border-b border-abyssal-800/80 px-4 lg:px-8 py-2.5 shadow-2xl">
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
              className="w-9 h-9 rounded-xl object-cover border border-ocean-cyan/40 shadow-glow-cyan-sm ring-1 ring-ocean-cyan/30 group-hover:scale-105 transition-transform duration-200"
            />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1 font-heading">
                Lehar <span className="bg-gradient-to-r from-ocean-cyan via-teal-300 to-cyan-400 bg-clip-text text-transparent">AI</span>
              </h1>
            </div>
            <p className="text-[10px] text-cyan-300/80 font-medium tracking-wide">
              Know the Sea. Know the Way.
            </p>
          </div>
        </div>

        {/* Center: 3 Top-Level Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-abyssal-900/90 p-1 rounded-2xl border border-abyssal-800/90 overflow-x-auto no-scrollbar shadow-inner">
          {topTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentMode === tab.id || (tab.id === 'map' && currentMode === '3d');
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectMode(tab.id)}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-abyssal-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-abyssal-950' : 'text-ocean-cyan'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                      isActive
                        ? 'bg-abyssal-950/20 text-abyssal-950'
                        : tab.alert
                        ? 'bg-coral-alert/20 text-coral-glow border border-coral-alert/30 animate-pulse'
                        : 'bg-abyssal-800 text-slate-400'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Theme Selector, Offline Edge Badge & Demonstrators Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Live Theme Palette Switcher */}
          <div className="relative shrink-0" ref={themeRef}>
            <button
              type="button"
              onClick={() => {
                setThemeOpen(!themeOpen);
                setDemoOpen(false);
              }}
              title="Switch Visual Theme Palette"
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-abyssal-900/80 hover:bg-abyssal-850 border border-abyssal-800 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer active:scale-95 shadow-sm"
            >
              <Palette className="w-3.5 h-3.5 text-ocean-cyan" />
              <span className="hidden sm:inline">Theme</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${themeOpen ? 'rotate-180 text-ocean-cyan' : ''}`} />
            </button>

            {/* Theme Popover */}
            {themeOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-abyssal-950/98 backdrop-blur-3xl border border-abyssal-700/90 rounded-2xl shadow-2xl shadow-black p-2 z-[9999] space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-cyan-500/20">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between border-b border-abyssal-800 pb-1">
                  <span>Ocean Aesthetics</span>
                  <Palette className="w-3 h-3 text-ocean-cyan" />
                </div>
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleSelectTheme(t.id)}
                    className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      currentTheme === t.id
                        ? 'bg-ocean-cyan/15 border border-ocean-cyan/40 text-white font-bold'
                        : 'hover:bg-abyssal-850 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span 
                      className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 ring-1 ring-white/20" 
                      style={{ backgroundColor: t.dot }} 
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">{t.label}</div>
                      <div className="text-[10px] text-slate-400 leading-tight truncate">{t.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Real-time Offline Edge Readiness Badge */}
          <div 
            className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-teal-950/70 border border-teal-500/30 text-[10px] font-mono text-teal-300 shadow-sm select-none"
            title="Lehar Edge Active: Local SQLite In-Situ DB + Cached NOAA Satellite Snapshot. 100% Offline Capable."
          >
            <span className="w-2 h-2 rounded-full bg-teal-400 shadow-glow-cyan-sm animate-pulse shrink-0" />
            <span className="font-bold">Offline Edge</span>
          </div>

          {/* Demonstrators Dropdown Menu */}
          <div className="relative shrink-0" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => {
                setDemoOpen(!demoOpen);
                setThemeOpen(false);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 cursor-pointer active:scale-95 ${
                isDemoActive
                  ? 'bg-ocean-cyan/15 border-ocean-cyan/50 text-ocean-cyan shadow-glow-cyan-sm'
                  : 'bg-abyssal-900/80 hover:bg-abyssal-850 border-abyssal-800 text-slate-300 hover:text-white'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${isDemoActive ? 'text-ocean-cyan' : 'text-slate-400'}`} />
              <span>{isDemoActive ? activeDemo?.label : 'Demonstrators'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${demoOpen ? 'rotate-180 text-ocean-cyan' : 'text-slate-400'}`} />
            </button>

          {/* Dropdown Popover */}
          {demoOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-abyssal-950/98 backdrop-blur-3xl border border-abyssal-700/90 rounded-2xl shadow-2xl shadow-black p-2 z-[9999] space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-cyan-500/20">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center justify-between">
                <span>Target Demonstrator Modes</span>
                <Activity className="w-3 h-3 text-ocean-cyan animate-pulse" />
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
                    className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-ocean-cyan/15 border border-ocean-cyan/30 text-white shadow-inner'
                        : 'hover:bg-abyssal-800/80 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSelected ? 'bg-ocean-cyan/25 text-cyan-200' : 'bg-abyssal-800 text-ocean-cyan'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white leading-snug font-heading">{item.label}</span>
                        <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-abyssal-800 text-cyan-300">
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
