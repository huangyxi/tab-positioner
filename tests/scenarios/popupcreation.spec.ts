import { test, expect, type Fixtures, type ExtensionSettings } from '../fixtures';
import { PAGE, TEST_TIMEOUT } from '../constants';

async function verifyPopupPosition(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	expectedIndex: number,
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;
	const page1 = await context.newPage();
	await page1.goto(PAGE(1));
	await page1.bringToFront();

	await configureSettings(settings);

	// Open a popup
	const popupURI = PAGE('popup');
	const popupPromise = context.waitForEvent('page');
	await page1.evaluate((url) => {
		window.open(url, 'popup_window', 'popup=yes,width=400,height=400');
	}, popupURI);
	const popup = await popupPromise;

	// Wait for extension to handle it
	await page1.waitForTimeout(TEST_TIMEOUT);
	expect(popup).toBeTruthy();

	const tabs = (await getTabs()).filter(t => t.url?.includes(PAGE()));
	const popupTab = tabs.find(t => t.url?.includes(popupURI));
	const originalTab = tabs.find(t => t.url?.includes(PAGE(1)));

	expect(popupTab).toBeDefined();
	expect(tabs.length).toBeGreaterThanOrEqual(2);

	// Should be in the same window
	expect(popupTab?.windowId).toBe(originalTab?.windowId);
	expect(popupTab?.index).toBe(expectedIndex);

	await page1.close();
	if (!popup.isClosed()) await popup.close();
}

test.describe('Popup Behavior', () => {
	[
		{
			title: '_popup_position: new_foreground_tab -> window_first',
			settings: { _popup_position: 'new_foreground_tab', foreground_link_position: 'window_first' } as const,
			expectedIndex: 0,
		},
		// TODO: Fix this test case
		// {
		// 	title: '_popup_position: new_background_tab -> window_first',
		// 	settings: { _popup_position: 'new_background_tab', background_link_position: 'window_first' } as const,
		// 	expectedIndex: 0,
		// },
	].forEach(({ title, settings, expectedIndex }) => {
		test(title, async ({ context, configureSettings, getTabs }) => {
			await verifyPopupPosition(
				{ context, configureSettings, getTabs },
				settings,
				expectedIndex,
			);
		});
	});
});
