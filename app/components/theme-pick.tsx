import { useEffect, useState } from "react";

import { readTheme, writeTheme, type Theme } from "~/lib/theme";

const THEMES: [Theme, string][] = [
  ["light", "Day"],
  ["dark", "Night"],
  ["system", "Auto"],
];

export function ThemePick() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => setTheme(readTheme()), []);
  return (
    <div className="flex gap-2">
      {THEMES.map(([value, label]) => (
        <button
          key={value}
          onClick={() => {
            setTheme(value);
            writeTheme(value);
          }}
          aria-pressed={value === theme}
          className={`h-12 flex-1 rounded-2xl border-2 font-medium ${
            value === theme ? "border-leaf bg-leaf-soft text-leaf-ink" : "border-line bg-page text-muted"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
