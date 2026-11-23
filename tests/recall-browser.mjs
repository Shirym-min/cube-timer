import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173");
  await page.getByRole("link", { name: "練習", exact: true }).click();
  await page.getByRole("link", { name: /Recall Trainer/ }).click();
  await page.locator(".recall-cube twisty-player").waitFor();
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `docs/screenshots/recall-${viewport.width}.png`,
  });
  for (const mode of ["top", "net", "3d"]) {
    await page.getByLabel("表示", { exact: true }).selectOption(mode);
    await page.waitForTimeout(600);
    assert.equal(
      await page
        .locator(
          mode === "3d" ? ".recall-cube twisty-player" : ".recall-cube svg",
        )
        .count(),
      1,
    );
  }
  await page.getByLabel("パターン", { exact: true }).selectOption("ZBLL");
  assert.match(await page.locator(".recall-count").innerText(), /472/);
  await page.getByLabel("切り替え間隔", { exact: true }).selectOption("2");
  await page.getByRole("button", { name: "開始", exact: true }).click();
  await page.getByRole("button", { name: "答えを見る" }).click();
  let first = await page.locator(".recall-answer strong").innerText();
  await page.waitForTimeout(2300);
  assert.equal(await page.locator(".recall-answer strong").count(), 0);
  await page.getByRole("button", { name: "答えを見る" }).click();
  assert.notEqual(
    await page.locator(".recall-answer strong").innerText(),
    first,
  );
  await page.getByRole("button", { name: "一時停止" }).click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  await page.close();
}
console.log(
  "PASS: practice navigation, 3 views, ZBLL, automatic advance, pause, answer, desktop and mobile",
);
await browser.close();
