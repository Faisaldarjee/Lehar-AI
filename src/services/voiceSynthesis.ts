/**
 * Lehar AI — High Quality Natural Voice Synthesis (Text-to-Speech)
 * Automatically detects language and selects the softest, most natural
 * Indian/English female voice available in the user's browser.
 */

// Voice cache
let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    cachedVoices = voices;
  }
  return cachedVoices;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices();
  };
}

export function detectLanguageFromText(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) {
    return 'hi-IN';
  }
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'ta-IN';
  }
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return 'te-IN';
  }
  const hinglishWords = [
    'machhli', 'machhali', 'samundar', 'taapman', 'kaisa', 'paas', 'batao', 
    'kahan', 'namaste', 'hai', 'anukool', 'leharon', 'shaant', 'surakshit', 'gehrai', 'sthiti'
  ];
  const lower = text.toLowerCase();
  if (hinglishWords.some((w) => lower.includes(w))) {
    return 'hi-IN';
  }
  return 'en-IN';
}

/**
 * Select the best natural soft female voice for the given language.
 */
function getSoftFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length > 0 ? cachedVoices : loadVoices();
  if (!voices || voices.length === 0) return null;

  const isHindi = lang.startsWith('hi');

  if (isHindi) {
    // 1. Check for Natural Hindi Female voices (Edge/Chrome/Google/Apple)
    const hindiFemale = voices.find((v) =>
      v.lang.startsWith('hi') &&
      /swara|heera|lekh|veena|kalpana|female|google/i.test(v.name)
    );
    if (hindiFemale) return hindiFemale;

    // 2. Any Hindi voice
    const anyHindi = voices.find((v) => v.lang.startsWith('hi'));
    if (anyHindi) return anyHindi;

    // 3. Fallback to soft Indian English Female voice if Hindi not installed
    const indianEnglishFemale = voices.find((v) =>
      v.lang === 'en-IN' && /neerja|heera|veena|female|google/i.test(v.name)
    );
    if (indianEnglishFemale) return indianEnglishFemale;
  }

  // English & Regional selection: Prioritize soft, natural female voices
  const preferredFemaleEnglish = voices.find((v) =>
    (v.lang === 'en-IN' || v.lang === 'en-GB' || v.lang === 'en-US') &&
    /neerja|swara|samantha|victoria|karen|serena|zira|female|natural|google uk english female/i.test(v.name)
  );
  if (preferredFemaleEnglish) return preferredFemaleEnglish;

  // Next: Google or Natural voices
  const naturalVoice = voices.find((v) =>
    v.lang.startsWith('en') && /google|natural/i.test(v.name)
  );
  if (naturalVoice) return naturalVoice;

  // Fallback to any female voice
  const anyFemale = voices.find((v) => /female|woman/i.test(v.name));
  if (anyFemale) return anyFemale;

  return voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) || voices[0] || null;
}

export function speakText(text: string, preferredLanguage?: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      resolve();
      return;
    }

    // Stop any active speech before starting fresh
    window.speechSynthesis.cancel();

    // Clean text for natural speech pronunciation
    const cleanText = text
      .replace(/[*_#`]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/SELECT[\s\S]*?;/gi, '')
      .replace(/°C/g, ' degree celsius')
      .replace(/PSU/g, ' P S U')
      .replace(/–/g, ' to ')
      .trim();

    if (!cleanText) {
      resolve();
      return;
    }

    const detectedLang = preferredLanguage && preferredLanguage !== 'en-IN'
      ? preferredLanguage
      : detectLanguageFromText(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = detectedLang;
    
    // Soft, pleasant female voice tuning
    utterance.rate = 0.92;   // Gentle natural pace, not fast or rushed
    utterance.pitch = 1.08;  // Soft, clear female tone

    const bestVoice = getSoftFemaleVoice(detectedLang);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
