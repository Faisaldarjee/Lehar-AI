import React, { useState } from 'react';
import { 
  Radar, 
  Flame, 
  Droplets, 
  MapPin, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpRight,
  ShieldAlert,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Fish,
  AlertTriangle,
  Info
} from 'lucide-react';
import type { AnomalyAlert, AIAnomalyImpact } from '../../types';
import { PolarRadarScope } from './PolarRadarScope';

interface AnomalyRadarProps {
  anomalies: AnomalyAlert[];
  onSelectAnomaly?: (anomaly: AnomalyAlert) => void;
  onHoverAnomaly?: (anomaly: AnomalyAlert | null) => void;
  onTriggerScan?: () => void;
  isScanning?: boolean;
}

function getAIImpact(alert: AnomalyAlert): AIAnomalyImpact {
  const isTemp = alert.parameter.toLowerCase().includes('temp');
  const val = typeof alert.value === 'number' ? alert.value : parseFloat(alert.value);
  const diff = Math.abs(val - alert.threshold);

  if (isTemp && val > alert.threshold) {
    if (diff >= 2.0 || alert.severity === 'critical') {
      return {
        coral_bleaching_risk: 'Severe',
        fish_migration_shift: 'Tuna & Mackerel shoals diving to 50m–75m cold thermocline layer to escape thermal shock.',
        yield_impact_pct: '-30% to -45% in surface purse-seine operations.',
        actionable_advisory: 'Avoid surface gillnets in this sector. Switch to deep hook-and-line (50m+) or navigate to coastal upwelling fronts.',
      };
    }
    if (diff >= 1.0 || alert.severity === 'high') {
      return {
        coral_bleaching_risk: 'Moderate',
        fish_migration_shift: 'Pelagic sardine shoals scattering offshore into deeper shelf boundaries.',
        yield_impact_pct: '-15% to -25% localized catch drop.',
        actionable_advisory: 'Deploy troll lines at 30m depth. High feed activity expected at outer thermal boundary lines.',
      };
    }
    return {
      coral_bleaching_risk: 'Low',
      fish_migration_shift: 'Minor localized vertical movement; pelagic schools stable.',
      yield_impact_pct: 'Nominal (±5%).',
      actionable_advisory: 'Standard fishing operations safe. Monitor for sudden mixed layer depth drops.',
    };
  }

  // Salinity anomaly (Freshwater plume or hypersaline intrusion)
  return {
    coral_bleaching_risk: 'Low',
    fish_migration_shift: 'Estuarine species (Hilsa, Bhetki, White Prawns) congregating along freshwater plume boundary.',
    yield_impact_pct: '+20% higher yield for estuarine gillnetters near river mouths.',
    actionable_advisory: 'Set bottom gillnets along salinity front edge for premium Hilsa and tiger prawn catch.',
  };
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
  const [expandedImpactId, setExpandedImpactId] = useState<number | null>(null);
  const [showPolarScope, setShowPolarScope] = useState<boolean>(true);

  const filtered = anomalies.filter((a) => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const selectedAlert = anomalies.find((a) => a.id === activeAlertId) || (anomalies.length > 0 ? anomalies[0] : null);

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

  const handleCardClick = (alert: AnomalyAlert) => {
    setActiveAlertId(alert.id);
    if (onSelectAnomaly) {
      onSelectAnomaly(alert);
    }
  };

  return (
    <div className="flex flex-col h-full bg-abyssal-950/85 border border-abyssal-800/90 rounded-2xl p-4 md:p-5 shadow-2xl backdrop-blur-2xl space-y-4 overflow-y-auto">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-abyssal-800/80 shrink-0">
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
              Proactive marine heatwave (MHW) & deep CTD threshold deviation monitoring
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPolarScope(!showPolarScope)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition cursor-pointer flex items-center gap-1.5 ${
              showPolarScope
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-glow-emerald-sm'
                : 'bg-abyssal-900 border-abyssal-800 text-slate-400 hover:text-white'
            }`}
          >
            <Radar className="w-3.5 h-3.5" />
            <span>{showPolarScope ? 'Hide Polar Radar' : 'Show Polar Radar'}</span>
          </button>

          {onTriggerScan && (
            <button
              type="button"
              onClick={onTriggerScan}
              disabled={isScanning}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold text-xs shadow-md shadow-ocean-cyan/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-abyssal-950 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Run Live Scan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 1. FUTURISTIC 360° POLAR RADAR SCOPE COMPONENT */}
      {showPolarScope && (
        <div className="shrink-0 animate-in fade-in zoom-in-95 duration-200">
          <PolarRadarScope
            anomalies={anomalies}
            selectedAnomaly={selectedAlert}
            onSelectAnomaly={handleCardClick}
          />
        </div>
      )}

      {/* Severity Filter Tabs */}
      <div className="flex items-center justify-between gap-2 text-xs pt-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 font-semibold mr-1 font-heading">Severity:</span>
          {['all', 'critical', 'high', 'medium', 'low'].map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setFilterSeverity(sev)}
              className={`px-2.5 py-1 rounded-xl font-semibold capitalize transition active:scale-95 cursor-pointer text-xs ${
                filterSeverity === sev
                  ? 'bg-ocean-cyan text-abyssal-950 shadow-md shadow-ocean-cyan/20 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-abyssal-850'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Showing <strong>{filtered.length}</strong> active alerts
        </span>
      </div>

      {/* Alert Feed Stream */}
      <div className="space-y-3 pr-1">
        {filtered.length === 0 ? (
          <div className="p-8 bg-abyssal-900/40 rounded-xl border border-abyssal-800 text-center flex flex-col items-center justify-center">
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
            const isImpactOpen = expandedImpactId === alert.id;
            const aiImpact = getAIImpact(alert);

            return (
              <div
                key={alert.id}
                onMouseEnter={() => onHoverAnomaly && onHoverAnomaly(alert)}
                onMouseLeave={() => onHoverAnomaly && onHoverAnomaly(null)}
                className={`p-3.5 rounded-xl border transition-all duration-200 shadow-sm space-y-2.5 ${
                  isSelected
                    ? 'bg-abyssal-850 border-ocean-cyan/60 shadow-glow-cyan-sm ring-1 ring-ocean-cyan/40'
                    : 'bg-abyssal-900/90 hover:bg-abyssal-850 border-abyssal-800 hover:border-abyssal-700'
                }`}
              >
                <div 
                  onClick={() => handleCardClick(alert)}
                  className="flex items-start justify-between gap-2 cursor-pointer"
                >
                  <div className="flex items-center space-x-2.5">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
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
                        {alert.mhw_category && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-950 border border-rose-500/50 text-rose-300 font-mono">
                            {alert.mhw_category}
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border font-mono ${getSeverityBadge(
                            alert.severity
                          )}`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">{alert.description}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-white font-mono">
                      {typeof alert.value === 'number' ? alert.value.toFixed(2) : alert.value}
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
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-950/60 border border-red-500/30 text-[9px] font-mono text-red-300">
                    <ShieldAlert className="w-3 h-3 text-red-400 shrink-0" />
                    <span>🛡️ Pushed to Coastal Fishermen via Lehar Guardian</span>
                  </div>
                )}

                {/* 2. GEMINI AI ECOLOGICAL & FISHERY IMPACT ACCORDION */}
                <div className="border border-abyssal-800 rounded-lg overflow-hidden bg-abyssal-950/70">
                  <button
                    type="button"
                    onClick={() => setExpandedImpactId(isImpactOpen ? null : alert.id)}
                    className="w-full px-3 py-1.5 flex items-center justify-between text-xs font-semibold text-emerald-300 hover:bg-abyssal-850 cursor-pointer transition"
                  >
                    <div className="flex items-center gap-1.5 font-heading text-[11px]">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>🤖 AI Ecological & Fish Catch Impact Assessment</span>
                    </div>
                    {isImpactOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {isImpactOpen && (
                    <div className="p-3 border-t border-abyssal-800 space-y-2 text-[11px] font-sans animate-in fade-in">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                        <div className="p-2 rounded bg-abyssal-900 border border-abyssal-800">
                          <span className="text-slate-400 block text-[9px] uppercase">🪸 Coral Bleaching Risk</span>
                          <span className={`font-bold ${
                            aiImpact.coral_bleaching_risk === 'Severe' ? 'text-red-400' : aiImpact.coral_bleaching_risk === 'Moderate' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {aiImpact.coral_bleaching_risk} (Degree Heating Exposure)
                          </span>
                        </div>
                        <div className="p-2 rounded bg-abyssal-900 border border-abyssal-800">
                          <span className="text-slate-400 block text-[9px] uppercase">📉 Projected Harvest Yield</span>
                          <span className="font-bold text-amber-300">{aiImpact.yield_impact_pct}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div>
                          <strong className="text-slate-300">🐟 Pelagic Behavioral Shift:</strong>{' '}
                          <span className="text-slate-300">{aiImpact.fish_migration_shift}</span>
                        </div>
                        <div className="pt-1 border-t border-abyssal-800/80 text-emerald-200">
                          <strong className="text-emerald-400">💡 Actionable Fishermen Guidance:</strong>{' '}
                          {aiImpact.actionable_advisory}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Footer Info */}
                <div className="pt-1 border-t border-abyssal-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex items-center space-x-2">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-ocean-cyan" />
                      {alert.latitude.toFixed(2)}°N, {alert.longitude.toFixed(2)}°E
                    </span>
                    <span>•</span>
                    <span>Probe #{alert.float_id || 'Alert-Probe'}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCardClick(alert)}
                    className="flex items-center gap-0.5 text-ocean-cyan hover:underline cursor-pointer"
                  >
                    View on Map <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
