import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({ channel: "chrome", headless: true });
for (const viewport of [
  { width: 1440, height: 960 },
  { width: 390, height: 844 },
]) {
  const p = await b.newPage({ viewport });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("http://127.0.0.1:4173");
  await p.getByRole("link", { name: "ツール", exact: true }).click();
  await p.getByRole("link", { name: /Recall Trainer/ }).click();
  await p.locator("twisty-player").waitFor();
  await p.waitForTimeout(1000);
  assert.equal(await p.getByRole("alert").count(), 0);
  await p.screenshot({
    path: `docs/screenshots/recall-3d-${viewport.width}.png`,
  });
  const mobile = viewport.width <= 760;
  async function configure(label, value) {
    if (mobile) await p.getByRole("button", { name: "練習設定" }).click();
    const scope = mobile ? p.getByRole("dialog") : p;
    await scope.getByLabel(label, { exact: true }).selectOption(value);
    if (mobile) {
      await scope.getByRole("button", { name: "閉じる" }).click();
      await scope.waitFor({ state: "hidden" });
    }
  }
  await configure("表示", "net");
  await p.locator(".recall-flat").waitFor();
  for (const n of [2, 3, 4]) {
    await configure("側面の数", String(n));
    assert.equal(await p.locator(".recall-flat [data-sticker]").count(), 9 + 3 * n);
    assert.equal(await p.locator('[data-sticker^="L"]').count(), n >= 3 ? 3 : 0);
    assert.equal(await p.locator('[data-sticker^="B"]').count(), n === 4 ? 3 : 0);
    const right = p.locator('[data-sticker="R0"]');
    assert.equal(await right.getAttribute("x"), "6");
    assert.equal(await right.getAttribute("y"), "5");
    if (n >= 3) {
      const left = p.locator('[data-sticker="L0"]');
      assert.equal(await left.getAttribute("x"), "2.54");
      assert.equal(await left.getAttribute("y"), "3");
    }
  }
  await configure("パターン", "F2L");
  await p.locator('.recall-flat [data-sticker="F8"]').waitFor({ state: "attached" });
  assert.equal(await p.locator(".recall-flat [data-sticker]").count(), 45);
  await configure("パターン", "ZBLL");
  await p.locator(".recall-flat").waitFor();
  assert.equal(await p.locator(".recall-flat [data-sticker]").count(), 21);
  assert.equal(await p.locator('.recall-flat [data-sticker="F3"]').count(), 0);
  await configure("AUF", "random");
  await p.getByRole("button", { name: "次のケース" }).click();
  await p.getByRole("button", { name: "答えを見る" }).click();
  assert.ok((await p.locator(".recall-answer span").innerText()).length > 1);
  await p.screenshot({
    path: `docs/screenshots/recall-auf-${viewport.width}.png`,
  });
  assert.ok(
    await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  assert.deepEqual(errors, []);
  await p.close();
}
await b.close();
console.log(
  "PASS: original 3D player, AUF, side rows, counts and responsive layouts",
);
