import { test, expect } from '@playwright/test';

test.describe('Non-functional: security smoke', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('HTML responses include required WebContainer isolation headers', async ({ page }) => {
		const response = await page.goto('/');
		expect(response, 'Expected navigation response for /').not.toBeNull();
		expect(response?.status(), 'Expected successful status for /').toBe(200);

		const coep = response?.headers()['cross-origin-embedder-policy'];
		const coop = response?.headers()['cross-origin-opener-policy'];

		expect(coep).toBe('require-corp');
		expect(coop).toBe('same-origin');
	});

	test('auth API endpoint stays reachable and does not leak stack traces', async ({ page }) => {
		const response = await page.request.get('/api/auth/session');

		expect(response.status(), 'Expected auth session endpoint to stay reachable').toBeLessThan(500);

		const body = await response.text();
		expect(body).not.toContain('Error:');
		expect(body).not.toContain('at ');
		expect(body).not.toContain('node_modules');
	});
});
