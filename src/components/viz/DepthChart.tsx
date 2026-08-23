import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import { Thermometer, Info, Layers, Droplets } from 'lucide-react';
import type { ChartData } from '../../types';

interface DepthChartProps {
  chart: ChartData | null;
  title?: string;
}

export const DepthChart: React.FC<DepthChartProps> = ({ chart, title }) => {
  const [viewMode, setViewMode] = useState<'temp' | 'sal' | 'both'>('temp');

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

  // Robustly deduplicate and average multiple profile casts by unique depth level
  // and strictly filter out invalid 0.0/placeholder sensor readings
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
      // Legitimate Indian Ocean water temperature range: 2.0°C to 36.0°C (ignore 0.0 placeholders)
      if (t >= 2.0 && t <= 36.0) {
        bucket.temps.push(t);
      }
    }
    if (d.salinity !== undefined && !isNaN(Number(d.salinity))) {
      const s = Number(d.salinity);
      // Legitimate marine salinity range: 15.0 to 42.0 PSU
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

  const hasTemp = sortedData.some((d) => d.temperature !== undefined);
  const hasSal = sortedData.some((d) => d.salinity !== undefined);

  // Compute temperature domain
  const validTemps = sortedData.map((d) => d.temperature).filter((t): t is number => typeof t === 'number');
  const minTempNum = validTemps.length ? Math.min(...validTemps) : 10;
  const maxTempNum = validTemps.length ? Math.max(...validTemps) : 32;
  const tempDomain: [number, number] = [Math.max(0, Math.floor(minTempNum - 1)), Math.ceil(maxTempNum + 1)];

  // Compute salinity domain
  const validSals = sortedData.map((d) => d.salinity).filter((s): s is number => typeof s === 'number');
  const minSalNum = validSals.length ? Math.min(...validSals) : 32;
  const maxSalNum = validSals.length ? Math.max(...validSals) : 38;
  const salDomain: [number, number] = [Math.floor(minSalNum - 0.5), Math.ceil(maxSalNum + 0.5)];

  const surfaceTemp = validTemps.length ? validTemps[0].toFixed(1) : 'N/A';
  const deepTemp = validTemps.length ? validTemps[validTemps.length - 1].toFixed(1) : 'N/A';
  const maxDepthLevel = sortedData.length ? Math.round(sortedData[sortedData.length - 1].depth) : 2000;

  return (
    <div className="flex flex-col h-full bg-abyssal-950/90 border border-abyssal-800/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-abyssal-800/80">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5 font-heading">
            <Thermometer className="w-4 h-4 text-ocean-cyan" />
            <span>{title || chart.title || 'Ocean Depth Profile (0 - 2,000m)'}</span>
          </h3>
          <p className="text-[10px] text-slate-400">Vertical Hydrographic CTD Water Column Curves</p>
        </div>

        {/* View Mode Segmented Switcher */}
        <div className="flex items-center gap-1 bg-abyssal-900/90 p-1 rounded-xl border border-abyssal-800 shrink-0">
          {hasTemp && (
            <button
              type="button"
              onClick={() => setViewMode('temp')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer active:scale-95 ${
                viewMode === 'temp'
                  ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Thermometer className="w-3 h-3" />
              <span>Temp (°C)</span>
            </button>
          )}

          {hasSal && (
            <button
              type="button"
              onClick={() => setViewMode('sal')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer active:scale-95 ${
                viewMode === 'sal'
                  ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-abyssal-950 font-bold shadow-md shadow-emerald-400/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Droplets className="w-3 h-3" />
              <span>Salinity (PSU)</span>
            </button>
          )}

          {hasTemp && hasSal && (
            <button
              type="button"
              onClick={() => setViewMode('both')}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer active:scale-95 ${
                viewMode === 'both'
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400 text-abyssal-950 font-bold shadow-md shadow-cyan-400/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Dual-Axis</span>
            </button>
          )}
        </div>
      </div>

      {/* Depth Zones Pill Badges */}
      <div className="flex items-center gap-2 mb-2 px-1 text-[10px] font-mono overflow-x-auto no-scrollbar">
        <span className="text-slate-400 flex items-center gap-1 shrink-0 font-sans font-semibold">
          <Layers className="w-3 h-3 text-ocean-cyan" /> Zones:
        </span>
        <span className="bg-abyssal-900 border border-abyssal-800 text-cyan-300 px-2 py-0.5 rounded-md whitespace-nowrap">
          Epipelagic (0-200m)
        </span>
        <span className="bg-abyssal-900 border border-abyssal-800 text-teal-300 px-2 py-0.5 rounded-md whitespace-nowrap">
          Mesopelagic (200-1000m)
        </span>
        <span className="bg-abyssal-900 border border-abyssal-800 text-indigo-300 px-2 py-0.5 rounded-md whitespace-nowrap">
          Bathypelagic (&gt;1000m)
        </span>
      </div>

      {/* Recharts Chart Area */}
      <div className="flex-1 w-full min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sortedData}
            layout="vertical"
            margin={{ top: viewMode === 'both' ? 25 : 10, right: 30, left: 10, bottom: 15 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0f243a" />
            
            {/* TEMPERATURE VIEW ONLY */}
            {viewMode === 'temp' && (
              <XAxis
                type="number"
                domain={tempDomain}
                stroke="#2dd4bf"
                tick={{ fill: '#2dd4bf', fontSize: 10 }}
                tickFormatter={(v) => `${v}°C`}
                label={{ value: 'Temperature (°C)', position: 'bottom', fill: '#2dd4bf', fontSize: 11, dy: 5 }}
              />
            )}

            {/* SALINITY VIEW ONLY */}
            {viewMode === 'sal' && (
              <XAxis
                type="number"
                domain={salDomain}
                stroke="#10b981"
                tick={{ fill: '#10b981', fontSize: 10 }}
                tickFormatter={(v) => `${v}`}
                label={{ value: 'Salinity (PSU)', position: 'bottom', fill: '#10b981', fontSize: 11, dy: 5 }}
              />
            )}

            {/* DUAL-AXIS VIEW (Temperature Bottom, Salinity Top) */}
            {viewMode === 'both' && (
              <>
                <XAxis
                  xAxisId="temp"
                  type="number"
                  orientation="bottom"
                  domain={tempDomain}
                  stroke="#2dd4bf"
                  tick={{ fill: '#2dd4bf', fontSize: 10 }}
                  tickFormatter={(v) => `${v}°C`}
                  label={{ value: 'Temperature (°C)', position: 'bottom', fill: '#2dd4bf', fontSize: 10, dy: 5 }}
                />
                <XAxis
                  xAxisId="sal"
                  type="number"
                  orientation="top"
                  domain={salDomain}
                  stroke="#10b981"
                  tick={{ fill: '#10b981', fontSize: 10 }}
                  tickFormatter={(v) => `${v} PSU`}
                  label={{ value: 'Salinity (PSU)', position: 'top', fill: '#10b981', fontSize: 10, dy: -5 }}
                />
              </>
            )}

            {/* Y Axis: Depth (Inverted, 0m at top) */}
            <YAxis
              type="number"
              dataKey="depth"
              reversed={true}
              domain={[0, 'auto']}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
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
                boxShadow: '0 15px 30px -5px rgba(0,0,0,0.8)',
              }}
              formatter={(value: any, name: any) => [
                typeof value === 'number' ? value.toFixed(2) : value,
                name === 'temperature' ? 'Temperature (°C)' : name === 'salinity' ? 'Salinity (PSU)' : name
              ]}
              labelFormatter={(depth) => `Depth: ${depth} meters`}
            />

            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />

            {/* Temperature Line */}
            {(viewMode === 'temp' || viewMode === 'both') && hasTemp && (
              <Line
                xAxisId={viewMode === 'both' ? 'temp' : undefined}
                type="monotone"
                dataKey="temperature"
                name="Temperature (°C)"
                stroke="#2dd4bf"
                strokeWidth={3}
                dot={false}
                connectNulls={true}
                activeDot={{ r: 5, fill: '#2dd4bf' }}
              />
            )}

            {/* Salinity Line */}
            {(viewMode === 'sal' || viewMode === 'both') && hasSal && (
              <Line
                xAxisId={viewMode === 'both' ? 'sal' : undefined}
                type="monotone"
                dataKey="salinity"
                name="Salinity (PSU)"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                connectNulls={true}
                activeDot={{ r: 5, fill: '#10b981' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hydrographic Info Footer */}
      <div className="mt-2 pt-2 border-t border-abyssal-800/80 flex items-center justify-between text-[10px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-ocean-cyan" />
          <span>Surface Temp: <strong className="text-cyan-300">{surfaceTemp}°C</strong> • Deep Temp ({maxDepthLevel}m): <strong className="text-teal-300">{deepTemp}°C</strong></span>
        </div>
        <span className="font-mono text-ocean-cyan bg-abyssal-900 px-2 py-0.5 rounded border border-abyssal-800">
          {sortedData.length} Clean Depth Levels
        </span>
      </div>
    </div>
  );
};
