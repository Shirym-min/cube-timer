import { useEffect } from "react";
import type { Settings } from "./model";
import { accentColors } from "./theme";

export function useTheme(settings: Settings) {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const el = document.documentElement;
      el.dataset.theme = settings.theme;
      el.style.setProperty("--accent", settings.accent);
      const colors = accentColors(
        settings.accent,
        settings.theme === "dark" ||
          (settings.theme === "system" && media.matches),
      );
      el.style.setProperty("--accent-ink", colors.ink);
      el.style.setProperty("--accent-foreground", colors.foreground);
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content",
        getComputedStyle(el).getPropertyValue("--surface").trim(),
      );
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [settings]);
}
