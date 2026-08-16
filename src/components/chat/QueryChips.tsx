import React from 'react';
import { Compass, Sparkles, AlertTriangle, Thermometer, Fish, Waves } from 'lucide-react';

interface QueryChipsProps {
  onSelectQuery: (query: string) => void;
}

export const QueryChips: React.FC<QueryChipsProps> = ({ onSelectQuery }) => {
  const suggestions = [
    {
      label: 'Mumbai Fishing Advisory',
      icon: Fish,
      query: 'Mumbai ke paas machhli pakadne ke liye samundar ka taapman aur hal kaisa hai?',
      tag: 'PFZ Advisory',
    },
    {
      label: 'Bay of Bengal SST',
      icon: Thermometer,
      query: 'Bay of Bengal ka surface temperature kitna hai aur koi marine heatwave alert hai?',
      tag: 'SST Surface',
    },
    {
      label: 'Arabian Sea Floats',
      icon: Compass,
      query: 'Arabian Sea me kitne active Argo floats hain aur unka latest temperature data dikhao',
      tag: 'Fleet Status',
    },
    {
      label: 'Anomaly Alerts',
      icon: AlertTriangle,
      query: 'Koi bhi marine heatwave, temperature spike ya salinity anomaly alert hai recent me?',
      tag: 'Ocean Alert',
    },
    {
      label: 'Kochi Depth Profile',
      icon: Waves,
      query: 'Kochi ke paas samundar ka 2000 meter tak ka temperature aur salinity depth profile dikhao',
      tag: 'Depth CTD',
    },
  ];

  return (
    <div className="w-full flex flex-col space-y-2 py-1.5">
      <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium px-1">
        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
        <span>Discovery Queries (Hindi & English):</span>
      </div>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              onClick={() => onSelectQuery(item.query)}
              className="group flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-white transition-all duration-150 whitespace-nowrap shadow-sm active:scale-98 cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-105 transition-transform" />
              <span>{item.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 font-mono">
                {item.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
