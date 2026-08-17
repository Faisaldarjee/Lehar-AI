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
  MapPin,
  Battery,
  Layers,
  Activity,
  Award
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
    <div className="flex flex-col h-full bg-abyssal-950/90 border border-abyssal-800/90 rounded-2xl p-4 md:p-6 shadow-2xl space-y-4 overflow-hidden backdrop-blur-2xl">
      
      {/* Header Banner with Internal Classroom Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-abyssal-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-ocean-cyan/10 text-ocean-cyan border border-ocean-cyan/30 shadow-glow-cyan-sm">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white font-heading">Lehar Classroom</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                NEP 2020 Aligned
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Interactive experiential ocean science for 10 Lakh+ coastal students across India.
            </p>
          </div>
        </div>

        {/* Segmented Internal Tabs */}
        <div className="flex items-center gap-1 bg-abyssal-900/90 p-1 rounded-xl border border-abyssal-800 self-start md:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('adopt')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'adopt'
                ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-abyssal-800/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Adopt a Float</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cycle')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'cycle'
                ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-abyssal-800/50'
            }`}
          >
            <Anchor className="w-3.5 h-3.5" />
            <span>10-Day Dive Cycle</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 ${
              activeTab === 'quiz'
                ? 'bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold shadow-md shadow-ocean-cyan/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-abyssal-800/50'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Daily Ocean Quiz</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ADOPT A FLOAT PASSPORT & ROSTER */}
      {activeTab === 'adopt' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto">
          {/* Float Selector Grid */}
          <div className="lg:col-span-5 space-y-2.5">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-ocean-cyan" />
              <span>Select Active ARGO Float to Adopt</span>
            </div>

            <div className="space-y-2">
              {sampleFloats.map((f) => {
                const isSelected = selectedFloat?.float_id === f.float_id;
                return (
                  <div
                    key={f.float_id}
                    onClick={() => setSelectedFloat(f)}
                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between shadow-sm ${
                      isSelected
                        ? 'bg-abyssal-850 border-ocean-cyan/60 shadow-glow-cyan-sm ring-1 ring-ocean-cyan/40'
                        : 'bg-abyssal-900/80 hover:bg-abyssal-850 border-abyssal-800 text-slate-300 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs font-heading">Float #{f.float_id}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-ocean-cyan/20 text-ocean-cyan">
                          Active Profiler
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                        {f.latitude.toFixed(2)}°N, {f.longitude.toFixed(2)}°E
                      </p>
                    </div>

                    <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-ocean-cyan translate-x-1' : 'text-slate-600'}`} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Float Passport Card */}
          {selectedFloat && (
            <div className="lg:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-gradient-to-br from-abyssal-900 via-abyssal-850 to-abyssal-900 border border-ocean-cyan/30 shadow-2xl relative overflow-hidden">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-ocean-cyan tracking-widest font-mono">
                      Official ARGO Ocean Float Passport
                    </span>
                    <h3 className="text-xl font-black text-white mt-1 font-heading">
                      WMO ID: {selectedFloat.float_id}
                    </h3>
                    <p className="text-xs text-slate-300">Indian Ocean Hydrographic Monitoring Station</p>
                  </div>
                  <div className="p-3 rounded-2xl bg-ocean-cyan/10 border border-ocean-cyan/30 text-ocean-cyan shadow-glow-cyan-sm">
                    <Anchor className="w-8 h-8" />
                  </div>
                </div>

                {/* Passport Spec Chips */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
                  <div className="p-2.5 rounded-xl bg-abyssal-950/80 border border-abyssal-800">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <MapPin className="w-3 h-3 text-ocean-cyan" /> Latitude
                    </div>
                    <div className="text-xs font-bold text-white mt-1 font-mono">{selectedFloat.latitude.toFixed(3)}°N</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-abyssal-950/80 border border-abyssal-800">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <MapPin className="w-3 h-3 text-ocean-cyan" /> Longitude
                    </div>
                    <div className="text-xs font-bold text-white mt-1 font-mono">{selectedFloat.longitude.toFixed(3)}°E</div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-abyssal-950/80 border border-abyssal-800">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <Layers className="w-3 h-3 text-ocean-cyan" /> Max Depth
                    </div>
                    <div className="text-xs font-bold text-white mt-1 font-mono">
                      {selectedFloat.max_depth ? `${selectedFloat.max_depth.toFixed(0)}m` : '2000m'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-abyssal-950/80 border border-abyssal-800">
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <Battery className="w-3 h-3 text-emerald-400" /> Battery
                    </div>
                    <div className="text-xs font-bold text-emerald-400 mt-1 font-mono">94% (4.2 yrs left)</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-abyssal-950/60 border border-abyssal-800 text-xs text-slate-300 leading-relaxed">
                  <span className="font-bold text-white font-heading">Mission Objective: </span>
                  Measuring vertical temperature, salinity, and pressure gradients down to 2,000 meters in the Indian Ocean to support monsoon forecasts and climate studies.
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
                {onSelectFloatForMap && (
                  <button
                    type="button"
                    onClick={() => onSelectFloatForMap(selectedFloat.float_id)}
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-ocean-cyan to-teal-400 text-abyssal-950 font-bold text-xs shadow-md shadow-ocean-cyan/25 transition active:scale-95 cursor-pointer"
                  >
                    <Compass className="w-4 h-4 text-abyssal-950" />
                    <span>Track This Float on 3D Map</span>
                  </button>
                )}

                <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-ocean-cyan" />
                  <span>Cycle #48 Completed • Last Synced 6 hrs ago</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: 10-DAY DIVE CYCLE INFOGRAPHIC */}
      {activeTab === 'cycle' && (
        <div className="flex-1 overflow-y-auto space-y-4 p-2">
          <div className="text-center max-w-lg mx-auto mb-4">
            <h3 className="text-base font-bold text-white font-heading">How an ARGO Float Operates (10-Day Cycle)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Autonomous hydraulic buoyancy engines glide without fuel across the global ocean.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {[
              {
                step: 'Day 1',
                title: 'Surface Deployment & GPS Sync',
                desc: 'Float transmits collected profile data to INCOIS & GDAC via Iridium Satellite and captures fresh GPS coordinates.',
                depth: '0 meters (Surface)',
                color: 'border-cyan-500/40 text-cyan-300',
              },
              {
                step: 'Day 2 - 9',
                title: 'Drift at Parking Depth',
                desc: 'Oil is pumped into internal reservoir, causing float to sink neutrally at 1,000m depth to measure ocean currents.',
                depth: '1,000 meters (Parking)',
                color: 'border-teal-500/40 text-teal-300',
              },
              {
                step: 'Day 10 (Hour 0)',
                title: 'Deep Profile Descent',
                desc: 'Float sinks further down to 2,000m bathypelagic zone to prepare for high-precision hydrographic profiling.',
                depth: '2,000 meters (Deep)',
                color: 'border-indigo-500/40 text-indigo-300',
              },
              {
                step: 'Day 10 (Hour 6)',
                title: 'Ascent & Sensor Profiling',
                desc: 'Buoyancy bladder expands; float ascends over 6 hours recording temperature, salinity, and pressure every 2 meters.',
                depth: '2,000m → 0m Ascent',
                color: 'border-emerald-500/40 text-emerald-300',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className={`p-4 rounded-2xl bg-abyssal-900/80 border ${item.color} space-y-2 shadow-lg backdrop-blur-md`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded bg-abyssal-950 border border-abyssal-800">
                    {item.step}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">{item.depth}</span>
                </div>
                <h4 className="text-xs font-bold text-white font-heading">{item.title}</h4>
                <p className="text-[11px] text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: DAILY OCEAN SCIENCE QUIZ */}
      {activeTab === 'quiz' && (
        <div className="flex-1 max-w-xl mx-auto flex flex-col justify-center space-y-4 p-4">
          <div className="p-5 rounded-2xl bg-abyssal-900/90 border border-abyssal-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-abyssal-800">
              <span className="text-xs font-bold uppercase tracking-wider text-ocean-cyan font-mono flex items-center gap-1.5">
                <Award className="w-4 h-4 text-ocean-cyan" /> Question of the Day
              </span>
              <span className="text-xs font-mono text-slate-400">+100 Ocean IQ Points</span>
            </div>

            <h3 className="text-sm sm:text-base font-bold text-white leading-snug font-heading">
              {quiz.question}
            </h3>

            {/* Quiz Options */}
            <div className="space-y-2">
              {quiz.options.map((opt, idx) => {
                const isSelected = selectedAnswer === idx;
                const isCorrect = idx === quiz.correct;

                let btnStyle = 'bg-abyssal-950/80 hover:bg-abyssal-850 border-abyssal-800 text-slate-300 hover:text-white';
                if (quizSubmitted) {
                  if (isCorrect) {
                    btnStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200 font-bold';
                  } else if (isSelected && !isCorrect) {
                    btnStyle = 'bg-coral-dark/80 border-coral-alert text-coral-glow';
                  }
                } else if (isSelected) {
                  btnStyle = 'bg-ocean-cyan/20 border-ocean-cyan text-white';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={quizSubmitted}
                    onClick={() => handleQuizSubmit(idx)}
                    className={`w-full p-3 rounded-xl border text-xs text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {quizSubmitted && isCorrect && <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation card after submit */}
            {quizSubmitted && (
              <div className="p-3.5 rounded-xl bg-abyssal-950 border border-emerald-500/30 text-xs text-emerald-200 space-y-1.5 animate-in fade-in duration-200">
                <div className="font-bold flex items-center gap-1 font-heading">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> Explanation:
                </div>
                <p className="text-[11px] leading-relaxed text-slate-300">{quiz.explanation}</p>
                <div className="pt-2 text-right">
                  <button
                    type="button"
                    onClick={handleResetQuiz}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-abyssal-900 hover:bg-abyssal-800 border border-abyssal-700 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-ocean-cyan" /> Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
