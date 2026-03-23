import { test, expect } from '@playwright/test';

test.describe('Non-functional: performance smoke', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('home page interactive timing is within a smoke budget', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const timing = await page.evaluate(() => {
			const navEntries = performance.getEntriesByType(
				'navigation'
			) as PerformanceNavigationTiming[];
			const nav = navEntries[0];

			if (!nav) {
				return {
					domContentLoadedMs: Number.POSITIVE_INFINITY,
					loadEventMs: Number.POSITIVE_INFINITY,
					firstPaintMs: Number.POSITIVE_INFINITY
				};
			}

			const paintEntries = performance.getEntriesByType('paint');
			const firstPaint = paintEntries.find((entry) => entry.name === 'first-paint');

			return {
				domContentLoadedMs: nav.domContentLoadedEventEnd,
				loadEventMs: nav.loadEventEnd,
				firstPaintMs: firstPaint?.startTime ?? Number.POSITIVE_INFINITY
			};
		});

		expect(timing.firstPaintMs).toBeLessThan(7000);
		expect(timing.domContentLoadedMs).toBeLessThan(10000);
		expect(timing.loadEventMs).toBeLessThan(15000);
	});
});
