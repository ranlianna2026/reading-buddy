import { env } from "cloudflare:workers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

import { b64url, id, readCookie, siteOf, unb64url } from "./auth.server";

const CHALLENGE = "rb_challenge";
const CHALLENGE_TTL = 5 * 60 * 1000;

type Credential = { id: string; public_key: string; counter: number; transports: string | null };

function challengeCookie(request: Request, value: string, seconds = CHALLENGE_TTL / 1000) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${CHALLENGE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure}`;
}

async function keepChallenge(request: Request, challenge: string, userId: string | null) {
  const key = id();
  await env.DB.prepare("INSERT INTO challenges (id, user_id, challenge, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(key, userId, challenge, Date.now() + CHALLENGE_TTL)
    .run();
  return challengeCookie(request, key);
}

async function takeChallenge(request: Request) {
  const key = readCookie(request, CHALLENGE);
  if (!key) return null;
  const row = await env.DB.prepare("SELECT user_id, challenge, expires_at FROM challenges WHERE id = ?1")
    .bind(key)
    .first<{ user_id: string | null; challenge: string; expires_at: number }>();
  await env.DB.prepare("DELETE FROM challenges WHERE id = ?1 OR expires_at < ?2").bind(key, Date.now()).run();
  return row && row.expires_at > Date.now() ? row : null;
}

export async function registerOptions(request: Request, user: { id: string; email: string }) {
  const { rpID } = siteOf(request);
  const known = await env.DB.prepare("SELECT id, transports FROM credentials WHERE user_id = ?1").bind(user.id).all<Credential>();
  const options = await generateRegistrationOptions({
    rpName: env.PRODUCT_NAME ?? "Learning Buddy",
    rpID,
    userName: user.email,
    userDisplayName: user.email.split("@")[0],
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: known.results.map((row) => ({ id: row.id, transports: parseTransports(row.transports) })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  return { options, cookie: await keepChallenge(request, options.challenge, user.id) };
}

export async function registerCheck(request: Request, user: { id: string }, response: RegistrationResponseJSON, label: string) {
  const kept = await takeChallenge(request);
  if (!kept || kept.user_id !== user.id) throw new Error("That passkey request timed out. Try again.");
  const { rpID, origin } = siteOf(request);
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: kept.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
  if (!result.verified || !result.registrationInfo) throw new Error("That passkey could not be checked.");
  const { credential } = result.registrationInfo;
  await env.DB.prepare(
    "INSERT OR REPLACE INTO credentials (id, user_id, public_key, counter, transports, label, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
  )
    .bind(credential.id, user.id, b64url(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? []), label, Date.now())
    .run();
  return credential.id;
}

export async function signInOptions(request: Request, email?: string) {
  const { rpID } = siteOf(request);
  let userId: string | null = null;
  let allow: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;
  if (email) {
    const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?1").bind(email.trim().toLowerCase()).first<{ id: string }>();
    if (user) {
      userId = user.id;
      const known = await env.DB.prepare("SELECT id, transports FROM credentials WHERE user_id = ?1").bind(user.id).all<Credential>();
      allow = known.results.map((row) => ({ id: row.id, transports: parseTransports(row.transports) }));
    }
  }
  const options = await generateAuthenticationOptions({ rpID, allowCredentials: allow, userVerification: "preferred" });
  return { options, cookie: await keepChallenge(request, options.challenge, userId) };
}

export async function signInCheck(request: Request, response: AuthenticationResponseJSON) {
  const kept = await takeChallenge(request);
  if (!kept) throw new Error("That sign-in request timed out. Try again.");
  const row = await env.DB.prepare("SELECT id, user_id, public_key, counter, transports FROM credentials WHERE id = ?1")
    .bind(response.id)
    .first<Credential & { user_id: string }>();
  if (!row) throw new Error("That passkey is not known here.");
  const { rpID, origin } = siteOf(request);
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: kept.challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: row.id,
      publicKey: unb64url(row.public_key),
      counter: row.counter,
      transports: parseTransports(row.transports),
    },
  });
  if (!result.verified) throw new Error("That passkey could not be checked.");
  await env.DB.prepare("UPDATE credentials SET counter = ?2 WHERE id = ?1").bind(row.id, result.authenticationInfo.newCounter).run();
  return row.user_id;
}

type AuthenticatorTransportFuture = NonNullable<Parameters<typeof generateAuthenticationOptions>[0]["allowCredentials"]>[number]["transports"] extends
  | (infer T)[]
  | undefined
  ? T
  : never;

function parseTransports(raw: string | null): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? (list as AuthenticatorTransportFuture[]) : undefined;
  } catch {
    return undefined;
  }
}
