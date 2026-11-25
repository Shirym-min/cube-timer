import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const url = process.env.TEST_URL ?? "http://127.0.0.1:4173";

try {
  for (const viewport of [{ width: 1440, height: 960 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(url);
    await page.locator('.timer-touch[aria-disabled="false"]').waitFor();
    const touch = page.locator(".timer-touch");
    const idle = await touch.boundingBox();
    const idleCenter = idle.y + idle.height / 2;
    if (viewport.width === 390) {
      assert.ok(viewport.height / 2 - idleCenter >= 12);
      assert.ok(viewport.height / 2 - idleCenter <= 22);
    }
    await page.keyboard.down("Space");
    await page.locator(".timer-stage.ready").waitFor();
    await page.keyboard.up("Space");
    await page.locator(".timer-stage.running").waitFor();
    await page.waitForTimeout(450);
    const running = await touch.boundingBox();
    const expectedY = viewport.width === 390 ? idleCenter : viewport.height / 2;
    assert.ok(Math.abs(running.x + running.width / 2 - viewport.width / 2) < 2);
    assert.ok(Math.abs(running.y + running.height / 2 - expectedY) < 2);
    const scramble = page.locator(".scramble-panel");
    assert.equal(await scramble.evaluate((el) => getComputedStyle(el).visibility), "hidden");
    await page.screenshot({ path: `docs/screenshots/timer-running-${viewport.width}.png` });
    await page.keyboard.press("4");
    assert.equal(await page.locator(".timer-stage.running").count(), 1);
    await page.keyboard.press("Space");
    await page.locator(".timer-stage.stopped").waitFor();
    await page.waitForTimeout(250);
    assert.equal(await scramble.evaluate((el) => getComputedStyle(el).visibility), "visible");
    await page.close();
  }
  console.log("PASS: running timer alignment, hidden controls, blocked shortcuts, and restored layout.");
} finally {
  await browser.close();
}
