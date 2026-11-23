import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://127.0.0.1:4173");
await page.waitForFunction(
  () => document.querySelector(".scramble-sequence")?.textContent.length > 10,
);
let scramble = await page.locator(".scramble-sequence").innerText();
await page.keyboard.press("r");
await page.waitForFunction(
  (s) => document.querySelector(".scramble-sequence")?.textContent !== s,
  scramble,
);
await page.keyboard.press("4");
await page.getByRole("link", { name: /Recall Trainer/ }).click();
await page.locator("twisty-player").waitFor();
await page.locator(".recall-stage").click({ position: { x: 10, y: 10 } });
await page.keyboard.press("Space");
assert.equal(await page.getByRole("button", { name: "一時停止" }).count(), 1);
await page.keyboard.press("a");
assert.equal(await page.locator(".recall-answer strong").count(), 1);
await page.keyboard.press("n");
assert.equal(await page.locator(".recall-answer strong").count(), 0);
await page.keyboard.press("Space");
assert.equal(
  await page.getByRole("button", { name: "開始", exact: true }).count(),
  1,
);
await page.keyboard.press("2");
await page.getByRole("heading", { name: "統計" }).waitFor();
await page.keyboard.press("1");
await page.waitForFunction(
  () => document.querySelector(".scramble-sequence")?.textContent.length > 10,
);
await page.getByRole("button", { name: "タイムを手入力", exact: true }).click();
await page.getByLabel("タイム", { exact: true }).fill("1");
await page.keyboard.press("4");
assert.equal(await page.locator("dialog[open]").count(), 1);
await page.getByRole("button", { name: "閉じる" }).click();
await page.close();
for (const viewport of [
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 320, height: 568 },
]) {
  const p = await browser.newPage({ viewport, isMobile: true, hasTouch: true });
  await p.goto("http://127.0.0.1:4173");
  await p.getByRole("link", { name: "練習", exact: true }).click();
  await p.getByRole("link", { name: /Recall Trainer/ }).click();
  await p.locator("twisty-player").waitFor();
  await p.waitForTimeout(500);
  if (viewport.height >= 560)
    assert.ok(
      await p.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  let box = await p.locator(".recall-cube").boundingBox();
  assert.ok(box.width >= 250 && box.height >= 150);
  await p.screenshot({
    path: `docs/screenshots/recall-mobile-new-${viewport.width}.png`,
  });
  await p.getByRole("button", { name: "練習設定" }).click();
  await p
    .getByRole("dialog")
    .getByLabel("パターン", { exact: true })
    .selectOption("OLL");
  await p
    .getByRole("dialog")
    .getByLabel("表示", { exact: true })
    .selectOption("net");
  await p.getByRole("dialog").getByLabel("側面の数").selectOption("3");
  await p.getByRole("button", { name: "閉じる" }).click();
  await p.locator(".recall-flat").waitFor();
  assert.equal(await p.locator(".recall-flat rect").count(), 18);
  await p.close();
}
await browser.close();
console.log(
  "PASS: navigation, scramble, recall shortcuts, modal input protection, mobile fixed layout and settings",
);
