export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "rb-theme";

export const NO_FLASH = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): Theme {
  if (typeof localStorage === "undefined") return "system";
  const kept = localStorage.getItem(THEME_KEY);
  return kept === "light" || kept === "dark" ? kept : "system";
}

export function writeTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "system") {
    localStorage.removeItem(THEME_KEY);
    delete document.documentElement.dataset.theme;
  } else {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.dataset.theme = theme;
  }
}
