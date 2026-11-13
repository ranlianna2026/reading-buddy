import { askJson, count, guard, respond, text, texts } from "~/lib/ai.server";
import { tongueOf } from "~/lib/languages";
import { norm } from "~/lib/scoring";
import type { Route } from "./+types/api.talk";

const VOICE = (age: string, tongue: string) =>
  `You are Fig, a warm, patient reading buddy for a child aged ${age}. Short simple sentences. ` +
  "Be encouraging and specific, never shame, and ground everything in the passage. Answer with JSON only. " +
  `Every word the child will see or hear — questions, answers, feedback, hints — is written in ${tongue}. ` +
  'The "kind" and "verdict" fields stay in English.';

const flat = (words: string) =>
  words
    .split(/\s+/)
    .map(norm)
    .filter(Boolean)
    .join(" ");

const quoteOk = (quote: string, passage: string) => {
  const q = flat(quote);
  return Boolean(q) && flat(passage).includes(q);
};

export async function action({ request }: Route.ActionArgs) {
  return respond(async () => {
    const body = await guard(request);
    const passage = text(body.passage, 2000);
    const age = text(body.age, 10) || "6-10";
    const tongue = tongueOf(text(body.language, 24)).name;
    if (!passage) throw new Error("No passage to talk about.");

    if (body.step === "questions") {
      const stumbled = texts(body.practiceWords, 30).slice(0, 8);
      const made = await askJson(
        VOICE(age, tongue),
        `${stumbled.length ? `Words the child stumbled on: ${stumbled.join(", ")}.\n` : ""}` +
          "Write exactly 3 spoken questions about this passage: one 'recall' (what happened or who), one " +
          "'inference' (why, or how someone felt), one 'vocabulary' (what a word from the passage means, " +
          "preferring a word the child stumbled on). Answer as JSON: " +
          '{"questions": [{"kind": "recall|inference|vocabulary", "question": "...", "answer": "the answer, ' +
          'plus other answers the passage supports", "quote": "exact words copied from the passage"}]}' +
          `\n\nPassage:\n${passage}`,
        800,
        0.6
      );
      const list = Array.isArray(made.questions) ? made.questions : [];
      const questions = list
        .map((item) => item as Record<string, unknown>)
        .map((item) => ({
          kind: ["recall", "inference", "vocabulary"].includes(String(item.kind)) ? String(item.kind) : "recall",
          question: text(item.question, 200),
          answer: text(item.answer, 300),
          quote: quoteOk(text(item.quote, 300), passage) ? text(item.quote, 300) : "",
        }))
        .filter((item) => item.question)
        .slice(0, 3);
      if (!questions.length) throw new Error("No questions came back.");
      return { questions };
    }

    if (body.step === "grade") {
      const question = text(body.question, 200);
      const expected = text(body.answer, 300);
      const said = text(body.said, 600);
      const attempt = count(body.attempt, 1, 3, 1);
      const quote = text(body.quote, 300);
      if (!said) return { verdict: "not_yet", feedback: "I did not quite catch that. Try once more.", hint: "", quote };
      const made = await askJson(
        VOICE(age, tongue),
        `Passage:\n${passage}\n\nQuestion: ${question}\nExpected answer: ${expected}\n` +
          `The child said (speech to text, small errors are fine): "${said}"\nAttempt ${attempt}. ` +
          "Judge meaning, not wording or spelling. Mark 'correct' for any answer the passage supports. " +
          (attempt >= 2 ? "This is the last try, so gently explain the answer. " : "If it is not right, hint without giving it away. ") +
          'Answer as JSON: {"verdict": "correct|partly|not_yet", "feedback": "one or two short spoken sentences", ' +
          '"hint": "a nudge, or empty when correct", "quote": "exact words from the passage that show the answer"}',
        500,
        0.4
      );
      const back = text(made.quote, 300);
      return {
        verdict: ["correct", "partly", "not_yet"].includes(String(made.verdict)) ? String(made.verdict) : "not_yet",
        feedback: text(made.feedback, 300) || "Good try.",
        hint: text(made.hint, 200),
        quote: quoteOk(back, passage) ? back : quoteOk(quote, passage) ? quote : "",
      };
    }

    if (body.step === "praise") {
      const made = await askJson(
        VOICE(age, tongue),
        `A child just read "${text(body.title, 80)}" out loud at ${count(body.wcpm, 0, 400, 0)} words a minute ` +
          `with ${count(body.accuracy, 0, 100, 0)}% accuracy and got ${count(body.right, 0, 3, 0)} of 3 questions right. ` +
          `${texts(body.practiceWords, 30).length ? `Words to practise: ${texts(body.practiceWords, 30).join(", ")}. ` : ""}` +
          'Answer as JSON: {"said": "two short warm spoken sentences naming one real thing they did well and one thing to try next", ' +
          '"notes": [{"kind": "likes|word|fact|win", "subject": "a few words", "note": "a short note to remember"}]}',
        400,
        0.7
      );
      const notes = Array.isArray(made.notes) ? made.notes : [];
      return {
        said: text(made.said, 300) || "Lovely reading. Let's do another one soon.",
        notes: notes
          .map((note) => note as Record<string, unknown>)
          .map((note) => ({
            kind: ["likes", "word", "fact", "win"].includes(String(note.kind)) ? String(note.kind) : "win",
            subject: text(note.subject, 80),
            note: text(note.note, 200),
          }))
          .filter((note) => note.subject && note.note)
          .slice(0, 6),
      };
    }

    throw new Error("Unknown step.");
  });
}
