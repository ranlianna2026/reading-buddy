import { env } from "cloudflare:workers";

export class Refusal extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function guard(request: Request) {
  if (request.method !== "POST") throw new Refusal("POST only.", 405);
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  if (env.LIMIT && !(await env.LIMIT.limit({ key: ip })).success) {
    throw new Refusal("Your buddy needs a little break. Try again in a minute.", 429);
  }
  return (await request.json()) as Record<string, unknown>;
}

const base = () => (env.AI_BASE_URL || "https://inference.celeris.ai/celeris-1/v1").replace(/\/+$/, "");

function key() {
  if (!env.AI_API_KEY) {
    throw new Refusal("No AI key yet. Put AI_API_KEY in .dev.vars (or run wrangler secret put AI_API_KEY).", 503);
  }
  return env.AI_API_KEY;
}

export async function ask(system: string, user: string, maxTokens: number, warmth = 0.7): Promise<string> {
  const res = await fetch(`${base()}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key()}` },
    body: JSON.stringify({
      model: env.AI_MODEL || "celeris-1",
      max_tokens: maxTokens,
      temperature: warmth,
      ...(base().includes("celeris.ai") ? { chat_template_kwargs: { enable_thinking: false } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Refusal(`The story model answered ${res.status}: ${(await res.text()).slice(0, 300)}`, 502);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function askJson(system: string, user: string, maxTokens: number, warmth = 0.7): Promise<Record<string, unknown>> {
  for (let attempt = 0; ; attempt++) {
    const text = await ask(system, user, maxTokens, attempt ? Math.min(warmth, 0.35) : warmth);
    try {
      return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    } catch {
      if (attempt >= 2) throw new Refusal("Your buddy got its words muddled. Try again.", 502);
    }
  }
}

export async function respond(work: () => Promise<unknown>) {
  try {
    const value = await work();
    return value instanceof Response ? value : Response.json(value);
  } catch (error) {
    if (error instanceof Refusal) return new Response(error.message, { status: error.status });
    throw error;
  }
}

export const text = (value: unknown, max = 300) => (typeof value === "string" ? value.trim().slice(0, max) : "");
export const texts = (value: unknown, max = 300) => (Array.isArray(value) ? value.map((item) => text(item, max)).filter(Boolean) : []);
export const count = (value: unknown, low: number, high: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : fallback;
};
