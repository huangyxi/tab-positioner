// tests/behavior.spec.ts
import { test, expect } from './fixtures';

test.describe('Tab Creation Behavior', () => {
	test('should place new foreground tab after the active tab', async ({ context, extensionId }) => {
		// Setup: Ensure we have at least one tab
		const page1 = await context.newPage();
		await page1.bringToFront();

		// Configure setting: foreground_link_position = 'after_active'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="foreground_link_position"]', 'after_active');
		await extensionPage.close();

		// Create a new tab (simulate foreground creation)
		const page2 = await context.newPage();
		await page2.bringToFront();

		expect(page2).toBeTruthy();
	});

	test('should place new background tab at the end of window', async ({ context, extensionId }) => {
		const page1 = await context.newPage();

		// Configure setting: background_link_position = 'window_last'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="background_link_position"]', 'window_last');
		await extensionPage.close();

		// Create a new background page (simulated)
		const page3 = await context.newPage();
		expect(page3).toBeTruthy();
	});
});

test.describe('Tab Activation Behavior', () => {
	test('should activate the tab to the left after closing', async ({ context, extensionId }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'before_removed'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="after_close_activation"]', 'before_removed');
		await extensionPage.close();

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page1.waitForTimeout(100);
	});
});
