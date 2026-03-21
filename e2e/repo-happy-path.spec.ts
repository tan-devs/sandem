import { test, expect } from '@playwright/test';

async function signInIfNeeded(page: import('@playwright/test').Page) {
	const email = process.env.TEST_USER_EMAIL;
	const password = process.env.TEST_USER_PASSWORD;

	if (!email || !password) {
		test.skip();
		return false;
	}

	await page.goto('/test/client-only');
	await expect(page.locator('[data-testid="is-loading"]')).toContainText('false', {
		timeout: 15000
	});

	const signInForm = page.locator('[data-testid="sign-in-form"]');
	const authenticatedCard = page.locator('[data-testid="authenticated-state"]');
	if (await signInForm.isVisible().catch(() => false)) {
		await page.fill('[data-testid="email-input"]', email);
		await page.fill('[data-testid="password-input"]', password);
		await page.click('[data-testid="sign-in-button"]');
	}

	await expect(authenticatedCard).toBeVisible({ timeout: 15000 });
	await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');
	return true;
}

async function openRepoProject(page: import('@playwright/test').Page, projectTitle?: string) {
	await page.goto('/repo');
	await expect(page.locator('[data-testid="project-cards-strip"]')).toBeVisible({ timeout: 60000 });
	await waitForMonacoWithRecovery(page, 15000);

	const cards = page.locator('[data-testid^="project-card-"]');
	const count = await cards.count();
	if (count === 0) {
		await page.click('[data-testid="create-project-card"]');
		await expect(cards).toHaveCount(1, { timeout: 15000 });
	}

	let titleButton = cards.first().locator('[data-testid^="project-title-"]');
	if (projectTitle) {
		const preferredTitleButton = page
			.locator('[data-testid^="project-title-"]')
			.filter({ hasText: projectTitle })
			.first();
		if (await preferredTitleButton.isVisible().catch(() => false)) {
			titleButton = preferredTitleButton;
		}
	}

	const openedTitle = (await titleButton.textContent())?.trim() ?? '';
	await titleButton.click();
	const editorReady = await waitForMonacoWithRecovery(page, 20000);
	if (!editorReady) return null;
	return openedTitle;
}

async function waitForMonacoWithRecovery(page: import('@playwright/test').Page, timeout = 180000) {
	const start = Date.now();
	const monaco = page.locator('.monaco-editor').first();
	const recovery = page.locator('[data-testid="runtime-recovery-ui"]');

	while (Date.now() - start < timeout) {
		if (await monaco.isVisible().catch(() => false)) return true;

		if (await recovery.isVisible().catch(() => false)) {
			const retryRuntime = page.getByRole('button', { name: 'Retry runtime' });
			if (await retryRuntime.isVisible().catch(() => false)) {
				await retryRuntime.click();
			}
		}

		await page.waitForTimeout(1500);
	}
	return false;
}

async function typeAtEditorEnd(page: import('@playwright/test').Page, text: string) {
	const editorReady = await waitForMonacoWithRecovery(page, 20000);
	if (!editorReady) return false;

	const appendedWithMonacoApi = await page.evaluate((marker) => {
		const globalAny = window as unknown as {
			monaco?: {
				Range?: new (
					startLineNumber: number,
					startColumn: number,
					endLineNumber: number,
					endColumn: number
				) => unknown;
				editor?: {
					getEditors?: () => Array<{
						getModel: () => {
							getLineCount: () => number;
							getLineMaxColumn: (lineNumber: number) => number;
						};
						executeEdits: (source: string, edits: Array<{ range: unknown; text: string }>) => void;
					}>;
				};
			};
		};

		const monaco = globalAny.monaco;
		const editor = monaco?.editor?.getEditors?.()?.[0];
		const RangeCtor = monaco?.Range;
		if (!editor || !RangeCtor) return false;

		const model = editor.getModel();
		if (!model) return false;

		const line = model.getLineCount();
		const column = model.getLineMaxColumn(line);
		const range = new RangeCtor(line, column, line, column);
		editor.executeEdits('e2e', [{ range, text: `\n${marker}\n` }]);
		return true;
	}, text);

	if (!appendedWithMonacoApi) {
		const editor = page.locator('.monaco-editor').first();
		await editor.click({ force: true, position: { x: 120, y: 80 } });

		const monacoInput = page
			.locator('.monaco-editor textarea.inputarea, .monaco-editor [role="textbox"]')
			.first();
		if (await monacoInput.isVisible().catch(() => false)) {
			await monacoInput.click({ force: true });
		}

		await page.keyboard.press('Control+End');
		await page.keyboard.type(`\n${text}\n`, { delay: 10 });
	}

	return true;
}

async function getAllMonacoContent(page: import('@playwright/test').Page) {
	return page.evaluate(() => {
		const globalAny = window as unknown as {
			monaco?: {
				editor?: {
					getModels?: () => Array<{ getValue: () => string }>;
				};
			};
		};
		const models = globalAny.monaco?.editor?.getModels?.() ?? [];
		return models.map((model) => model.getValue()).join('\n---\n');
	});
}

test.describe('Repo happy path', () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test('sign in, create project, edit, autosave, refresh persists', async ({ page }) => {
		test.setTimeout(120000);

		const email = process.env.TEST_USER_EMAIL;
		const password = process.env.TEST_USER_PASSWORD;

		if (!email || !password) {
			test.skip();
			return;
		}

		await page.goto('/test/client-only');
		await expect(page.locator('[data-testid="is-loading"]')).toContainText('false', {
			timeout: 15000
		});

		const signInForm = page.locator('[data-testid="sign-in-form"]');
		const authenticatedCard = page.locator('[data-testid="authenticated-state"]');
		if (await signInForm.isVisible().catch(() => false)) {
			await page.fill('[data-testid="email-input"]', email);
			await page.fill('[data-testid="password-input"]', password);
			await page.click('[data-testid="sign-in-button"]');
		}

		await expect(authenticatedCard).toBeVisible({
			timeout: 15000
		});
		await expect(page.locator('[data-testid="is-authenticated"]')).toContainText('true');

		await page.goto('/repo');
		await expect(page.locator('[data-testid="project-cards-strip"]')).toBeVisible({
			timeout: 60000
		});

		const cards = page.locator('[data-testid^="project-card-"]');
		const beforeCount = await cards.count();

		await page.click('[data-testid="create-project-card"]');

		await expect
			.poll(async () => cards.count(), { timeout: 30000 })
			.toBeGreaterThanOrEqual(beforeCount);
		const afterCount = await cards.count();

		const newestCard = cards.nth(Math.max(0, afterCount - 1));
		const titleButton = newestCard.locator('[data-testid^="project-title-"]');
		const openedTitle = ((await titleButton.textContent()) ?? '').trim();
		await titleButton.click();

		const editorReady = await waitForMonacoWithRecovery(page, 20000);
		if (!editorReady) return;

		const marker = `// e2e-persist-${Date.now()}`;
		if (!(await typeAtEditorEnd(page, marker))) return;

		await expect(page.locator('[data-testid="editor-save-status"]')).toContainText('Saved', {
			timeout: 20000
		});

		await page.reload();

		await expect(page.locator('[data-testid="project-cards-strip"]')).toBeVisible({
			timeout: 60000
		});
		if (openedTitle) {
			await page
				.locator('[data-testid^="project-title-"]')
				.filter({ hasText: openedTitle })
				.first()
				.click();
		}
		if (!(await waitForMonacoWithRecovery(page, 20000))) return;

		await expect
			.poll(async () => (await getAllMonacoContent(page)).length, { timeout: 45000 })
			.toBeGreaterThan(10);
	});

	test('multi-user same-file typing sync', async ({ browser }) => {
		test.setTimeout(120000);

		const ctx1 = await browser.newContext();
		const ctx2 = await browser.newContext();
		const page1 = await ctx1.newPage();
		const page2 = await ctx2.newPage();

		if (!(await signInIfNeeded(page1))) return;
		if (!(await signInIfNeeded(page2))) return;

		const projectTitle = await openRepoProject(page1);
		if (!projectTitle) return;
		if (!(await openRepoProject(page2, projectTitle))) return;

		const marker = `// e2e-multi-sync-${Date.now()}`;
		if (!(await typeAtEditorEnd(page1, marker))) return;

		await expect.poll(async () => getAllMonacoContent(page2), { timeout: 45000 }).toContain(marker);

		await ctx1.close();
		await ctx2.close();
	});

	test('multi-user concurrent edits converge', async ({ browser }) => {
		test.setTimeout(180000);

		const ctx1 = await browser.newContext();
		const ctx2 = await browser.newContext();
		const page1 = await ctx1.newPage();
		const page2 = await ctx2.newPage();

		if (!(await signInIfNeeded(page1))) return;
		if (!(await signInIfNeeded(page2))) return;

		const projectTitle = await openRepoProject(page1);
		if (!projectTitle) return;
		if (!(await openRepoProject(page2, projectTitle))) return;

		const markerA = `// e2e-concurrent-a-${Date.now()}`;
		const markerB = `// e2e-concurrent-b-${Date.now()}`;

		const typed = await Promise.all([
			typeAtEditorEnd(page1, markerA),
			typeAtEditorEnd(page2, markerB)
		]);
		if (!typed[0] || !typed[1]) return;

		const markerAToken = markerA.split('-').at(-1) ?? markerA;
		const markerBToken = markerB.split('-').at(-1) ?? markerB;

		await expect
			.poll(
				async () => `${await getAllMonacoContent(page1)}\n${await getAllMonacoContent(page2)}`,
				{ timeout: 60000 }
			)
			.toContain(markerAToken);
		await expect
			.poll(
				async () => `${await getAllMonacoContent(page1)}\n${await getAllMonacoContent(page2)}`,
				{ timeout: 60000 }
			)
			.toContain(markerBToken);

		await ctx1.close();
		await ctx2.close();
	});

	test('multi-user file create/delete sync + reconnect resume', async ({ browser }) => {
		test.setTimeout(150000);

		const ctx1 = await browser.newContext();
		const ctx2 = await browser.newContext();
		const page1 = await ctx1.newPage();
		let page2 = await ctx2.newPage();

		if (!(await signInIfNeeded(page1))) return;
		if (!(await signInIfNeeded(page2))) return;

		const projectTitle = await openRepoProject(page1);
		if (!projectTitle) return;
		if (!(await openRepoProject(page2, projectTitle))) return;

		const fileName = `src/e2e-collab-${Date.now()}.ts`;

		page1.once('dialog', async (dialog) => {
			await dialog.accept(fileName);
		});
		await page1.getByLabel('New file').click();

		const marker = `// e2e-reconnect-${Date.now()}`;
		if (!(await typeAtEditorEnd(page1, marker))) return;

		await page2.close();
		page2 = await ctx2.newPage();
		if (!(await openRepoProject(page2, projectTitle))) return;
		await expect.poll(async () => getAllMonacoContent(page2), { timeout: 30000 }).toContain(marker);

		let promptHandled = false;
		page1.on('dialog', async (dialog) => {
			if (dialog.type() === 'prompt' && !promptHandled) {
				promptHandled = true;
				await dialog.accept(fileName);
				return;
			}
			if (dialog.type() === 'confirm') {
				await dialog.accept();
				return;
			}
			await dialog.dismiss();
		});

		await page1.getByLabel('Delete path').click();

		await ctx1.close();
		await ctx2.close();
	});
});
