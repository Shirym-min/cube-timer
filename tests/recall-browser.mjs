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
  await page.getByRole("link", { name: "ツール", exact: true }).click();
  await page.getByRole("link", { name: /Recall Trainer/ }).click();
  await page.locator(".recall-cube twisty-player").waitFor();
  const mobile = viewport.width <= 760;
  const settingsButton = page.getByRole("button", { name: "練習設定" });
  const settingsDialog = page.getByRole("dialog", { name: "練習設定" });
  const controls = mobile ? settingsDialog : page.locator(".recall-controls-desktop");
  async function openSettings() {
    if (mobile) await settingsButton.click();
  }
  async function closeSettings() {
    if (!mobile) return;
    await settingsDialog.getByRole("button", { name: "閉じる" }).click();
    await settingsDialog.waitFor({ state: "hidden" });
  }
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: `docs/screenshots/recall-${viewport.width}.png`,
  });
  await openSettings();
  for (const mode of ["top", "3d", "net"]) {
    await controls.getByLabel("表示", { exact: true }).selectOption(mode);
    await page.locator(
      mode === "3d" ? ".recall-cube twisty-player" : ".recall-cube svg",
    ).waitFor({ state: "attached" });
  }
  const pattern = controls.getByLabel("パターン", { exact: true });
  for (const [name, count] of [["ZBLL", 472], ["COLL", 40], ["WV", 27], ["VLS", 216]]) {
    await pattern.selectOption(name);
    assert.equal(await page.locator(".recall-count").textContent(), `${count} ケース`);
  }
  const mask = controls.getByRole("checkbox", { name: "判別に不要な部分を灰色にする" });
  const sideStickers = page.locator(".recall-flat rect[data-sticker]");
  await controls.getByLabel("側面の数").selectOption("4");
  for (const name of ["WV", "VLS"]) {
    await pattern.selectOption(name);
    await sideStickers.first().waitFor({ state: "attached" });
    assert.equal(await sideStickers.count(), 12, name);
    await mask.check();
    await page.waitForFunction(() => {
      const stickers = [...document.querySelectorAll('.recall-flat [data-sticker]')];
      const colors = new Set(stickers.map((sticker) => sticker.getAttribute('fill')));
      return stickers.length === 21 && colors.has('yellow') && colors.has('#888');
    });
    await mask.uncheck();
  }

  for (const name of ["COLL", "PLL", "ZBLL"]) {
    await pattern.selectOption(name);
    await mask.check();
    await page.waitForFunction((group) => {
      const top = Array.from(document.querySelectorAll('.recall-flat [data-sticker^="U"]'));
      if (top.length !== 9) return false;
      const isYellow = (i) => top[i].getAttribute("fill") === "yellow";
      if (![1, 3, 4, 5, 7].every(isYellow)) return false;
      return group === "PLL" ? [0, 2, 6, 8].every(isYellow) : ![0, 2, 6, 8].every(isYellow);
    }, name);
    if (name === "COLL") {
      assert.equal(await page.locator('.recall-flat rect[data-sticker$="1"][fill="#888"]').count(), 4);
    }
    await mask.uncheck();
  }

  await pattern.selectOption("OLL");
  await controls.getByLabel("上面の色").selectOption("green");
  await mask.check();
  const slider = controls.getByRole("slider", { name: "切り替え間隔" });
  assert.equal(await slider.getAttribute("min"), "1");
  assert.equal(await slider.getAttribute("max"), "10");
  await slider.fill("2");
  await closeSettings();
  await page.reload();
  await page.waitForFunction(() => {
    const stickers = Array.from(document.querySelectorAll(".recall-flat [data-sticker]"));
    const colors = new Set(stickers.map((sticker) => sticker.getAttribute("fill")));
    return colors.size === 2 && colors.has("limegreen") && colors.has("#888");
  });
  await openSettings();
  assert.equal(await pattern.inputValue(), "OLL");
  assert.equal(await controls.getByLabel("表示", { exact: true }).inputValue(), "net");
  assert.equal(await slider.inputValue(), "2");
  assert.equal(await mask.isChecked(), true);
  await closeSettings();
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
  "PASS: recall modes, gray mask, saved interval, automatic advance and responsive layouts",
);
await browser.close();
