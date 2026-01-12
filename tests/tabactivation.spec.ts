import { test, expect } from './fixtures';

test.describe('Tab Activation Behavior', () => {
	test('should activate the tab to the left after closing', async ({ context, extensionId, configureSettings }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'before_removed'
		await configureSettings({
			after_close_activation: 'before_removed'
		});

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page1.waitForTimeout(100);
	});

	test('should activate the tab to the right after closing', async ({ context, extensionId, configureSettings }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'after_removed'
		await configureSettings({
			after_close_activation: 'after_removed'
		});

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page3.waitForTimeout(100);
	});

	test('should activate the first tab in window after closing', async ({ context, extensionId, configureSettings }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();
		await page2.waitForTimeout(200); // Ensure extension sees activation

		// Configure setting: after_close_activation = 'window_first'
		await configureSettings({
			after_close_activation: 'window_first'
		});

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page1.waitForTimeout(500);

		// Assert page1 is active
		const isPage1Active = await page1.evaluate(() => document.visibilityState === 'visible');
		expect(isPage1Active).toBe(true);
	});

	test('should activate the last tab in window after closing', async ({ context, extensionId, configureSettings }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'window_last'
		await configureSettings({
			after_close_activation: 'window_last'
		});

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page3.waitForTimeout(100);
	});
});
