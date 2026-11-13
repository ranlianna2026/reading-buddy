import { Refusal, respond } from "~/lib/ai.server";
import { listen } from "~/lib/voice.server";
import type { Route } from "./+types/api.listen";

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    if (request.method !== "POST") throw new Refusal("POST only.", 405);
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob) || audio.size < 1000) throw new Refusal("No sound in that.", 400);
    return { said: await listen(audio) };
  });
}
