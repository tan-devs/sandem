import { test, expect } from '@playwright/test';

test.describe('Non-functional: visual smoke', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('home page renders non-empty screenshot output', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');

		const shot = await page.screenshot({ fullPage: true });
		expect(shot.byteLength).toBeGreaterThan(25_000);
	});

	test('repo page shows either editor or runtime recovery shell', async ({ page }) => {
		await page.goto('/repo');

		const editor = page.locator('.monaco-editor').first();
		const recovery = page.locator('[data-testid="runtime-recovery-ui"]').first();

		await expect
			.poll(
				async () => {
					const editorVisible = await editor.isVisible().catch(() => false);
					const recoveryVisible = await recovery.isVisible().catch(() => false);
					return editorVisible || recoveryVisible;
				},
				{ timeout: 30000 }
			)
			.toBe(true);
	});
});
