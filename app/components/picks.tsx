const LEAF = "var(--rb-leaf)";
const SUN = "var(--rb-sun)";
const BERRY = "var(--rb-berry)";
const INK = "var(--rb-ink)";
const CREAM = "oklch(0.915 0.052 82)";

const skin = { stroke: INK, strokeWidth: 1.7, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Rocket() {
  return (
    <g {...skin}>
      <path d="M15 2c4 4 6 9 6 14v5H9v-5c0-5 2-10 6-14z" fill={CREAM} />
      <path d="M9 14 4 19v6l5-3zM21 14l5 5v6l-5-3z" fill={BERRY} />
      <circle cx="15" cy="12" r="3.4" fill={LEAF} />
      <path d="M12 21h6l-3 7z" fill={SUN} />
    </g>
  );
}

function Puppy() {
  return (
    <g {...skin}>
      <path d="M7 8c-2.5 0-4 2.5-4 6s1.5 5 4 4z" fill={SUN} />
      <path d="M23 8c2.5 0 4 2.5 4 6s-1.5 5-4 4z" fill={SUN} />
      <ellipse cx="15" cy="16" rx="8.5" ry="8" fill={SUN} />
      <ellipse cx="15" cy="20" rx="5" ry="3.6" fill={CREAM} />
      <circle cx="11.8" cy="14" r="1.5" fill={INK} stroke="none" />
      <circle cx="18.2" cy="14" r="1.5" fill={INK} stroke="none" />
      <ellipse cx="15" cy="18.4" rx="1.7" ry="1.2" fill={INK} stroke="none" />
      <path d="M15 20v1.4M13.2 22.8q1.8 1.5 3.6 0" strokeWidth="1.3" />
    </g>
  );
}

function Forest() {
  return (
    <g {...skin}>
      <path d="M15 3 8.5 13H12L6.5 22h17L18 13h3.5z" fill={LEAF} />
      <path d="M13.5 22h3v5h-3z" fill={BERRY} />
      <path d="M25 5l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill={SUN} stroke="none" />
      <path d="M4 7l.7 1.8 1.8.7-1.8.7L4 12l-.7-1.8-1.8-.7 1.8-.7z" fill={SUN} stroke="none" />
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

export const IDEAS = [
  { word: "outer space", Art: Rocket },
  { word: "a lost puppy", Art: Puppy },
  { word: "a magic forest", Art: Forest },
  { word: "under the sea", Art: Sea },
] as const;

export function Idea({ Art }: { Art: () => React.JSX.Element }) {
  return (
    <svg viewBox="0 0 30 30" width="34" height="34" aria-hidden className="shrink-0">
      <Art />
    </svg>
  );
}
