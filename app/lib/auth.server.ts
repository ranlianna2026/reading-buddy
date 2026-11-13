import { env } from "cloudflare:workers";

const COOKIE = "rb_session";
const TTL = 60 * 60 * 24 * 60 * 1000;
const ROUNDS = 150_000;

export type User = { id: string; email: string };

export const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export const unb64url = (text: string) =>
  Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const sha256 = async (text: string) => b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));

export const id = () => crypto.randomUUID();

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt: salt as BufferSource, iterations: ROUNDS, hash: "SHA-256" }, key, 256);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2.${ROUNDS}.${b64url(salt)}.${b64url(await derive(password, salt))}`;
}

export async function checkPassword(password: string, stored: string | null) {
  if (!stored) return false;
  const [, rounds, salt, hash] = stored.split(".");
  if (Number(rounds) !== ROUNDS) return false;
  const made = b64url(await derive(password, unb64url(salt)));
  if (made.length !== hash.length) return false;
  let same = 0;
  for (let i = 0; i < made.length; i++) same |= made.charCodeAt(i) ^ hash.charCodeAt(i);
  return same === 0;
}

export async function startSession(userId: string) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256(token), userId, now, now + TTL)
    .run();
  return token;
}

export function readCookie(request: Request, name = COOKIE) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TTL / 1000}${secure}`;
}

export function clearedCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function userOf(request: Request): Promise<User | null> {
  const token = readCookie(request);
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?1 AND sessions.revoked_at IS NULL AND sessions.expires_at > ?2"
  )
    .bind(await sha256(token), Date.now())
    .first<User>();
  return row ?? null;
}

export async function endSession(request: Request) {
  const token = readCookie(request);
  if (token) {
    await env.DB.prepare("UPDATE sessions SET revoked_at = ?2 WHERE id = ?1").bind(await sha256(token), Date.now()).run();
  }
}

export async function userByEmail(email: string) {
  return env.DB.prepare("SELECT id, email, password_hash FROM users WHERE email = ?1")
    .bind(email.trim().toLowerCase())
    .first<{ id: string; email: string; password_hash: string | null }>();
}

export async function createUser(email: string, password: string | null) {
  const userId = id();
  await env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(userId, email.trim().toLowerCase(), password ? await hashPassword(password) : null, Date.now())
    .run();
  return userId;
}

export function siteOf(request: Request) {
  const url = new URL(request.url);
  return { rpID: url.hostname, origin: url.origin };
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
