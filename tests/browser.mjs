import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
await fs.mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL ?? "http://127.0.0.1:4173");
await page.waitForFunction(
  () => document.querySelector(".scramble-text")?.textContent.includes(" "),
  { timeout: 60000 },
);
await page.locator("twisty-player").waitFor();
await page.waitForTimeout(1000);
await page.screenshot({ path: "docs/screenshots/desktop-empty.png" });
await page.locator("body").click({ position: { x: 1430, y: 500 } });
await page.keyboard.down("Space");
await page.waitForTimeout(400);
await page.keyboard.up("Space");
await page.waitForTimeout(180);
await page.keyboard.down("Space");
await page.keyboard.up("Space");
await page.locator(".records-table tbody tr").waitFor();
assert.equal(await page.locator(".records-table tbody tr").count(), 1);
await page.getByRole("button", { name: "タイムを手入力", exact: true }).click();
await page.getByLabel("タイム", { exact: true }).fill("12.345");
await page.getByRole("button", { name: "保存", exact: true }).click();
await page.waitForFunction(
  () => document.querySelectorAll(".records-table tbody tr").length === 2,
);
await page.getByRole("button", { name: "+2", exact: true }).click();
await page.waitForFunction(() =>
  document.querySelector(".last-actions")?.textContent.includes("14.345+"),
);
await page.reload();
await page.waitForFunction(
  () => document.querySelectorAll(".records-table tbody tr").length === 2,
);
await page
  .getByRole("button", { name: "新しいセッション", exact: true })
  .click();
await page.getByLabel("名前", { exact: true }).fill("3×3 練習");
await page.getByRole("button", { name: "作成", exact: true }).click();
await page.waitForFunction(
  () => document.querySelector(".current-session")?.textContent === "3×3 練習",
);
assert.equal(await page.locator(".records-table tbody tr").count(), 0);
await page
  .getByLabel("セッション", { exact: true })
  .selectOption({ label: "メインセッション" });
await page.waitForFunction(
  () => document.querySelectorAll(".records-table tbody tr").length === 2,
);
for (const time of [
  "14.282",
  "11.938",
  "13.804",
  "12.153",
  "10.927",
  "12.408",
  "11.572",
  "13.016",
  "12.831",
  "11.204",
  "12.566",
]) {
  await page
    .getByRole("button", { name: "タイムを手入力", exact: true })
    .click();
  await page.getByLabel("タイム", { exact: true }).fill(time);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.waitForFunction(() => !document.querySelector("dialog"));
  await page.waitForFunction(
    () => !document.querySelector(".scramble-text.loading"),
  );
}
await page.waitForTimeout(800);
await page.screenshot({ path: "docs/screenshots/desktop-records.png" });
await page.getByRole("button", { name: "ヒント", exact: true }).click();
await page.locator(".hint-result").waitFor({ timeout: 30000 });
await page.screenshot({ path: "docs/screenshots/hint.png" });
await page.getByRole("button", { name: "ヒントを閉じる", exact: true }).click();
await page.getByRole("button", { name: "統計", exact: true }).first().click();
await page.locator(".statistics-table").waitFor();
assert.equal(await page.locator(".statistics-table tbody tr").count(), 7);
await page.screenshot({ path: "docs/screenshots/statistics.png" });
await page.getByRole("button", { name: "タイマー", exact: true }).click();
await page.getByRole("button", { name: "設定", exact: true }).click();
await page.getByLabel("テーマ", { exact: true }).selectOption("dark");
await page.getByRole("button", { name: "設定を保存", exact: true }).click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "dark",
);
await page.getByRole("button", { name: "閉じる", exact: true }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: "docs/screenshots/dark.png" });
await page.setViewportSize({ width: 820, height: 1180 });
await page.screenshot({ path: "docs/screenshots/tablet.png" });
await page.setViewportSize({ width: 390, height: 844 });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.screenshot({
  path: "docs/screenshots/mobile-dark.png",
  fullPage: true,
});
await page.getByRole("button", { name: "設定", exact: true }).click();
await page.getByLabel("テーマ", { exact: true }).selectOption("light");
await page.getByRole("button", { name: "設定を保存", exact: true }).click();
await page.waitForFunction(
  () => document.documentElement.dataset.theme === "light",
);
await page.getByRole("button", { name: "閉じる", exact: true }).click();
await page.screenshot({ path: "docs/screenshots/mobile.png", fullPage: true });
await page.getByRole("button", { name: /^記録 13$/ }).click();
await page.screenshot({
  path: "docs/screenshots/mobile-records.png",
  fullPage: true,
});
assert.deepEqual(errors, []);
console.log(
  "PASS: keyboard timer, manual entry, +2, persistence, session isolation, 13 records, cross hint, statistics, dark mode; responsive desktop/tablet/mobile.",
);
await browser.close();
