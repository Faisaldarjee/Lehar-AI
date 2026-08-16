import { useState } from 'react';
import { 
  GraduationCap, 
  Compass, 
  HelpCircle, 
  CheckCircle, 
  ChevronRight, 
  Anchor 
} from 'lucide-react';
import type { FloatSummary } from '../../types';

interface AdoptFloatProps {
  floats: FloatSummary[];
  onSelectFloatForMap?: (floatId: string) => void;
}

export const AdoptFloat: React.FC<AdoptFloatProps> = ({ floats, onSelectFloatForMap }) => {
  const [selectedFloat, setSelectedFloat] = useState<FloatSummary | null>(
    floats.length > 0 ? floats[0] : null
  );
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const sampleFloats = floats.slice(0, 6);

  const quiz = {
    question: "Why do ARGO floats dive down to 2,000 meters before ascending to the surface?",
    options: [
      "To measure deep ocean temperature & salinity profiles without battery-draining motors",
      "To hide from ocean marine predators like sharks and whales",
      "To anchor themselves permanently to the sea floor",
      "To recharge their solar panels from deep underwater thermal vents"
    ],
    correct: 0,
    explanation: "ARGO floats use hydraulic buoyancy bladders (adjusting internal oil volume) to naturally sink to 2000m and float back up, measuring CTD parameters passively over a 10-day cycle."
  };

  const handleQuizSubmit = (index: number) => {
    setSelectedAnswer(index);
    setQuizSubmitted(true);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl space-y-6 overflow-y-auto">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-cyan-950/60 via-slate-900 to-teal-950/60 border border-cyan-500/20">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white font-heading">Lehar Classroom — Adopt a Float</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                NEP 2020 Aligned
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Interactive ocean science education for 10 Lakh+ school & college students across coastal India.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
            97 Student-Adoptable Floats Active
          </span>
        </div>
      </div>

      {/* Grid: Adoptable Floats Selector */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span>Select an Active ARGO Float to Adopt & Track:</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sampleFloats.map((f) => {
            const isSelected = selectedFloat?.float_id === f.float_id;
            return (
              <div
                key={f.float_id}
                onClick={() => {
                  setSelectedFloat(f);
                  if (onSelectFloatForMap) onSelectFloatForMap(f.float_id);
                }}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3 ${
                  isSelected
                    ? 'bg-gradient-to-tr from-cyan-950/80 to-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-950/30 ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm font-heading">Float #{f.float_id}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Indian Ocean
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                  <div>
                    <span className="text-slate-500 block text-[9px]">Coordinates</span>
                    {f.latitude.toFixed(2)}°N, {f.longitude.toFixed(2)}°E
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Max CTD Depth</span>
                    {f.max_depth ? `${f.max_depth.toFixed(0)}m` : '2000m'}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-cyan-400 font-semibold">
                  <span>{isSelected ? '✓ Currently Adopted' : 'Adopt this Float'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 10-Day Dive Cycle Infographic */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Anchor className="w-4 h-4 text-cyan-400" />
          <span>The 10-Day ARGO Profiling Cycle Explained:</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="font-bold text-cyan-400 block text-[11px]">1. Surface Launch</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Float begins on surface, establishes satellite fix, and slowly deflates internal bladder.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="font-bold text-teal-400 block text-[11px]">2. 1000m Drift</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Drifts with deep ocean currents for 9 days at parking depth (~1,000 meters).
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="font-bold text-cyan-300 block text-[11px]">3. 2000m Profile Dive</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Descends to 2,000m depth, then ascends measuring temperature & salinity every meter.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-1">
            <span className="font-bold text-emerald-400 block text-[11px]">4. Satellite Relay</span>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Reaches surface, transmits CTD data via Iridium satellite to INCOIS / GDAC in &lt;15 mins.
            </p>
          </div>
        </div>
      </div>

      {/* Interactive NEP Quiz Challenge */}
      <div className="p-5 rounded-2xl bg-gradient-to-tr from-slate-900 to-cyan-950/40 border border-cyan-500/30 space-y-4">
        <div className="flex items-center space-x-2">
          <HelpCircle className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">Daily Ocean Science Challenge</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
            +50 Discovery XP
          </span>
        </div>

        <p className="text-sm text-slate-200 font-medium">{quiz.question}</p>

        <div className="space-y-2">
          {quiz.options.map((opt, idx) => {
            const isChosen = selectedAnswer === idx;
            const isCorrect = idx === quiz.correct;

            let buttonClass = 'bg-slate-950/80 hover:bg-slate-900 border-slate-800 text-slate-300';
            if (quizSubmitted) {
              if (isCorrect) {
                buttonClass = 'bg-emerald-950/60 border-emerald-500 text-emerald-200';
              } else if (isChosen && !isCorrect) {
                buttonClass = 'bg-rose-950/60 border-rose-500 text-rose-200';
              }
            }

            return (
              <button
                key={idx}
                disabled={quizSubmitted}
                onClick={() => handleQuizSubmit(idx)}
                className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${buttonClass}`}
              >
                <span>{opt}</span>
                {quizSubmitted && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>

        {quizSubmitted && (
          <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
            <span className="font-bold text-cyan-400">Explanation:</span>
            <p>{quiz.explanation}</p>
          </div>
        )}
      </div>

    </div>
  );
};
