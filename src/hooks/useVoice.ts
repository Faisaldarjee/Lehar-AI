import { useState, useEffect, useRef, useCallback } from 'react';

interface UseVoiceProps {
  onTranscriptChange: (text: string) => void;
  language?: string;
}

export function useVoice({ onTranscriptChange, language = 'en-IN' }: UseVoiceProps) {
  const [isListening, setIsListening] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const callbackRef = useRef(onTranscriptChange);

  // Keep callback fresh without triggering effect re-runs
  useEffect(() => {
    callbackRef.current = onTranscriptChange;
  }, [onTranscriptChange]);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = language;

      recognition.onstart = () => {
        setIsListening(true);
        isListeningRef.current = true;
        setErrorMsg(null);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';

        for (let i = 0; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript + ' ';
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const fullText = (final + interim).trim();
        if (fullText && callbackRef.current) {
          callbackRef.current(fullText);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        if (event.error === 'not-allowed') {
          setErrorMsg('Microphone access blocked. Please click the lock icon in the URL bar to allow microphone access.');
        } else if (event.error !== 'no-speech') {
          setErrorMsg(`Voice error: ${event.error}`);
        }
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognition.onend = () => {
        setIsListening(false);
        isListeningRef.current = false;
      };

      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition init error:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, [language]); // Only re-run when language changes

  const toggleListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    if (isListeningRef.current) {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } catch {
        // ignore
      }
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      try {
        setErrorMsg(null);
        if (recognitionRef.current) {
          recognitionRef.current.lang = language;
          recognitionRef.current.start();
          setIsListening(true);
          isListeningRef.current = true;
        }
      } catch (err: any) {
        console.error('Failed to start voice recognition:', err);
        // Reset if failed
        try {
          if (recognitionRef.current) {
            recognitionRef.current.stop();
          }
        } catch {
          // ignore
        }
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, [language]);

  return {
    isListening,
    errorMsg,
    toggleListening,
  };
}
