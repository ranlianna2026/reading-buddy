import { askJson, count, guard, respond, text } from "~/lib/ai.server";
import { userOf } from "~/lib/auth.server";
import { kidOf } from "~/lib/kid.server";
import { asPrompt, recall } from "~/lib/memory.server";
import type { Route } from "./+types/api.story";

const BANDS: Record<string, string> = {
  1: "ages 5-6, about 55 words, one-syllable words, very short sentences",
  2: "ages 6-7, about 85 words, mostly one and two-syllable words, short sentences",
  3: "ages 7-8, about 120 words, a few longer words, some dialogue",
  4: "ages 8-9, about 160 words, richer words, two short paragraphs",
  5: "ages 9-10, about 200 words, a vivid word or two worth asking about",
};

const PLACES = ["meadow", "sea", "space", "forest", "night", "dawn"];

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const body = await guard(request);
    const user = await userOf(request);
    const kid = user ? await kidOf(user.id, text(body.kidId, 64)) : null;
    const level = String(count(body.level, 1, 5, 2));
    const topic = text(body.topic, 80);
    const memories = kid ? await recall(kid.id, 14) : [];
    const name = kid?.name ?? "the reader";

    const made = await askJson(
      `You write tiny original stories for a child to read out loud. Reading level: ${BANDS[level]}. ` +
        "Warm, funny, kind, never scary and never sad at the end. Plain words a child can sound out. " +
        "No made-up spellings, no emoji, no headings inside the story. Answer with JSON only.",
      `${asPrompt(name, memories)}\n\n` +
        (topic ? `${name} asked for a story about: ${topic}.\n` : `Pick a subject ${name} would love.\n`) +
        "Write the story and answer as JSON: " +
        '{"title": "a real storybook title, two to five words, no quotes, no subtitle", ' +
        '"passage": "the story, one or two short paragraphs", ' +
        `"place": "where it happens, one of: ${PLACES.join(", ")}", ` +
        '"topic": "one real-world thing in the story worth a fun fact", ' +
        '"stretch": ["up to three words in the story that are worth talking about"]}',
      900,
      0.85
    );

    const passage = text(made.passage, 1600).replace(/\s+/g, " ").trim();
    if (!passage) throw new Error("The story came back empty.");
    const title = text(made.title, 60).replace(/^["'“”]+|["'“”.]+$/g, "") || "A Story";
    const place = PLACES.includes(String(made.place)) ? String(made.place) : "meadow";
    return {
      title,
      passage,
      place,
      seed: seedOf(`${kid?.id ?? "guest"}:${title}:${passage.length}`),
      by: name,
      topic: text(made.topic, 90),
      stretch: Array.isArray(made.stretch) ? made.stretch.map((word) => text(word, 30)).filter(Boolean).slice(0, 3) : [],
      words: passage.split(/\s+/).filter(Boolean).length,
      level: Number(level),
    };
  });
}

function seedOf(words: string) {
  let seed = 2166136261;
  for (let i = 0; i < words.length; i++) {
    seed ^= words.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}
