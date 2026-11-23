import { expect, it } from "vitest";
import { accentColors, contrast } from "../src/lib/theme";
it("keeps custom accent text and button labels readable in light and dark themes", () => {
  for (const color of ["#2459e0", "#ffffff", "#000000", "#ffff00", "#ff33cc"])
    for (const dark of [true, false]) {
      const colors = accentColors(color, dark);
      expect(
        contrast(colors.ink, dark ? "#182130" : "#ffffff"),
      ).toBeGreaterThanOrEqual(4.5);
      expect(contrast(color, colors.foreground)).toBeGreaterThanOrEqual(4.5);
    }
});
