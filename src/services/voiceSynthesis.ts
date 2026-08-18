/**
 * Lehar AI — Multi-Language Natural Voice Synthesis (Text-to-Speech)
 * Automatically matches speech synthesis voices to detected Indic & English locales:
 * - Hindi / Hinglish (hi-IN)
 * - Tamil (ta-IN)
 * - Telugu (te-IN)
 * - Kannada (kn-IN)
 * - Bengali (bn-IN)
 * - Malayalam (ml-IN)
 * - Indian English (en-IN)
 */

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
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';

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
 * Select the best natural soft female voice for the given language locale.
 */
function getSoftFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length > 0 ? cachedVoices : loadVoices();
  if (!voices || voices.length === 0) return null;

  const targetLang = lang.toLowerCase();
  const prefix = targetLang.slice(0, 2);

  // 1. Check exact or prefix match for regional language (Tamil, Telugu, Kannada, Bengali, Hindi)
  if (prefix !== 'en') {
    const regionalFemale = voices.find((v) =>
      v.lang.toLowerCase().startsWith(prefix) &&
      /swara|heera|lekh|veena|kalpana|valluvar|vani|chitra|female|google|natural/i.test(v.name)
    );
    if (regionalFemale) return regionalFemale;

    const anyRegional = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
    if (anyRegional) return anyRegional;
  }

  // 2. English & Indian English priority voices
  const preferredFemaleEnglish = voices.find((v) =>
    (v.lang.toLowerCase().startsWith('en-in') || v.lang.toLowerCase().startsWith('en-gb') || v.lang.toLowerCase().startsWith('en-us')) &&
    /neerja|swara|heera|samantha|victoria|karen|serena|zira|female|natural|google uk english female/i.test(v.name)
  );
  if (preferredFemaleEnglish) return preferredFemaleEnglish;

  // 3. Any Google / Natural voice
  const naturalVoice = voices.find((v) =>
    v.lang.toLowerCase().startsWith('en') && /google|natural/i.test(v.name)
  );
  if (naturalVoice) return naturalVoice;

  // 4. Any female voice
  const anyFemale = voices.find((v) => /female|woman/i.test(v.name));
  if (anyFemale) return anyFemale;

  return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || voices[0] || null;
}

export function speakText(text: string, preferredLanguage?: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('Speech synthesis not supported in this browser.');
      resolve();
      return;
    }

    try {
      window.speechSynthesis.cancel();

      // Clean markdown, symbols, and formatting for smooth pronunciation
      const cleanText = text
        .replace(/[*_#`~[\]()]/g, ' ')
        .replace(/•/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/°C/g, ' degree celsius')
        .replace(/PSU/g, ' P S U')
        .replace(/–/g, ' to ')
        .replace(/⚠️/g, ' Warning: ')
        .replace(/🎣/g, ' Fishing Opportunity: ')
        .replace(/🛡️/g, ' Safety Alert: ')
        .trim();

      if (!cleanText) {
        resolve();
        return;
      }

      const lang = preferredLanguage || detectLanguageFromText(cleanText);
      const voice = getSoftFemaleVoice(lang);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      if (voice) {
        utterance.voice = voice;
      }

      // Natural acoustic pacing
      utterance.rate = 0.92;
      utterance.pitch = 1.08;
      utterance.volume = 1.0;

      utterance.onend = () => resolve();
      utterance.onerror = (e) => {
        console.warn('Speech synthesis playback ended or error:', e);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Error during speakText execution:', err);
      resolve();
    }
  });
}
