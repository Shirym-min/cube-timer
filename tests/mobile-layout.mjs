import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
for(const viewport of [{width:390,height:844},{width:375,height:667},{width:320,height:568}]){
 const page=await browser.newPage({viewport,hasTouch:true,isMobile:true});
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('.scramble-sequence')?.textContent.length>10);
 if(viewport.height>=650) assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'timer page must fit');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
 let timer=await page.locator('.timer-touch').boundingBox();assert.ok(timer.y>=0 && timer.y+timer.height<viewport.height-59);
 await page.screenshot({path:`docs/screenshots/mobile-timer-${viewport.width}.png`});
 await page.locator('.diagram twisty-player').waitFor();await page.getByRole('button',{name:'ヒント',exact:true}).click();await page.locator('.hint-result').waitFor({timeout:30000});
 await page.getByRole('button',{name:'ヒントを閉じる'}).click();
 await page.getByRole('combobox',{name:'種目',exact:true}).selectOption('777');await page.waitForTimeout(200);await page.waitForFunction(()=>!document.querySelector('.scramble-text.loading'),null,{timeout:90000});
 if(viewport.height>=650) assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1),'long scramble must not expand page');
 const scramble=page.locator('.scramble-text');assert.ok(await scramble.evaluate(e=>e.scrollHeight>e.clientHeight),'long scramble remains scrollable');
 await page.close();
}
console.log('PASS: mobile timer fits, short screens reflow, long scrambles scroll locally, diagram and hints remain accessible.');await browser.close();
