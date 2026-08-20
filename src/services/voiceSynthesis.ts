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
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';

  // Check Marathi in Devanagari
  if (/[\u0900-\u097F]/.test(text)) {
    const marathiWords = ['मासे', 'कुठे', 'मिळतील', 'सांगा', 'आहेत', 'कशी', 'कसा', 'करावे', 'करा', 'किनारपट्टी'];
    if (marathiWords.some((w) => text.includes(w))) return 'mr-IN';
    return 'hi-IN';
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

const TA_NUMBERS: Record<number, string> = {
  0: 'பூஜ்ஜியம்', 1: 'ஒன்று', 2: 'இரண்டு', 3: 'மூன்று', 4: 'நான்கு', 5: 'ஐந்து',
  6: 'ஆறு', 7: 'ஏழு', 8: 'எட்டு', 9: 'ஒன்பது', 10: 'பத்து',
  11: 'பதினொன்று', 12: 'பன்னிரண்டு', 13: 'பதிமூன்று', 14: 'பதினான்கு', 15: 'பதினைந்து',
  16: 'பதினாறு', 17: 'பதினேழு', 18: 'பதினெட்டு', 19: 'பத்தொன்பது', 20: 'இருபது',
  21: 'இருபத்தி ஒன்று', 22: 'இருபத்தி இரண்டு', 23: 'இருபத்தி மூன்று', 24: 'இருபத்தி நான்கு',
  25: 'இருபத்தி ஐந்து', 26: 'இருபத்தி ஆறு', 27: 'இருபத்தி ஏழு', 28: 'இருபத்தி எட்டு',
  29: 'இருபத்தி ஒன்பது', 30: 'முப்பது', 31: 'முப்பத்தி ஒன்று', 32: 'முப்பத்தி இரண்டு',
  33: 'முப்பத்தி மூன்று', 34: 'முப்பத்தி நான்கு', 35: 'முப்பத்தி ஐந்து', 36: 'முப்பத்தி ஆறு',
  37: 'முப்பத்தி ஏழு', 38: 'முப்பத்தி எட்டு', 39: 'முப்பத்தி ஒன்பது', 40: 'நாற்பது',
  50: 'ஐம்பது', 60: 'அறுபது', 70: 'எழுபது', 80: 'எண்பது', 90: 'தொண்ணூறு', 97: 'தொண்ணூற்றி ஏழு',
  100: 'நூறு', 2000: 'இரண்டாயிரம்'
};

const HI_NUMBERS: Record<number, string> = {
  0: 'शून्य', 1: 'एक', 2: 'दो', 3: 'तीन', 4: 'चार', 5: 'पांच',
  6: 'छह', 7: 'सात', 8: 'आठ', 9: 'नौ', 10: 'दस',
  11: 'ग्यारह', 12: 'बारह', 13: 'तेरह', 14: 'चौदह', 15: 'पंद्रह',
  16: 'सोलह', 17: 'सत्रह', 18: 'अट्ठारह', 19: 'उन्नीस', 20: 'बीस',
  21: 'इक्कीस', 22: 'बाईस', 23: 'तेईस', 24: 'चौबीस', 25: 'पच्चीस',
  26: 'छब्बीस', 27: 'सत्ताईस', 28: 'अट्ठाईस', 29: 'उनतीस', 30: 'तीस',
  31: 'इकतीस', 32: 'बत्तीस', 33: 'तैंतीस', 34: 'चौंतीस', 35: 'पैंतीस',
  36: 'छत्तीस', 37: 'सैंतीस', 38: 'अड़तीस', 39: 'उनतालीस', 40: 'चालीस',
  50: 'पचास', 60: 'साठ', 70: 'सत्तर', 80: 'अस्सी', 90: 'नब्बे', 97: 'सत्तानवे',
  100: 'सौ', 2000: 'दो हज़ार'
};

const MR_NUMBERS: Record<number, string> = {
  0: 'शून्य', 1: 'एक', 2: 'दोन', 3: 'तीन', 4: 'चार', 5: 'पाच',
  6: 'सहा', 7: 'सात', 8: 'आठ', 9: 'नऊ', 10: 'दहा',
  11: 'अकरा', 12: 'बारा', 13: 'तेरा', 14: 'चौदा', 15: 'पंधरा',
  16: 'सोळा', 17: 'सतरा', 18: 'अठरा', 19: 'एकोणीस', 20: 'वीस',
  21: 'एकवीस', 22: 'बावीस', 23: 'तेवीस', 24: 'चोवीस', 25: 'पंचवीस',
  26: 'सव्वीस', 27: 'सत्तावीस', 28: 'अठ्ठावीस', 29: 'एकोणतीस', 30: 'तीस',
  31: 'एकतीस', 32: 'बत्तीस', 33: 'तेहेतीस', 34: 'चौतीस', 35: 'पस्तीस',
  50: 'पन्नास', 97: 'सत्त्याण्णव', 2000: 'दोन हजार'
};

const TE_NUMBERS: Record<number, string> = {
  0: 'సున్నా', 1: 'ఒకటి', 2: 'రెండు', 3: 'మూడు', 4: 'నాలుగు', 5: 'ఐదు',
  6: 'ఆరు', 7: 'ఏడు', 8: 'ఎనిమిది', 9: 'తొమ్మిది', 10: 'పది',
  20: 'ఇరవై', 21: 'ఇరవై ఒకటి', 22: 'ఇరవై రెండు', 23: 'ఇరవై మూడు', 24: 'ఇరవై నాలుగు',
  25: 'ఇరవై ఐదు', 26: 'ఇరవై ఆరు', 27: 'ఇరవై ఏడు', 28: 'ఇరవై ఎనిమిది', 29: 'ఇరవై తొమ్మిది',
  30: 'ముప్పై', 31: 'ముప్పై ఒకటి', 32: 'ముప్పై రెండు', 33: 'ముప్పై మూడు', 34: 'ముప్పై నాలుగు', 35: 'ముప్పై ఐదు',
  50: 'యాభై', 97: 'తొంభై ఏడు', 2000: 'రెండు వేలు'
};

/**
 * Phonetically translates numbers, acronyms, and units for the target language.
 */
function phoneticizeForLanguage(text: string, lang: string): string {
  let res = text;
  const prefix = lang.slice(0, 2).toLowerCase();

  // 1. TAMIL PHONETICS
  if (prefix === 'ta') {
    res = res.replace(/ARGO/gi, 'ஏஆர்கோ')
             .replace(/PSU/gi, 'பி எஸ் யு')
             .replace(/km/gi, ' கிலோமீட்டர் ')
             .replace(/\b(\d+)\.(\d+)°C/gi, (_, intPart, decPart) => {
               const intWord = TA_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = TA_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} புள்ளி ${decWord} டிகிரி செல்சியஸ்`;
             })
             .replace(/\b(\d+)°C/gi, (_, intPart) => {
               const intWord = TA_NUMBERS[parseInt(intPart, 10)] || intPart;
               return `${intWord} டிகிரி செல்சியஸ்`;
             })
             .replace(/\b(\d+)\.(\d+)/g, (_, intPart, decPart) => {
               const intWord = TA_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = TA_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} புள்ளி ${decWord}`;
             })
             .replace(/\b(\d+)\b/g, (match) => {
               const n = parseInt(match, 10);
               return TA_NUMBERS[n] || match;
             })
             .replace(/°C/g, ' டிகிரி செல்சியஸ்');
  }

  // 2. HINDI PHONETICS
  else if (prefix === 'hi') {
    res = res.replace(/ARGO/gi, 'आर्गो')
             .replace(/PSU/gi, 'पी एस यू')
             .replace(/km/gi, ' किलोमीटर ')
             .replace(/\b(\d+)\.(\d+)°C/gi, (_, intPart, decPart) => {
               const intWord = HI_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = HI_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} दशमलव ${decWord} डिग्री सेल्सियस`;
             })
             .replace(/\b(\d+)°C/gi, (_, intPart) => {
               const intWord = HI_NUMBERS[parseInt(intPart, 10)] || intPart;
               return `${intWord} डिग्री सेल्सियस`;
             })
             .replace(/\b(\d+)\.(\d+)/g, (_, intPart, decPart) => {
               const intWord = HI_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = HI_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} दशमलव ${decWord}`;
             })
             .replace(/\b(\d+)\b/g, (match) => {
               const n = parseInt(match, 10);
               return HI_NUMBERS[n] || match;
             })
             .replace(/°C/g, ' डिग्री सेल्सियस');
  }

  // 3. MARATHI PHONETICS
  else if (prefix === 'mr') {
    res = res.replace(/ARGO/gi, 'आर्गो')
             .replace(/PSU/gi, 'पी एस यू')
             .replace(/km/gi, ' किलोमीटर ')
             .replace(/\b(\d+)\.(\d+)°C/gi, (_, intPart, decPart) => {
               const intWord = MR_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = MR_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} दशांश ${decWord} डिग्री सेल्सिअस`;
             })
             .replace(/\b(\d+)°C/gi, (_, intPart) => {
               const intWord = MR_NUMBERS[parseInt(intPart, 10)] || intPart;
               return `${intWord} डिग्री सेल्सिअस`;
             })
             .replace(/\b(\d+)\.(\d+)/g, (_, intPart, decPart) => {
               const intWord = MR_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = MR_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} दशांश ${decWord}`;
             })
             .replace(/\b(\d+)\b/g, (match) => {
               const n = parseInt(match, 10);
               return MR_NUMBERS[n] || match;
             })
             .replace(/°C/g, ' डिग्री सेल्सिअस');
  }

  // 4. TELUGU PHONETICS
  else if (prefix === 'te') {
    res = res.replace(/ARGO/gi, 'ఆర్గో')
             .replace(/PSU/gi, 'పి ఎస్ యు')
             .replace(/km/gi, ' కిలోమీటర్లు ')
             .replace(/\b(\d+)\.(\d+)°C/gi, (_, intPart, decPart) => {
               const intWord = TE_NUMBERS[parseInt(intPart, 10)] || intPart;
               const decWord = TE_NUMBERS[parseInt(decPart, 10)] || decPart;
               return `${intWord} పాయింట్ ${decWord} డిగ్రీల సెల్సియస్`;
             })
             .replace(/\b(\d+)°C/gi, (_, intPart) => {
               const intWord = TE_NUMBERS[parseInt(intPart, 10)] || intPart;
               return `${intWord} డిగ్రీల సెల్సియస్`;
             })
             .replace(/°C/g, ' డిగ్రీల సెల్సియస్');
  }

  // 5. ENGLISH & DEFAULT
  else {
    res = res.replace(/°C/g, ' degree celsius')
             .replace(/PSU/g, ' P S U ')
             .replace(/ARGO/gi, 'Argo');
  }

  return res;
}

/**
 * Select the best natural soft female voice for the given language locale.
 */
function getSoftFemaleVoice(lang: string): SpeechSynthesisVoice | null {
  const voices = cachedVoices.length > 0 ? cachedVoices : loadVoices();
  if (!voices || voices.length === 0) return null;

  const targetLang = lang.toLowerCase();
  const prefix = targetLang.slice(0, 2);

  // 1. Check exact or prefix match for regional language (Tamil, Telugu, Kannada, Bengali, Hindi, Marathi)
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

      const lang = preferredLanguage || detectLanguageFromText(text);

      // Clean markdown, symbols, and convert numbers/temperatures to native pronunciation words
      let cleanText = text
        .replace(/[*_#`~[\]()]/g, ' ')
        .replace(/•/g, ' ')
        .replace(/–/g, ' ')
        .replace(/⚠️/g, ' ')
        .replace(/🎣/g, ' ')
        .replace(/🛡️/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Apply native phonetic translation for numbers and units
      cleanText = phoneticizeForLanguage(cleanText, lang);

      if (!cleanText) {
        resolve();
        return;
      }

      const voice = getSoftFemaleVoice(lang);

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = lang;
      if (voice) {
        utterance.voice = voice;
      }

      // Natural acoustic pacing
      utterance.rate = 0.90;
      utterance.pitch = 1.05;
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
