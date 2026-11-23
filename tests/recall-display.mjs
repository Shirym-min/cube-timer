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
  if (viewport.width < 761) await p.getByRole("button", { name: "練習設定" }).click();
  const controls = viewport.width < 761 ? p.getByRole("dialog") : p.locator(".recall-controls-desktop");
  await controls.getByLabel("表示", { exact: true }).selectOption("net");
  await p.locator(".recall-cube svg").waitFor({ state: "attached" });
  for (const n of [2, 3, 4]) {
    await controls.getByLabel("側面の数").selectOption(String(n));
    assert.equal(await p.locator(".recall-cube [data-sticker]").count(), 9 + 3 * n);
    assert.equal(
      await p.locator('.recall-cube path[data-sticker^="U"]').count(),
      9,
    );
  }
  assert.equal(
    await p.locator('.recall-cube [data-sticker^="F"][width="1"][height="0.46"]').count(),
    3,
  );
  assert.equal(
    await p.locator('.recall-cube [data-sticker^="R"][width="0.46"][height="1"]').count(),
    3,
  );
  await controls.getByLabel("上面の色").selectOption("green");
  await p.waitForFunction(
    () =>
      document
        .querySelector('.recall-cube [data-sticker="U4"]')
        ?.getAttribute("fill") === "limegreen",
  );
  if (viewport.width < 761) {
    await p.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
    await p.getByRole("dialog").waitFor({ state: "hidden" });
  }
  await p.locator(".recall-cube svg").waitFor();
  await p.screenshot({
    path: `docs/screenshots/recall-net-${viewport.width}.png`,
  });
  if (viewport.width < 761) await p.getByRole("button", { name: "練習設定" }).click();
  await controls.getByLabel("表示", { exact: true }).selectOption("3d");
  if (viewport.width < 761) await p.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
  await p.locator(".recall-cube twisty-player").waitFor();
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await p.close();
}
console.log(
  "PASS: selected upper colors, rounded top stickers, 2/3/4 sides, 3D and responsive layouts",
);
await browser.close();
