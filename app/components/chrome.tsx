import { NavLink } from "react-router";

import { useIntro } from "~/lib/motion";

import { Head } from "./buddy";

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

export function Meter({ at, of }: { at: number; of: number }) {
  return (
    <div className="bar flex-1" role="progressbar" aria-valuenow={at} aria-valuemin={0} aria-valuemax={of}>
      <span style={{ width: `${of ? Math.min(100, (at / of) * 100) : 0}%` }} />
    </div>
  );
}

export function TopNav({
  left,
  middle,
  right,
}: {
  left?: React.ReactNode;
  middle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header id="top-nav" className="sticky top-0 z-20 bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 w-full max-w-3xl items-center gap-4 px-5">
        {left}
        {middle ?? <span className="flex-1" />}
        {right}
      </div>
    </header>
  );
}

export function Crumbs({ kid }: { kid: { name: string; hearts: number; streak: number; stars: number } }) {
  return (
    <div className="flex items-center gap-4 font-medium">
      <span className="flex items-center gap-1 text-sun-ink" title={`${kid.streak} day streak`}>
        <Flame on={kid.streak > 0} size={24} /> {kid.streak}
      </span>
      <span className="flex items-center gap-1" title={`${kid.stars} stars`}>
        <Star size={24} /> {kid.stars}
      </span>
      <span className="flex items-center gap-1 text-berry-ink" title={`${kid.hearts} hearts`}>
        <Heart size={24} /> {kid.hearts}
      </span>
    </div>
  );
}

const TABS = [
  { to: "/read", label: "Read", icon: "book" },
  { to: "/library", label: "Stories", icon: "shelf" },
  { to: "/me", label: "Me", icon: "buddy" },
] as const;

function TabIcon({ name }: { name: (typeof TABS)[number]["icon"] }) {
  if (name === "buddy") return <Head size={30} />;
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden>
      {name === "book" ? (
        <>
          <path d="M12 6.5C10.4 5 8.2 4.4 4.5 4.4v13c3.7 0 5.9.6 7.5 2.1 1.6-1.5 3.8-2.1 7.5-2.1v-13c-3.7 0-5.9.6-7.5 2.1z" />
          <path d="M12 6.5v13" />
        </>
      ) : (
        <>
          <rect x="3.5" y="4.5" width="4.5" height="15" rx="1.3" />
          <rect x="9.8" y="7.5" width="4.5" height="12" rx="1.3" />
          <rect x="16" y="4.5" width="4.5" height="15" rx="1.3" />
        </>
      )}
    </svg>
  );
}

export function BottomNav() {
  return (
    <nav id="bottom-nav" className="sticky bottom-0 z-20 border-t-2 border-line bg-page/90 backdrop-blur-md">
      <ul className="mx-auto flex w-full max-w-3xl items-stretch justify-around px-3 pt-2" style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              className={({ isActive }) =>
                `flex w-full flex-col items-center gap-0.5 rounded-2xl py-2 text-[13px] font-medium ${
                  isActive ? "bg-leaf-soft text-leaf-ink" : "text-muted hover:text-ink"
                }`
              }
            >
              <TabIcon name={tab.icon} />
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Screen({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex min-h-svh flex-col">
      {children}
    </div>
  );
}

export function Focus({ children, className = "", intro }: { children: React.ReactNode; className?: string; intro?: unknown }) {
  const scope = useIntro<HTMLElement>(intro);
  return (
    <main
      ref={scope}
      className={`mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center ${className}`}
    >
      {children}
    </main>
  );
}

export function ActionBar({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "good" | "bad" }) {
  const skin = tone === "good" ? "bg-leaf-soft" : tone === "bad" ? "bg-berry-soft" : "border-t-2 border-line";
  return (
    <footer className={`sticky bottom-0 z-10 ${skin}`}>
      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-center sm:justify-between"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </footer>
  );
}
