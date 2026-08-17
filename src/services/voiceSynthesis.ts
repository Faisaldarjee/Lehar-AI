/**
 * Lehar AI — Voice Synthesis (Text-to-Speech)
 * Automatically detects response language (Hindi, Tamil, Telugu, English)
 * and speaks ocean query responses naturally.
 */

export function detectLanguageFromText(text: string): string {
  // Check for Devanagari unicode range \u0900-\u097F
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi-IN';
  }
  // Check for Tamil \u0B80-\u0BFF
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta-IN';
  }
  // Check for Telugu \u0C00-\u0C7F
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return 'te-IN';
  }
  // Check for common Hinglish words
  const hinglishWords = [
    'machhli', 'samundar', 'taapman', 'kaisa', 'paas', 'batao', 
    'kahan', 'namaste', 'hai', 'anukool', 'leharon', 'shaant', 'surakshit'
  ];
  const lower = text.toLowerCase();
  if (hinglishWords.some((w) => lower.includes(w))) {
    return 'hi-IN';
  }
  return 'en-IN';
}

export function speakText(text: string, preferredLanguage?: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      resolve();
      return;
    }

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    // Clean text of markdown syntax / code blocks before speaking
    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/SELECT[\s\S]*?;/gi, '')
      .trim();

    if (!cleanText) {
      resolve();
      return;
    }

    // Automatically detect language from text if preferredLanguage is default or omitted
    const detectedLang = preferredLanguage && preferredLanguage !== 'en-IN' 
      ? preferredLanguage 
      : detectLanguageFromText(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = detectedLang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick best matching voice if available
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(
      (v) => v.lang === detectedLang || v.lang.startsWith(detectedLang.slice(0, 2))
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
