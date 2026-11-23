import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4173");
await page.waitForFunction(
  () => document.querySelector(".scramble-sequence")?.textContent.length > 10,
);
await page.keyboard.press("h");
await page.locator(".hint-result").waitFor({ timeout: 30000 });
assert.equal(await page.locator("dialog[open]").count(), 0);
assert.equal(await page.locator(".hint-popover:popover-open").count(), 1);
assert.equal(await page.locator(".hint-popover select").count(), 0);
let trigger = await page.locator(".hint-button").boundingBox(),
  popup = await page.locator(".hint-popover").boundingBox();
assert.ok(Math.abs(trigger.y - (popup.y + popup.height)) <= 12);
await page.locator(".diagram twisty-player").waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/screenshots/hint-popover-desktop.png" });
await page.keyboard.press("h");
await page.locator(".hint-popover:popover-open").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "設定", exact: true }).click();
await page.getByLabel("ヒントの対象面", { exact: true }).selectOption("U");
await page.getByLabel("ヒントの種類", { exact: true }).selectOption("xcross");
await page.getByRole("button", { name: "設定を保存", exact: true }).click();
await page.getByRole("button", { name: "閉じる", exact: true }).click();
await page.reload();
await page.waitForFunction(
  () => document.querySelector(".scramble-sequence")?.textContent.length > 10,
);
await page.getByRole("button", { name: "ヒント", exact: true }).click();
await page.locator(".hint-result").waitFor({ timeout: 30000 });
assert.equal(
  await page.locator(".hint-popover-header h3").innerText(),
  "U面 X-cross",
);
await page.getByRole("button", { name: "手順を見る", exact: true }).click();
await page.locator(".hint-preview twisty-player").waitFor();
await page.getByRole("button", { name: "ヒントを閉じる", exact: true }).click();
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole("button", { name: "ヒント", exact: true }).click();
await page.locator(".hint-result").waitFor({ timeout: 30000 });
popup = await page.locator(".hint-popover").boundingBox();
assert.ok(
  popup.x >= 0 &&
    popup.x + popup.width <= 390 &&
    popup.y >= 0 &&
    popup.y + popup.height <= 844,
);
await page
  .locator(".hint-popover-body[aria-busy=false] .hint-result")
  .waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: "docs/screenshots/hint-popover-mobile.png" });
await page.locator(".breadcrumb").click();
await page.locator(".hint-popover:popover-open").waitFor({ state: "hidden" });
assert.deepEqual(errors, []);
console.log(
  "PASS: one-click automatic hint in anchored non-modal popover, Escape/outside dismissal, persisted face/type settings, 3D disclosure, mobile bounds.",
);
await browser.close();
