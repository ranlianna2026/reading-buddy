import { env } from "cloudflare:workers";

import { Refusal, respond, text } from "~/lib/ai.server";
import { userOf } from "~/lib/auth.server";
import { reading } from "~/lib/kid.server";
import { PICKS, voices, type Voice } from "~/lib/voice.server";
import type { Route } from "./+types/api.voices";

async function kid(request: Request) {
  const user = await userOf(request);
  if (!user) throw new Refusal("Sign in first.", 401);
  const found = await reading(request, user.id);
  if (!found) throw new Refusal("No reader yet.", 404);
  return found;
}

export async function loader({ request }: Route.LoaderArgs) {
  return respond(async () => {
    const found = await kid(request);
    const row = await env.DB.prepare("SELECT voice, voice_name FROM kids WHERE id = ?1")
      .bind(found.id)
      .first<{ voice: string | null; voice_name: string | null }>();
    const all = await voices();
    return {
      now: row?.voice ?? PICKS.female.id,
      nowName: row?.voice_name ?? PICKS.female.name,
      picks: PICKS,
      voices: all,
    };
  });
}

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const found = await kid(request);
    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      return clone(request, found.id);
    }
    const body = (await request.json()) as Record<string, unknown>;
    const id = text(body.voice, 64);
    if (!id) throw new Refusal("Pick a voice.", 400);
    const all = await voices();
    const known = all.find((voice) => voice.id === id);
    const name = known?.name ?? text(body.name, 60) ?? "";
    await env.DB.prepare("UPDATE kids SET voice = ?2, voice_name = ?3 WHERE id = ?1").bind(found.id, id, name).run();
    return { voice: id, name };
  });
}

async function clone(request: Request, kidId: string) {
  if (!env.ELEVENLABS_API_KEY) throw new Refusal("No voice key is set.", 503);
  const sent = await request.formData();
  const audio = sent.get("audio");
  const name = text(sent.get("name"), 40) || "My voice";
  if (!(audio instanceof Blob) || audio.size < 20_000) {
    throw new Refusal("That recording was too short. Read for about thirty seconds.", 400);
  }
  const form = new FormData();
  form.set("name", name);
  form.set("remove_background_noise", "true");
  form.append("files", audio, "voice.webm");
  const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
    method: "POST",
    headers: { "xi-api-key": env.ELEVENLABS_API_KEY },
    body: form,
  });
  if (!res.ok) {
    const said = (await res.text()).slice(0, 400);
    throw new Refusal(
      res.status === 401 || res.status === 403
        ? "Voice cloning is not on this ElevenLabs plan yet."
        : `The voice service answered ${res.status}: ${said}`,
      502
    );
  }
  const made = (await res.json()) as { voice_id?: string };
  if (!made.voice_id) throw new Refusal("No voice came back.", 502);
  await env.DB.prepare("UPDATE kids SET voice = ?2, voice_name = ?3 WHERE id = ?1").bind(kidId, made.voice_id, name).run();
  return { voice: made.voice_id, name } satisfies { voice: string; name: string };
}

export type { Voice };
