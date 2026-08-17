import React, { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, Sparkles, X, Radio, AlertCircle } from 'lucide-react';
import { useVoice } from '../../hooks/useVoice';

interface ChatInputProps {
  onSendMessage: (text: string, mode?: 'text' | 'voice') => void;
  isLoading: boolean;
  selectedLanguage: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isLoading,
  selectedLanguage,
}) => {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { isListening, errorMsg, toggleListening } = useVoice({
    onTranscriptChange: (text) => {
      setInputText(text);
    },
    language: selectedLanguage,
  });

  // Focus input when listening starts
  useEffect(() => {
    if (isListening && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isListening]);

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

  return (
    <div className="w-full flex flex-col space-y-2">
      {/* Listening State Banner */}
      {isListening && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-gradient-to-r from-coral-alert/30 via-abyssal-900 to-ocean-cyan/20 border border-coral-alert/60 text-coral-glow text-xs shadow-glow-coral animate-pulse">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-coral-alert animate-spin" />
            <span className="font-bold text-white">Mic Active: Speak now in {selectedLanguage.split('-')[0].toUpperCase()}</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">(Your speech is typing below in real-time)</span>
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
        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? 'Stop Listening (Click to stop)' : 'Click to Speak (Speech-to-Text)'}
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

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening 
              ? "Listening... speak now (Hindi / English)..." 
              : "Ask ocean data (or click Mic to speak)..."
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
