import { test, expect } from '@playwright/test';

test.describe('Mobile Safari (iPhone) Compatibility Tests', () => {
  test('Mobile Safari opens successfully and renders login UI', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(`[PAGE_ERROR] ${err.name}: ${err.message}\n${err.stack}`);
    });

    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBe(200);

    // Wait for React to mount and hydrate
    await page.waitForTimeout(3000);

    // Check no page errors occurred
    expect(errors).toHaveLength(0);

    // Verify main auth container or workspace is present
    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(100);

    // Verify login inputs are accessible
    const emailInput = page.locator('input#email, input[type="email"], input[type="text"]').first();
    await expect(emailInput).toBeVisible();

    // Verify Arabic text rendering (الغربية or كيان EYE)
    const hasArabicText = await page.evaluate(() => {
      return document.body.innerText.includes('الغربية') || document.body.innerText.includes('EYE');
    });
    expect(hasArabicText).toBe(true);
  });

  test('Simulated Safari Private Browsing (Storage throwing SecurityError) loads seamlessly', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', err => {
      errors.push(`[PAGE_ERROR] ${err.name}: ${err.message}\n${err.stack}`);
    });

    // Injects a script before any page scripts to simulate strict Private Browsing
    await page.addInitScript(() => {
      const throwSecurityError = () => {
        const err = new Error('The operation is insecure.');
        err.name = 'SecurityError';
        throw err;
      };
      try {
        Object.defineProperty(window, 'localStorage', {
          get: throwSecurityError,
          configurable: true,
        });
      } catch {}
      try {
        Object.defineProperty(window, 'sessionStorage', {
          get: throwSecurityError,
          configurable: true,
        });
      } catch {}
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const rootHtml = await page.locator('#root').innerHTML();
    expect(rootHtml.length).toBeGreaterThan(100);
    expect(errors).toHaveLength(0);
  });
});
