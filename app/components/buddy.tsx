export type Mood = "hi" | "listen" | "cheer" | "think" | "sad";

const SKIN = "oklch(0.705 0.074 128)";
const SKIN_DARK = "oklch(0.615 0.07 128)";
const SKIN_DEEP = "oklch(0.545 0.062 128)";
const BELLY = "oklch(0.915 0.052 82)";
const BELLY_LINE = "oklch(0.845 0.07 76)";
const LINE = "oklch(0.33 0.03 70)";
const CHEEK = "oklch(0.78 0.1 32)";

export function Buddy({ mood = "hi", size = 160, className = "" }: { mood?: Mood; size?: number; className?: string }) {
  const lift = mood === "cheer" ? -5 : 0;
  const tilt = mood === "think" ? -6 : mood === "listen" ? 5 : 0;
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={(size * 140) / 120}
      className={className}
      role="img"
      aria-label="Fig, your reading buddy"
    >
      <defs>
        <clipPath id="fig-belly">
          <ellipse cx="60" cy="94" rx="19" ry="22" />
        </clipPath>
      </defs>

      <ellipse cx="60" cy="131" rx="29" ry="5" fill="var(--rb-shade)" />

      <g stroke={LINE} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path
          d="M82 102c16 2 26-5 27-16 1-9-6-16-13-14 7 4 9 12 4 17-5 5-13 6-20 4z"
          fill={SKIN_DEEP}
        />

        <g transform={`translate(0 ${lift})`}>
          <path d="M38 71c-11-12-25-13-30-5 8-1 14 3 17 9 3 6 6 10 10 11z" fill={SKIN_DARK} />
          <path d="M82 71c11-12 25-13 30-5-8-1-14 3-17 9-3 6-6 10-10 11z" fill={SKIN_DARK} />

          <ellipse cx="43" cy="120" rx="13" ry="8" fill={SKIN_DARK} />
          <ellipse cx="77" cy="120" rx="13" ry="8" fill={SKIN_DARK} />

          <path d="M35 82c-10 2-16 11-13 20 2 5 8 7 13 4z" fill={SKIN_DARK} />
          <path d="M85 82c10 2 16 11 13 20-2 5-8 7-13 4z" fill={SKIN_DARK} />

          <ellipse cx="60" cy="90" rx="30" ry="31" fill={SKIN} />
          <ellipse cx="60" cy="94" rx="19" ry="22" fill={BELLY} />
          <g clipPath="url(#fig-belly)" stroke={BELLY_LINE} strokeWidth="2.2" fill="none">
            <path d="M39 82q21 7 42 0" />
            <path d="M39 94q21 7 42 0" />
            <path d="M39 106q21 7 42 0" />
          </g>

          <g transform={`rotate(${tilt} 60 46)`}>
            <path d="M46 21c-2-8 0-13 3-14 2 4 3 9 3 14z" fill={SKIN_DEEP} />
            <path d="M74 21c2-8 0-13-3-14-2 4-3 9-3 14z" fill={SKIN_DEEP} />
            <ellipse cx="60" cy="46" rx="32" ry="28" fill={SKIN} />
            <ellipse cx="60" cy="60" rx="18" ry="11" fill={BELLY} />
            <ellipse cx="35" cy="55" rx="6.5" ry="4.2" fill={CHEEK} opacity=".6" stroke="none" />
            <ellipse cx="85" cy="55" rx="6.5" ry="4.2" fill={CHEEK} opacity=".6" stroke="none" />

            {mood === "cheer" ? (
              <g fill="none" strokeWidth="3.2">
                <path d="M40 42q7-9 14 0" />
                <path d="M66 42q7-9 14 0" />
              </g>
            ) : mood === "think" ? (
              <g>
                <circle cx="48" cy="41" r="5.4" fill={LINE} stroke="none" />
                <circle cx="74" cy="41" r="5.4" fill={LINE} stroke="none" />
                <circle cx="50" cy="39" r="1.9" fill="#fff" stroke="none" />
                <circle cx="76" cy="39" r="1.9" fill="#fff" stroke="none" />
                <path d="M41 31l11 3M79 31l-11 3" fill="none" strokeWidth="2.4" />
              </g>
            ) : (
              <g className={mood === "listen" ? "" : "blink"}>
                <circle cx="47" cy="42" r="6.4" fill={LINE} stroke="none" />
                <circle cx="73" cy="42" r="6.4" fill={LINE} stroke="none" />
                <circle cx="49.4" cy="39.6" r="2.3" fill="#fff" stroke="none" />
                <circle cx="75.4" cy="39.6" r="2.3" fill="#fff" stroke="none" />
              </g>
            )}

            {mood === "sad" && (
              <g fill="none" stroke={SKIN_DEEP} strokeWidth="2.4">
                <path d="M40 32l11-4" />
                <path d="M80 32l-11-4" />
              </g>
            )}

            <g fill={LINE} stroke="none">
              <ellipse cx="55" cy="56" rx="2.1" ry="1.5" />
              <ellipse cx="65" cy="56" rx="2.1" ry="1.5" />
            </g>
            <path
              d={
                mood === "sad"
                  ? "M52 66q8-6 16 0"
                  : mood === "listen"
                    ? "M55 62q5 7 10 0"
                    : "M51 62q4.5 7 9 0q4.5 7 9 0"
              }
              fill={mood === "listen" ? LINE : "none"}
              strokeWidth="2.6"
            />
          </g>
        </g>
      </g>

      {mood === "cheer" && (
        <g fill="var(--rb-sun)">
          <path d="M15 25l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4z" />
          <path d="M104 14l1.8 4.5 4.5 1.8-4.5 1.8-1.8 4.5-1.8-4.5-4.5-1.8 4.5-1.8z" />
          <path d="M99 44l1.4 3.5 3.5 1.4-3.5 1.4-1.4 3.5-1.4-3.5-3.5-1.4 3.5-1.4z" />
        </g>
      )}
      {mood === "listen" && (
        <g fill="none" stroke="var(--rb-berry)" strokeWidth="2.6" strokeLinecap="round" opacity=".8">
          <path d="M100 38q7 8 0 16" />
          <path d="M107 32q12 14 0 28" />
        </g>
      )}
    </svg>
  );
}

export function Head({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 100" width={size} height={size} aria-hidden>
      <g stroke={LINE} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round">
        <path d="M44 26c-3-10 0-16 4-17 3 5 4 11 4 17z" fill={SKIN_DEEP} />
        <path d="M76 26c3-10 0-16-4-17-3 5-4 11-4 17z" fill={SKIN_DEEP} />
        <ellipse cx="60" cy="56" rx="39" ry="35" fill={SKIN} />
        <ellipse cx="60" cy="72" rx="22" ry="13" fill={BELLY} />
        <circle cx="45" cy="48" r="8" fill={LINE} stroke="none" />
        <circle cx="75" cy="48" r="8" fill={LINE} stroke="none" />
        <circle cx="48" cy="45" r="2.8" fill="#fff" stroke="none" />
        <circle cx="78" cy="45" r="2.8" fill="#fff" stroke="none" />
        <path d="M49 72q5.5 8 11 0q5.5 8 11 0" fill="none" strokeWidth="4" />
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
