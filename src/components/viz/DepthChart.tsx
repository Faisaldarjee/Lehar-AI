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
import { Thermometer, Info } from 'lucide-react';
import type { ChartData } from '../../types';

interface DepthChartProps {
  chart: ChartData | null;
  title?: string;
}

export const DepthChart: React.FC<DepthChartProps> = ({ chart, title }) => {
  if (!chart || !chart.data || chart.data.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-900/40 rounded-2xl border border-slate-800">
        <Thermometer className="w-10 h-10 text-slate-600 mb-2" />
        <p className="text-sm font-bold text-slate-300 font-heading">No Depth Profile Loaded</p>
        <p className="text-xs text-slate-500 max-w-xs mt-1">
          Ask Lehar AI for a depth profile or click a float on the map to inspect its temperature & salinity gradients.
        </p>
      </div>
    );
  }

  // Ensure depth is sorted ascending
  const sortedData = [...chart.data].sort((a: any, b: any) => (a.depth ?? 0) - (b.depth ?? 0));

  const hasTemp = chart.y_keys.includes('temperature') || chart.data.some((d: any) => d.temperature !== undefined);
  const hasSal = chart.y_keys.includes('salinity') || chart.data.some((d: any) => d.salinity !== undefined);

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800/80">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Thermometer className="w-4 h-4 text-cyan-400" />
            {title || chart.title || 'Ocean Depth Profile (0 - 2,000m)'}
          </h3>
          <p className="text-[11px] text-slate-400">Vertical Hydrographic CTD Water Column Profile</p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          {hasTemp && (
            <span className="flex items-center gap-1 text-cyan-400 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span> Temp (°C)
            </span>
          )}
          {hasSal && (
            <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Salinity (PSU)
            </span>
          )}
        </div>
      </div>

      {/* Recharts Chart Area */}
      <div className="flex-1 w-full min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            
            {/* X Axis: Measurements (Temperature / Salinity) */}
            <XAxis
              type="number"
              domain={['auto', 'auto']}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v) => `${v.toFixed(1)}`}
            />

            {/* Y Axis: Depth (Inverted, 0m at top) */}
            <YAxis
              type="number"
              dataKey="depth"
              reversed={true}
              domain={[0, 'auto']}
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(v) => `${v}m`}
              label={{ value: 'Depth (m)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 11 }}
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#0284c7',
                borderRadius: '10px',
                color: '#f8fafc',
                fontSize: '12px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
              }}
              formatter={(value: any, name: any) => [
                typeof value === 'number' ? value.toFixed(2) : value,
                name === 'temperature' ? 'Temperature (°C)' : name === 'salinity' ? 'Salinity (PSU)' : name
              ]}
              labelFormatter={(depth) => `Depth: ${depth} meters`}
            />

            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />

            {/* Temperature Line */}
            {hasTemp && (
              <Line
                type="monotone"
                dataKey="temperature"
                name="Temperature (°C)"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: '#38bdf8' }}
              />
            )}

            {/* Salinity Line */}
            {hasSal && (
              <Line
                type="monotone"
                dataKey="salinity"
                name="Salinity (PSU)"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, fill: '#34d399' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hydrographic Info Footer */}
      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400" />
          <span>Thermocline typically observed between 50m - 200m depth</span>
        </div>
        <span className="font-mono text-slate-400">{sortedData.length} depth levels</span>
      </div>
    </div>
  );
};
