import { test, expect, type Page } from "@playwright/test";

async function login(page: Page, name: string) {
  await page.goto(`/auth/test-login?name=${encodeURIComponent(name)}&id=u-${name.toLowerCase()}`);
  await expect(page).toHaveURL("/");
}

async function currentTime(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const p = (window as unknown as { __lastPlayer?: { currentTime: () => number } }).__lastPlayer;
    return p ? p.currentTime() : -1;
  });
}

test("two participants countdown and play in sync within 200ms", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  try {
    const aPage = await aCtx.newPage();
    const bPage = await bCtx.newPage();

    await login(aPage, "Alice");
    await login(bPage, "Bob");

    await expect(aPage.locator(".countdown")).toBeVisible({ timeout: 15_000 });
    await expect(bPage.locator(".countdown")).toBeVisible({ timeout: 15_000 });

    await aPage.waitForSelector("iframe[src*='youtube.com/embed/fPO76Jlnz6c']", { timeout: 30_000 });
    await bPage.waitForSelector("iframe[src*='youtube.com/embed/fPO76Jlnz6c']", { timeout: 30_000 });

    // Wait for playback to advance past T0 in both pages.
    // COUNTDOWN_SECONDS=10, so wait at least 12s after the iframe appears.
    await aPage.waitForTimeout(12_000);

    const ta = await currentTime(aPage);
    const tb = await currentTime(bPage);
    expect(ta, "Alice playhead").toBeGreaterThan(0);
    expect(tb, "Bob playhead").toBeGreaterThan(0);
    expect(Math.abs(ta - tb)).toBeLessThan(0.2);
  } finally {
    await aCtx.close();
    await bCtx.close();
  }
});

test("public grid (no login) shows participants' tiles with names", async ({ browser }) => {
  const aCtx = await browser.newContext();
  const bCtx = await browser.newContext();
  const gCtx = await browser.newContext();
  try {
    const aPage = await aCtx.newPage();
    const bPage = await bCtx.newPage();
    const gPage = await gCtx.newPage();

    await login(aPage, "Alice2");
    await login(bPage, "Bob2");
    await gPage.goto("/grid");
    await expect(gPage.locator("text=Alice2")).toBeVisible({ timeout: 15_000 });
    await expect(gPage.locator("text=Bob2")).toBeVisible({ timeout: 15_000 });
  } finally {
    await aCtx.close();
    await bCtx.close();
    await gCtx.close();
  }
});
