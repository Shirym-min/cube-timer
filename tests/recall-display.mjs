import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const p = await browser.newPage({ viewport });
  await p.goto("http://127.0.0.1:4173");
  await p.getByRole("link", { name: "練習", exact: true }).click();
  await p.getByRole("link", { name: /Recall Trainer/ }).click();
  await p.locator(".recall-cube svg").waitFor();
  await p.getByLabel("表示", { exact: true }).selectOption("net");
  for (const n of [2, 3, 4]) {
    await p.getByLabel("側面の数").selectOption(String(n));
    assert.equal(await p.locator(".recall-cube rect").count(), 9 + 3 * n);
    assert.equal(
      await p.locator('.recall-cube rect[width="1"][height="1"]').count(),
      9 + 3 * n,
    );
  }
  await p.getByLabel("上面の色").selectOption("green");
  await p.waitForFunction(
    () =>
      document
        .querySelector(".recall-cube rect:nth-child(5)")
        ?.getAttribute("fill") === "limegreen",
  );
  await p.screenshot({
    path: `docs/screenshots/recall-net-${viewport.width}.png`,
  });
  await p.getByLabel("表示", { exact: true }).selectOption("3d");
  await p.locator(".recall-cube twisty-player").waitFor();
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.close();
}
console.log(
  "PASS: selected upper colors, square stickers, 2/3/4 sides, 3D and responsive layouts",
);
await browser.close();
