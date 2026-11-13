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

let tongue = "en-US";

export const speakIn = (tag?: string | null) => void (tongue = tag || "en-US");

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
  engine.lang = tongue;
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
      body: JSON.stringify({ text, tag: tongue, mood }),
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

export async function sayAlong(text: string, onWord: (index: number) => void) {
  hush();
  try {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, tag: tongue, mood: "read", along: true }),
    });
    if (!res.ok) throw new Error(await res.text());
    const { audio, marks } = (await res.json()) as { audio: string; marks: number[] };
    if (!audio || !marks.length) throw new Error("No timings came back.");
    const bytes = Uint8Array.from(atob(audio), (letter) => letter.charCodeAt(0));
    const player = new Audio(URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" })));
    playing = player;
    await player.play();
    let at = 0;
    const follow = () => {
      if (playing !== player) return;
      while (at < marks.length && marks[at] <= player.currentTime) onWord(at++);
      if (!player.paused && !player.ended) requestAnimationFrame(follow);
    };
    requestAnimationFrame(follow);
    await new Promise<void>((done) => {
      player.onended = () => done();
      player.onerror = () => done();
    });
    onWord(marks.length);
  } catch {
    await browserVoice(text, onWord);
  }
}

function browserVoice(text: string, onWord?: (index: number) => void) {
  if (typeof speechSynthesis === "undefined") return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = tongue;
  utterance.rate = 0.92;
  utterance.pitch = 1.1;
  const near = speechSynthesis.getVoices().filter((option) => option.lang.startsWith(tongue.slice(0, 2)));
  const voice = near.find((option) => /female|samantha|zira|aria|jenny/i.test(option.name)) ?? near[0];
  if (voice) utterance.voice = voice;
  if (onWord) {
    utterance.onboundary = (event) => {
      if (event.name && event.name !== "word") return;
      onWord(text.slice(0, event.charIndex).split(/\s+/).filter(Boolean).length);
    };
  }
  speechSynthesis.speak(utterance);
  return new Promise<void>((done) => {
    utterance.onend = () => {
      onWord?.(text.split(/\s+/).filter(Boolean).length);
      done();
    };
    utterance.onerror = () => done();
  });
}
