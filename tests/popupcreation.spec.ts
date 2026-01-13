import { test, expect } from './fixtures';
import { PAGE, TEST_TIMEOUT } from './constants';

test.describe('Popup Behavior', () => {
	test('should handle popup creation by moving it to normal window', async ({ context, configureSettings, getTabs }) => {
		const page1 = await context.newPage();
		await page1.bringToFront();

		await configureSettings({
			foreground_link_position: 'after_active',
			_popup_position: 'new_foreground_tab',
		});

		// Open a popup
		const popupPromise = context.waitForEvent('page');
		await page1.evaluate((url) => {
			window.open(url, 'popup_window', 'popup=yes,width=400,height=400');
		}, PAGE());
		const popup = await popupPromise;

		// Wait for extension to handle it
		await page1.waitForTimeout(TEST_TIMEOUT);
		expect(popup).toBeTruthy();

		const tabs = await getTabs();
		// If working, popup should be merged into the window.
		// Tab count should be 3 (page1, options(if open?), popup) or 2 (page1, popup) if options was closed or not considered.
		// configureSettings closes options page.
		// So we expect: page1 + popup.
		// Check that popup url is there.
		const popupTab = tabs.find(t => t.url?.includes(PAGE()));
		expect(popupTab).toBeDefined();
		expect(popupTab?.windowId).toBe(tabs[0].windowId); // Should be same window
	});
});
