import { test } from './fixtures';
import { expect } from './fixtures';

test('Options page should load', async ({ context, extensionManager }) => {
	const page = await context.newPage();
	await page.goto(extensionManager.getOptionsPageUri());
	await page.waitForLoadState('domcontentloaded');
	const controls = page.locator('form [name]');
	expect(await controls.count()).toBeGreaterThan(0);
	await expect(controls.first()).toBeVisible();
});

test('Popup should load', async ({ context, extensionManager }) => {
	const page = await context.newPage();
	await page.goto(extensionManager.getPopupUri());
	await page.waitForLoadState('domcontentloaded');
	const controls = page.locator('form [name]');
	expect(await controls.count()).toBeGreaterThan(0);
	await expect(controls.first()).toBeVisible();
});
