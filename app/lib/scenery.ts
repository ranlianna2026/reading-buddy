import { dice, ok, Paint, ramp, type RGB, type Ramp } from "./pixel";

export const PLACES = ["meadow", "forest", "sea", "space", "night", "dawn"] as const;
export type Place = (typeof PLACES)[number];

type Weather = {
  sky: Ramp;
  cloud: Ramp;
  lamp: RGB;
  far: Ramp;
  ground: Ramp;
  leaf: Ramp;
  bark: Ramp;
  bloom: RGB;
  ink: RGB;
};

const INK = ok(0.24, 0.03, 262);
const WARM_INK = ok(0.27, 0.04, 56);

const WEATHER: Record<Place, Weather> = {
  meadow: {
    sky: [ok(0.62, 0.15, 252), ok(0.7, 0.13, 248), ok(0.78, 0.11, 242), ok(0.86, 0.08, 236), ok(0.92, 0.05, 226), ok(0.95, 0.04, 200)],
    cloud: [ok(0.78, 0.05, 256), ok(0.89, 0.03, 250), ok(0.96, 0.015, 244), ok(1, 0.005, 240)],
    lamp: ok(0.97, 0.1, 95),
    far: ramp(0.72, 0.055, 200, 4, 0.15),
    ground: ramp(0.63, 0.12, 142, 5, 0.28),
    leaf: ramp(0.56, 0.13, 146, 4, 0.26),
    bark: ramp(0.46, 0.065, 62, 3, 0.2),
    bloom: ok(0.84, 0.16, 28),
    ink: ok(0.3, 0.05, 150),
  },
  forest: {
    sky: [ok(0.56, 0.14, 244), ok(0.66, 0.12, 238), ok(0.76, 0.1, 230), ok(0.85, 0.07, 212), ok(0.91, 0.05, 180), ok(0.95, 0.04, 150)],
    cloud: [ok(0.78, 0.05, 240), ok(0.89, 0.03, 232), ok(0.96, 0.015, 220), ok(1, 0.006, 200)],
    lamp: ok(0.97, 0.09, 100),
    far: ramp(0.66, 0.06, 176, 4, 0.16),
    ground: ramp(0.54, 0.1, 150, 5, 0.26),
    leaf: ramp(0.46, 0.1, 158, 4, 0.28),
    bark: ramp(0.44, 0.07, 58, 3, 0.24),
    bloom: ok(0.88, 0.15, 92),
    ink: ok(0.26, 0.05, 160),
  },
  sea: {
    sky: [ok(0.64, 0.14, 248), ok(0.73, 0.12, 242), ok(0.82, 0.09, 234), ok(0.89, 0.06, 224), ok(0.94, 0.04, 206), ok(0.96, 0.035, 188)],
    cloud: [ok(0.79, 0.05, 250), ok(0.9, 0.03, 242), ok(0.97, 0.015, 232), ok(1, 0.005, 226),],
    lamp: ok(0.98, 0.09, 92),
    far: ramp(0.7, 0.06, 214, 4, 0.14),
    ground: ramp(0.84, 0.055, 80, 5, 0.22),
    leaf: ramp(0.56, 0.1, 150, 4, 0.24),
    bark: ramp(0.5, 0.06, 64, 3, 0.2),
    bloom: ok(0.98, 0.02, 220),
    ink: ok(0.32, 0.05, 236),
  },
  space: {
    sky: [ok(0.14, 0.08, 288), ok(0.19, 0.1, 292), ok(0.25, 0.11, 300), ok(0.31, 0.11, 312), ok(0.37, 0.1, 326), ok(0.43, 0.09, 338)],
    cloud: [ok(0.3, 0.09, 310), ok(0.42, 0.1, 318), ok(0.56, 0.1, 326), ok(0.72, 0.08, 330)],
    lamp: ok(0.86, 0.1, 326),
    far: ramp(0.36, 0.06, 308, 4, 0.16),
    ground: ramp(0.42, 0.045, 300, 5, 0.26),
    leaf: ramp(0.4, 0.08, 318, 4, 0.22),
    bark: ramp(0.36, 0.05, 300, 3, 0.18),
    bloom: ok(0.96, 0.05, 92),
    ink: ok(0.12, 0.04, 292),
  },
  night: {
    sky: [ok(0.14, 0.07, 272), ok(0.19, 0.075, 270), ok(0.25, 0.08, 268), ok(0.32, 0.08, 266), ok(0.4, 0.075, 268), ok(0.48, 0.07, 272)],
    cloud: [ok(0.26, 0.05, 272), ok(0.34, 0.05, 270), ok(0.44, 0.045, 268), ok(0.56, 0.04, 266)],
    lamp: ok(0.96, 0.035, 96),
    far: ramp(0.3, 0.05, 268, 4, 0.14),
    ground: ramp(0.3, 0.05, 250, 5, 0.22),
    leaf: ramp(0.28, 0.055, 200, 4, 0.2),
    bark: ramp(0.26, 0.035, 60, 3, 0.16),
    bloom: ok(0.92, 0.12, 96),
    ink: ok(0.1, 0.03, 268),
  },
  dawn: {
    sky: [ok(0.46, 0.13, 294), ok(0.58, 0.13, 318), ok(0.7, 0.12, 2), ok(0.8, 0.11, 34), ok(0.88, 0.1, 58), ok(0.94, 0.08, 78)],
    cloud: [ok(0.56, 0.1, 350), ok(0.7, 0.1, 20), ok(0.84, 0.09, 48), ok(0.95, 0.06, 72)],
    lamp: ok(0.96, 0.12, 74),
    far: ramp(0.6, 0.07, 36, 4, 0.16),
    ground: ramp(0.55, 0.09, 118, 5, 0.26),
    leaf: ramp(0.48, 0.09, 132, 4, 0.24),
    bark: ramp(0.42, 0.06, 54, 3, 0.2),
    bloom: ok(0.96, 0.07, 72),
    ink: ok(0.28, 0.05, 44),
  },
};

function ridge(rnd: () => number, w: number, base: number, amp: number, waves = 3) {
  const turn = Array.from({ length: waves }, () => rnd() * Math.PI * 2);
  const beat = Array.from({ length: waves }, (_, i) => 0.6 + i * 0.9 + rnd() * 0.4);
  return (x: number) => {
    let v = 0;
    for (let i = 0; i < waves; i++) v += Math.sin((x / w) * Math.PI * 2 * beat[i] + turn[i]) / (i + 1);
    return Math.round(base + v * amp);
  };
}

function land(p: Paint, line: (x: number) => number, tones: Ramp, crest: RGB) {
  for (let x = 0; x < p.w; x++) {
    const top = line(x);
    for (let y = top; y < p.h; y++) {
      const deep = Math.min(tones.length - 1, 1 + Math.floor((y - top) / 9));
      p.put(x, y, tones[deep]);
    }
    p.put(x, top, crest);
    if (line(x - 1) > top) p.put(x, top + 1, crest);
  }
}

function fig(p: Paint, cx: number, floor: number, tall: number, ink: RGB) {
  const skin = ok(0.69, 0.072, 128);
  const dark = ok(0.58, 0.066, 128);
  const belly = ok(0.91, 0.05, 86);
  const line = ok(0.3, 0.035, 92);
  const u = tall;
  const edge = (cx: number, cy: number, r: number, squash = 1) => p.disc(cx, cy, r + 1, line, squash);

  p.disc(cx, floor, u * 0.3, ink, 0.26);

  edge(cx + u * 0.34, floor - u * 0.3, u * 0.12, 0.9);
  p.disc(cx + u * 0.34, floor - u * 0.3, u * 0.11, dark, 0.9);
  edge(cx - u * 0.16, floor - u * 0.03, u * 0.12, 0.5);
  edge(cx + u * 0.16, floor - u * 0.03, u * 0.12, 0.5);
  p.disc(cx - u * 0.16, floor - u * 0.03, u * 0.11, dark, 0.5);
  p.disc(cx + u * 0.16, floor - u * 0.03, u * 0.11, dark, 0.5);

  edge(cx, floor - u * 0.27, u * 0.25, 1.06);
  p.disc(cx, floor - u * 0.27, u * 0.24, skin, 1.06);
  p.disc(cx, floor - u * 0.25, u * 0.15, belly, 1.08);

  edge(cx - u * 0.26, floor - u * 0.3, u * 0.09, 1.2);
  edge(cx + u * 0.26, floor - u * 0.3, u * 0.09, 1.2);
  p.disc(cx - u * 0.26, floor - u * 0.3, u * 0.08, dark, 1.2);
  p.disc(cx + u * 0.26, floor - u * 0.3, u * 0.08, dark, 1.2);

  const hy = floor - u * 0.68;
  for (const side of [-1, 1]) {
    p.disc(cx + side * u * 0.14, hy - u * 0.26, u * 0.055, line, 1.4);
    p.disc(cx + side * u * 0.14, hy - u * 0.25, u * 0.035, dark, 1.4);
  }
  edge(cx, hy, u * 0.25, 0.92);
  p.disc(cx, hy, u * 0.24, skin, 0.92);
  p.disc(cx, hy + u * 0.08, u * 0.14, belly, 0.62);
  p.disc(cx - u * 0.17, hy + u * 0.04, u * 0.05, ok(0.78, 0.1, 32), 0.7);
  p.disc(cx + u * 0.17, hy + u * 0.04, u * 0.05, ok(0.78, 0.1, 32), 0.7);
  for (const side of [-1, 1]) {
    p.disc(cx + side * u * 0.1, hy - u * 0.04, u * 0.055, line);
    p.put(cx + side * u * 0.1 - 1, hy - u * 0.06, [255, 255, 255]);
  }
  p.put(cx - 1, hy + u * 0.1, line);
  p.put(cx, hy + u * 0.1, line);
}

export function paint(seed: number, place: Place, w: number, h: number) {
  const rnd = dice(seed);
  const look = WEATHER[place] ?? WEATHER.meadow;
  const p = new Paint(w, h);
  const hz = Math.round(h * 0.54);
  const dark = place === "night" || place === "space";

  p.sky(0, h, look.sky);

  const lampX = Math.round(w * (0.14 + rnd() * 0.68));
  const lampY = Math.round(h * (0.1 + rnd() * 0.18));

  if (dark) {
    for (let i = 0; i < Math.round(w * h * 0.013); i++) {
      const x = Math.floor(rnd() * w);
      const y = Math.floor(rnd() * hz);
      p.put(x, y, look.bloom, 0.35 + rnd() * 0.65);
    }
  }

  if (place === "space") {
    const r = Math.round(h * 0.13);
    p.disc(lampX, lampY, r + 1, look.ink);
    p.disc(lampX, lampY, r, look.lamp);
    p.disc(lampX - r * 0.3, lampY - r * 0.3, r * 0.62, ok(0.93, 0.07, 330));
    p.disc(lampX + r * 0.35, lampY + r * 0.25, r * 0.2, ok(0.72, 0.09, 320));
    for (let a = -1; a <= 1; a++) p.ring(lampX, lampY + a, r * 1.9, look.bloom, 0.22);
  } else if (place === "night") {
    p.disc(lampX, lampY, h * 0.078, ok(0.72, 0.05, 240), 1);
    p.disc(lampX, lampY, h * 0.062, look.lamp);
    p.disc(lampX - h * 0.02, lampY - h * 0.012, h * 0.013, ok(0.88, 0.03, 96));
    p.disc(lampX + h * 0.022, lampY + h * 0.018, h * 0.009, ok(0.88, 0.03, 96));
  } else {
    p.disc(lampX, lampY, h * 0.075, look.lamp, 1);
    p.disc(lampX, lampY, h * 0.055, ok(1, 0.045, 96));
  }

  if (!dark) {
    const many = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < many; i++) {
      const cx = rnd() * w;
      const cy = h * (0.1 + rnd() * 0.3);
      p.puff(cx, cy, h * (0.045 + rnd() * 0.05), look.cloud, 3 + Math.floor(rnd() * 3), rnd);
    }
  } else if (place === "night") {
    for (let i = 0; i < 2; i++) p.puff(rnd() * w, h * (0.14 + rnd() * 0.2), h * 0.05, look.cloud, 3, rnd);
  }

  const haze = look.sky[look.sky.length - 1];
  p.wash(0, hz - Math.round(h * 0.07), w, Math.round(h * 0.07), haze, haze, (j) => j / (h * 0.07));

  const back = ridge(rnd, w, hz, h * 0.05);
  land(p, back, look.far, look.far[3]);

  if (place === "sea") {
    const shore = Math.round(h * 0.76);
    const water = ramp(0.58, 0.12, 232, 5, 0.3);
    for (let y = hz; y < shore; y++) {
      const t = (y - hz) / (shore - hz);
      const tone = water[Math.min(water.length - 1, 1 + Math.floor(t * 3))];
      for (let x = 0; x < w; x++) p.put(x, y, tone);
    }
    for (let i = 0; i < Math.round(h * 0.5); i++) {
      const y = hz + Math.floor(rnd() * (shore - hz));
      const x = Math.floor(rnd() * w);
      const run = 1 + Math.floor(rnd() * 4);
      const near = Math.abs(x - lampX) < w * 0.16 ? 1 : 0.4;
      for (let k = 0; k < run; k++) p.put(x + k, y, look.bloom, near);
    }
    const sand = ridge(rnd, w, shore, h * 0.012, 2);
    land(p, sand, look.ground, look.ground[2]);
    for (let x = 0; x < w; x++) p.put(x, sand(x) - 1, [255, 255, 255], 0.75);
  } else {
    const mid = ridge(rnd, w, Math.round(h * 0.66), h * 0.035);
    land(p, mid, look.ground, look.ground[1]);
  }

  if (place === "forest") {
    for (let depth = 0; depth < 3; depth++) {
      const row = Math.round(h * (0.58 + depth * 0.055));
      const tone: Ramp = look.leaf.map((c, i) => (depth === 2 ? c : (ok(0.3 + depth * 0.09 + i * 0.05, 0.06, 168) as RGB)));
      for (let i = 0; i < 5 - depth; i++) {
        const x = rnd() * w;
        const tall = h * (0.1 + depth * 0.05 + rnd() * 0.05);
        for (let k = 0; k < 4; k++) {
          const wide = (tall * 0.4 * (k + 1)) / 4;
          p.disc(x, row - tall + (tall * k) / 3.2, wide, tone[1 + (k % 2)], 0.55);
        }
        p.rect(x - 1, row - tall * 0.1, 2, tall * 0.14, look.bark[0]);
      }
    }
    const trunk = Math.round(w * (rnd() > 0.5 ? 0.88 : 0.1));
    const wide = Math.max(8, Math.round(w * 0.11));
    const grain = Array.from({ length: wide * 2 }, () => rnd());
    for (let y = 0; y < h * 0.9; y++)
      for (let x = trunk - wide; x < trunk + wide; x++) {
        const t = (x - (trunk - wide)) / (wide * 2);
        const lit = t < 0.18 ? 2 : t < 0.52 ? 1 : 0;
        const vein = grain[x - (trunk - wide)] > 0.72 && ((y + Math.floor(t * 9)) % 17) < 11;
        p.put(x, y, look.bark[vein ? Math.max(0, lit - 1) : lit]);
      }
    for (let i = 0; i < h * 0.12; i++) {
      const y = Math.floor(h * 0.5 + rnd() * h * 0.4);
      const x = trunk - wide + Math.floor(rnd() * wide * 2);
      p.put(x, y, look.leaf[0]);
      p.put(x + 1, y, look.leaf[1]);
    }
    const over = look.leaf.map((_, i) => ok(0.18 + i * 0.065, 0.055, 164) as RGB);
    for (let i = 0; i < 7; i++) {
      const x = (i / 6) * w + (rnd() - 0.5) * w * 0.18;
      p.leafy(x, h * (-0.04 + rnd() * 0.1), h * (0.08 + rnd() * 0.05), over, rnd);
    }
    p.rect(0, 0, w, Math.round(h * 0.03), over[0]);
  }

  if (place === "meadow" || place === "dawn") {
    const row = Math.round(h * 0.68);
    for (let i = 0; i < 3; i++) {
      const x = rnd() * w;
      const tall = h * (0.09 + rnd() * 0.06);
      p.rect(x - 1, row - tall * 0.5, 3, tall * 0.5, look.bark[0]);
      p.leafy(x, row - tall * 0.66, tall * 0.42, look.leaf, rnd);
    }
  }

  if (place === "night") {
    const row = Math.round(h * 0.72);
    for (let i = 0; i < 7; i++) {
      const x = rnd() * w;
      const tall = h * (0.14 + rnd() * 0.12);
      const tone = i % 3 === 0 ? look.leaf[1] : look.ink;
      for (let k = 0; k < 5; k++) p.disc(x, row - tall + (tall * k) / 4.2, (tall * 0.34 * (k + 1)) / 5, tone, 0.5);
      p.rect(x - 1, row - tall * 0.08, 2, tall * 0.1, look.ink);
    }
  }

  const front = ridge(rnd, w, Math.round(h * 0.82), h * 0.02, 2);
  if (place !== "sea") land(p, front, look.ground.slice(1).concat([look.ground[4]]), look.ground[2]);

  const standing = Math.round(h * (place === "sea" ? 0.8 : 0.8));
  fig(p, Math.round(w * (0.3 + rnd() * 0.42)), standing, Math.round(h * 0.3), look.ink);

  if (place === "space") {
    for (let i = 0; i < 9; i++) {
      const x = rnd() * w;
      const y = h * (0.7 + rnd() * 0.28);
      const r = h * (0.015 + rnd() * 0.04);
      p.disc(x, y, r, look.ground[0], 0.38);
      p.disc(x, y - r * 0.14, r * 0.78, look.ground[2], 0.36);
      p.disc(x, y - r * 0.2, r * 0.5, look.ground[3], 0.34);
    }
    for (let i = 0; i < 5; i++) {
      const x = rnd() * w;
      const y = h * (0.78 + rnd() * 0.18);
      const r = h * (0.012 + rnd() * 0.02);
      p.disc(x, y, r + 1, look.ink, 0.72);
      p.disc(x, y, r, look.ground[3], 0.72);
      p.disc(x - r * 0.3, y - r * 0.3, r * 0.5, look.ground[4], 0.7);
    }
  } else {
    for (let i = 0; i < w * (dark ? 0.4 : 0.9); i++) {
      const x = Math.floor(rnd() * w);
      const y = Math.round(h * 0.84 + rnd() * h * 0.16);
      const tone = dark ? look.ink : look.ground[rnd() > 0.5 ? 0 : 4];
      p.put(x, y, tone);
      p.put(x, y - 1, tone);
      if (rnd() > 0.82) p.put(x, y - 2, tone);
    }
  }

  if (place === "meadow" || place === "dawn") {
    for (let i = 0; i < w * 0.14; i++) {
      const x = Math.floor(rnd() * w);
      const y = Math.round(h * 0.85 + rnd() * h * 0.13);
      const tone = rnd() > 0.5 ? look.bloom : ok(0.95, 0.09, 92);
      p.put(x, y, tone);
      p.put(x + 1, y, tone);
      p.put(x, y - 1, tone);
    }
  }

  if (place === "forest" || place === "night") {
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rnd() * w);
      const y = Math.floor(h * (0.4 + rnd() * 0.45));
      p.put(x, y, look.bloom);
      p.put(x + 1, y, look.bloom, 0.4);
      p.put(x, y + 1, look.bloom, 0.4);
    }
  }

  if (place !== "sea" && place !== "space") {
    const blade = look.ground[0];
    const root = dark ? look.ink : look.ground[1];
    let tall = h * 0.04;
    for (let x = 0; x < w; x++) {
      tall = Math.max(h * 0.012, Math.min(h * 0.075, tall + (rnd() - 0.5) * h * 0.05));
      for (let k = 0; k < tall; k++) p.put(x, h - 1 - k, k < h * 0.02 ? root : blade);
    }
  }
  if (place !== "sea" && place !== "space") {
    const frond = look.leaf.map((_, i) => (dark ? look.ink : (ok(0.2 + i * 0.05, 0.06, 158) as RGB)));
    for (const side of [0, 1]) {
      const x = side ? w + h * 0.06 : -h * 0.06;
      p.leafy(x, h * 1.0, h * 0.16, frond, rnd);
      p.leafy(x + (side ? -h * 0.1 : h * 0.1), h * 1.06, h * 0.12, frond, rnd);
    }
  }

  for (let x = 0; x < w; x++) {
    p.put(x, h - 1, look.ink, 0.22);
    p.put(x, 0, dark ? look.ink : WARM_INK, 0.12);
  }
  for (let y = 0; y < h; y++) {
    p.put(0, y, dark ? INK : WARM_INK, 0.14);
    p.put(w - 1, y, dark ? INK : WARM_INK, 0.14);
  }

  return p.image();
}

export function seedOf(text: string) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}
