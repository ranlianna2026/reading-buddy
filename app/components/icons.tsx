export function Heart({ on = true, size = 26 }: { on?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M12 21.2S3.6 15.6 3.6 9.7A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.4 3.1c0 5.9-8.4 11.5-8.4 11.5z"
        fill={on ? "var(--rb-berry)" : "var(--rb-locked)"}
        stroke={on ? "color-mix(in oklab, var(--rb-berry), black 25%)" : "var(--rb-line)"}
        strokeWidth="1.3"
      />
      {on && <ellipse cx="8.6" cy="9.4" rx="2.1" ry="1.4" fill="#fff" opacity=".45" />}
    </svg>
  );
}

export function Star({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5-5.9-3.2-5.9 3.2 1.2-6.5L2.5 9.5l6.6-.9z"
        fill="var(--rb-sun)"
        stroke="color-mix(in oklab, var(--rb-sun), black 25%)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Flame({ on = true, size = 26 }: { on?: boolean; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d="M12 2.2c1.2 4.2 6.2 6.2 6.2 12a6.2 6.2 0 0 1-12.4 0c0-3.1 2.1-5.2 3.1-6.2 0 2.1 1 3.1 2.1 3.1 0-3.1-1-6.2 1-8.9z"
        fill={on ? "var(--rb-sun)" : "var(--rb-locked)"}
        stroke={on ? "color-mix(in oklab, var(--rb-sun), black 28%)" : "var(--rb-line)"}
        strokeWidth="1.3"
      />
      {on && <path d="M12 12.4c1 2.1 3.1 3.1 3.1 5.2a3.1 3.1 0 0 1-6.2 0c0-1 1-2.1 1-3.1 1 1 2.1 0 2.1-2.1z" fill="var(--rb-berry)" opacity=".75" />}
    </svg>
  );
}

export function Hearts({ n, max = 5 }: { n: number; max?: number }) {
  return (
    <span id="hearts" className="flex items-center gap-1" title={`${n} of ${max} hearts`} aria-label={`${n} hearts left`}>
      {Array.from({ length: max }, (_, i) => (
        <Heart key={i} on={i < n} size={22} />
      ))}
    </span>
  );
}
