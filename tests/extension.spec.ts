import { test, expect } from './fixtures';

test('Options page should load', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/options.html?context=page`);
	await page.waitForLoadState('domcontentloaded');
	expect(page.url()).toContain('options.html?context=page');
	const controls = page.locator('form [name]');
	expect(await controls.count()).toBeGreaterThan(0);
	await expect(controls.first()).toBeVisible();
});

test('Popup should load', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/options.html?context=popup`);
	await page.waitForLoadState('domcontentloaded');
	expect(page.url()).toContain('options.html?context=popup');
	const controls = page.locator('form [name]');
	expect(await controls.count()).toBeGreaterThan(0);
	await expect(controls.first()).toBeVisible();
});
