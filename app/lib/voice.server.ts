import { env } from "cloudflare:workers";

import { Refusal } from "./ai.server";

const VOICE = () => env.VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

export async function speak(words: string, mood: "read" | "ask" | "cheer" = "read") {
  if (!env.ELEVENLABS_API_KEY) {
    throw new Refusal("No voice key yet. Put ELEVENLABS_API_KEY in .dev.vars (or run wrangler secret put ELEVENLABS_API_KEY).", 503);
  }
  const settings =
    mood === "cheer"
      ? { stability: 0.35, similarity_boost: 0.8, style: 0.55, use_speaker_boost: true }
      : mood === "ask"
        ? { stability: 0.5, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true }
        : { stability: 0.62, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true };
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE()}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "xi-api-key": env.ELEVENLABS_API_KEY },
    body: JSON.stringify({
      text: words,
      model_id: env.VOICE_MODEL || "eleven_turbo_v2_5",
      voice_settings: settings,
    }),
  });
  if (!res.ok) throw new Refusal(`The voice answered ${res.status}: ${(await res.text()).slice(0, 200)}`, 502);
  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" },
  });
}

export async function listen(audio: Blob): Promise<string> {
  const viaCeleris = await transcribeCeleris(audio).catch(() => null);
  if (viaCeleris !== null) return viaCeleris;
  if (!env.AI) throw new Refusal("Nothing could listen to that just now.", 502);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  const run = env.AI.run as (model: string, input: unknown) => Promise<{ text?: string }>;
  const result = await run("@cf/openai/whisper-large-v3-turbo", { audio: [...bytes] });
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
