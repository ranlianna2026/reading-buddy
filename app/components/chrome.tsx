import { useState } from "react";
import { NavLink } from "react-router";

import { useIntro } from "~/lib/motion";

import { Head } from "./buddy";
import { Hearts } from "./icons";
import { Progress } from "./progress";

export const PAGE = "max-w-[1100px]";

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
  width = PAGE,
}: {
  left?: React.ReactNode;
  middle?: React.ReactNode;
  right?: React.ReactNode;
  width?: string;
}) {
  return (
    <header id="top-nav" className="sticky top-0 z-20 bg-page/85 backdrop-blur-md">
      <div className={`mx-auto flex h-20 w-full items-center gap-4 px-5 ${width}`}>
        {left}
        {middle ?? <span className="flex-1" />}
        {right}
      </div>
    </header>
  );
}

export function Crumbs({ kid }: { kid: { name: string; hearts: number; streak: number; stars: number } }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        id="crumbs"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Your progress"
        className="flex items-center gap-3 rounded-2xl border-2 border-line bg-surface px-3 py-1.5 font-medium hover:border-leaf"
      >
        <span className="mono text-sun-ink">{kid.streak} day</span>
        <span className="mono text-muted">·</span>
        <span className="mono">{kid.stars} stars</span>
        <span className="mono text-muted">·</span>
        <span className="mono text-berry-ink">{kid.hearts} hearts</span>
      </button>
      {open && <Progress onClose={() => setOpen(false)} />}
    </>
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
      <ul className={`mx-auto flex w-full items-stretch justify-around px-3 pt-2 ${PAGE}`} style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}>
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

export { Flame, Heart, Hearts, Star } from "./icons";

export function Screen({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div id={id} className="flex min-h-svh flex-col">
      {children}
    </div>
  );
}

export function Focus({
  children,
  className = "",
  intro,
  width = "max-w-2xl",
}: {
  children: React.ReactNode;
  className?: string;
  intro?: unknown;
  width?: string;
}) {
  const scope = useIntro<HTMLElement>(intro);
  return (
    <main
      ref={scope}
      className={`mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 px-5 py-8 text-center ${width} ${className}`}
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
        className={`mx-auto flex w-full flex-col gap-3 px-5 pt-4 sm:flex-row sm:items-center sm:justify-between ${PAGE}`}
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </footer>
  );
}
