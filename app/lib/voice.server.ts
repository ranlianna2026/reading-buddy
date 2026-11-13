import { env } from "cloudflare:workers";

import { Refusal } from "./ai.server";

export type Voice = { id: string; name: string; gender: string; kind: string; mine: boolean; preview: string };

export const PICKS = {
  female: { id: "zmcVlqmyk3Jpn5AVYcAL", name: "Sapphire" },
  male: { id: "bIHbv24MWmeRgasZH58o", name: "Will" },
} as const;

const FALLBACK = (): string => env.VOICE_ID || PICKS.female.id;

type Mood = "read" | "ask" | "cheer";

const SETTINGS: Record<Mood, Record<string, number | boolean>> = {
  cheer: { stability: 0.35, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true },
  ask: { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true },
  read: { stability: 0.62, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
};

function key() {
  if (!env.ELEVENLABS_API_KEY) {
    throw new Refusal("No voice key yet. Put ELEVENLABS_API_KEY in .dev.vars (or run wrangler secret put ELEVENLABS_API_KEY).", 503);
  }
  return env.ELEVENLABS_API_KEY;
}

export async function voices(): Promise<Voice[]> {
  const res = await fetch("https://api.elevenlabs.io/v2/voices?page_size=100", { headers: { "xi-api-key": key() } });
  if (!res.ok) throw new Refusal(`The voice list answered ${res.status}.`, 502);
  const made = (await res.json()) as {
    voices?: { voice_id: string; name: string; category?: string; labels?: Record<string, string>; preview_url?: string }[];
  };
  return (made.voices ?? [])
    .map((voice) => ({
      id: voice.voice_id,
      name: voice.name.split(" - ")[0].split(" – ")[0].trim(),
      gender: voice.labels?.gender ?? "neutral",
      kind: voice.category ?? "premade",
      mine: voice.category === "cloned" || voice.category === "generated",
      preview: voice.preview_url ?? "",
    }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.name.localeCompare(b.name));
}

async function voice(words: string, mood: Mood, path: string, id: string, tag = "en-US") {
  const tongue = tag.split("-")[0];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}${path}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": key() },
    body: JSON.stringify({
      text: words,
      model_id: tongue === "en" ? env.VOICE_MODEL || "eleven_turbo_v2_5" : "eleven_multilingual_v2",
      language_code: tongue === "en" ? "en" : undefined,
      voice_settings: SETTINGS[mood],
    }),
  });
  if (!res.ok) throw new Refusal(`The voice answered ${res.status}: ${(await res.text()).slice(0, 200)}`, 502);
  return res;
}

export async function speak(words: string, mood: Mood = "read", id = FALLBACK(), tag = "en-US") {
  const res = await voice(words, mood, "", id, tag);
  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
}

export async function speakAlong(words: string, mood: Mood = "read", id = FALLBACK(), tag = "en-US") {
  const res = await voice(words, mood, "/with-timestamps", id, tag);
  const made = (await res.json()) as {
    audio_base64?: string;
    alignment?: { characters?: string[]; character_start_times_seconds?: number[] };
  };
  const letters = made.alignment?.characters ?? [];
  const times = made.alignment?.character_start_times_seconds ?? [];
  const marks: number[] = [];
  let word = 0;
  let inWord = false;
  for (let i = 0; i < letters.length; i++) {
    const blank = /\s/.test(letters[i]);
    if (!blank && !inWord) {
      marks[word] = times[i] ?? 0;
      word++;
    }
    inWord = !blank;
  }
  return { audio: made.audio_base64 ?? "", marks };
}

export async function listen(audio: Blob): Promise<string> {
  const viaCeleris = await transcribeCeleris(audio).catch(() => null);
  if (viaCeleris !== null) return viaCeleris;
  if (!env.AI) throw new Refusal("Nothing could listen to that just now.", 502);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const ai = env.AI as unknown as { run: (model: string, input: unknown) => Promise<{ text?: string }> };
  const result = await ai.run("@cf/openai/whisper-large-v3-turbo", { audio: [...bytes] });
  return (result.text ?? "").trim();
}

async function transcribeCeleris(audio: Blob) {
  if (!env.AI_API_KEY) return null;
  const base = (env.AI_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return null;
  const form = new FormData();
  form.set("file", audio, "speech.webm");
  form.set("model", env.STT_MODEL || "whisper-1");
  form.set("language", "en");
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.AI_API_KEY}` },
    body: form,
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { text?: string };
  return typeof data.text === "string" ? data.text.trim() : null;
}
