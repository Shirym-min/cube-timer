import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4173");
await page.waitForFunction(
  () => document.querySelector(".scramble-sequence")?.textContent.length > 10,
);
await page.evaluate(async () => {
  await navigator.serviceWorker.ready;
});
await page.reload();
await page.waitForFunction(() => !!navigator.serviceWorker.controller);
await context.setOffline(true);
await page.reload();
await page.waitForFunction(
  () => document.querySelector(".scramble-sequence")?.textContent.length > 10,
);
const client = await context.newCDPSession(page);
async function press(ms) {
  const b = await page.locator(".timer-touch").boundingBox();
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
  });
  await page.waitForTimeout(ms);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
}
await press(50);
assert.equal(await page.locator(".timer-stage.running").count(), 0);
await press(400);
await page.locator(".timer-stage.running").waitFor();
await page.waitForTimeout(130);
await press(20);
await page.getByRole("button", { name: "直前の記録の追加操作" }).waitFor();
await page.getByRole("button", { name: "設定", exact: true }).click();
await page.getByLabel("15秒インスペクション").check();
await page.getByRole("button", { name: "設定を保存", exact: true }).click();
await page.getByText("設定を保存しました。", { exact: true }).waitFor();
await page.getByRole("button", { name: "閉じる", exact: true }).click();
await page.locator("dialog").waitFor({ state: "detached" });
await press(400);
await page.locator(".timer-stage.inspection").waitFor();
await page.clock.install();
await page.clock.fastForward(15300);
const b = await page.locator(".timer-touch").boundingBox();
await client.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
});
await page.clock.fastForward(400);
await client.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await page.locator(".timer-stage.running").waitFor();
await page.clock.fastForward(1234);
await client.send("Input.dispatchTouchEvent", {
  type: "touchStart",
  touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }],
});
await client.send("Input.dispatchTouchEvent", {
  type: "touchEnd",
  touchPoints: [],
});
await page.waitForFunction(() =>
  document.querySelector(".last-actions")?.textContent.includes("+"),
);
await page.clock.resume();
await page.getByRole("button", { name: "設定", exact: true }).click();
await page.getByLabel("15秒インスペクション").uncheck();
await page.getByLabel("区間数").selectOption("2");
await page.getByRole("button", { name: "設定を保存", exact: true }).click();
await page.getByText("設定を保存しました。", { exact: true }).waitFor();
await page.getByRole("button", { name: "閉じる", exact: true }).click();
await page.locator("dialog").waitFor({ state: "detached" });
await press(400);
await page.waitForTimeout(100);
await press(20);
assert.equal(await page.locator(".timer-stage.running").count(), 1);
await page.waitForTimeout(100);
await press(20);
await page.locator(".timer-stage.stopped").waitFor();
await page.getByRole("button", { name: /^記録/ }).click();
assert.equal(await page.locator(".records-table tbody tr").count(), 3);
await page
  .locator(".records-table tbody tr")
  .first()
  .getByRole("button")
  .click();
assert.ok((await page.locator("dialog").innerText()).includes("区間"));
await page.getByRole("button", { name: "記録を削除", exact: true }).click();
await page
  .getByRole("button", { name: "この記録を削除する", exact: true })
  .click();
await page.waitForFunction(
  () => document.querySelectorAll(".records-table tbody tr").length === 2,
);
await page.setViewportSize({ width: 320, height: 568 });
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
await page.screenshot({
  path: "docs/screenshots/mobile-small.png",
  fullPage: true,
});
await context.setOffline(false);
assert.deepEqual(errors, []);
console.log(
  "PASS: production PWA offline reload and scramble generation; touch hold, inspection +2, splits, delete, 320px reflow.",
);
await browser.close();
