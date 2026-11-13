import { count, Refusal, respond, text } from "~/lib/ai.server";
import { userOf } from "~/lib/auth.server";
import { env } from "cloudflare:workers";
import { heartsNow, MAX_HEARTS, nextHeartIn } from "~/lib/kid";
import { kidOf } from "~/lib/kid.server";
import { history, recall } from "~/lib/memory.server";
import type { Route } from "./+types/api.settings";

async function mine(request: Request) {
  const user = await userOf(request);
  if (!user) throw new Refusal("Sign in first.", 401);
  const kid = await kidOf(user.id);
  if (!kid) throw new Refusal("No reader yet.", 404);
  return { user, kid };
}

export async function loader({ request }: Route.LoaderArgs) {
  return respond(async () => {
    const { user, kid } = await mine(request);
    const [read, memories] = await Promise.all([history(kid.id, 60), recall(kid.id, 60)]);
    const language = await env.DB.prepare("SELECT language FROM kids WHERE id = ?1").bind(kid.id).first<{ language: string }>();
    return {
      email: user.email,
      kid: { id: kid.id, name: kid.name, age: kid.age, language: language?.language ?? "en" },
      stats: {
        hearts: heartsNow(kid),
        maxHearts: MAX_HEARTS,
        heartIn: Math.ceil(nextHeartIn(kid) / 60000),
        streak: kid.streak,
        stars: kid.stars,
        stories: read.length,
        words: read.reduce((all, row) => all + row.words, 0),
        bestWcpm: read.reduce((top, row) => Math.max(top, row.wcpm), 0),
        accuracy: read.length ? Math.round(read.reduce((all, row) => all + row.accuracy, 0) / read.length) : 0,
        remembered: memories.length,
      },
    };
  });
}

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const { kid } = await mine(request);
    const body = (await request.json()) as Record<string, unknown>;
    const name = text(body.name, 40) || kid.name;
    const age = body.age === null ? null : count(body.age, 3, 14, kid.age ?? 7);
    const language = text(body.language, 8) || "en";
    await env.DB.prepare("UPDATE kids SET name = ?2, age = ?3, language = ?4 WHERE id = ?1")
      .bind(kid.id, name, age, language)
      .run();
    return { name, age, language };
  });
}
