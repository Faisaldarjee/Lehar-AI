import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Thermometer, Info, Layers } from 'lucide-react';
import type { ChartData } from '../../types';

interface DepthChartProps {
  chart: ChartData | null;
  title?: string;
}

export const DepthChart: React.FC<DepthChartProps> = ({ chart, title }) => {
  if (!chart || !chart.data || chart.data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-abyssal-950/60 rounded-2xl border border-abyssal-800">
        <div className="w-12 h-12 rounded-2xl bg-ocean-cyan/10 border border-ocean-cyan/20 flex items-center justify-center text-ocean-cyan mb-3 shadow-glow-cyan-sm">
          <Thermometer className="w-6 h-6 animate-pulse" />
        </div>
        <p className="text-sm font-bold text-slate-200 font-heading">No Depth Profile Selected</p>
        <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
          Ask Lehar AI for a depth curve or click any active ARGO float on the map to inspect vertical hydrographic salinity & temperature.
        </p>
      </div>
    );
  }

  // Deduplicate and average measurements by unique depth level (0 to 2000m)
  // Strictly filter out 0.0 or corrupted placeholder readings
  const depthMap = new Map<number, { depth: number; temps: number[]; sals: number[] }>();
  for (const d of chart.data) {
    if (d.depth === undefined || d.depth === null || isNaN(Number(d.depth))) continue;
    const depthVal = Math.round(Number(d.depth) * 10) / 10;
    if (!depthMap.has(depthVal)) {
      depthMap.set(depthVal, { depth: depthVal, temps: [], sals: [] });
    }
    const bucket = depthMap.get(depthVal)!;
    if (d.temperature !== undefined && !isNaN(Number(d.temperature))) {
      const t = Number(d.temperature);
      if (t >= 2.0 && t <= 36.0) {
        bucket.temps.push(t);
      }
    }
    if (d.salinity !== undefined && !isNaN(Number(d.salinity))) {
      const s = Number(d.salinity);
      if (s >= 15.0 && s <= 42.0) {
        bucket.sals.push(s);
      }
    }
  }

  const sortedData = Array.from(depthMap.values())
    .map((b) => ({
      depth: b.depth,
      temperature: b.temps.length ? Math.round((b.temps.reduce((acc, v) => acc + v, 0) / b.temps.length) * 100) / 100 : undefined,
      salinity: b.sals.length ? Math.round((b.sals.reduce((acc, v) => acc + v, 0) / b.sals.length) * 100) / 100 : undefined,
    }))
    .filter((row) => row.temperature !== undefined || row.salinity !== undefined)
    .sort((a, b) => a.depth - b.depth);

  const depths = sortedData.map((d) => d.depth);
  const maxMeasuredDepth = depths.length ? Math.max(...depths) : 2000;

  // Calculate dynamic vertical depth domain & ticks based on actual cast depth
  let yDomain: [number, number];
  let yTicks: number[];

  if (maxMeasuredDepth <= 60) {
    const topCap = Math.max(50, Math.ceil(maxMeasuredDepth / 10) * 10);
    yDomain = [0, topCap];
    yTicks = [0, Math.round(topCap * 0.25), Math.round(topCap * 0.5), Math.round(topCap * 0.75), topCap];
  } else if (maxMeasuredDepth <= 250) {
    const topCap = Math.max(100, Math.ceil(maxMeasuredDepth / 25) * 25);
    yDomain = [0, topCap];
    yTicks = [0, Math.round(topCap * 0.25), Math.round(topCap * 0.5), Math.round(topCap * 0.75), topCap];
  } else if (maxMeasuredDepth <= 1000) {
    const topCap = Math.max(500, Math.ceil(maxMeasuredDepth / 100) * 100);
    yDomain = [0, topCap];
    yTicks = [0, 250, 500, 750, topCap];
  } else {
    const topCap = Math.max(1500, Math.ceil(maxMeasuredDepth / 500) * 500);
    yDomain = [0, topCap];
    yTicks = [0, 500, 1000, 1500, topCap];
  }

  const validTemps = sortedData.map((d) => d.temperature).filter((t): t is number => typeof t === 'number');
  const surfaceTemp = validTemps.length ? validTemps[0].toFixed(1) : '28.6';
  const deepTemp = validTemps.length ? validTemps[validTemps.length - 1].toFixed(1) : '3.7';

  return (
    <div className="flex flex-col h-full bg-abyssal-950/90 border border-abyssal-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl font-sans">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-abyssal-800/80">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-heading">
            <Thermometer className="w-4 h-4 text-ocean-cyan" />
            <span>{title || chart.title || 'Argo Float Hydrographic Depth Profile'}</span>
          </h3>
          <p className="text-[10px] text-slate-400">Vertical Hydrographic CTD Water Column Curves ({Math.round(maxMeasuredDepth)}m Range)</p>
        </div>

        {/* Top Right Measurement Badges */}
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300 font-mono text-[11px] bg-abyssal-900/90 px-3 py-1 rounded-xl border border-slate-700/80 shadow-inner">
            <span>Temp (°C)</span>
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] bg-emerald-950/40 px-3 py-1 rounded-xl border border-emerald-500/40 shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-glow-emerald-sm"></span>
            <span>Salinity (PSU)</span>
          </span>
        </div>
      </div>

      {/* Depth Zones Pill Badges */}
      <div className="flex items-center gap-2 mb-2 px-1 text-[11px] font-mono overflow-x-auto no-scrollbar">
        <span className="text-slate-400 flex items-center gap-1 shrink-0 font-sans font-semibold text-xs">
          <Layers className="w-3.5 h-3.5 text-ocean-cyan" /> Zones:
        </span>
        <span className="bg-abyssal-900/90 border border-ocean-cyan/40 text-cyan-300 px-3 py-0.5 rounded-lg whitespace-nowrap shadow-sm font-semibold">
          Epipelagic (0–200m)
        </span>
        <span className="bg-abyssal-900/90 border border-teal-500/40 text-teal-300 px-3 py-0.5 rounded-lg whitespace-nowrap shadow-sm font-semibold">
          Mesopelagic (200–1000m)
        </span>
        <span className="bg-abyssal-900/90 border border-indigo-500/40 text-indigo-300 px-3 py-0.5 rounded-lg whitespace-nowrap shadow-sm font-semibold">
          Bathypelagic (&gt;1000m)
        </span>
      </div>

      {/* Recharts Clean Canvas Area */}
      <div className="flex-1 w-full min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0e2338" />
            
            {/* X Axis: Measurements (0.0 to 40.0) */}
            <XAxis
              type="number"
              domain={[0, 40]}
              ticks={[0, 10, 20, 30, 40]}
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={(v) => v.toFixed(1)}
            />

            {/* Y Axis: Dynamic Depth (0m to maxMeasuredDepth, 0m at top for vertical CTD profile) */}
            <YAxis
              type="number"
              dataKey="depth"
              reversed={true}
              domain={yDomain}
              ticks={yTicks}
              stroke="#475569"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              tickFormatter={(v) => `${v}m`}
              label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#05101d',
                borderColor: '#2dd4bf',
                borderRadius: '12px',
                color: '#f8fafc',
                fontSize: '11px',
                boxShadow: '0 15px 30px -5px rgba(0,0,0,0.85)',
              }}
              formatter={(value: any, name: any) => [
                typeof value === 'number' ? value.toFixed(2) : value,
                name === 'temperature' ? 'Temperature (°C)' : name === 'salinity' ? 'Salinity (PSU)' : name
              ]}
              labelFormatter={(depth) => `Depth: ${depth} meters`}
            />

            {/* Temperature Smooth Line (Cyan) */}
            <Line
              type="monotone"
              dataKey="temperature"
              name="Temperature (°C)"
              stroke="#20d6c7"
              strokeWidth={2.5}
              dot={false}
              connectNulls={true}
              activeDot={{ r: 5, fill: '#20d6c7' }}
            />

            {/* Salinity Smooth Line (Emerald) */}
            <Line
              type="monotone"
              dataKey="salinity"
              name="Salinity (PSU)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              connectNulls={true}
              activeDot={{ r: 5, fill: '#10b981' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Centered Legend Bar */}
      <div className="flex items-center justify-center gap-6 py-1 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-400 bg-abyssal-950"></span>
          <span>Salinity (PSU)</span>
        </div>
        <div className="flex items-center gap-1.5 text-ocean-cyan">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-ocean-cyan bg-abyssal-950"></span>
          <span>Temperature (°C)</span>
        </div>
      </div>

      {/* Hydrographic Info Footer */}
      <div className="mt-1 pt-2 border-t border-abyssal-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-ocean-cyan" />
          <span>Surface Temp: <strong className="text-white font-mono">{surfaceTemp}°C</strong> • Deep Temp: <strong className="text-white font-mono">{deepTemp}°C</strong></span>
        </div>
        <span className="font-mono text-cyan-300 bg-abyssal-900 px-2.5 py-0.5 rounded-lg border border-abyssal-800 text-[10px]">
          {sortedData.length} Depth Levels
        </span>
      </div>
    </div>
  );
};
