import { useId } from "react";
import { Buddy } from "./buddy";

export const PLACES = ["meadow", "sea", "space", "forest", "night", "dawn"] as const;
export type Place = (typeof PLACES)[number];

export function seedOf(text: string) {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function dice(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Look = {
  sky: [string, string, string];
  light: string;
  far: string;
  mid: string;
  near: string;
  deep: string;
  bloom: string;
  above: "cloud" | "star" | "mist";
  ground: "grass" | "sand" | "dust";
  trees: "round" | "pine" | "none";
  flecks: "petal" | "spark" | "bird" | "foam";
  lamp: "sun" | "moon" | "none";
  water?: true;
  planet?: true;
};

const LOOK: Record<Place, Look> = {
  meadow: {
    sky: ["oklch(0.9 0.066 232)", "oklch(0.952 0.045 206)", "oklch(0.975 0.05 122)"],
    light: "oklch(0.97 0.1 96)",
    far: "oklch(0.838 0.062 152)",
    mid: "oklch(0.728 0.1 148)",
    near: "oklch(0.606 0.126 146)",
    deep: "oklch(0.48 0.108 148)",
    bloom: "oklch(0.83 0.15 28)",
    above: "cloud",
    ground: "grass",
    trees: "round",
    flecks: "petal",
    lamp: "sun",
  },
  sea: {
    sky: ["oklch(0.876 0.07 236)", "oklch(0.944 0.052 216)", "oklch(0.972 0.05 192)"],
    light: "oklch(0.965 0.09 92)",
    far: "oklch(0.79 0.082 218)",
    mid: "oklch(0.664 0.112 226)",
    near: "oklch(0.888 0.056 82)",
    deep: "oklch(0.776 0.07 76)",
    bloom: "oklch(0.985 0.012 220)",
    above: "cloud",
    ground: "sand",
    trees: "none",
    flecks: "bird",
    lamp: "sun",
    water: true,
  },
  space: {
    sky: ["oklch(0.206 0.09 288)", "oklch(0.296 0.112 302)", "oklch(0.418 0.118 324)"],
    light: "oklch(0.84 0.1 326)",
    far: "oklch(0.47 0.072 310)",
    mid: "oklch(0.372 0.058 300)",
    near: "oklch(0.286 0.044 294)",
    deep: "oklch(0.218 0.034 292)",
    bloom: "oklch(0.95 0.052 92)",
    above: "star",
    ground: "dust",
    trees: "none",
    flecks: "spark",
    lamp: "none",
    planet: true,
  },
  forest: {
    sky: ["oklch(0.858 0.05 196)", "oklch(0.925 0.042 158)", "oklch(0.962 0.04 124)"],
    light: "oklch(0.975 0.075 102)",
    far: "oklch(0.81 0.05 168)",
    mid: "oklch(0.654 0.082 162)",
    near: "oklch(0.516 0.09 156)",
    deep: "oklch(0.382 0.07 156)",
    bloom: "oklch(0.87 0.142 86)",
    above: "mist",
    ground: "grass",
    trees: "pine",
    flecks: "spark",
    lamp: "sun",
  },
  night: {
    sky: ["oklch(0.224 0.072 266)", "oklch(0.318 0.078 272)", "oklch(0.45 0.072 282)"],
    light: "oklch(0.955 0.038 96)",
    far: "oklch(0.398 0.056 266)",
    mid: "oklch(0.312 0.05 263)",
    near: "oklch(0.242 0.04 260)",
    deep: "oklch(0.186 0.03 258)",
    bloom: "oklch(0.92 0.108 96)",
    above: "star",
    ground: "grass",
    trees: "pine",
    flecks: "spark",
    lamp: "moon",
  },
  dawn: {
    sky: ["oklch(0.682 0.104 302)", "oklch(0.858 0.102 48)", "oklch(0.952 0.078 76)"],
    light: "oklch(0.952 0.122 70)",
    far: "oklch(0.808 0.062 92)",
    mid: "oklch(0.688 0.086 112)",
    near: "oklch(0.558 0.094 130)",
    deep: "oklch(0.424 0.078 138)",
    bloom: "oklch(0.975 0.06 70)",
    above: "mist",
    ground: "grass",
    trees: "round",
    flecks: "bird",
    lamp: "sun",
  },
};

const W = 240;
const H = 300;
const SKYLINE = 170;
const FIELD = 214;
const FEET = 218;
const FRONT = 252;

function ridge(ys: number[], floor: number) {
  const n = ys.length - 1;
  const at = (i: number) => -26 + (i * (W + 52)) / n;
  let d = `M${at(0)} ${ys[0]}`;
  for (let i = 1; i <= n; i++) {
    const arm = (at(i) - at(i - 1)) / 2;
    d += `C${at(i - 1) + arm} ${ys[i - 1]} ${at(i) - arm} ${ys[i]} ${at(i)} ${ys[i]}`;
  }
  return `${d}L${at(n)} ${floor}L${at(0)} ${floor}Z`;
}

function rolling(rnd: () => number, base: number, amp: number, bumps: number, floor: number) {
  return ridge(
    Array.from({ length: bumps + 1 }, () => base + (rnd() - 0.5) * amp),
    floor
  );
}

function Pine({ x, y, h, fill }: { x: number; y: number; h: number; fill: string }) {
  const w = h * 0.42;
  return (
    <path
      transform={`translate(${x} ${y})`}
      fill={fill}
      d={`M0 ${-h}Q${w * 0.52} ${-h * 0.5} ${w * 0.6} ${-h * 0.38}L${w * 0.32} ${-h * 0.42}Q${w * 0.86} ${-h * 0.11} ${w} 0L${-w} 0Q${-w * 0.86} ${-h * 0.11} ${-w * 0.32} ${-h * 0.42}L${-w * 0.6} ${-h * 0.38}Q${-w * 0.52} ${-h * 0.5} 0 ${-h}Z`}
    />
  );
}

function Round({ x, y, h, fill, dark }: { x: number; y: number; h: number; fill: string; dark: string }) {
  const r = h * 0.4;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M${-h * 0.05} 0L${-h * 0.04} ${-h * 0.62}h${h * 0.1}L${h * 0.05} 0Z`} fill={dark} />
      <g fill={fill}>
        <ellipse cx={-r * 0.56} cy={-h * 0.66} rx={r * 0.66} ry={r * 0.58} />
        <ellipse cx={r * 0.58} cy={-h * 0.7} rx={r * 0.6} ry={r * 0.54} />
        <ellipse cx="0" cy={-h * 0.84} rx={r} ry={r * 0.78} />
      </g>
    </g>
  );
}

export function Scene({
  seed,
  place,
  width = 224,
  height = 300,
  still = false,
  className = "",
  alt = "The story, drawn",
}: {
  seed: number;
  place: Place;
  width?: number;
  height?: number;
  still?: boolean;
  className?: string;
  alt?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const look = LOOK[place] ?? LOOK.meadow;
  const rnd = dice(seed);
  const move = (name: string, secs: number, delay = 0) =>
    still ? undefined : { className: name, style: { animationDuration: `${secs}s`, animationDelay: `${delay}s` } };

  const lampX = 38 + rnd() * 164;
  const lampY = 48 + rnd() * 44;
  const far = rolling(rnd, SKYLINE, 26, 4, H);
  const mid = rolling(rnd, FIELD, 13, 5, H);
  const front = rolling(rnd, FRONT, 14, 4, H);
  const trees = Array.from({ length: look.trees === "pine" ? 9 : 4 }, () => ({
    x: rnd() * W,
    h: 26 + rnd() * 34,
    lift: rnd() * 10,
  })).sort((a, b) => a.h - b.h);
  const sparks = Array.from({ length: look.above === "star" ? 34 : 0 }, () => ({
    x: rnd() * W,
    y: 8 + rnd() * 150,
    r: 0.6 + rnd() * 1.5,
    wait: rnd() * 4,
  }));
  const flecks = Array.from({ length: 7 }, () => ({
    x: 16 + rnd() * (W - 32),
    y: 90 + rnd() * 130,
    turn: rnd() * 360,
    wait: rnd() * 6,
  }));
  const figSize = 58 + rnd() * 26;
  const figX = Math.min(28 + rnd() * 126, 206 - figSize);
  const clouds = Array.from({ length: 3 }, (_, i) => ({
    x: 20 + rnd() * 200,
    y: 44 + i * 26 + rnd() * 10,
    s: 0.7 + rnd() * 0.7,
    wait: rnd() * 8,
  }));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={alt}
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
    >
      <defs>
        <linearGradient id={`sky${uid}`} x1="0.1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.sky[0]} />
          <stop offset="0.54" stopColor={look.sky[1]} />
          <stop offset="1" stopColor={look.sky[2]} />
        </linearGradient>
        <radialGradient id={`glow${uid}`}>
          <stop offset="0" stopColor={look.light} stopOpacity="0.92" />
          <stop offset="0.4" stopColor={look.light} stopOpacity="0.3" />
          <stop offset="1" stopColor={look.light} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`wet${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.far} />
          <stop offset="1" stopColor={look.mid} />
        </linearGradient>
        <linearGradient id={`lit${uid}`} gradientUnits="userSpaceOnUse" x1="70" y1={SKYLINE - 16} x2="170" y2={H}>
          <stop offset="0" stopColor={look.light} stopOpacity="0.3" />
          <stop offset="0.5" stopColor={look.light} stopOpacity="0.07" />
          <stop offset="1" stopColor={look.deep} stopOpacity="0.22" />
        </linearGradient>
        <filter id={`soft${uid}`} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={`wash${uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.032" numOctaves="2" seed={seed % 97} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`grain${uid}`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <radialGradient id={`vig${uid}`} cx="0.5" cy="0.42" r="0.76">
          <stop offset="0.52" stopColor="#1a1208" stopOpacity="0" />
          <stop offset="1" stopColor="#1a1208" stopOpacity="0.22" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill={`url(#sky${uid})`} />

      {look.lamp !== "none" && (
        <g>
          <circle cx={lampX} cy={lampY} r="92" fill={`url(#glow${uid})`} />
          <circle cx={lampX} cy={lampY} r={look.lamp === "moon" ? 15 : 17} fill={look.light} opacity="0.96" />
          {look.lamp === "moon" && (
            <g fill={look.far} opacity="0.3">
              <circle cx={lampX - 4} cy={lampY - 3} r="3.4" />
              <circle cx={lampX + 5} cy={lampY + 4} r="2.2" />
              <circle cx={lampX + 1} cy={lampY + 7} r="1.4" />
            </g>
          )}
        </g>
      )}

      {look.planet && (
        <g {...move("rb-float", 26)}>
          <circle cx="188" cy="74" r="30" fill={look.light} opacity="0.9" />
          <circle cx="178" cy="66" r="9" fill={look.sky[2]} opacity="0.35" />
          <circle cx="196" cy="86" r="5" fill={look.sky[2]} opacity="0.3" />
          <ellipse
            cx="188"
            cy="76"
            rx="46"
            ry="11"
            fill="none"
            stroke={look.bloom}
            strokeWidth="3.2"
            opacity="0.7"
            transform="rotate(-16 188 76)"
          />
        </g>
      )}

      {sparks.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={look.bloom} {...move("rb-twinkle", 4.5, s.wait)} />
      ))}

      {look.above === "cloud" &&
        clouds.map((c, i) => (
          <g key={i} filter={`url(#soft${uid})`} opacity="0.85" {...move("rb-drift", 34, c.wait)}>
            <g transform={`translate(${c.x} ${c.y}) scale(${c.s})`} fill="oklch(0.995 0.01 92)">
              <ellipse cx="0" cy="0" rx="30" ry="10" />
              <ellipse cx="-12" cy="-5" rx="16" ry="9" />
              <ellipse cx="11" cy="-6" rx="19" ry="11" />
            </g>
          </g>
        ))}

      {look.above === "mist" &&
        clouds.map((c, i) => (
          <ellipse
            key={i}
            cx={c.x}
            cy={c.y + 56}
            rx={78 * c.s}
            ry={9 * c.s}
            fill="oklch(0.99 0.01 100)"
            opacity="0.5"
            filter={`url(#soft${uid})`}
            {...move("rb-drift", 42, c.wait)}
          />
        ))}

      <g filter={`url(#wash${uid})`}>
        <path d={far} fill={look.far} />
        {look.water ? (
          <g>
            <path d={rolling(rnd, 182, 5, 6, H)} fill={`url(#wet${uid})`} />
            <path d={rolling(rnd, 198, 4, 6, H)} fill={look.mid} />
            <path d={mid} fill={look.near} />
          </g>
        ) : (
          <path d={mid} fill={look.mid} />
        )}
        <path d={mid} fill={`url(#lit${uid})`} />
      </g>

      {look.trees !== "none" && (
        <g>
          {trees.map((t, i) => (
            <g key={i} {...move("rb-sway", 7 + (i % 3), i * 0.4)}>
              {look.trees === "pine" ? (
                <Pine x={t.x} y={FEET + t.lift} h={t.h} fill={i % 2 ? look.near : look.deep} />
              ) : (
                <Round x={t.x} y={FEET + 2 + t.lift} h={t.h} fill={look.near} dark={look.deep} />
              )}
            </g>
          ))}
        </g>
      )}

      <ellipse
        cx={figX + figSize / 2}
        cy={FEET + 1}
        rx={figSize * 0.34}
        ry="5"
        fill={look.deep}
        opacity="0.26"
        filter={`url(#soft${uid})`}
      />
      <g transform={`translate(${figX} ${FEET - figSize * 1.0917})`}>
        <Buddy size={figSize} />
      </g>

      <g filter={`url(#wash${uid})`}>
        <path d={front} fill={look.near} />
        <path d={front} fill={`url(#lit${uid})`} />
      </g>

      <g fill={look.deep}>
        {look.ground === "grass" &&
          Array.from({ length: 16 }, (_, i) => {
            const x = rnd() * W;
            const y = 256 + rnd() * 36;
            return <path key={i} d={`M${x} ${y}q2.5 -6 5 -9q-1 7 -1.4 9Z`} opacity="0.55" />;
          })}
        {look.ground === "sand" &&
          Array.from({ length: 12 }, (_, i) => (
            <ellipse key={i} cx={rnd() * W} cy={258 + rnd() * 34} rx={1.6 + rnd() * 2.6} ry={1 + rnd()} opacity="0.4" />
          ))}
        {look.ground === "dust" &&
          Array.from({ length: 7 }, (_, i) => {
            const x = rnd() * W;
            const y = 258 + rnd() * 30;
            const r = 5 + rnd() * 11;
            return (
              <g key={i}>
                <ellipse cx={x} cy={y} rx={r} ry={r * 0.4} opacity="0.5" />
                <ellipse cx={x} cy={y - 1.4} rx={r * 0.7} ry={r * 0.26} fill={look.near} />
              </g>
            );
          })}
      </g>

      {look.flecks === "petal" &&
        Array.from({ length: 9 }, (_, i) => {
          const x = rnd() * W;
          const y = 250 + rnd() * 42;
          return (
            <g key={i} fill={i % 3 ? look.bloom : look.light} {...move("rb-sway", 6 + (i % 4), i * 0.3)}>
              <circle cx={x} cy={y} r="2.4" />
              <circle cx={x - 3.4} cy={y + 1.6} r="1.9" />
              <circle cx={x + 3.4} cy={y + 1.6} r="1.9" />
            </g>
          );
        })}

      {look.flecks === "spark" &&
        flecks.map((f, i) => (
          <circle key={i} cx={f.x} cy={f.y} r="2.2" fill={look.bloom} opacity="0.9" {...move("rb-float", 9 + (i % 5), f.wait)} />
        ))}

      {look.flecks === "bird" &&
        flecks.slice(0, 4).map((f, i) => (
          <path
            key={i}
            d={`M${f.x} ${f.y - 60}q4 -4 8 0q4 -4 8 0`}
            fill="none"
            stroke={look.deep}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.7"
            {...move("rb-float", 12 + i, f.wait)}
          />
        ))}

      {look.water &&
        Array.from({ length: 6 }, (_, i) => {
          const x = rnd() * W;
          const y = 196 + rnd() * 34;
          return (
            <path
              key={i}
              d={`M${x} ${y}q7 -3.4 14 0`}
              fill="none"
              stroke={look.bloom}
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.75"
              {...move("rb-roll", 8 + (i % 3), i * 0.5)}
            />
          );
        })}

      <rect width={W} height={H} fill={`url(#vig${uid})`} />
      <rect width={W} height={H} filter={`url(#grain${uid})`} opacity="0.1" style={{ mixBlendMode: "overlay" }} />
    </svg>
  );
}
