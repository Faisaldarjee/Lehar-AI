import { useState } from 'react';
import { 
  Database, 
  Layers, 
  Cpu, 
  BarChart3, 
  Play, 
  CheckCircle2, 
  Radio, 
  Sparkles
} from 'lucide-react';

export const ArchitecturePipeline: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const steps = [
    {
      layer: 'LAYER 1: DATA INGESTION',
      icon: Database,
      color: 'from-cyan-500 to-blue-600',
      title: 'ARGO Global GDAC & INCOIS Ingestion Pipeline',
      description: 'Continuous ingestion of multi-dimensional NetCDF hydrographic files from 4,000+ floats via xarray & argopy into SQLite & columnar Parquet.',
      specs: ['646 Profiles Ingested', '97 Active Indian Ocean Floats', '6-Hour Automated Sync Cron', 'SQLite + Spatial Indexes'],
    },
    {
      layer: 'LAYER 2: USER INTERFACE & ACCESS',
      icon: Layers,
      color: 'from-blue-500 to-indigo-600',
      title: 'Multi-Channel Conversational Entry Points',
      description: 'Dual-access interface: Web Dashboard (React + TypeScript) + WhatsApp Business API & Telegram bot for zero-app download coastal reach.',
      specs: ['OceanVoice Speech (en-IN, hi-IN, ta-IN, te-IN)', 'Web Dashboard Console', 'WhatsApp / Telegram Native Bots', 'One-Click Discovery Chips'],
    },
    {
      layer: 'LAYER 3: AI BRAIN & INTELLIGENCE',
      icon: Cpu,
      color: 'from-indigo-500 to-purple-600',
      title: 'Groq LLaMA 3.3 70B & AnomalyRadar Engine',
      description: 'Translates natural language questions into safe read-only SQL queries with spatial bounding boxes and monitors background marine heatwaves.',
      specs: ['Intent Classification', 'Safe Read-Only SQL Sanitization', 'Climatological Heatwave Thresholds', 'Real-time Anomaly Trigger'],
    },
    {
      layer: 'LAYER 4: RESPONSE COMPOSER',
      icon: BarChart3,
      color: 'from-purple-500 to-emerald-600',
      title: 'Multimodal Visual & Audio Insight Generation',
      description: 'Composes rich visual answers including Three.js WebGL 3D depth cross-sections, Leaflet map coordinates, and voice audio speech synthesis.',
      specs: ['3D OceanLens WebGL Cross-Section', 'Interactive Leaflet CTD Markers', 'Natural Voice Audio Readout', 'Researcher CSV/ASCII Export'],
    },
  ];

  const handleSimulate = () => {
    setIsSimulating(true);
    setActiveStep(0);

    const interval = setInterval(() => {
      setActiveStep((prev) => {
        if (prev >= 3) {
          clearInterval(interval);
          setIsSimulating(false);
          return 3;
        }
        return prev + 1;
      });
    }, 1200);
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 bg-slate-950/80 border border-slate-800/80 rounded-2xl shadow-2xl space-y-6 overflow-y-auto">
      
      {/* Top Title & Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/40 to-slate-900 border border-cyan-500/20 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-black text-white font-heading">Lehar AI 4-Layer System Architecture</h2>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              Live Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            End-to-End Enterprise Architecture: From NetCDF Ingestion to 3D WebGL & Multilingual Voice Delivery.
          </p>
        </div>

        <button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition active:scale-98 disabled:opacity-50 cursor-pointer shrink-0"
        >
          {isSimulating ? <Radio className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          <span>{isSimulating ? 'Simulating Pipeline Flow...' : 'Simulate Query Flow'}</span>
        </button>
      </div>

      {/* 4 Architecture Layer Cards with Connectors */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isCurrent = activeStep === idx;
          const isPassed = activeStep >= idx;

          return (
            <div
              key={idx}
              className={`flex flex-col justify-between p-5 rounded-2xl border transition-all duration-300 relative ${
                isCurrent
                  ? 'bg-gradient-to-b from-cyan-950/90 to-slate-900 border-cyan-500 shadow-xl shadow-cyan-950/40 ring-1 ring-cyan-500/40 scale-[1.02]'
                  : isPassed
                  ? 'bg-slate-900/90 border-cyan-500/40 text-slate-200'
                  : 'bg-slate-900/40 border-slate-800 text-slate-400 opacity-70'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
                    {s.layer}
                  </span>
                  {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                </div>

                <div className="flex items-center space-x-2.5">
                  <div className={`p-2.5 rounded-xl bg-gradient-to-tr ${s.color} text-white shadow-md`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight font-heading">{s.title}</h3>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{s.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5">
                <span className="text-[10px] text-slate-500 font-mono block uppercase">Specifications:</span>
                {s.specs.map((spec, sIdx) => (
                  <div key={sIdx} className="flex items-center space-x-1.5 text-[11px] text-slate-300 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                    <span>{spec}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Latency & Throughput Benchmark */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-heading">
            Enterprise Latency & Pipeline Benchmarks
          </h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">NL→SQL Speed (Groq)</span>
            <span className="text-emerald-400 font-bold text-sm">~420 ms</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">SQL Execution (SQLite)</span>
            <span className="text-cyan-400 font-bold text-sm">~12 ms</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">3D WebGL Render</span>
            <span className="text-cyan-300 font-bold text-sm">60 FPS Smooth</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="text-slate-500 text-[10px] block">Delivery Channels</span>
            <span className="text-white font-bold text-sm">Web + WhatsApp</span>
          </div>
        </div>
      </div>

    </div>
  );
};
