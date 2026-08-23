import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldAlert,
  Navigation,
  Volume2,
  RefreshCw,
  MapPin,
  Anchor,
  Radio,
  Send,
  AlertTriangle,
  Fish,
} from 'lucide-react';
import type { GuardianAlert, GuardianStatusResponse, AppMode } from '../../types';
import { getGuardianAlerts } from '../../services/api';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMode: (mode: AppMode) => void;
  onOpenTelegramModal?: () => void;
  onFocusMapLocation?: (lat: number, lon: number) => void;
}

const GEOFENCE_PRESETS = [
  { id: 'all', label: '🌐 All India Coast (National)', harbour: '', lat: undefined, lon: undefined },
  { id: 'mumbai', label: '⚓ Mumbai / Sassoon Dock (MH)', harbour: 'Mumbai (Sassoon Dock)', lat: 18.91, lon: 72.83 },
  { id: 'kochi', label: '⚓ Kochi / Cochin (KL)', harbour: 'Kochi (Cochin), Kerala', lat: 9.97, lon: 76.27 },
  { id: 'veraval', label: '⚓ Veraval / Porbandar (GJ)', harbour: 'Porbandar, Gujarat', lat: 21.64, lon: 69.61 },
  { id: 'chennai', label: '⚓ Royapuram / Chennai (TN)', harbour: 'Chennai (Royapuram)', lat: 13.12, lon: 80.30 },
  { id: 'vizag', label: '⚓ Visakhapatnam (AP)', harbour: 'Visakhapatnam, AP', lat: 17.69, lon: 83.22 },
  { id: 'goa', label: '⚓ Goa / Ratnagiri (Konkan)', harbour: 'Ratnagiri, Maharashtra', lat: 16.99, lon: 73.30 },
  { id: 'paradip', label: '⚓ Paradip Port (OD)', harbour: 'Paradip, Odisha', lat: 20.32, lon: 86.61 },
];

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onSelectMode,
  onOpenTelegramModal,
  onFocusMapLocation,
}) => {
  const [selectedHarbour, setSelectedHarbour] = useState('all');
  const [activeTab, setActiveTab] = useState<'all' | 'safety' | 'opportunity'>('all');
  const [radiusKm] = useState<number>(80);
  const [statusData, setStatusData] = useState<GuardianStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  // Fetch Geo-Fenced Alerts
  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const preset = GEOFENCE_PRESETS.find((p) => p.id === selectedHarbour);
      const params = preset?.id !== 'all' ? {
        harbour: preset?.harbour,
        lat: preset?.lat,
        lon: preset?.lon,
        radius_km: radiusKm,
      } : undefined;

      const data = await getGuardianAlerts(params);
      setStatusData(data);
    } catch (err) {
      console.error('Failed to load Guardian alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen, selectedHarbour, radiusKm]);

  // Voice narration using Web Speech API
  const handleSpeakAlert = (alert: GuardianAlert) => {
    if ('speechSynthesis' in window) {
      if (speakingId === alert.id) {
        window.speechSynthesis.cancel();
        setSpeakingId(null);
        return;
      }

      window.speechSynthesis.cancel();
      const textToSpeak = `${alert.title}. ${alert.message.replace(/[•*`]/g, '')}`;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);

      setSpeakingId(alert.id);
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleNavigateToMap = (lat: number, lon: number) => {
    onClose();
    if (onFocusMapLocation) {
      onFocusMapLocation(lat, lon);
    } else {
      onSelectMode('map');
    }
  };

  const alerts = statusData?.alerts || [];
  const filteredAlerts = alerts.filter((a) => {
    if (activeTab === 'all') return true;
    return a.type === activeTab;
  });

  const safetyCount = alerts.filter((a) => a.type === 'safety').length;
  const opportunityCount = alerts.filter((a) => a.type === 'opportunity').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1500] flex justify-end">
      {/* Dark Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Slide-out Glassmorphic Drawer Panel */}
      <div className="relative w-full max-w-md h-full bg-[#050e1a]/98 border-l border-cyan-500/30 shadow-2xl shadow-black z-10 flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-cyan-500/20 bg-[#071322]/90 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
              <ShieldAlert className="w-5 h-5 text-cyan-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white font-heading tracking-wide">
                  Lehar Guardian Watchdog
                </h2>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  LIVE 24/7
                </span>
              </div>
              <p className="text-[10px] text-cyan-300/70">
                Proactive Marine Safety & Multi-Sensor PFZ Telemetry
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
            title="Close Notification Center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Smart Geo-Fencing Harbour Selector Bar */}
        <div className="p-3 bg-[#081729] border-b border-cyan-500/20 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-cyan-300 font-bold flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-cyan-400" />
              <span>Smart Coastal Geo-Fence:</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
              Radius: <strong>{radiusKm} km</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <select
              value={selectedHarbour}
              onChange={(e) => setSelectedHarbour(e.target.value)}
              className="w-full bg-[#050e1a] border border-cyan-500/40 text-slate-200 text-xs rounded-xl px-3 py-1.5 font-mono focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
            >
              {GEOFENCE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {selectedHarbour !== 'all' && (
            <div className="flex items-center justify-between text-[10px] text-emerald-300/90 font-mono pt-1">
              <span className="flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                Geo-Fence Active: Filtered within {radiusKm}km radius
              </span>
              <button
                type="button"
                onClick={() => setSelectedHarbour('all')}
                className="text-slate-400 hover:text-white underline cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Category Tabs & Quick Refresh */}
        <div className="px-4 py-2 bg-[#061220] border-b border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('safety')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'safety'
                  ? 'bg-rose-500 text-white'
                  : 'text-rose-400 hover:bg-rose-950/40'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Safety ({safetyCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('opportunity')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1 ${
                activeTab === 'opportunity'
                  ? 'bg-amber-500 text-slate-950'
                  : 'text-amber-300 hover:bg-amber-950/40'
              }`}
            >
              <Fish className="w-3 h-3" />
              <span>PFZ ({opportunityCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchAlerts}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Scan Ocean Now"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>

        {/* Alerts Scrollable Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 mx-auto flex items-center justify-center text-slate-400">
                <ShieldAlert className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-xs text-slate-400 font-mono">
                No active threats or alerts within selected geo-fence radius.
              </p>
              <button
                type="button"
                onClick={() => setSelectedHarbour('all')}
                className="text-xs text-cyan-400 underline font-mono cursor-pointer"
              >
                View National All-India Ocean Alerts
              </button>
            </div>
          ) : (
            filteredAlerts.map((alert) => {
              const isSafety = alert.type === 'safety';
              return (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-2xl border transition-all duration-150 space-y-2.5 backdrop-blur-md ${
                    isSafety
                      ? 'bg-rose-950/30 border-rose-500/40 hover:border-rose-500/60 shadow-lg shadow-rose-950/20'
                      : 'bg-[#091e34]/70 border-amber-500/40 hover:border-amber-500/60 shadow-lg shadow-amber-950/20'
                  }`}
                >
                  {/* Alert Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            isSafety
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {isSafety ? '🚨 MARINE THREAT' : '🐟 PFZ OPPORTUNITY'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {alert.timestamp}
                        </span>
                      </div>
                      <h3 className="text-xs font-bold text-white leading-snug font-heading pt-0.5">
                        {alert.title}
                      </h3>
                    </div>

                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                        isSafety
                          ? 'bg-rose-950 text-rose-300 border border-rose-600/50'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                      }`}
                    >
                      {isSafety
                        ? alert.severity.toUpperCase()
                        : `SCORE ${alert.metrics?.pfz_score || 94}/100`}
                    </span>
                  </div>

                  {/* Message Body */}
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans line-clamp-3">
                    {alert.message.replace(/[*#]/g, '')}
                  </p>

                  {/* Geo-Location Distance Banner */}
                  <div className="flex items-center justify-between text-[10px] font-mono bg-[#050e1a]/80 p-2 rounded-xl border border-slate-800 text-slate-300">
                    <span className="flex items-center gap-1 text-cyan-300">
                      <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span>{alert.location?.distance_km} km from {alert.location?.home_harbour?.split(',')[0]}</span>
                    </span>
                    <span className="text-slate-400">
                      {alert.location?.latitude}°N, {alert.location?.longitude}°E
                    </span>
                  </div>

                  {/* Multi-Sensor Metrics Row */}
                  {alert.metrics && (
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                      {isSafety ? (
                        <>
                          <div className="p-1.5 rounded-lg bg-rose-950/40 border border-rose-500/20">
                            <span className="text-slate-400 block text-[8px] uppercase">Observed</span>
                            <strong className="text-rose-300 text-xs">
                              {alert.metrics.observed_value} {alert.metrics.unit}
                            </strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                            <span className="text-slate-400 block text-[8px] uppercase">Climatology Normal</span>
                            <strong className="text-white text-xs">
                              {alert.metrics.baseline_threshold} {alert.metrics.unit}
                            </strong>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-1.5 rounded-lg bg-[#0a1f36] border border-cyan-500/20">
                            <span className="text-slate-400 block text-[8px] uppercase">Fused SST</span>
                            <strong className="text-cyan-300 text-xs">
                              {alert.metrics.sst_celsius || 28.2}°C
                            </strong>
                          </div>
                          <div className="p-1.5 rounded-lg bg-[#0a1f36] border border-cyan-500/20">
                            <span className="text-slate-400 block text-[8px] uppercase">Thermocline Depth</span>
                            <strong className="text-emerald-300 text-xs">
                              {alert.metrics.mld_meters ? `${alert.metrics.mld_meters}m` : '35m'}
                            </strong>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleNavigateToMap(alert.location.latitude, alert.location.longitude)}
                      className="flex-1 py-1.5 px-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-cyan-500/20"
                    >
                      <Navigation className="w-3 h-3 text-slate-950" />
                      <span>Show on Ocean Map</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSpeakAlert(alert)}
                      className={`p-2 rounded-xl border transition cursor-pointer active:scale-95 ${
                        speakingId === alert.id
                          ? 'bg-amber-500 border-amber-400 text-slate-950 animate-pulse'
                          : 'bg-[#081829] border-cyan-500/30 text-cyan-300 hover:bg-[#0e2742]'
                      }`}
                      title={speakingId === alert.id ? 'Stop audio playback' : 'Listen spoken voice advisory'}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Telegram Live Mobile Dispatch Footer */}
        <div className="p-3 bg-[#071322] border-t border-cyan-500/20 flex items-center justify-between gap-2 select-none">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/40">
              <Send className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white font-heading">
                Telegram @LeharAIBot
              </div>
              <div className="text-[9px] text-slate-400">
                Pushes live voice alerts to fishermen smartphones
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onOpenTelegramModal) onOpenTelegramModal();
            }}
            className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-mono font-bold transition cursor-pointer"
          >
            Connect Bot
          </button>
        </div>

      </div>
    </div>
  );
};
