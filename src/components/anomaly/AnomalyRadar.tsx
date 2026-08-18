import { useState } from 'react';
import { 
  Radar, 
  Flame, 
  Droplets, 
  MapPin, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import type { AnomalyAlert } from '../../types';

interface AnomalyRadarProps {
  anomalies: AnomalyAlert[];
  onSelectAnomaly?: (anomaly: AnomalyAlert) => void;
  onHoverAnomaly?: (anomaly: AnomalyAlert | null) => void;
  onTriggerScan?: () => void;
  isScanning?: boolean;
}

export const AnomalyRadar: React.FC<AnomalyRadarProps> = ({
  anomalies,
  onSelectAnomaly,
  onHoverAnomaly,
  onTriggerScan,
  isScanning = false,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [activeAlertId, setActiveAlertId] = useState<number | null>(null);

  const filtered = anomalies.filter((a) => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-coral-alert/20 text-coral-glow border-coral-alert/50 shadow-glow-coral';
      case 'high':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm';
      case 'medium':
        return 'bg-ocean-cyan/20 text-ocean-cyan border-ocean-cyan/40 shadow-sm';
      default:
        return 'bg-abyssal-800 text-slate-400 border-abyssal-700';
    }
  };

  return (
    <div className="flex flex-col h-full bg-abyssal-950/85 border border-abyssal-800/90 rounded-2xl p-4 md:p-5 shadow-2xl backdrop-blur-2xl space-y-4 overflow-hidden">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-abyssal-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-coral-alert/10 border border-coral-alert/30 text-coral-alert shadow-glow-coral">
            <Radar className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white font-heading">AnomalyRadar Watchdog</h3>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-coral-alert/20 text-coral-glow border border-coral-alert/30 font-mono">
                24/7 Ocean Alert
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
            type="button"
            onClick={onTriggerScan}
            disabled={isScanning}
            className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold text-xs shadow-md shadow-ocean-cyan/25 transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-abyssal-950 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Scanning Profiles...' : 'Run Live Scan'}</span>
          </button>
        )}
      </div>

      {/* Severity Filter Tabs */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-semibold mr-1 font-heading">Severity:</span>
        {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
          <button
            key={sev}
            type="button"
            onClick={() => setFilterSeverity(sev)}
            className={`px-3 py-1 rounded-xl font-semibold capitalize transition active:scale-95 cursor-pointer ${
              filterSeverity === sev
                ? 'bg-ocean-cyan text-abyssal-950 shadow-md shadow-ocean-cyan/20 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-abyssal-850'
            }`}
          >
            {sev}
          </button>
        ))}
      </div>

      {/* Alert Feed Stream */}
      <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-abyssal-900/40 rounded-xl border border-abyssal-800">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
            <p className="text-sm font-bold text-slate-200 font-heading">All Ocean Sectors Nominal</p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              No anomalies exceeding climatological threshold detected in current filter view.
            </p>
          </div>
        ) : (
          filtered.map((alert) => {
            const isTemp = alert.parameter.toLowerCase().includes('temp');
            const isSal = alert.parameter.toLowerCase().includes('sal');
            const isSelected = activeAlertId === alert.id;

            return (
              <div
                key={alert.id}
                onMouseEnter={() => onHoverAnomaly && onHoverAnomaly(alert)}
                onMouseLeave={() => onHoverAnomaly && onHoverAnomaly(null)}
                onClick={() => {
                  setActiveAlertId(alert.id);
                  if (onSelectAnomaly) onSelectAnomaly(alert);
                }}
                className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm ${
                  isSelected
                    ? 'bg-abyssal-850 border-ocean-cyan/60 shadow-glow-cyan-sm ring-1 ring-ocean-cyan/40'
                    : 'bg-abyssal-900/90 hover:bg-abyssal-850 border-abyssal-800 hover:border-abyssal-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`p-2 rounded-lg ${
                        isTemp
                          ? 'bg-coral-alert/10 text-coral-alert border border-coral-alert/30'
                          : isSal
                          ? 'bg-ocean-cyan/10 text-ocean-cyan border border-ocean-cyan/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isTemp ? <Flame className="w-4 h-4" /> : <Droplets className="w-4 h-4" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white font-heading">
                          {alert.parameter ? alert.parameter.toUpperCase() : 'Ocean Alert'}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase border font-mono ${getSeverityBadge(
                            alert.severity
                          )}`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{alert.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-white font-mono">
                      {alert.value}
                      <span className="text-[10px] text-slate-400 ml-0.5">
                        {isTemp ? '°C' : isSal ? 'PSU' : ''}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(alert.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Guardian Watchdog Push Badge */}
                {(alert.severity === 'critical' || alert.severity === 'high') && (
                  <div className="mt-2 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-950/60 border border-red-500/30 text-[9px] font-mono text-red-300">
                    <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />
                    <span>🛡️ Pushed to Coastal Fishermen via Lehar Guardian</span>
                  </div>
                )}

                {/* Bottom Footer Info */}
                <div className="mt-2.5 pt-2 border-t border-abyssal-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-ocean-cyan" />
                      {alert.latitude.toFixed(2)}°N, {alert.longitude.toFixed(2)}°E
                    </span>
                    <span>•</span>
                    <span>Float #{alert.float_id || 'Alert-Probe'}</span>
                  </div>

                  <span className="flex items-center gap-0.5 text-ocean-cyan hover:underline">
                    View on Map <ArrowUpRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
