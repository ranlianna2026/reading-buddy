import { env } from "cloudflare:workers";

import { levelLabel } from "./levels";
import { heartsNow, levelFor, type Kid } from "./kid";
import { kidsOf } from "./kid.server";

export type Day = {
  day: string;
  sessions: number;
  minutes: number;
  books: string[];
  wcpm: number | null;
  accuracy: number | null;
  comprehension: number;
};

export type Child = {
  id: string;
  name: string;
  age: number | null;
  grade: string;
  level: number;
  label: string;
  language: string;
  totals: { sessions: number; minutes: number; books: number; mastered: number; streak: number };
  days: Day[];
  skills: Record<string, [number, number]>;
  practice: string[];
  likes: string[];
};

const dayOf = (at: number) => new Date(at).toLocaleDateString("en-CA");
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// Every child on the account, rolled up day by day — the Python app's parent dashboard, over D1.
export async function dashboard(userId: string): Promise<Child[]> {
  const kids = await kidsOf(userId);
  return Promise.all(kids.map((kid) => childOf(kid)));
}

async function childOf(kid: Kid): Promise<Child> {
  const [reads, answers, notes] = await Promise.all([
    env.DB.prepare(
      "SELECT title, wcpm, accuracy, comprehension, seconds, created_at FROM readings WHERE kid_id = ?1 ORDER BY created_at"
    )
      .bind(kid.id)
      .all<{ title: string; wcpm: number; accuracy: number; comprehension: number; seconds: number; created_at: number }>(),
    env.DB.prepare("SELECT kind, verdict FROM answers WHERE kid_id = ?1").bind(kid.id).all<{ kind: string; verdict: string }>(),
    env.DB.prepare("SELECT kind, subject FROM memories WHERE kid_id = ?1 ORDER BY weight DESC, seen_at DESC")
      .bind(kid.id)
      .all<{ kind: string; subject: string }>(),
  ]);

  const byDay = new Map<string, { books: string[]; minutes: number; sessions: number; wcpm: number[]; accuracy: number[]; comprehension: number[] }>();
  const titles = new Set<string>();
  for (const row of reads.results) {
    const key = dayOf(row.created_at);
    const day = byDay.get(key) ?? { books: [], minutes: 0, sessions: 0, wcpm: [], accuracy: [], comprehension: [] };
    day.sessions += 1;
    day.minutes += (row.seconds || 0) / 60;
    if (!day.books.includes(row.title)) day.books.push(row.title);
    if (row.accuracy > 0) {
      day.wcpm.push(row.wcpm);
      day.accuracy.push(row.accuracy);
    }
    day.comprehension.push(row.comprehension);
    byDay.set(key, day);
    titles.add(row.title);
  }

  const days: Day[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, it]) => ({
      day,
      sessions: it.sessions,
      minutes: Math.round(it.minutes * 10) / 10,
      books: it.books,
      wcpm: it.wcpm.length ? Math.round(mean(it.wcpm) as number) : null,
      accuracy: it.accuracy.length ? Math.round(mean(it.accuracy) as number) : null,
      comprehension: Math.round(mean(it.comprehension) ?? 0),
    }));

  const had = new Set(days.map((one) => one.day));
  let streak = 0;
  for (let at = Date.now(); had.has(dayOf(at)); at -= 86400000) streak += 1;

  const skills: Record<string, [number, number]> = { recall: [0, 0], inference: [0, 0], vocabulary: [0, 0] };
  for (const one of answers.results) {
    const pair = skills[one.kind] ?? [0, 0];
    skills[one.kind] = [pair[0] + (one.verdict === "correct" ? 1 : 0), pair[1] + 1];
  }

  return {
    id: kid.id,
    name: kid.name,
    age: kid.age,
    grade: kid.grade,
    level: levelFor(kid),
    label: levelLabel(levelFor(kid)),
    language: kid.language,
    totals: {
      sessions: reads.results.length,
      minutes: Math.round(days.reduce((sum, one) => sum + one.minutes, 0)),
      books: titles.size,
      mastered: notes.results.filter((one) => one.kind === "win").length,
      streak,
    },
    days,
    skills,
    practice: notes.results.filter((one) => one.kind === "word").map((one) => one.subject).slice(0, 8),
    likes: notes.results.filter((one) => one.kind === "likes").map((one) => one.subject).slice(0, 4),
  };
}

export const hearts = (kid: Kid) => heartsNow(kid);
