import { test, expect } from './fixtures';

test('Options page should load', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/options.html?context=page`);
	expect(page).toBeTruthy();
});

test('Popup should load', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/options.html?context=popup`);
	expect(page).toBeTruthy();
});
