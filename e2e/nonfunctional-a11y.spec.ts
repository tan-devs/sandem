import { test, expect } from '@playwright/test';

test.describe('Non-functional: accessibility smoke', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('home page exposes baseline semantic landmarks', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('domcontentloaded');

		const main = page.locator('main');
		await expect(main).toBeVisible({ timeout: 10000 });

		const headingsCount = await page.locator('h1, h2').count();
		expect(headingsCount).toBeGreaterThan(0);

		const linksWithoutText = await page.evaluate(() => {
			const links = Array.from(document.querySelectorAll('a'));
			return links.filter((link) => {
				const text = (link.textContent ?? '').trim();
				const aria = (link.getAttribute('aria-label') ?? '').trim();
				return text.length === 0 && aria.length === 0;
			}).length;
		});

		expect(linksWithoutText).toBe(0);
	});

	test('keyboard focus is visible for first interactive element', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Tab');

		const hasFocusedInteractiveElement = await page.evaluate(() => {
			const active = document.activeElement as HTMLElement | null;
			if (!active) return false;
			const interactive =
				active.tagName === 'A' ||
				active.tagName === 'BUTTON' ||
				active.tagName === 'INPUT' ||
				active.tabIndex >= 0;
			if (!interactive) return false;

			const style = window.getComputedStyle(active);
			const outlineVisible = style.outlineStyle !== 'none' && style.outlineWidth !== '0px';
			const boxShadowVisible = style.boxShadow !== 'none';
			return outlineVisible || boxShadowVisible;
		});

		expect(hasFocusedInteractiveElement).toBe(true);
	});
});
