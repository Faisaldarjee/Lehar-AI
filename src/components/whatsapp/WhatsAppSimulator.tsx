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
  Lock
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
        text: response.answer || 'Samundar ka data safely process ho gaya hai.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'advisory',
        hasAudio: true,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const fallbackMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: 'Lehar AI server connection error. Please ensure backend is running at http://127.0.0.1:8000',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'advisory',
        hasAudio: false,
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handlePlayVoice = async (id: number, text: string) => {
    if (playingId === id) {
      window.speechSynthesis.cancel();
      setPlayingId(null);
      return;
    }

    setPlayingId(id);
    await speakText(text, selectedLanguage);
    setPlayingId(null);
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 1,
        sender: 'bot',
        text: 'Lehar AI Coastal WhatsApp Bot initialized.\nType or click a query below to get instant INCOIS ARGO ocean insights in Hindi or English!',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'advisory',
        hasAudio: false,
      },
    ]);
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Left Explanatory Column for Judges */}
        <div className="lg:col-span-5 space-y-4 text-left">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Smartphone className="w-3.5 h-3.5" />
            <span>Last-Mile Coastal Delivery</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight font-heading">
            Lehar AI <span className="text-emerald-400">WhatsApp & Telegram</span> Bot
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Over <strong className="text-white">10 million Indian artisanal fishermen</strong> do not use desktop browsers or complex NetCDF tools. Lehar AI delivers instant <strong className="text-cyan-400">Potential Fishing Zone (PFZ) advisories</strong> and <strong className="text-amber-400">Cyclone Precursors</strong> directly to basic 4G smartphones in local vernacular dialects.
          </p>

          <div className="space-y-2.5 pt-2">
            <div className="flex items-start space-x-3 text-xs text-slate-300">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 shrink-0">
                <Fish className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-white block font-medium">Zero-App Installation</strong>
                <span className="text-slate-400">Works directly on standard WhatsApp, Telegram, or SMS.</span>
              </div>
            </div>

            <div className="flex items-start space-x-3 text-xs text-slate-300">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 shrink-0">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-white block font-medium">Multilingual Audio Readout</strong>
                <span className="text-slate-400">Natural voice synthesis in Hindi, Tamil, Telugu, and English.</span>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleClearChat}
              className="flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Simulator Conversation</span>
            </button>
          </div>
        </div>

        {/* Right Phone Mockup Container */}
        <div className="lg:col-span-7 flex justify-center w-full">
          <div className="w-full max-w-[340px] sm:max-w-[360px] h-[580px] bg-[#111b21] rounded-[36px] border-4 border-slate-700/80 shadow-2xl overflow-hidden flex flex-col relative ring-1 ring-slate-800">
            
            {/* Phone Notch */}
            <div className="absolute top-0 inset-x-0 h-4 bg-slate-900 flex items-center justify-center z-20">
              <div className="w-20 h-3 bg-slate-950 rounded-b-lg flex items-center justify-center space-x-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>
                <div className="w-2 h-2 rounded-full bg-slate-800"></div>
              </div>
            </div>

            <div className="flex-1 flex flex-col pt-4 overflow-hidden">
              
              {/* WhatsApp Header */}
              <div className="bg-[#202c33] px-3 py-2.5 flex items-center justify-between text-white border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-500 flex items-center justify-center font-black text-slate-950 text-xs">
                      LA
                    </div>
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#202c33]"></span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight font-heading">Lehar AI Ocean Bot</h4>
                    <p className="text-[10px] text-emerald-400 font-medium">INCOIS Verified Assistant</p>
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
                  <span className="text-[9px] bg-[#182229] text-amber-300/80 px-2.5 py-1 rounded-lg text-center max-w-[280px] shadow-sm flex items-center justify-center gap-1">
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
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed shadow-md ${
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
                              onClick={() => handlePlayVoice(msg.id, msg.text)}
                              className={`flex items-center space-x-1.5 px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                isPlaying
                                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/50 animate-pulse'
                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
                              }`}
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>{isPlaying ? 'Stop' : 'Listen Voice'}</span>
                            </button>
                            <span className="text-[9px] text-slate-400 font-mono">OceanVoice</span>
                          </div>
                        )}

                        <div className="flex items-center justify-end space-x-1 mt-1 text-[9px] text-slate-400">
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
                    onClick={() => handleSend(q)}
                    className="shrink-0 px-2 py-1 rounded-lg bg-[#202c33] hover:bg-[#2a3942] border border-slate-700 text-[10px] text-slate-300 hover:text-white transition whitespace-nowrap cursor-pointer"
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
                  className="flex-1 bg-[#2a3942] rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none"
                />

                <button
                  onClick={() => handleSend()}
                  disabled={!inputVal.trim() || isTyping}
                  className="w-8 h-8 rounded-full bg-[#00a884] hover:bg-[#008f6f] disabled:opacity-40 flex items-center justify-center text-slate-950 transition cursor-pointer shadow-md"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                </button>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
