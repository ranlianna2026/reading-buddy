type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};

const Engine = () =>
  typeof window === "undefined"
    ? null
    : ((window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition ??
      null);

export const canHear = () => Engine() !== null;

export function hear(onWords: (said: string, settled: boolean) => void, onStop?: (reason?: string) => void) {
  const Make = Engine();
  if (!Make) {
    onStop?.("This browser cannot listen. Chrome or Edge can.");
    return { stop: () => {} };
  }
  const engine = new Make();
  engine.lang = "en-US";
  engine.continuous = true;
  engine.interimResults = true;
  engine.maxAlternatives = 1;
  let settled = "";
  let live = true;
  engine.onresult = (event) => {
    let loose = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) settled += `${piece} `;
      else loose += piece;
    }
    onWords(`${settled}${loose}`.replace(/\s+/g, " ").trim(), false);
  };
  engine.onerror = (event) => {
    if (event.error !== "no-speech" && event.error !== "aborted") {
      live = false;
      onStop?.(event.error === "not-allowed" ? "The microphone is blocked. Allow it and try again." : "");
    }
  };
  engine.onend = () => {
    if (live) {
      try {
        engine.start();
        return;
      } catch {
        /* restart raced the stop */
      }
    }
    onWords(settled.replace(/\s+/g, " ").trim(), true);
    onStop?.();
  };
  engine.start();
  return {
    stop: () => {
      live = false;
      engine.stop();
    },
  };
}

let playing: HTMLAudioElement | null = null;

export function hush() {
  playing?.pause();
  playing = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
}

export async function say(text: string, mood: "read" | "ask" | "cheer" = "read") {
  hush();
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mood }),
    });
    if (!res.ok) throw new Error(await res.text());
    const audio = new Audio(URL.createObjectURL(await res.blob()));
    playing = audio;
    await audio.play();
    return new Promise<void>((done) => {
      audio.onended = () => done();
      audio.onerror = () => done();
    });
  } catch {
    return browserVoice(text);
  }
}

function browserVoice(text: string) {
  if (typeof speechSynthesis === "undefined") return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  utterance.pitch = 1.1;
  const voice = speechSynthesis.getVoices().find((option) => /female|samantha|zira|aria|jenny/i.test(option.name) && option.lang.startsWith("en"));
  if (voice) utterance.voice = voice;
  speechSynthesis.speak(utterance);
  return new Promise<void>((done) => {
    utterance.onend = () => done();
    utterance.onerror = () => done();
  });
}
