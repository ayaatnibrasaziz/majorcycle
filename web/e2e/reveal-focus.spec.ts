import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { revealFocused } from '../lib/revealFocus';

/**
 * A keyboard reader's focus stays in sight inside a box that scrolls sideways
 * (lib/revealFocus.ts). Found on PR #128's CI: on Linux fonts the screener's
 * "Current DD%" ⓘ sat 1px inside the table's clip edge at 768px, Chromium does not
 * scroll a control that is already partly showing, and the focus ended up in a
 * control nobody could see. Credential-free: the real function, in a real browser.
 */

const PAGE = `
<style>
  .wrap { width: 500px; overflow-x: auto; border: 1px solid #ccc; }
  .row { display: flex; width: 2000px; }
  .cell { flex: none; width: 100px; padding: 4px; }
  button { width: 16px; height: 16px; padding: 0; }
</style>
<div class="wrap"><div class="row">
  ${Array.from({ length: 20 }, (_, i) => `<div class="cell">c${i}<button id="b${i}">i</button></div>`).join('')}
</div></div>`;

/** Put b6 `inside` px past the clip edge, focus b5, Tab, and report how much of b6 shows. */
async function tabToSliver(page: Page, inside: number, withRule: boolean): Promise<number> {
  await page.setContent(PAGE);
  if (withRule) {
    await page.evaluate((src) => {
      const reveal = new Function(`return (${src})`)() as (t: EventTarget | null) => void;
      document.addEventListener('focusin', (e) => reveal(e.target));
    }, revealFocused.toString());
  }
  await page.evaluate((off) => {
    const w = document.querySelector('.wrap') as HTMLElement;
    const clipRight = w.getBoundingClientRect().left + w.clientLeft + w.clientWidth;
    w.scrollLeft += document.getElementById('b6')!.getBoundingClientRect().left - (clipRight - off);
    (document.getElementById('b5') as HTMLElement).focus();
  }, inside);
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const w = document.querySelector('.wrap') as HTMLElement;
    const clipRight = w.getBoundingClientRect().left + w.clientLeft + w.clientWidth;
    const b = document.getElementById('b6')!.getBoundingClientRect();
    return Math.max(0, Math.min(b.right, clipRight) - b.left);
  });
}

test('a control focused at the very edge of a sideways box is brought fully into view', async ({ page }) => {
  for (const inside of [1, 4, 8]) {
    expect(await tabToSliver(page, inside, true), `${inside}px showing before Tab`).toBeGreaterThanOrEqual(15.5);
  }
});

test('CONTROL: without the rule, Chromium leaves it as a sliver', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'the defect being guarded is Chromium behaviour');
  expect(await tabToSliver(page, 1, false)).toBeLessThan(2);
});

test('both builds mount the rule: the site and the downloadable report', () => {
  const code = (p: string) =>
    readFileSync(join(__dirname, '..', p), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
  expect(code('app/layout.tsx')).toMatch(/<RevealFocus\s*\/>/);
  expect(code('report-bundle/entry.tsx')).toMatch(/<RevealFocus\s*\/>/);
});
