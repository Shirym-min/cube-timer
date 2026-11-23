import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL ?? "http://127.0.0.1:4173");
await page.waitForFunction(
  () => !document.querySelector(".scramble-text.loading"),
);
for (const event of [
  "333",
  "222",
  "444",
  "555",
  "666",
  "777",
  "333oh",
  "333bf",
  "444bf",
  "555bf",
  "333fm",
  "333mbf",
  "clock",
  "minx",
  "pyram",
  "skewb",
  "sq1",
]) {
  await page.getByLabel("種目", { exact: true }).selectOption(event);
  await page.waitForFunction(
    (e) => document.querySelector("#event")?.value === e,
    event,
  );
  await page.waitForTimeout(100);
  await page.waitForFunction(
    () => !document.querySelector(".scramble-text.loading"),
    null,
    { timeout: 90000 },
  );
  assert.ok((await page.locator(".scramble-text").innerText()).length > 8);
  assert.equal(await page.locator(".scramble-text [role=alert]").count(), 0);
  await page.locator("twisty-player").waitFor();
  await page.waitForTimeout(500);
  console.log(event, await page.locator(".scramble-text").innerText());
  if (["444", "clock", "minx", "sq1", "333mbf"].includes(event))
    await page.screenshot({
      path: `docs/screenshots/event-${event}.png`,
      fullPage: true,
    });
}
assert.deepEqual(errors, []);
console.log(
  "PASS: all 17 WCA events generated with 2D diagrams and no page errors",
);
await browser.close();
