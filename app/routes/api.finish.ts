import { count, guard, respond, text } from "~/lib/ai.server";
import { id, userOf } from "~/lib/auth.server";
import { cheer, kidOf } from "~/lib/kid.server";
import { keepReading, remember, type Note } from "~/lib/memory.server";
import type { Route } from "./+types/api.finish";

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const body = await guard(request);
    const user = await userOf(request);
    if (!user) throw new Error("Sign in first.");
    const kid = await kidOf(user.id, text(body.kidId, 64));
    if (!kid) throw new Error("No reader yet.");

    const reading = {
      id: id(),
      title: text(body.title, 80) || "A story",
      words: count(body.words, 0, 5000, 0),
      wcpm: count(body.wcpm, 0, 400, 0),
      accuracy: count(body.accuracy, 0, 100, 0),
      comprehension: count(body.comprehension, 0, 100, 0),
      detail: body.detail ?? null,
    };
    await keepReading(kid.id, reading);

    const notes: Note[] = Array.isArray(body.notes)
      ? (body.notes as Record<string, unknown>[])
          .map((note) => ({
            kind: (["likes", "word", "fact", "win"].includes(String(note.kind)) ? String(note.kind) : "win") as Note["kind"],
            subject: text(note.subject, 80),
            note: text(note.note, 200),
          }))
          .filter((note) => note.subject && note.note)
      : [];
    const practice = Array.isArray(body.practiceWords) ? (body.practiceWords as unknown[]).map((word) => text(word, 30)).filter(Boolean) : [];
    for (const word of practice.slice(0, 6)) notes.push({ kind: "word", subject: word, note: "tripped on this one" });
    await remember(kid.id, notes);

    const stars = reading.accuracy >= 95 ? 3 : reading.accuracy >= 85 ? 2 : 1;
    return { reading: reading.id, ...(await cheer(kid, stars)), stars_won: stars };
  });
}
