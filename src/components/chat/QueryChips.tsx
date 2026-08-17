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
    <div className="w-full flex flex-col space-y-1.5 py-1">
      <div className="flex items-center space-x-1.5 text-xs text-slate-400 font-medium px-1">
        <Sparkles className="w-3.5 h-3.5 text-ocean-cyan" />
        <span className="font-heading font-semibold text-slate-300">Quick Discovery Queries:</span>
      </div>
      
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {suggestions.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectQuery(item.query)}
              className="group flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-abyssal-900/90 hover:bg-abyssal-850 border border-abyssal-800 hover:border-ocean-cyan/50 text-xs text-slate-300 hover:text-white transition-all duration-200 whitespace-nowrap shadow-sm active:scale-95 cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5 text-ocean-cyan group-hover:scale-110 transition-transform duration-200" />
              <span className="font-medium">{item.label}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-abyssal-800 text-slate-400 group-hover:bg-ocean-cyan/20 group-hover:text-ocean-cyan font-mono transition-colors">
                {item.tag}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
