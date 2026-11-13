import { env } from "cloudflare:workers";

import { id } from "./auth.server";
import { day, heartsNow, MAX_HEARTS, type Kid } from "./kid";

export async function kidsOf(userId: string) {
  const rows = await env.DB.prepare(
    "SELECT id, name, age, hearts, hearts_at, streak, streak_day, stars, language FROM kids WHERE user_id = ?1 ORDER BY created_at"
  )
    .bind(userId)
    .all<Kid>();
  return rows.results;
}

export async function kidOf(userId: string, kidId?: string | null) {
  const kids = await kidsOf(userId);
  return kids.find((kid) => kid.id === kidId) ?? kids[0] ?? null;
}

export async function addKid(userId: string, name: string, age: number | null) {
  const kidId = id();
  await env.DB.prepare(
    "INSERT INTO kids (id, user_id, name, age, hearts, hearts_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)"
  )
    .bind(kidId, userId, name.slice(0, 40), age, MAX_HEARTS, Date.now())
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
