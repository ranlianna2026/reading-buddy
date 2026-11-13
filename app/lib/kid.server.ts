import { env } from "cloudflare:workers";

import { id } from "./auth.server";
import { gradeOf } from "./grades";
import { day, heartsNow, levelFor, MAX_HEARTS, type Kid } from "./kid";

export async function kidsOf(userId: string) {
  const rows = await env.DB.prepare(
    "SELECT id, name, age, hearts, hearts_at, streak, streak_day, stars, language, grade, level FROM kids WHERE user_id = ?1 ORDER BY created_at"
  )
    .bind(userId)
    .all<Kid>();
  return rows.results;
}

export async function kidOf(userId: string, kidId?: string | null) {
  const kids = await kidsOf(userId);
  return kids.find((kid) => kid.id === kidId) ?? kids[0] ?? null;
}

export async function addKid(userId: string, name: string, age: number | null, grade = "2") {
  const kidId = id();
  await env.DB.prepare(
    "INSERT INTO kids (id, user_id, name, age, grade, hearts, hearts_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)"
  )
    .bind(kidId, userId, name.slice(0, 40), age, grade, MAX_HEARTS, Date.now())
    .run();
  return kidId;
}

export async function spendHeart(kid: Kid) {
  const have = heartsNow(kid);
  if (have <= 0) return 0;
  const left = have - 1;
  await env.DB.prepare("UPDATE kids SET hearts = ?2, hearts_at = ?3 WHERE id = ?1")
    .bind(kid.id, left, left >= MAX_HEARTS ? Date.now() : kid.hearts_at || Date.now())
    .run();
  return left;
}

export async function cheer(kid: Kid, stars: number) {
  const today = day();
  const yesterday = day(Date.now() - 864e5);
  const streak = kid.streak_day === today ? kid.streak : kid.streak_day === yesterday ? kid.streak + 1 : 1;
  await env.DB.prepare("UPDATE kids SET stars = stars + ?2, streak = ?3, streak_day = ?4 WHERE id = ?1")
    .bind(kid.id, stars, streak, today)
    .run();
  return { stars: kid.stars + stars, streak };
}

// Standard instructional bands: 95% accuracy and two thirds understood moves up, under 90% moves down.
export async function settle(kid: Kid, read: { accuracy: number; comprehension: number; finished: boolean; asked: number; aloud: boolean }) {
  const was = levelFor(kid);
  const next =
    !read.aloud
      ? was
      : read.accuracy >= 95 && read.comprehension >= 67 && read.finished
        ? Math.min(5, was + 1)
        : read.accuracy < 90 || (read.asked > 0 && read.comprehension < 34)
          ? Math.max(1, was - 1)
          : was;
  if (next !== kid.level) await env.DB.prepare("UPDATE kids SET level = ?2 WHERE id = ?1").bind(kid.id, next).run();
  return {
    from: was,
    to: next,
    why:
      !read.aloud
        ? "listening practice, so your reading level stays the same"
        : next > was
        ? "accurate reading and good understanding"
        : next < was
          ? "this one was hard, so the next story will be a little easier"
          : "just right, so we will stay here for more practice",
  };
}
