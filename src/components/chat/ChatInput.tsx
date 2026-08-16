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
    
    // If voice was listening, turn it off on submit
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
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-950/90 via-slate-900 to-cyan-950/90 border border-rose-500/50 text-rose-300 text-xs shadow-lg animate-pulse">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-rose-400 animate-spin" />
            <span className="font-bold text-white">Mic Active: Speak now in {selectedLanguage.split('-')[0].toUpperCase()}</span>
            <span className="text-slate-400 text-[11px] hidden sm:inline">(Your speech is typing below in real-time)</span>
          </div>
          <button
            type="button"
            onClick={toggleListening}
            className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-500 hover:bg-rose-600 text-white transition cursor-pointer shadow-sm"
          >
            Click Mic or Here to Stop
          </button>
        </div>
      )}

      {/* Error Message if Mic permission denied */}
      {errorMsg && (
        <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg bg-rose-950/80 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Input Form Bar */}
      <form
        onSubmit={handleSubmit}
        className={`relative flex items-center bg-slate-900/95 border rounded-2xl shadow-xl px-3 py-2 transition-all duration-200 ${
          isListening 
            ? 'border-rose-500/80 ring-2 ring-rose-500/20 shadow-rose-950/30' 
            : 'border-slate-800 focus-within:border-cyan-500/50 shadow-slate-950/50'
        }`}
      >
        {/* OceanVoice Mic Toggle Button */}
        <button
          type="button"
          onClick={toggleListening}
          title={isListening ? 'Stop Listening (Click to stop)' : 'Click to Speak (Speech-to-Text)'}
          className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer ${
            isListening
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40 scale-105 animate-pulse'
              : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 active:scale-95'
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
          className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none disabled:opacity-50"
        />

        {/* Clear Button */}
        {inputText && (
          <button
            type="button"
            onClick={() => setInputText('')}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition mr-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Submit / Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || isLoading}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/25 transition-all duration-150 active:scale-98 shrink-0 cursor-pointer"
        >
          {isLoading ? (
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5 text-slate-950" />
          )}
          <span className="hidden sm:inline">Query Ocean</span>
        </button>
      </form>
    </div>
  );
};
