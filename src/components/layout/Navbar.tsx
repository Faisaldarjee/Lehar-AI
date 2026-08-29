import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Compass,
  Radar,
  ChevronDown,
  Smartphone,
  GitBranch,
  Sparkles,
  Activity,
  Send,
  FileText,
  Anchor,
  Microscope,
  GraduationCap,
  Box
} from 'lucide-react';
import type { AppMode, UserRole } from '../../types';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  userRole?: UserRole;
  onSelectRole?: (role: UserRole) => void;
  backendOnline?: boolean;
  onOpenTelegramModal?: () => void;
  onOpenBulletinModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  userRole = 'fisherman',
  onSelectRole,
  backendOnline = true,
  onOpenTelegramModal,
  onOpenBulletinModal,
}) => {
  const [demoOpen, setDemoOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDemoOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) {
        setRoleOpen(false);
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
      id: 'telegram' as AppMode,
      label: 'Telegram Live Bot',
      desc: 'Scan QR & test live @LeharAIBot on smartphone',
      tag: 'Live Phone Demo',
      icon: Send,
      isModal: true,
    },
    {
      id: 'whatsapp' as AppMode,
      label: 'WhatsApp Bot',
      desc: 'Vernacular voice & PFZ delivery for coastal fishermen',
      tag: 'Field Delivery',
      icon: Smartphone,
    },
    {
      id: 'pipeline' as AppMode,
      label: 'System Architecture',
      desc: '4-layer dataflow, NetCDF ingestion & Groq benchmarks',
      tag: 'For Judges',
      icon: GitBranch,
    },
    {
      id: 'twin' as AppMode,
      label: 'Ocean Twin VR/AR',
      desc: 'Immersive volumetric ocean digital twin with WebXR',
      tag: 'Immersive Demo',
      icon: Box,
      isModal: false,
    },
  ];

  const roleConfigs = {
    fisherman: { label: 'Fisherman Mode', icon: Anchor, color: 'text-amber-400', badge: '🎣 Field' },
    oceanographer: { label: 'Researcher Mode', icon: Microscope, color: 'text-ocean-cyan', badge: '🔬 Science' },
    student: { label: 'Classroom Mode', icon: GraduationCap, color: 'text-emerald-400', badge: '🎓 EdTech' },
  };

  const activeDemo = demoItems.find((d) => d.id === currentMode && !d.isModal);
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

        {/* Right Section: Adaptive Role Selector, Bulletin Button & Demonstrators */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Backend / Edge Indicator */}
          <div
            className={`hidden xl:flex items-center space-x-1.5 px-2.5 py-1 rounded-xl border text-[10px] font-mono select-none ${
              backendOnline
                ? 'bg-teal-950/80 border-teal-500/40 text-teal-300'
                : 'bg-amber-950/80 border-amber-500/40 text-amber-300'
            }`}
            title={backendOnline ? 'Backend Online: FastAPI ARGO & NetCDF services connected.' : 'Edge Mode: Local SQLite database active.'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${backendOnline ? 'bg-teal-400 animate-pulse' : 'bg-amber-400'}`} />
            <span>{backendOnline ? 'Online' : 'Edge'}</span>
          </div>

          {/* Adaptive Multi-Role Switcher */}
          <div className="relative" ref={roleRef}>
            <button
              type="button"
              onClick={() => setRoleOpen(!roleOpen)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#091524] hover:bg-[#0e2238] border border-cyan-500/30 text-white transition-all cursor-pointer shadow-sm active:scale-95"
              title="Switch user perspective (Fisherman / Scientist / Student)"
            >
              {React.createElement(roleConfigs[userRole].icon, { className: `w-3.5 h-3.5 ${roleConfigs[userRole].color}` })}
              <span className="hidden sm:inline font-bold">{roleConfigs[userRole].label}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {roleOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-[#071322] border border-cyan-500/30 rounded-2xl shadow-2xl p-1.5 z-[9999] space-y-1 ring-1 ring-cyan-500/20 animate-in fade-in">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono border-b border-slate-800 mb-1">
                  Select User Persona
                </div>
                {(['fisherman', 'oceanographer', 'student'] as UserRole[]).map((r) => {
                  const cfg = roleConfigs[r];
                  const Icon = cfg.icon;
                  const isSelected = userRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        if (onSelectRole) onSelectRole(r);
                        setRoleOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                          : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                        <span>{cfg.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">{cfg.badge}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Official INCOIS Bulletin Button */}
          {onOpenBulletinModal && (
            <button
              type="button"
              onClick={onOpenBulletinModal}
              className="hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-teal-500/20 to-cyan-500/20 hover:from-teal-500/30 hover:to-cyan-500/30 border border-teal-400/40 text-teal-200 transition-all cursor-pointer active:scale-95 shadow-sm"
              title="Generate Official INCOIS & Ministry of Earth Sciences Daily Marine Bulletin"
            >
              <FileText className="w-3.5 h-3.5 text-teal-300" />
              <span>Bulletin</span>
            </button>
          )}

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

            {/* Dropdown Popover */}
            {demoOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-[#071322] border border-cyan-500/30 rounded-2xl shadow-2xl shadow-black p-2 z-[9999] space-y-1 animate-in fade-in slide-in-from-top-2 duration-150 ring-1 ring-cyan-500/20">
                <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between border-b border-slate-800 pb-1.5 mb-1">
                  <span>Target Demonstrator Modes</span>
                  <Activity className="w-3 h-3 text-cyan-400 animate-pulse" />
                </div>
                {demoItems.map((item) => {
                  const Icon = item.icon;
                  const isSelected = currentMode === item.id && !item.isModal;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.isModal && onOpenTelegramModal) {
                          onOpenTelegramModal();
                        } else {
                          onSelectMode(item.id);
                        }
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

