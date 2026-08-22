import React, { useState, useEffect, useRef } from 'react';
import { Radar, Compass, ShieldAlert, Sparkles, Activity, MapPin } from 'lucide-react';
import type { AnomalyAlert } from '../../types';

interface PolarRadarScopeProps {
  anomalies: AnomalyAlert[];
  selectedAnomaly: AnomalyAlert | null;
  onSelectAnomaly: (anomaly: AnomalyAlert) => void;
}

export const PolarRadarScope: React.FC<PolarRadarScopeProps> = ({
  anomalies,
  selectedAnomaly,
  onSelectAnomaly,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoveredAnomaly, setHoveredAnomaly] = useState<AnomalyAlert | null>(null);
  const [rangeNM, setRangeNM] = useState<number>(300);

  // Center coordinates: Arabian Sea / West Coast Hub (18.9°N, 72.8°E)
  const centerLat = 18.91;
  const centerLon = 72.83;

  // Convert lat/lon relative to center into polar angle and normalized radius
  const convertToPolar = (lat: number, lon: number, maxRangeNM: number) => {
    const latDiff = lat - centerLat;
    const lonDiff = lon - centerLon;
    // 1 degree lat approx 60 NM
    const dNorthNM = latDiff * 60;
    const dEastNM = lonDiff * 60 * Math.cos((centerLat * Math.PI) / 180);
    const distNM = Math.sqrt(dNorthNM * dNorthNM + dEastNM * dEastNM);
    const angleRad = Math.atan2(dEastNM, dNorthNM); // 0 = North, pi/2 = East
    const normRadius = Math.min(distNM / maxRangeNM, 0.95);
    return { distNM, angleRad, normRadius };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let sweepAngle = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = (Math.min(width, height) / 2) - 24;

      ctx.clearRect(0, 0, width, height);

      // 1. Radar Screen Background & Grid
      const bgGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      bgGrad.addColorStop(0, 'rgba(6, 78, 59, 0.2)');
      bgGrad.addColorStop(0.7, 'rgba(4, 47, 46, 0.4)');
      bgGrad.addColorStop(1, 'rgba(2, 44, 34, 0.85)');
      ctx.fillStyle = bgGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Concentric Range Rings (50, 100, 200, 300 NM)
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.25)';
      const rings = [0.25, 0.5, 0.75, 1.0];
      rings.forEach((rFactor, idx) => {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * rFactor, 0, Math.PI * 2);
        ctx.stroke();

        // Ring distance labels
        ctx.fillStyle = 'rgba(45, 212, 191, 0.6)';
        ctx.font = '10px monospace';
        const ringLabel = `${Math.round(rangeNM * rFactor)} NM`;
        ctx.fillText(ringLabel, centerX + 4, centerY - (radius * rFactor) + 12);
      });

      // 3. Crosshairs & Angle Rays (N, E, S, W, and diagonals)
      ctx.strokeStyle = 'rgba(20, 184, 166, 0.2)';
      ctx.beginPath();
      ctx.moveTo(centerX - radius, centerY);
      ctx.lineTo(centerX + radius, centerY);
      ctx.moveTo(centerX, centerY - radius);
      ctx.lineTo(centerX, centerY + radius);
      ctx.stroke();

      // Cardinal direction letters
      ctx.fillStyle = 'rgba(52, 211, 153, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N (000°)', centerX, centerY - radius - 10);
      ctx.fillText('S (180°)', centerX, centerY + radius + 10);
      ctx.fillText('E (090°)', centerX + radius + 14, centerY);
      ctx.fillText('W (270°)', centerX - radius - 14, centerY);

      // 4. Rotating Sweep Beam with Fading Phosphor Trail
      const sweepGrad = ctx.createConicGradient(sweepAngle - Math.PI / 2, centerX, centerY);
      sweepGrad.addColorStop(0, 'rgba(16, 185, 129, 0.55)');
      sweepGrad.addColorStop(0.12, 'rgba(16, 185, 129, 0.15)');
      sweepGrad.addColorStop(0.25, 'rgba(16, 185, 129, 0.01)');
      sweepGrad.addColorStop(1.0, 'transparent');

      ctx.fillStyle = sweepGrad;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Active sweep line
      const sweepX = centerX + Math.cos(sweepAngle - Math.PI / 2) * radius;
      const sweepY = centerY + Math.sin(sweepAngle - Math.PI / 2) * radius;
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(sweepX, sweepY);
      ctx.stroke();

      // 5. Render Detected Anomaly Blips
      anomalies.forEach((a) => {
        const { angleRad, normRadius } = convertToPolar(a.latitude, a.longitude, rangeNM);
        const blipX = centerX + Math.sin(angleRad) * (radius * normRadius);
        const blipY = centerY - Math.cos(angleRad) * (radius * normRadius);

        const isSelected = selectedAnomaly?.id === a.id;
        const isHovered = hoveredAnomaly?.id === a.id;
        const isCritical = a.severity === 'critical';

        // Blip Color
        const blipColor = isCritical ? '#f43f5e' : a.severity === 'high' ? '#f59e0b' : '#06b6d4';

        // Pulsing Reticle for selected/hovered
        if (isSelected || isHovered) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(blipX, blipY, 12, 0, Math.PI * 2);
          ctx.stroke();

          // Corner reticles
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
          ctx.strokeRect(blipX - 10, blipY - 10, 20, 20);
        }

        // Inner glowing blip dot
        ctx.fillStyle = blipColor;
        ctx.shadowColor = blipColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(blipX, blipY, isCritical ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      });

      sweepAngle += 0.025;
      if (sweepAngle >= Math.PI * 2) {
        sweepAngle = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [anomalies, selectedAnomaly, hoveredAnomaly, rangeNM]);

  // Handle canvas clicks to select closest blip
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = (Math.min(width, height) / 2) - 24;

    for (const a of anomalies) {
      const { angleRad, normRadius } = convertToPolar(a.latitude, a.longitude, rangeNM);
      const blipX = centerX + Math.sin(angleRad) * (radius * normRadius);
      const blipY = centerY - Math.cos(angleRad) * (radius * normRadius);
      const dist = Math.hypot(clickX - blipX, clickY - blipY);
      if (dist <= 16) {
        onSelectAnomaly(a);
        break;
      }
    }
  };

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6 p-4 rounded-2xl bg-abyssal-950/90 border border-emerald-500/30 shadow-2xl backdrop-blur-2xl">
      
      {/* 360° Polar Scope Canvas Container */}
      <div className="relative flex flex-col items-center shrink-0">
        <div className="relative p-2 rounded-full bg-gradient-to-b from-emerald-950/80 to-abyssal-950 border border-emerald-500/40 shadow-glow-emerald-lg">
          <canvas
            ref={canvasRef}
            width={320}
            height={320}
            onClick={handleCanvasClick}
            className="rounded-full cursor-crosshair"
          />

          {/* Top Live Badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-400/50 text-[9px] font-mono text-emerald-300 font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>360° Polar Scan</span>
          </div>

          {/* Center Origin Icon (Vessel / Sassoon Dock Origin) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 border border-white shadow-glow-emerald" />
          </div>
        </div>

        {/* Range Selector Controls */}
        <div className="flex items-center gap-1.5 mt-3 text-xs font-mono">
          <span className="text-slate-400 text-[10px]">Radar Range:</span>
          {[150, 300, 500].map((nm) => (
            <button
              key={nm}
              type="button"
              onClick={() => setRangeNM(nm)}
              className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold cursor-pointer transition ${
                rangeNM === nm
                  ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                  : 'bg-abyssal-900 border-abyssal-800 text-slate-400 hover:text-white'
              }`}
            >
              {nm} NM
            </button>
          ))}
        </div>
      </div>

      {/* Real-time Sector Threat Analytics */}
      <div className="flex-1 w-full space-y-3 font-sans">
        <div className="flex items-center justify-between border-b border-abyssal-800 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-bold text-white font-heading">
              Polar Threat Vector Analysis
            </h4>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/30 text-emerald-300 font-bold">
            {anomalies.length} Signals Monitored
          </span>
        </div>

        {selectedAnomaly ? (
          <div className="p-3 rounded-xl bg-abyssal-900/90 border border-emerald-500/40 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Target Locked: {selectedAnomaly.parameter.toUpperCase()}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono uppercase ${
                selectedAnomaly.severity === 'critical' ? 'bg-red-950 text-red-300 border border-red-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}>
                {selectedAnomaly.severity}
              </span>
            </div>

            <p className="text-xs text-slate-200 leading-relaxed">
              {selectedAnomaly.description}
            </p>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-2 border-t border-abyssal-800 text-slate-300">
              <div>Coords: <strong>{selectedAnomaly.latitude}°N, {selectedAnomaly.longitude}°E</strong></div>
              <div>Measured: <strong>{selectedAnomaly.value} {selectedAnomaly.parameter.includes('temp') ? '°C' : 'PSU'}</strong></div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-abyssal-900/40 border border-abyssal-800 text-center text-xs text-slate-400 space-y-1">
            <p className="font-bold text-slate-300">Click any radar blip to lock target</p>
            <p className="text-[11px]">Real-time distance and angular bearing from coastal hub (Mumbai 18.91°N, 72.83°E).</p>
          </div>
        )}

        {/* Quick Legend Tags */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 shadow-glow-coral" /> Critical Heatwave
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> High Deviation
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-cyan-400" /> Moderate Front
          </span>
        </div>

      </div>

    </div>
  );
};
