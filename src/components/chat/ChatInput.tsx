import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Sparkles, X, Radio, AlertCircle, Globe } from 'lucide-react';
import { useVoice } from '../../hooks/useVoice';

interface ChatInputProps {
  onSendMessage: (text: string, mode?: 'text' | 'voice') => void;
  isLoading: boolean;
  language?: string;
  selectedLanguage?: string;
}

const REGIONAL_SPEECH_OPTIONS = [
  { code: 'en-IN', label: 'English / Hinglish (Default)' },
  { code: 'hi-IN', label: 'हिंदी (Hindi)' },
  { code: 'ta-IN', label: 'தமிழ் (Tamil)' },
  { code: 'te-IN', label: 'తెలుగు (Telugu)' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ (Kannada)' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)' },
];

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
}) => {
  const [inputText, setInputText] = useState('');
  const [micLang, setMicLang] = useState<string>('en-IN');
  const [showLangMenu, setShowLangMenu] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);

  const { isListening, errorMsg, toggleListening } = useVoice({
    onTranscriptChange: (text) => {
      setInputText(text);
    },
    language: micLang,
  });

  // Focus input when listening starts
  useEffect(() => {
    if (isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening]);

  // Close lang menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    
    if (isListening) {
      toggleListening();
    }

    onSendMessage(inputText.trim(), 'text');
    setInputText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeOption = REGIONAL_SPEECH_OPTIONS.find((o) => o.code === micLang) || REGIONAL_SPEECH_OPTIONS[0];

  return (
    <div className="w-full flex flex-col space-y-2">
      {/* Listening State Banner */}
      {isListening && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-coral-alert/30 via-abyssal-900 to-ocean-cyan/20 border border-coral-alert/60 text-coral-glow text-xs shadow-glow-coral animate-pulse">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-coral-alert animate-spin" />
            <span className="font-bold text-white">Mic Active: Speak now in {activeOption.label}</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">(Speech transcribed in real-time)</span>
          </div>
          <button
            type="button"
            onClick={toggleListening}
            className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-coral-alert hover:bg-rose-600 text-white transition cursor-pointer shadow-md"
          >
            Stop Listening
          </button>
        </div>
      )}

      {/* Error Message if Mic permission denied */}
      {errorMsg && (
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-coral-dark/80 border border-coral-alert/40 text-coral-glow text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-coral-alert" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Input Form Bar */}
      <form
        onSubmit={handleSubmit}
        className={`relative flex items-center bg-abyssal-900/95 border rounded-2xl shadow-2xl px-3 py-2 transition-all duration-200 ${
          isListening 
            ? 'border-coral-alert/80 ring-2 ring-coral-alert/30 shadow-glow-coral' 
            : 'border-abyssal-800 focus-within:border-ocean-cyan/60 focus-within:shadow-glow-cyan-sm'
        }`}
      >
        {/* OceanVoice Mic Toggle Button */}
        <div className="relative flex items-center" ref={langMenuRef}>
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? 'Stop Listening (Click to stop)' : `Click to Speak in ${activeOption.label}`}
            className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
              isListening
                ? 'bg-coral-alert text-white shadow-glow-coral scale-105 animate-pulse'
                : 'text-slate-400 hover:text-ocean-cyan hover:bg-abyssal-800/80 active:scale-95'
            }`}
          >
            {isListening ? (
              <MicOff className="w-4 h-4 text-white" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {/* Micro Speech Language Override Switcher */}
          <button
            type="button"
            onClick={() => setShowLangMenu(!showLangMenu)}
            title="Speaking in regional language? Click to override mic locale"
            className="p-1 text-slate-500 hover:text-slate-300 hover:bg-abyssal-800 rounded-lg text-[9px] font-mono mr-1 hidden sm:flex items-center gap-0.5 cursor-pointer"
          >
            <Globe className="w-2.5 h-2.5 text-ocean-cyan" />
            <span>{micLang.split('-')[0].toUpperCase()}</span>
          </button>

          {/* Language Menu Popover */}
          {showLangMenu && (
            <div className="absolute left-0 bottom-10 w-52 bg-abyssal-950 border border-abyssal-800 rounded-xl shadow-2xl p-1.5 z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                Speech Input Language
              </div>
              {REGIONAL_SPEECH_OPTIONS.map((opt) => (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => {
                    setMicLang(opt.code);
                    setShowLangMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-left text-xs transition cursor-pointer ${
                    micLang === opt.code
                      ? 'bg-ocean-cyan/20 text-ocean-cyan font-bold'
                      : 'text-slate-300 hover:text-white hover:bg-abyssal-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  <span className="text-[9px] font-mono text-slate-500">{opt.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening 
              ? "Listening... speak now..." 
              : "Ask in any language (English, Hindi, Hinglish, Tamil, Telugu...)"
          }
          disabled={isLoading}
          className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50 font-medium"
        />

        {/* Clear Button */}
        {inputText && (
          <button
            type="button"
            onClick={() => setInputText('')}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-abyssal-800 transition mr-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Submit / Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-ocean-cyan to-teal-400 hover:from-teal-300 hover:to-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-abyssal-950 font-bold text-xs shadow-md shadow-ocean-cyan/25 transition-all duration-150 active:scale-95 shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 text-abyssal-950" />
          )}
          <span className="hidden sm:inline font-heading">Query Ocean</span>
        </button>
      </form>
    </div>
  );
};
