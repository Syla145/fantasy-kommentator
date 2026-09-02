// ============================================================
// SPEECH – Web Speech API mit Warteschlange, damit sich
// mehrere Kommentare nicht überlappen
// ============================================================

const Speech = (() => {
  let voices = [];
  let queue = [];
  let speaking = false;
  let onLine = null; // Callback fürs UI-Transkript

  function loadVoices() {
    voices = window.speechSynthesis.getVoices();
  }

  // Manche Browser laden Stimmen asynchron nach
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();

  function pickVoice(preferLang) {
    const match = voices.find(v => v.lang && v.lang.startsWith(preferLang));
    return match || voices[0] || null;
  }

  function speakNext() {
    if (speaking || queue.length === 0) return;
    speaking = true;
    const { host, text } = queue.shift();
    const hostCfg = CONFIG.voices[host] || { pitch: 1, rate: 1, preferLang: "de-DE" };

    const utter = new SpeechSynthesisUtterance(text);
    utter.pitch = hostCfg.pitch;
    utter.rate = hostCfg.rate;
    const v = pickVoice(hostCfg.preferLang);
    if (v) utter.voice = v;

    if (onLine) onLine(host, text);

    utter.onend = () => {
      speaking = false;
      speakNext();
    };
    utter.onerror = () => {
      speaking = false;
      speakNext();
    };

    window.speechSynthesis.speak(utter);
  }

  function say(host, text) {
    queue.push({ host, text });
    speakNext();
  }

  function setOnLine(cb) {
    onLine = cb;
  }

  return { say, setOnLine };
})();
