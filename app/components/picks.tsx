const LEAF = "var(--rb-leaf)";
const SUN = "var(--rb-sun)";
const BERRY = "var(--rb-berry)";
const INK = "var(--rb-ink)";
const CREAM = "oklch(0.915 0.052 82)";

const skin = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Kitten() {
  return (
    <g {...skin}>
      <path d="M8 11 6.5 5.5 11 8.5zM22 11l1.5-5.5L19 8.5z" fill={SUN} />
      <ellipse cx="15" cy="15" rx="9" ry="8" fill={SUN} />
      <circle cx="12" cy="14" r="1.4" fill={INK} stroke="none" />
      <circle cx="18" cy="14" r="1.4" fill={INK} stroke="none" />
      <path d="M13.4 18q1.6 2 3.2 0" />
      <path d="M6 16h-4M6 18h-4M24 16h4M24 18h4" strokeWidth="1.2" />
    </g>
  );
}

function Sea() {
  return (
    <g {...skin}>
      <path d="M2 8q3.5-3 7 0t7 0 7 0 5-1" strokeWidth="1.4" />
      <path d="M2 13q3.5-3 7 0t7 0 7 0 5-1" strokeWidth="1.4" />
      <path d="M19 17c4.5 0 8 2.5 8 5s-3.5 5-8 5-8-2.5-9-5c1-2.5 4.5-5 9-5z" fill={SUN} />
      <path d="M10 22 4 17v10z" fill={SUN} />
      <circle cx="21" cy="21" r="1.3" fill={INK} stroke="none" />
      <path d="M17 24q3 1.5 6 0" strokeWidth="1.2" />
    </g>
  );
}

function Robot() {
  return (
    <g {...skin}>
      <path d="M15 4v3" />
      <circle cx="15" cy="3" r="1.6" fill={BERRY} />
      <rect x="6" y="7" width="18" height="14" rx="5" fill={LEAF} />
      <circle cx="11" cy="13" r="2" fill={CREAM} />
      <circle cx="19" cy="13" r="2" fill={CREAM} />
      <path d="M11.5 17.5q3.5 2.5 7 0" />
      <path d="M4 12v5M26 12v5M11 21v4M19 21v4" />
    </g>
  );
}

function Dragon() {
  return (
    <g {...skin}>
      <path d="M9 7 7.5 2.5 11.5 5zM21 7l1.5-4.5L18.5 5z" fill={LEAF} />
      <ellipse cx="15" cy="13" rx="9" ry="8" fill={LEAF} />
      <ellipse cx="15" cy="17" rx="5" ry="3.5" fill={CREAM} />
      <circle cx="11.5" cy="11" r="1.6" fill={INK} stroke="none" />
      <circle cx="18.5" cy="11" r="1.6" fill={INK} stroke="none" />
      <path d="M24 15c3 1 4 4 2 6-1 1-3 1-4 0" />
      <path d="M12 23l1 4M18 23l-1 4" />
    </g>
  );
}

export const IDEAS = [
  { word: "dragons", Art: Dragon },
  { word: "a lost kitten", Art: Kitten },
  { word: "a silly robot", Art: Robot },
  { word: "the deep sea", Art: Sea },
] as const;

export function Idea({ Art }: { Art: () => React.JSX.Element }) {
  return (
    <svg viewBox="0 0 30 30" width="34" height="34" aria-hidden className="shrink-0">
      <Art />
    </svg>
  );
}
