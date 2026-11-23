const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
function luminance(c: number[]) {
  return c
    .map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    })
    .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) {
  const x = luminance(rgb(a)),
    y = luminance(rgb(b));
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function accentColors(accent: string, dark: boolean) {
  const background = dark ? "#182130" : "#ffffff",
    target = dark ? [255, 255, 255] : [0, 0, 0],
    source = rgb(accent);
  let ink = accent;
  for (let i = 0; i <= 100 && contrast(ink, background) < 5; i++)
    ink =
      "#" +
      source
        .map((v, j) =>
          Math.round(v + ((target[j] - v) * i) / 100)
            .toString(16)
            .padStart(2, "0"),
        )
        .join("");
  return {
    ink,
    foreground:
      contrast(accent, "#ffffff") >= contrast(accent, "#101824")
        ? "#ffffff"
        : "#101824",
  };
}
