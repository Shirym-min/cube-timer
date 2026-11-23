import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const url = new URL(process.env.TEST_URL ?? "http://127.0.0.1:4173");
const browser = await chromium.launch({ channel: "chrome", args: ["--no-proxy-server"] });

try {
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    permissions: ["clipboard-read", "clipboard-write"],
  });
  const page = await desktop.newPage();
  await page.goto(url.href);
  const copy = page.getByRole("button", { name: "スクランブルをコピー" });
  const refresh = page.getByRole("button", { name: "次のスクランブル" });
  const sequence = page.locator(".scramble-sequence");
  await sequence.waitFor();
  const oldScramble = await sequence.innerText();
  await copy.click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), oldScramble);
  const textBox = await copy.boundingBox();
  const refreshBox = await refresh.boundingBox();
  assert.ok(refreshBox.x >= textBox.x + textBox.width);
  await refresh.click();
  await page.waitForFunction((oldScramble) => {
    const sequence = document.querySelector(".scramble-text:not(.loading) .scramble-sequence");
    return sequence && sequence.textContent !== oldScramble;
  }, oldScramble);
  const workspace = await page.locator(".timer-workspace").boundingBox();
  const records = await page.locator(".records-pane").boundingBox();
  const timer = await page.locator(".timer-touch").boundingBox();
  assert.ok(records.x >= workspace.x + workspace.width - 1);
  assert.ok(Math.abs(timer.x + timer.width / 2 - (workspace.x + workspace.width / 2)) < 2);
  await page.locator(".diagram twisty-player").waitFor();
  await page.waitForFunction(() => document.querySelector(".toast")?.dataset.visible !== "true");
  await page.keyboard.press("Tab");
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), "solid");
  if (process.env.TIMER_SCREENSHOTS) await page.screenshot({ path: "/tmp/cube-timer-desktop.png" });
  await desktop.close();

  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await phone.newPage();
  for (const route of ["timer", "stats", "sessions", "practice", "recall", "algorithms", "video"]) {
    const routeUrl = new URL(url);
    routeUrl.searchParams.set("page", route);
    await mobile.goto(routeUrl.href);
    assert.equal((await mobile.locator(".topbar").boundingBox()).height, 44, route);
  }
  await mobile.goto(url.href);
  await mobile.locator(".scramble-text:not(.loading) .scramble-sequence").waitFor();
  assert.equal(await mobile.getByText("準備完了", { exact: true }).count(), 0);
  assert.equal(await mobile.getByText("または画面を長押しして離す").count(), 0);
  await mobile.getByRole("button", { name: "設定", exact: true }).tap();
  const dialog = mobile.locator("dialog");
  const input = mobile.getByLabel("15秒インスペクション");
  await input.tap();
  assert.equal(await input.evaluate((el) => getComputedStyle(el).outlineStyle), "none");
  await mobile.keyboard.press("Tab");
  assert.equal(await dialog.evaluate((el) => getComputedStyle(el.ownerDocument.activeElement).outlineStyle), "solid");
  await mobile.getByRole("button", { name: "閉じる", exact: true }).tap();
  await dialog.waitFor({ state: "detached" });

  const cdp = await phone.newCDPSession(mobile);
  const timerTouch = mobile.locator(".timer-touch");
  const handle = mobile.getByRole("button", { name: "直前の記録の追加操作" });
  const touch = (type, point) => cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: point ? [point] : [],
  });
  const center = async (locator) => {
    const { x, y, width, height } = await locator.boundingBox();
    return { x: x + width / 2, y: y + height / 2 };
  };
  async function holdTimer(ms) {
    await touch("touchStart", await center(timerTouch));
    await mobile.waitForTimeout(ms);
    await touch("touchEnd");
  }
  await holdTimer(60);
  assert.equal(await mobile.locator(".timer-stage.running").count(), 0);
  await holdTimer(400);
  await mobile.locator(".timer-stage.running").waitFor();
  await mobile.waitForTimeout(250);
  await holdTimer(15);
  await handle.waitFor();

  const plusTwo = mobile.getByRole("button", { name: "+2", exact: true });
  const dnf = mobile.getByRole("button", { name: "DNF", exact: true });
  assert.equal(await plusTwo.isVisible(), false);
  const start = await center(handle);
  await touch("touchStart", start);
  await touch("touchMove", { x: start.x + 24, y: start.y - 4 });
  await touch("touchEnd");
  assert.equal(await handle.getAttribute("aria-expanded"), "false");
  await touch("touchStart", start);
  await touch("touchMove", { x: start.x, y: start.y - 16 });
  const tracked = await center(handle);
  assert.ok(Math.abs(tracked.y - start.y + 16) < 2);
  await touch("touchMove", { x: start.x, y: start.y - 39 });
  await touch("touchEnd");
  await plusTwo.waitFor();
  assert.equal(await handle.getAttribute("aria-expanded"), "true");
  assert.equal(await mobile.locator(".timer-stage.running").count(), 0);
  await plusTwo.tap();
  await mobile.getByRole("button", { name: "+2", pressed: true }).waitFor();
  await dnf.tap();
  await mobile.getByRole("button", { name: "DNF", pressed: true }).waitFor();
  if (process.env.TIMER_SCREENSHOTS) await mobile.screenshot({ path: "/tmp/cube-timer-mobile-actions.png" });
  const top = await center(handle);
  await touch("touchStart", top);
  await touch("touchMove", { x: top.x, y: top.y + 39 });
  await touch("touchEnd");
  await plusTwo.waitFor({ state: "hidden" });
  assert.equal(await handle.getAttribute("aria-expanded"), "false");
  if (process.env.TIMER_SCREENSHOTS) await mobile.screenshot({ path: "/tmp/cube-timer-mobile.png" });
  await mobile.setViewportSize({ width: 320, height: 568 });
  await handle.tap();
  await mobile.getByRole("button", { name: "削除", exact: true }).waitFor();
  const narrowTimer = await timerTouch.boundingBox();
  const narrowActions = await mobile.locator(".last-actions").boundingBox();
  assert.ok(narrowActions.y >= narrowTimer.y + narrowTimer.height - 2);
  assert.ok(narrowActions.x >= 0 && narrowActions.x + narrowActions.width <= 320);
  await mobile.getByRole("button", { name: "削除", exact: true }).tap();
  await mobile.getByRole("button", { name: "キャンセル", exact: true }).tap();
  await mobile.getByRole("button", { name: "削除", exact: true }).tap();
  await mobile.getByRole("button", { name: "削除する", exact: true }).tap();
  await handle.waitFor({ state: "detached" });
  await mobile.getByRole("button", { name: /^記録/ }).tap();
  assert.equal(await mobile.locator(".records-table tbody tr").count(), 0);
  console.log("PASS: compact timer layout, clipboard, shared header height, pointer focus, and mobile solve actions.");
} finally {
  await browser.close();
}
