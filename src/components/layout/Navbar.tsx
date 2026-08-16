import { 
  MessageSquare, 
  MapPin, 
  Box, 
  Radar, 
  GraduationCap, 
  Activity, 
  Globe2,
  Sparkles,
  Smartphone,
  GitBranch
} from 'lucide-react';
import type { AppMode, DashboardStats } from '../../types';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  stats: DashboardStats | null;
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  backendOnline: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  stats,
  selectedLanguage,
  onSelectLanguage,
  backendOnline,
}) => {
  const modes: { id: AppMode; label: string; icon: any; badge?: string; alert?: boolean }[] = [
    { id: 'chat', label: 'Lehar AI', icon: MessageSquare, badge: 'Voice + Chat' },
    { id: 'map', label: 'Fleet Map', icon: MapPin, badge: `${stats?.total_floats || 97} Floats` },
    { id: '3d', label: 'OceanLens 3D', icon: Box, badge: 'WebGL' },
    { id: 'anomaly', label: 'AnomalyRadar', icon: Radar, badge: 'Alerts', alert: true },
    { id: 'whatsapp', label: 'WhatsApp Bot', icon: Smartphone, badge: 'Coastal Delivery' },
    { id: 'classroom', label: 'Classroom', icon: GraduationCap, badge: 'NEP 2020' },
    { id: 'pipeline', label: 'Architecture', icon: GitBranch, badge: '4-Layer' },
  ];

  const languages = [
    { code: 'en-IN', label: 'English (IN)' },
    { code: 'hi-IN', label: 'हिंदी (Hindi)' },
    { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
    { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Brand & Team Identity */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="Lehar AI" 
                className="w-10 h-10 rounded-xl object-cover border border-cyan-500/40 shadow-lg shadow-cyan-500/25 ring-1 ring-cyan-500/30"
              />
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${backendOnline ? 'bg-emerald-400' : 'bg-amber-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 ${backendOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
              </span>
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5 font-heading">
                  Lehar <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">AI</span>
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-md">
                  SIH26040
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[11px] text-cyan-300 font-semibold tracking-wide">Know the Sea. Know the Way.</p>
                <span className="text-[10px] text-slate-500 hidden sm:inline">•</span>
                <p className="text-[10px] text-slate-400 font-medium hidden sm:inline">Ctrl Alt Elites • INCOIS ARGO</p>
              </div>
            </div>
          </div>

          {/* Mobile status pill */}
          <div className="flex md:hidden items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
            <Activity className="w-3 h-3 text-cyan-400" />
            <span>{stats?.total_profiles || 646} Profiles</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800/90 overflow-x-auto max-w-full no-scrollbar">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = currentMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onSelectMode(mode.id)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 whitespace-nowrap active:scale-98 cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-cyan-400'}`} />
                <span>{mode.label}</span>
                {mode.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : mode.alert
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {mode.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Telemetry & Controls */}
        <div className="hidden xl:flex items-center space-x-3">
          {/* Language Selector */}
          <div className="flex items-center space-x-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={selectedLanguage}
              onChange={(e) => onSelectLanguage(e.target.value)}
              aria-label="Select OceanVoice Language"
              className="bg-transparent text-slate-300 text-xs font-medium focus:outline-none cursor-pointer"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Telemetry Stats */}
          <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-slate-300 font-mono text-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin" style={{ animationDuration: '6s' }} />
            <span>
              <strong className="text-white">{stats?.total_profiles || 646}</strong> profiles (
              <span className="text-cyan-400">{stats?.total_floats || 97} floats</span>)
            </span>
          </div>
        </div>

      </div>
    </header>
  );
};
