import { test, expect } from './fixtures';

test.describe('Popup Behavior', () => {
	test('should handle popup creation by moving it to normal window', async ({ context, extensionId }) => {
		const page1 = await context.newPage();
		await page1.bringToFront();

		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);

		// Set foreground link to after_active so the logic proceeds
		await extensionPage.selectOption('select[name="foreground_link_position"]', 'after_active');

		// Expand advanced settings and set popup position
		await extensionPage.locator('details > summary').click();
		await extensionPage.selectOption('select[name="_popup_position"]', 'new_foreground_tab', { force: true });
		await extensionPage.close();

		// Open a popup
		const popupPromise = context.waitForEvent('page');
		await page1.evaluate(() => {
			window.open('https://example.com', 'popup_window', 'popup=yes,width=400,height=400');
		});
		const popup = await popupPromise;

		// Wait for extension to handle it
		await page1.waitForTimeout(1000);
		expect(popup).toBeTruthy();
	});
});
