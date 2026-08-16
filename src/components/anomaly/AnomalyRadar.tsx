import { useState } from 'react';
import { 
  Radar, 
  Flame, 
  Droplets, 
  MapPin, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpRight
} from 'lucide-react';
import type { AnomalyAlert } from '../../types';

interface AnomalyRadarProps {
  anomalies: AnomalyAlert[];
  onSelectAnomaly?: (anomaly: AnomalyAlert) => void;
  onTriggerScan?: () => void;
  isScanning?: boolean;
}

export const AnomalyRadar: React.FC<AnomalyRadarProps> = ({
  anomalies,
  onSelectAnomaly,
  onTriggerScan,
  isScanning = false,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const filtered = anomalies.filter((a) => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'medium':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-4">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">AnomalyRadar Watchdog</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-rose-500/20 text-rose-400 border border-rose-500/30">
                24/7 Ocean Health Alert
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Proactive marine heatwave and salinity threshold deviation monitoring
            </p>
          </div>
        </div>

        {/* Scan Trigger Button */}
        {onTriggerScan && (
          <button
            onClick={onTriggerScan}
            disabled={isScanning}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-200 hover:text-white transition disabled:opacity-50 cursor-pointer shadow-md"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Profiles...' : 'Run Live Scan'}</span>
          </button>
        )}
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-500 font-medium mr-1">Severity:</span>
        {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
          <button
            key={sev}
            onClick={() => setFilterSeverity(sev)}
            className={`px-2.5 py-1 rounded-lg font-medium capitalize transition ${
              filterSeverity === sev
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Alert Cards Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filtered.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400/60" />
            <p className="text-sm font-semibold text-slate-300">All Parameters Normal</p>
            <p className="text-xs max-w-xs">No active anomalies matching this severity filter in the Indian Ocean sector.</p>
          </div>
        ) : (
          filtered.map((alert) => (
            <div
              key={alert.id}
              onClick={() => onSelectAnomaly && onSelectAnomaly(alert)}
              className="group p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/90 hover:border-cyan-500/40 transition-all duration-200 cursor-pointer shadow-md hover:shadow-cyan-950/20 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center space-x-2">
                  {alert.parameter === 'temperature' ? (
                    <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <Droplets className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  <span className="font-bold text-white text-sm">
                    {alert.parameter === 'temperature' ? 'Surface Temperature Spike' : 'Salinity Influx Anomaly'}
                  </span>
                  {alert.mhw_category && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {alert.mhw_category}
                    </span>
                  )}
                </div>

                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getSeverityBadge(
                    alert.severity
                  )}`}
                >
                  {alert.severity}
                </span>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">{alert.description}</p>

              {/* Telemetry Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-slate-300">
                    <MapPin className="w-3 h-3 text-cyan-400" />
                    {alert.latitude.toFixed(2)}°N, {alert.longitude.toFixed(2)}°E
                  </span>
                  <span>
                    Observed: <strong className="text-white">{alert.value}</strong> vs Threshold{' '}
                    <strong className="text-slate-300">{alert.threshold}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1 text-cyan-400 group-hover:translate-x-0.5 transition-transform">
                  <span>Focus Map</span>
                  <ArrowUpRight className="w-3 h-3" />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};
