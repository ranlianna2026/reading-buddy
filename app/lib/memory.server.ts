import { env } from "cloudflare:workers";

import { id } from "./auth.server";

export type Note = { kind: "likes" | "word" | "fact" | "win"; subject: string; note: string };
export type Memory = Note & { weight: number; seen_at: number };

const book = (kidId: string) => `kid/${kidId}/book.json`;
const page = (kidId: string, readingId: string) => `kid/${kidId}/reading/${readingId}.json`;

export async function recall(kidId: string, limit = 24): Promise<Memory[]> {
  const rows = await env.DB.prepare(
    "SELECT kind, subject, note, weight, seen_at FROM memories WHERE kid_id = ?1 ORDER BY weight DESC, seen_at DESC LIMIT ?2"
  )
    .bind(kidId, limit)
    .all<Memory>();
  return rows.results;
}

export function asPrompt(name: string, memories: Memory[]) {
  if (!memories.length) return `This is ${name}'s first time reading with you. Keep it warm and simple.`;
  const of = (kind: Note["kind"]) => memories.filter((memory) => memory.kind === kind);
  const line = (label: string, list: Memory[]) => (list.length ? `${label}: ${list.map((m) => `${m.subject} (${m.note})`).join("; ")}` : "");
  return [
    `What you remember about ${name}:`,
    line("Loves", of("likes")),
    line("Words still tricky", of("word")),
    line("About them", of("fact")),
    line("Proud of", of("win")),
  ]
    .filter(Boolean)
    .join("\n");
}

export async function remember(kidId: string, notes: Note[]) {
  if (!notes.length) return;
  const now = Date.now();
  const statement = env.DB.prepare(
    `INSERT INTO memories (id, kid_id, kind, subject, note, weight, key, created_at, seen_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 1, ?6, ?7, ?7)
     ON CONFLICT(kid_id, kind, subject) DO UPDATE SET weight = weight + 1, note = excluded.note, seen_at = excluded.seen_at`
  );
  await env.DB.batch(
    notes.map((note) =>
      statement.bind(id(), kidId, note.kind, note.subject.slice(0, 80), note.note.slice(0, 200), book(kidId), now)
    )
  );
  await env.MEMORY.put(book(kidId), JSON.stringify({ kidId, written: now, memories: await recall(kidId, 200) }, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function forget(kidId: string) {
  await env.DB.prepare("DELETE FROM memories WHERE kid_id = ?1").bind(kidId).run();
  await env.MEMORY.delete(book(kidId));
}

export async function keepReading(
  kidId: string,
  reading: { id: string; title: string; words: number; wcpm: number; accuracy: number; comprehension: number; detail: unknown }
) {
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO readings (id, kid_id, title, words, wcpm, accuracy, comprehension, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
  )
    .bind(reading.id, kidId, reading.title, reading.words, reading.wcpm, reading.accuracy, reading.comprehension, now)
    .run();
  await env.MEMORY.put(page(kidId, reading.id), JSON.stringify({ ...reading, at: now }, null, 2), {
    httpMetadata: { contentType: "application/json" },
  });
}

export async function history(kidId: string, limit = 20) {
  const rows = await env.DB.prepare(
    "SELECT id, title, words, wcpm, accuracy, comprehension, created_at FROM readings WHERE kid_id = ?1 ORDER BY created_at DESC LIMIT ?2"
  )
    .bind(kidId, limit)
    .all<{ id: string; title: string; words: number; wcpm: number; accuracy: number; comprehension: number; created_at: number }>();
  return rows.results;
}
