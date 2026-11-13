export type RGB = [number, number, number];

const gamma = (v: number) =>
  Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055));

export function ok(L: number, C: number, H: number): RGB {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

export type Ramp = RGB[];

export function ramp(L: number, C: number, H: number, steps = 5, spread = 0.19, turn = 0): Ramp {
  const out: Ramp = [];
  for (let i = 0; i < steps; i++) {
    const t = steps === 1 ? 0 : i / (steps - 1) - 0.5;
    out.push(ok(L + t * spread * 2, Math.max(0, C * (1 - Math.abs(t) * 0.35)), H + t * turn));
  }
  return out;
}

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export class Paint {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray<ArrayBuffer>;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(new ArrayBuffer(w * h * 4));
  }

  put(x: number, y: number, c: RGB, alpha = 1) {
    x = x | 0;
    y = y | 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const at = (y * this.w + x) * 4;
    const d = this.data;
    if (alpha >= 1) {
      d[at] = c[0];
      d[at + 1] = c[1];
      d[at + 2] = c[2];
      d[at + 3] = 255;
      return;
    }
    const was = d[at + 3] / 255;
    const now = alpha + was * (1 - alpha);
    d[at] = (c[0] * alpha + d[at] * was * (1 - alpha)) / now;
    d[at + 1] = (c[1] * alpha + d[at + 1] * was * (1 - alpha)) / now;
    d[at + 2] = (c[2] * alpha + d[at + 2] * was * (1 - alpha)) / now;
    d[at + 3] = now * 255;
  }

  rect(x: number, y: number, w: number, h: number, c: RGB, alpha = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(x + i, y + j, c, alpha);
  }

  disc(cx: number, cy: number, r: number, c: RGB, squash = 1) {
    const ry = r * squash;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      const span = r * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - cy) / ry) ** 2));
      for (let x = Math.round(cx - span); x <= cx + span - 0.5; x++) this.put(x, y, c);
    }
  }

  ring(cx: number, cy: number, r: number, c: RGB, squash = 1) {
    const ry = r * squash;
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      this.put(Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * ry), c);
    }
  }

  // A soft step between two ramp entries, dithered rather than banded.
  wash(x: number, y: number, w: number, h: number, low: RGB, high: RGB, mix: (j: number) => number) {
    for (let j = 0; j < h; j++) {
      const t = Math.min(1, Math.max(0, mix(j)));
      for (let i = 0; i < w; i++) {
        const near = BAYER[(y + j) & 3][(x + i) & 3] / 16;
        this.put(x + i, y + j, t > near ? high : low);
      }
    }
  }

  // A vertical ramp down a column range, dithered across every step.
  sky(from: number, to: number, tones: Ramp) {
    const span = Math.max(1, to - from);
    for (let y = from; y < to; y++) {
      const place = ((y - from) / span) * (tones.length - 1);
      const step = Math.min(tones.length - 2, Math.floor(place));
      const t = place - step;
      for (let x = 0; x < this.w; x++) {
        const near = BAYER[y & 3][x & 3] / 16;
        this.put(x, y, t > near ? tones[step + 1] : tones[step]);
      }
    }
  }

  // A cumulus built from discs: shadow below, body, lit crown, dark rim.
  puff(cx: number, cy: number, r: number, tones: Ramp, lobes: number, rnd: () => number) {
    const blobs: [number, number, number][] = [[cx, cy, r]];
    for (let i = 0; i < lobes; i++) {
      const a = Math.PI + (i / Math.max(1, lobes - 1)) * Math.PI;
      blobs.push([cx + Math.cos(a) * r * (0.5 + rnd() * 0.6), cy - Math.abs(Math.sin(a)) * r * 0.5, r * (0.42 + rnd() * 0.42)]);
    }
    for (const [x, y, s] of blobs) this.disc(x, y + 1, s + 1, tones[0], 0.78);
    for (const [x, y, s] of blobs) this.disc(x, y, s, tones[1], 0.78);
    for (const [x, y, s] of blobs) this.disc(x, y - s * 0.3, s * 0.78, tones[2], 0.74);
    for (const [x, y, s] of blobs) this.disc(x - s * 0.18, y - s * 0.52, s * 0.44, tones[3], 0.7);
  }

  // A canopy or bush: clustered lobes, lit from the upper left.
  leafy(cx: number, cy: number, r: number, tones: Ramp, rnd: () => number) {
    const lobes: [number, number, number][] = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rnd();
      lobes.push([cx + Math.cos(a) * r * 0.46, cy + Math.sin(a) * r * 0.36, r * (0.44 + rnd() * 0.3)]);
    }
    lobes.push([cx, cy, r * 0.82]);
    for (const [x, y, s] of lobes) this.disc(x, y + 1, s + 1, tones[0], 0.86);
    for (const [x, y, s] of lobes) this.disc(x, y, s, tones[1], 0.86);
    for (const [x, y, s] of lobes) this.disc(x - s * 0.2, y - s * 0.26, s * 0.62, tones[2], 0.84);
    for (const [x, y, s] of lobes) this.disc(x - s * 0.34, y - s * 0.44, s * 0.28, tones[3], 0.8);
  }

  image() {
    return new ImageData(this.data, this.w, this.h);
  }
}

export function dice(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
