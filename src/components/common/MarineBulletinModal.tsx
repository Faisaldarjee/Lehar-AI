import React from 'react';
import { 
  X, 
  Printer, 
  Flame, 
  Fish, 
  Ship, 
  QrCode, 
  ShieldCheck 
} from 'lucide-react';
import type { PFZAdvisory, AnomalyAlert } from '../../types';

interface MarineBulletinModalProps {
  isOpen: boolean;
  onClose: () => void;
  pfzAdvisories: PFZAdvisory[];
  anomalies: AnomalyAlert[];
}

export const MarineBulletinModal: React.FC<MarineBulletinModalProps> = ({
  isOpen,
  onClose,
  pfzAdvisories,
  anomalies,
}) => {
  if (!isOpen) return null;

  const topAdvisories = pfzAdvisories.slice(0, 3);
  const mhwAlerts = anomalies.filter(a => a.parameter.toLowerCase().includes('temp')).slice(0, 3);
  const now = new Date();
  const bulletinNo = `INCOIS-MOES-LEHAR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-01`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-abyssal-950/80 backdrop-blur-md animate-fade-in print:p-0 print:bg-white">
      {/* Modal Card */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-abyssal-900 border border-ocean-cyan/30 rounded-2xl shadow-2xl overflow-hidden print:border-none print:shadow-none print:max-h-full print:bg-white print:text-black">
        
        {/* Top Control Bar (Hidden in Print) */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-abyssal-950/90 border-b border-abyssal-800 print:hidden">
          <div className="flex items-center gap-2 text-xs font-mono text-ocean-cyan">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>OFFICIAL OPERATIONAL BULLETIN SYSTEM (SIH26040)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-ocean-cyan/20 border border-ocean-cyan/50 hover:bg-ocean-cyan/30 rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-abyssal-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-slate-200 font-sans print:p-0 print:text-black print:overflow-visible">
          
          {/* Header Banner */}
          <div className="border-b-2 border-ocean-cyan/40 pb-5 text-center space-y-1.5">
            <div className="flex items-center justify-center gap-3">
              <span className="text-2xl">🇮🇳</span>
              <div className="text-left">
                <h1 className="text-lg font-black tracking-wider text-white uppercase print:text-black">
                  Ministry of Earth Sciences • Government of India
                </h1>
                <p className="text-xs font-medium text-ocean-cyan font-mono print:text-slate-700">
                  Indian National Centre for Ocean Information Services (INCOIS) & Lehar AI
                </p>
              </div>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 border-t border-abyssal-800/60 mt-3 print:border-slate-300 print:text-slate-600">
              <span><strong>BULLETIN NO:</strong> {bulletinNo}</span>
              <span><strong>ISSUED AT:</strong> {now.toUTCString()}</span>
              <span><strong>STATUS:</strong> OPERATIONAL (LEVEL-4)</span>
            </div>
          </div>

          {/* Section 1: Synoptic Ocean State & Marine Heatwaves */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-abyssal-700 pb-1.5 print:border-slate-300">
              <Flame className="w-4 h-4 text-coral-glow print:text-red-600" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide print:text-black">
                1. Synoptic Ocean Thermal Anomalies (Hobday et al. 2016 Standards)
              </h2>
            </div>
            {mhwAlerts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {mhwAlerts.map((alert, idx) => (
                  <div key={idx} className="p-3 bg-abyssal-950/60 border border-abyssal-700/80 rounded-xl space-y-1.5 print:border-slate-300 print:bg-slate-50">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-ocean-cyan font-bold print:text-slate-800">Float #{alert.float_id || 'ARGO'}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 print:text-red-700">
                        {alert.mhw_category || alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 print:text-slate-700 line-clamp-2 leading-relaxed">
                      {alert.description}
                    </p>
                    <div className="text-[11px] font-mono text-slate-400 print:text-slate-600">
                      Coordinates: {alert.latitude.toFixed(2)}°N, {alert.longitude.toFixed(2)}°E
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No critical thermal anomalies exceeding Hobday Cat-II active in Indian coastal waters today.</p>
            )}
          </div>

          {/* Section 2: Prime Potential Fishing Zones & Voyage Economics */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-abyssal-700 pb-1.5 print:border-slate-300">
              <Fish className="w-4 h-4 text-emerald-400 print:text-emerald-700" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wide print:text-black">
                2. High-Yield Potential Fishing Zones (PFZ) & NavIC Voyage Economics
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-abyssal-950/80 border-b border-abyssal-700 text-slate-400 font-mono print:bg-slate-100 print:text-black">
                    <th className="py-2.5 px-3">Sector / Zone</th>
                    <th className="py-2.5 px-3">Coordinates</th>
                    <th className="py-2.5 px-3">SST / MLD</th>
                    <th className="py-2.5 px-3">Target Species</th>
                    <th className="py-2.5 px-3">Closest Port & Range</th>
                    <th className="py-2.5 px-3">NavIC Est. Savings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-abyssal-800 print:divide-slate-200">
                  {topAdvisories.map((pfz, idx) => {
                    const distKm = pfz.nearest_harbour?.distance_km || 40;
                    const fuelSavedL = Math.round(distKm * 0.45);
                    const inrSaved = fuelSavedL * 94;
                    return (
                      <tr key={idx} className="hover:bg-abyssal-800/30 print:hover:bg-transparent">
                        <td className="py-2 px-3 font-semibold text-ocean-cyan print:text-blue-700">
                          {pfz.float_id}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300 print:text-slate-800">
                          {pfz.latitude.toFixed(3)}°N, {pfz.longitude.toFixed(3)}°E
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300 print:text-slate-800">
                          {pfz.sst_celsius.toFixed(1)}°C | {pfz.mld_meters ? `${pfz.mld_meters.toFixed(0)}m` : 'Coastal'}
                        </td>
                        <td className="py-2 px-3 text-emerald-300 print:text-emerald-800">
                          {pfz.target_species.slice(0, 2).join(', ')}
                        </td>
                        <td className="py-2 px-3 text-slate-300 print:text-slate-700">
                          {pfz.nearest_harbour?.harbour || 'Coast'} ({distKm} km {pfz.nearest_harbour?.compass || 'W'})
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-amber-300 print:text-amber-800">
                          ~₹{inrSaved.toLocaleString()} ({fuelSavedL}L)
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Operational Advisory & Multi-Channel Delivery */}
          <div className="p-4 bg-abyssal-950/80 border border-ocean-cyan/30 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 print:border-slate-400 print:bg-slate-50">
            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-white print:text-black">
                <Ship className="w-4 h-4 text-ocean-cyan print:text-blue-600" />
                <span>24/7 Multi-Lingual Last-Mile Delivery</span>
              </div>
              <p className="text-slate-300 print:text-slate-700 text-[11px] leading-relaxed">
                Coastal fishermen can receive spoken voice advisories in Hindi, Tamil, Telugu & Marathi directly on Telegram (@LeharAIBot) by sharing their live GPS coordinates.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right text-[10px] font-mono text-slate-400 print:text-slate-600 hidden md:block">
                <div>Scan to Launch</div>
                <div className="font-bold text-ocean-cyan">@LeharAIBot</div>
              </div>
              <div className="w-14 h-14 bg-white p-1 rounded-lg flex items-center justify-center shadow-md">
                <QrCode className="w-12 h-12 text-black" />
              </div>
            </div>
          </div>

          {/* Footer Official Notice */}
          <div className="text-[10px] font-mono text-slate-500 border-t border-abyssal-800 pt-3 text-center space-y-0.5 print:border-slate-300 print:text-slate-600">
            <p>Developed for Smart India Hackathon 2026 (Problem Statement: SIH26040) • Team Ctrl Alt Elites</p>
            <p>Data Sources: INCOIS ARGO NetCDF Telemetry • NOAA MUR SST • NASA VIIRS Ocean Color • Open-Meteo High-Resolution Marine ECMWF</p>
          </div>

        </div>
      </div>
    </div>
  );
};
