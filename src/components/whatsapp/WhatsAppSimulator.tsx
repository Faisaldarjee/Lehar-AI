import React, { useState } from 'react';
import { 
  Smartphone, 
  Send, 
  CheckCheck, 
  Phone, 
  Video, 
  MoreVertical, 
  Volume2, 
  Sparkles, 
  RefreshCw, 
  Fish, 
  Waves, 
  Lock,
  Compass
} from 'lucide-react';
import { speakText } from '../../services/voiceSynthesis';
import { sendChatQuery } from '../../services/api';

interface WhatsAppSimulatorProps {
  onExecuteQuery?: (query: string) => void;
  selectedLanguage?: string;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({ selectedLanguage = 'hi-IN' }) => {
  const [messages, setMessages] = useState<any[]>([
    {
      id: 1,
      sender: 'user',
      text: 'Namaste Lehar AI, Mumbai ke paas machhli pakadne ke liye samundar kaisa hai?',
      time: '10:42 AM',
      type: 'text',
    },
    {
      id: 2,
      sender: 'bot',
      text: 'Namaste! INCOIS ARGO Ocean Intelligence Report:\n\n• Surface Temp (SST): 28.5°C (Optimal)\n• Thermocline Depth: 18 meters\n• Salinity: 35.8 PSU\n\nPFZ Advisory: Surmai, Bangda aur Tuna ke liye anukool taapman hai. Arabian Sea me samundar surakshit hai.',
      time: '10:42 AM',
      type: 'advisory',
      hasAudio: true,
    },
  ]);

  const [inputVal, setInputVal] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [playingId, setPlayingId] = useState<number | null>(null);

  const quickFishermanQueries = [
    'Mumbai ke paas machhli pakadne ke liye samundar kaisa hai?',
    'Ratnagiri coast me samundar ka temperature aur storm alert?',
    'Show me today\'s PFZ zone near Visakhapatnam',
    'Bay of Bengal me cyclone precursor warnings?',
  ];

  const handleSend = async (textToSend?: string) => {
    const q = textToSend || inputVal;
    if (!q.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputVal('');
    setIsTyping(true);

    try {
      const response = await sendChatQuery(q, 'text', selectedLanguage);
      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: response.answer || response.summary || 'Samundar ka data safely process ho gaya hai.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'advisory',
        hasAudio: true,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.warn('WhatsApp query error:', err);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePlayVoice = (id: number, text: string) => {
    if (playingId === id) {
      window.speechSynthesis?.cancel();
      setPlayingId(null);
      return;
    }
    setPlayingId(id);
    speakText(text, selectedLanguage).finally(() => {
      setPlayingId(null);
    });
  };

  return (
    <div className="flex flex-col h-full bg-abyssal-950/90 border border-abyssal-800/90 rounded-2xl p-4 md:p-6 shadow-2xl space-y-4 overflow-hidden backdrop-blur-2xl">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-abyssal-800/80">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white font-heading">
                WhatsApp Coastal Intelligence Bot
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                Zero-App Install
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Delivering INCOIS Potential Fishing Zones (PFZ) and vernacular audio to 40 Lakh+ coastal fishermen.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setMessages([
              {
                id: 1,
                sender: 'user',
                text: 'Namaste Lehar AI, Mumbai ke paas machhli pakadne ke liye samundar kaisa hai?',
                time: '10:42 AM',
                type: 'text',
              },
              {
                id: 2,
                sender: 'bot',
                text: 'Namaste! INCOIS ARGO Ocean Intelligence Report:\n\n• Surface Temp (SST): 28.5°C (Optimal)\n• Thermocline Depth: 18 meters\n• Salinity: 35.8 PSU\n\nPFZ Advisory: Surmai, Bangda aur Tuna ke liye anukool taapman hai. Arabian Sea me samundar surakshit hai.',
                time: '10:42 AM',
                type: 'advisory',
                hasAudio: true,
              },
            ])
          }
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-abyssal-900 hover:bg-abyssal-850 border border-abyssal-800 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer active:scale-95 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-ocean-cyan" />
          <span>Reset Chat</span>
        </button>
      </div>

      {/* Simulator Device Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 overflow-hidden">
        
        {/* Left: Value Proposition Cards */}
        <div className="lg:col-span-5 space-y-3.5 overflow-y-auto pr-1">
          <div className="p-4 rounded-2xl bg-abyssal-900/80 border border-abyssal-800 space-y-2">
            <h3 className="text-xs font-bold text-white font-heading flex items-center gap-1.5">
              <Fish className="w-4 h-4 text-ocean-cyan" />
              <span>Why WhatsApp for Coastal Fishermen?</span>
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Traditional mobile apps have &lt;3% adoption in coastal fishing villages due to low storage and complex English UI. Lehar AI runs directly inside standard WhatsApp with vernacular voice notes.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-abyssal-900/80 border border-abyssal-800 space-y-2">
            <h3 className="text-xs font-bold text-white font-heading flex items-center gap-1.5">
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Vernacular Audio Readout</span>
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Every query response automatically generates an Indian vernacular audio message (Hindi, Tamil, Telugu, Marathi), enabling illiterate fishermen to listen to ocean safety and fish zone advisories on boats.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-abyssal-900/80 border border-abyssal-800 space-y-2">
            <h3 className="text-xs font-bold text-white font-heading flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-amber-400" />
              <span>Smart PFZ Satellite Coordinates</span>
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Provides exact bearing and distance in kilometers to the nearest high-yield thermal front from 18 Indian coastal fishing harbours (Mumbai, Kochi, Visakhapatnam, Paradip, Chennai, etc.).
            </p>
          </div>
        </div>

        {/* Right: Realistic WhatsApp Mobile Phone Frame */}
        <div className="lg:col-span-7 flex justify-center items-center h-full">
          <div className="w-full max-w-[380px] h-[520px] bg-[#111b21] rounded-3xl border-4 border-slate-700 shadow-2xl flex flex-col overflow-hidden relative">
            
            {/* Phone Top Notch / Bar */}
            <div className="bg-[#202c33] px-3.5 py-2.5 flex items-center justify-between border-b border-slate-800 text-white z-10">
              <div className="flex items-center space-x-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-ocean-cyan/20 border border-ocean-cyan flex items-center justify-center text-ocean-cyan">
                    <Waves className="w-4 h-4" />
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#202c33]"></span>
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold font-heading">Lehar AI Ocean Bot</span>
                    <span className="text-[8px] bg-emerald-500/30 text-emerald-400 px-1 rounded font-bold">VERIFIED</span>
                  </div>
                  <p className="text-[9px] text-emerald-400 font-medium">online • INCOIS Certified</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 text-slate-400">
                <Video className="w-4 h-4 hover:text-white transition cursor-pointer" />
                <Phone className="w-4 h-4 hover:text-white transition cursor-pointer" />
                <MoreVertical className="w-4 h-4 hover:text-white transition cursor-pointer" />
              </div>
            </div>

            {/* WhatsApp Chat Bubbles Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
              
              {/* Security encryption pill */}
              <div className="flex justify-center">
                <span className="text-[9px] bg-[#182229] text-amber-300/80 px-2.5 py-1 rounded-lg text-center max-w-[280px] shadow-sm flex items-center justify-center gap-1 font-mono">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span>Messages verified with INCOIS Open Ocean data protocol.</span>
                </span>
              </div>

              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                const isPlaying = playingId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div
                      className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-md ${
                        isUser
                          ? 'bg-[#005c4b] text-white rounded-tr-none'
                          : 'bg-[#202c33] text-slate-100 rounded-tl-none border border-slate-800'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Audio play button if present */}
                      {msg.hasAudio && (
                        <div className="mt-2 pt-1.5 border-t border-slate-700/60 flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => handlePlayVoice(msg.id, msg.text)}
                            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                              isPlaying
                                ? 'bg-coral-alert/30 text-coral-glow border border-coral-alert/50 animate-pulse'
                                : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                            }`}
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>{isPlaying ? 'Stop' : 'Listen Voice'}</span>
                          </button>
                          <span className="text-[9px] text-slate-400 font-mono">OceanVoice</span>
                        </div>
                      )}

                      <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] text-slate-400 font-mono">
                        <span>{msg.time}</span>
                        {isUser && <CheckCheck className="w-3 h-3 text-cyan-400" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex items-center space-x-1.5 p-2 rounded-xl bg-[#202c33] text-slate-300 text-xs max-w-[120px] rounded-tl-none animate-pulse">
                  <Sparkles className="w-3 h-3 text-emerald-400 animate-spin" />
                  <span className="text-[10px]">Typing reply...</span>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips for Fisherman */}
            <div className="bg-[#111b21] p-2 border-t border-slate-800/80 overflow-x-auto no-scrollbar flex items-center gap-1.5">
              {quickFishermanQueries.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="shrink-0 px-2 py-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] border border-slate-700 text-[10px] text-slate-300 hover:text-white transition whitespace-nowrap cursor-pointer active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* WhatsApp Message Input Bar */}
            <div className="bg-[#202c33] p-2 flex items-center space-x-2 border-t border-slate-800">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Message (Hindi/English)..."
                className="flex-1 bg-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none font-medium"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!inputVal.trim() || isTyping}
                className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 flex items-center justify-center text-abyssal-950 transition cursor-pointer shadow-md active:scale-95"
              >
                <Send className="w-3.5 h-3.5 text-abyssal-950" />
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
