export type Mood = "hi" | "listen" | "cheer" | "think" | "sad";

const SKIN = "oklch(0.705 0.074 128)";
const SKIN_DARK = "oklch(0.595 0.068 128)";
const SKIN_DEEP = "oklch(0.515 0.06 128)";
const BELLY = "oklch(0.915 0.052 82)";
const BELLY_LINE = "oklch(0.835 0.072 76)";
const LINE = "oklch(0.33 0.03 70)";
const CHEEK = "oklch(0.78 0.1 32)";

export function Buddy({ mood = "hi", size = 160, className = "" }: { mood?: Mood; size?: number; className?: string }) {
  const lift = mood === "cheer" ? -6 : 0;
  const tilt = mood === "think" ? -7 : mood === "listen" ? 5 : 0;
  return (
    <svg
      viewBox="0 0 120 150"
      width={size}
      height={(size * 150) / 120}
      className={className}
      role="img"
      aria-label="Fig, your reading buddy"
    >
      <ellipse cx="60" cy="143" rx="31" ry="5" fill="var(--rb-shade)" />

      <g stroke={LINE} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round">
        <path
          d="M84 118c16 4 25 0 28-9 3-9-3-17-11-18 6 4 8 11 4 15-4 4-12 4-21 1z"
          fill={SKIN_DARK}
        />

        <g transform={`translate(0 ${lift})`}>
          <path d="M34 72c-12-9-24-7-27 1 7-2 12 0 15 4 4 5 6 10 10 12z" fill={SKIN_DEEP} />
          <path d="M86 72c12-9 24-7 27 1-7-2-12 0-15 4-4 5-6 10-10 12z" fill={SKIN_DEEP} />

          <path d="M41 132c-7 0-11-3-11-7 0-4 4-6 10-6h8v13z" fill={SKIN_DARK} />
          <path d="M79 132c7 0 11-3 11-7 0-4-4-6-10-6h-8v13z" fill={SKIN_DARK} />

          <ellipse cx="60" cy="94" rx="31" ry="34" fill={SKIN} />
          <path
            d="M60 66c14 0 22 12 22 26s-9 25-22 25-22-11-22-25 8-26 22-26z"
            fill={BELLY}
          />
          <g stroke={BELLY_LINE} strokeWidth="2" fill="none" strokeLinecap="round">
            <path d="M41 78q19 7 38 0" />
            <path d="M39 90q21 8 42 0" />
            <path d="M40 102q20 8 40 0" />
          </g>

          <path d="M29 84c-7 3-10 10-8 17 1 5 5 8 9 8" fill={SKIN} />
          <path d="M91 84c7 3 10 10 8 17-1 5-5 8-9 8" fill={SKIN} />

          <g transform={`rotate(${tilt} 60 48)`}>
            <path d="M44 20c-2-7 0-12 3-13 2 3 3 8 3 13z" fill={SKIN_DEEP} />
            <path d="M76 20c2-7 0-12-3-13-2 3-3 8-3 13z" fill={SKIN_DEEP} />
            <ellipse cx="60" cy="48" rx="33" ry="29" fill={SKIN} />
            <ellipse cx="60" cy="63" rx="19" ry="11" fill={BELLY} />
            <ellipse cx="36" cy="58" rx="6.5" ry="4.2" fill={CHEEK} opacity=".6" />
            <ellipse cx="84" cy="58" rx="6.5" ry="4.2" fill={CHEEK} opacity=".6" />

            {mood === "cheer" ? (
              <g fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
                <path d="M39 42q7-9 14 0" />
                <path d="M67 42q7-9 14 0" />
              </g>
            ) : mood === "think" ? (
              <g>
                <circle cx="48" cy="41" r="5.4" fill={LINE} />
                <circle cx="74" cy="41" r="5.4" fill={LINE} />
                <circle cx="50" cy="39" r="1.9" fill="#fff" />
                <circle cx="76" cy="39" r="1.9" fill="#fff" />
                <path d="M40 31l12 3M80 31l-12 3" fill="none" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />
              </g>
            ) : (
              <g className={mood === "listen" ? "" : "blink"}>
                <circle cx="47" cy="42" r="6.4" fill={LINE} />
                <circle cx="73" cy="42" r="6.4" fill={LINE} />
                <circle cx="49.4" cy="39.6" r="2.3" fill="#fff" />
                <circle cx="75.4" cy="39.6" r="2.3" fill="#fff" />
              </g>
            )}

            {mood === "sad" && (
              <g fill="none" stroke={SKIN_DEEP} strokeWidth="2.6" strokeLinecap="round">
                <path d="M39 33l11-4" />
                <path d="M81 33l-11-4" />
              </g>
            )}

            <g fill={LINE}>
              <ellipse cx="55" cy="59" rx="2.1" ry="1.5" />
              <ellipse cx="65" cy="59" rx="2.1" ry="1.5" />
            </g>
            <path
              d={
                mood === "sad"
                  ? "M52 69q8-6 16 0"
                  : mood === "listen"
                    ? "M55 65q5 7 10 0"
                    : "M51 65q4.5 7 9 0q4.5 7 9 0"
              }
              fill={mood === "listen" ? LINE : "none"}
              stroke={LINE}
              strokeWidth="2.6"
              strokeLinecap="round"
            />
          </g>
        </g>
      </g>

      {mood === "cheer" && (
        <g fill="var(--rb-sun)">
          <path d="M16 26l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" />
          <path d="M103 14l1.8 4.5 4.5 1.8-4.5 1.8-1.8 4.5-1.8-4.5-4.5-1.8 4.5-1.8z" />
          <path d="M98 44l1.4 3.5 3.5 1.4-3.5 1.4-1.4 3.5-1.4-3.5-3.5-1.4 3.5-1.4z" />
        </g>
      )}
      {mood === "listen" && (
        <g fill="none" stroke="var(--rb-berry)" strokeWidth="2.6" strokeLinecap="round" opacity=".8">
          <path d="M99 40q7 8 0 16" />
          <path d="M106 34q12 14 0 28" />
        </g>
      )}
    </svg>
  );
}

export function Head({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={size} aria-hidden>
      <g stroke={LINE} strokeWidth="5" strokeLinejoin="round">
        <path d="M40 24c-3-9 0-15 4-16 3 4 4 10 4 16z" fill={SKIN_DEEP} />
        <path d="M80 24c3-9 0-15-4-16-3 4-4 10-4 16z" fill={SKIN_DEEP} />
        <ellipse cx="60" cy="56" rx="40" ry="36" fill={SKIN} />
        <ellipse cx="60" cy="70" rx="23" ry="14" fill={BELLY} />
        <circle cx="45" cy="48" r="8" fill={LINE} stroke="none" />
        <circle cx="75" cy="48" r="8" fill={LINE} stroke="none" />
        <path d="M49 72q5.5 8 11 0q5.5 8 11 0" fill="none" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Says({
  children,
  mood,
  size = 110,
  className = "",
}: {
  children: React.ReactNode;
  mood?: Mood;
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <Buddy mood={mood} size={size} className="shrink-0 breathe" />
      <div className="bubble text-lg">{children}</div>
    </div>
  );
}
