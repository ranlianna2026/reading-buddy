import { env } from "cloudflare:workers";

import { guard, respond, text } from "~/lib/ai.server";
import { userOf } from "~/lib/auth.server";
import { kidOf } from "~/lib/kid.server";
import { speak, speakAlong } from "~/lib/voice.server";
import type { Route } from "./+types/api.speak";

async function chosen(request: Request) {
  const user = await userOf(request);
  if (!user) return undefined;
  const kid = await kidOf(user.id);
  if (!kid) return undefined;
  const row = await env.DB.prepare("SELECT voice FROM kids WHERE id = ?1").bind(kid.id).first<{ voice: string | null }>();
  return row?.voice ?? undefined;
}

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const body = await guard(request);
    const words = text(body.text, 1800);
    if (!words) throw new Error("Nothing to say.");
    const mood = body.mood === "cheer" || body.mood === "ask" ? body.mood : "read";
    const voice = text(body.voice, 64) || (await chosen(request));
    return body.along ? speakAlong(words, mood, voice) : speak(words, mood, voice);
  });
}
