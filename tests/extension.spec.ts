// tests/extension.spec.ts
import { test, expect } from './fixtures';

test('Options page should load', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/options.html?context=page`);
	await expect(page).toHaveTitle('Tab Positioner Settings');
});

test('Popup should load', async ({ page, extensionId }) => {
	await page.goto(`chrome-extension://${extensionId}/options.html?context=popup`);
	// The popup shares the same title in this extension
	await expect(page).toHaveTitle('Tab Positioner Settings');
});
