import React from 'react';
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

  // Ensure depth is sorted ascending
  const sortedData = [...chart.data].sort((a: any, b: any) => (a.depth ?? 0) - (b.depth ?? 0));

  const hasTemp = chart.y_keys.includes('temperature') || chart.data.some((d: any) => d.temperature !== undefined);
  const hasSal = chart.y_keys.includes('salinity') || chart.data.some((d: any) => d.salinity !== undefined);

  // Compute stats
  const temps = sortedData.map((d: any) => d.temperature).filter((t: any) => typeof t === 'number');
  const maxTemp = temps.length ? Math.max(...temps).toFixed(1) : 'N/A';
  const minTemp = temps.length ? Math.min(...temps).toFixed(1) : 'N/A';

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

        <div className="flex items-center gap-3 text-xs">
          {hasTemp && (
            <span className="flex items-center gap-1 text-ocean-cyan font-mono text-[10px] bg-ocean-cyan/10 px-2 py-0.5 rounded-lg border border-ocean-cyan/20">
              <span className="w-2 h-2 rounded-full bg-ocean-cyan"></span> Temp (°C)
            </span>
          )}
          {hasSal && (
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Salinity (PSU)
            </span>
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
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#0f243a" />
            
            {/* X Axis: Measurements (Temperature / Salinity) */}
            <XAxis
              type="number"
              domain={['auto', 'auto']}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickFormatter={(v) => `${v.toFixed(1)}`}
            />

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
            {hasTemp && (
              <Line
                type="monotone"
                dataKey="temperature"
                name="Temperature (°C)"
                stroke="#2dd4bf"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#2dd4bf' }}
              />
            )}

            {/* Salinity Line */}
            {hasSal && (
              <Line
                type="monotone"
                dataKey="salinity"
                name="Salinity (PSU)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
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
          <span>Surface Temp: {maxTemp}°C • Deep Temp: {minTemp}°C</span>
        </div>
        <span className="font-mono text-ocean-cyan bg-abyssal-900 px-2 py-0.5 rounded border border-abyssal-800">
          {sortedData.length} Depth Levels
        </span>
      </div>
    </div>
  );
};
