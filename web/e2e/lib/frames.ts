import type { Page } from '@playwright/test';

/**
 * Let the page draw two frames — or give up waiting after `capMs`.
 *
 * ⚠️ WHY THE CAP (Layer H4, 2026-09-19). Headless Firefox occasionally never fires
 * `requestAnimationFrame` at all, and an uncapped wait then hangs until the test's
 * own limit: the 112-width phone sweep of the ticker page ran past TEN MINUTES on
 * one width, while a timed rotation of the same page took 0.3–1.3s in Firefox
 * against 0.65–0.8s in Chromium. The page was never slow; the wait was unbounded.
 *
 * The cap is safe for what these waits are for. Every caller reads layout AFTER
 * waiting (`scrollX`, a bounding box), and reading layout forces it to be computed,
 * so a frame that never came costs nothing but the frame's own paint — which no
 * caller measures.
 */
export async function twoFrames(page: Page, capMs = 250): Promise<void> {
  await page.evaluate(
    (cap) =>
      new Promise<void>((resolve) => {
        const done = setTimeout(resolve, cap);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            clearTimeout(done);
            resolve();
          }),
        );
      }),
    capMs,
  );
}
