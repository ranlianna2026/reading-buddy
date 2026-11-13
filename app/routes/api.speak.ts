import { guard, respond, text } from "~/lib/ai.server";
import { speak, speakAlong } from "~/lib/voice.server";
import type { Route } from "./+types/api.speak";

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const body = await guard(request);
    const words = text(body.text, 1800);
    if (!words) throw new Error("Nothing to say.");
    const mood = body.mood === "cheer" || body.mood === "ask" ? body.mood : "read";
    return body.along ? speakAlong(words, mood) : speak(words, mood);
  });
}
