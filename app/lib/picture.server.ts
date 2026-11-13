import { env } from "cloudflare:workers";

import { Refusal } from "./ai.server";

// Page illustrations, ported from the Python app's Muse Image step (rb/illustrate.py).
// With a reference the model edits in that reference's style and characters, so a book's pages stay
// consistent; without one it draws the first picture, which then becomes the reference. Cached in R2.
const STYLES: Record<string, string> = {
  book: "the same hand-drawn art style, colors and characters as the reference illustration from this classic public-domain picture book",
  story:
    "the same style as the child's drawing in the reference: same characters, colors and crayon/marker look, a little more finished but still clearly the child's art",
  series:
    "exactly the same art style, characters (same faces, colors, clothes) and world as the reference picture, which is an earlier page of this same book",
  new: "a warm, cozy watercolor-and-ink children's picture-book style with soft colors and friendly, expressive characters",
};

export function promptFor(title: string, page: string, kind: string, cast = "", avoid = "") {
  return (
    `An illustration for one page of the children's story "${title}", in ${STYLES[kind] ?? STYLES.book}. ` +
    (cast ? `Characters and setting: ${cast.slice(0, 400)}. ` : "") +
    `Show this moment: ${page.slice(0, 600)} ` +
    "Gentle and friendly for young children, richly detailed, soft natural light, clean composition. " +
    "A wordless picture: nothing written anywhere in it." +
    (avoid ? ` A child said the last picture for this page was wrong (${avoid}); fix that.` : "")
  );
}

// Models will letter a picture unless told not to; this is the half of the instruction they listen to.
const NOT = "text, words, letters, numbers, title, caption, subtitle, watermark, signature, logo, " +
  "speech bubble, handwriting, book cover text, frame, border, blurry, deformed, extra limbs";

async function keyOf(parts: string) {
  const hash = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(parts));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 20);
}

// Muse Image when the key is there, Workers AI otherwise, so a picture always arrives.
async function draw(prompt: string, reference: string) {
  const key = env.MODEL_API_KEY;
  if (key) {
    const base = env.MUSE_BASE_URL || "https://api.meta.ai/v1";
    const body: Record<string, unknown> = {
      model: env.IMAGE_MODEL || "muse-image-1.0",
      prompt,
      n: 1,
      size: "1536x1024",
      output_format: "jpeg",
      reasoning_strength: "low",
    };
    if (reference) body.images = [{ image_url: reference }];
    const res = await fetch(`${base}${reference ? "/images/edits" : "/images/generations"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Refusal(`The picture model answered ${res.status}: ${(await res.text()).slice(0, 200)}`, 502);
    const made = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = made.data?.[0]?.b64_json;
    if (!b64) throw new Refusal("The picture came back empty.", 502);
    return { bytes: Uint8Array.from(atob(b64), (letter) => letter.charCodeAt(0)), type: "image/jpeg" };
  }

  const ai = env.AI as unknown as { run: (model: string, input: unknown) => Promise<ReadableStream | { image?: string }> };
  const model = env.AI_IMAGE_MODEL || "@cf/bytedance/stable-diffusion-xl-lightning";
  const flux = model.includes("flux");
  const made = await ai.run(
    model,
    flux
      ? { prompt: prompt.slice(0, 2000), steps: 4 }
      : { prompt: prompt.slice(0, 2000), negative_prompt: NOT, width: 1024, height: 1024, num_steps: 20, guidance: 7.5 }
  );
  if (made instanceof ReadableStream) return { bytes: new Uint8Array(await new Response(made).arrayBuffer()), type: flux ? "image/jpeg" : "image/png" };
  if (made.image) return { bytes: Uint8Array.from(atob(made.image), (letter) => letter.charCodeAt(0)), type: "image/jpeg" };
  throw new Refusal("No picture came back.", 502);
}

export async function picture(opts: { title: string; page: string; kind: string; cast?: string; reference?: string; avoid?: string }) {
  const kind = opts.reference ? opts.kind : "new";
  const prompt = promptFor(opts.title, opts.page, kind, opts.cast, opts.avoid);
  const name = `pictures/${await keyOf(`${(opts.reference ?? "").slice(0, 4000)}|${prompt}|${kind}`)}.img`;
  const had = await env.FILES.get(name);
  if (had) return { url: `/api/picture/${encodeURIComponent(name)}`, cached: true };
  const made = await draw(prompt, opts.reference ?? "");
  await env.FILES.put(name, made.bytes, { httpMetadata: { contentType: made.type, cacheControl: "public, max-age=31536000" } });
  return { url: `/api/picture/${encodeURIComponent(name)}`, cached: false };
}

export async function served(name: string) {
  const file = await env.FILES.get(name);
  if (!file) return new Response("No such picture.", { status: 404 });
  return new Response(file.body, {
    headers: {
      "Content-Type": file.httpMetadata?.contentType ?? "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
