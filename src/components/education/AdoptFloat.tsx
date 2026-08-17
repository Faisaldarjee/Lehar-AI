import React, { useState } from 'react';
import { 
  GraduationCap, 
  Compass, 
  HelpCircle, 
  CheckCircle, 
  ChevronRight, 
  Anchor,
  RotateCcw,
  Sparkles,
  MapPin
} from 'lucide-react';
import type { FloatSummary } from '../../types';

interface AdoptFloatProps {
  floats: FloatSummary[];
  onSelectFloatForMap?: (floatId: string) => void;
}

type ClassroomTab = 'adopt' | 'cycle' | 'quiz';

export const AdoptFloat: React.FC<AdoptFloatProps> = ({ floats, onSelectFloatForMap }) => {
  const [activeTab, setActiveTab] = useState<ClassroomTab>('adopt');
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

  const handleResetQuiz = () => {
    setSelectedAnswer(null);
    setQuizSubmitted(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950/90 border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl space-y-4 overflow-hidden">
      
      {/* Header Banner with Internal Classroom Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white font-heading">Lehar Classroom</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                NEP 2020 Aligned
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive experiential ocean science for 10 Lakh+ coastal students across India.
            </p>
          </div>
        </div>

        {/* Segmented Internal Tabs */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('adopt')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'adopt'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Adopt a Float</span>
          </button>

          <button
            onClick={() => setActiveTab('cycle')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'cycle'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            <span>10-Day Dive Cycle</span>
          </button>

          <button
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Daily Quiz</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADOPT A FLOAT GRID */}
      {activeTab === 'adopt' && (
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Select an Active Indian Ocean Float to Adopt:</span>
            </h3>
            <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/30">
              {floats.length || 97} Floats Live in Fleet
            </span>
          </div>

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

          {selectedFloat && (
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-300 font-medium">
                  Adopted Float <strong className="text-white">#{selectedFloat.float_id}</strong> is active at {selectedFloat.latitude.toFixed(2)}°N, {selectedFloat.longitude.toFixed(2)}°E
                </span>
              </div>
              {onSelectFloatForMap && (
                <button
                  onClick={() => onSelectFloatForMap(selectedFloat.float_id)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  View on Ocean Map
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 10-DAY DIVE CYCLE INFOGRAPHIC */}
      {activeTab === 'cycle' && (
        <div className="flex-1 flex flex-col justify-center space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
            <h3 className="font-bold text-white text-sm mb-1 font-heading">The Hydraulic Buoyancy Engine</h3>
            <p className="text-slate-400 leading-relaxed">
              ARGO floats carry no propellers or thrusters. Instead, they control internal buoyancy using a battery-powered hydraulic pump that inflates/deflates an external synthetic rubber bladder, allowing them to measure the global ocean autonomously for 5+ years.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold text-xs">1</div>
              <span className="font-bold text-cyan-400 block text-xs font-heading">Surface Launch</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Float establishes GPS satellite fix, deflates hydraulic bladder, and sinks at 10 cm/sec.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center font-bold text-xs">2</div>
              <span className="font-bold text-teal-400 block text-xs font-heading">1000m Isobaric Drift</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Drifts passively with deep ocean currents for 9 days at parking depth (~1,000 meters).
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-300/10 text-cyan-300 flex items-center justify-center font-bold text-xs">3</div>
              <span className="font-bold text-cyan-300 block text-xs font-heading">2000m CTD Ascent</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Descends to 2,000m, then pumps oil into bladder to ascend, taking continuous CTD readings.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">4</div>
              <span className="font-bold text-emerald-400 block text-xs font-heading">Satellite Relay</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Reaches surface and transmits profile data via Iridium satellite to INCOIS & GDAC in &lt;15 mins.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DAILY QUIZ CHALLENGE */}
      {activeTab === 'quiz' && (
        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-4">
          <div className="p-5 rounded-2xl bg-gradient-to-tr from-slate-900 to-cyan-950/40 border border-cyan-500/30 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white font-heading">Daily Ocean Science Challenge</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                +50 Discovery XP
              </span>
            </div>

            <p className="text-sm text-slate-200 font-medium leading-relaxed">{quiz.question}</p>

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
              <div className="p-3 rounded-xl bg-slate-950 border border-cyan-500/20 text-xs text-slate-300 space-y-2">
                <div>
                  <span className="font-bold text-cyan-400">Scientific Explanation: </span>
                  <span>{quiz.explanation}</span>
                </div>
                <button
                  onClick={handleResetQuiz}
                  className="flex items-center space-x-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer pt-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
