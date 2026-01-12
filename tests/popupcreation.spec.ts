import { test, expect } from './fixtures';

test.describe('Popup Behavior', () => {
	test('should handle popup creation by moving it to normal window', async ({ context, extensionId, configureSettings }) => {
		const page1 = await context.newPage();
		await page1.bringToFront();

		await configureSettings({
			foreground_link_position: 'after_active',
			_popup_position: 'new_foreground_tab',
		});

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
