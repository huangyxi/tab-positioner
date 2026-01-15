import { test, expect, type Fixtures, type ExtensionSettings } from '../fixtures';
import { TEST_TIMEOUT_MS } from '../constants';
import { createPage, openPopup, filterTestTabs, expectTabOrder, type PageId } from '../helpers';

async function verifyPopupPosition(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	expectedIndex: number,
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;
	const page0 = await createPage(context, 0);
	await page0.bringToFront();

	await configureSettings(settings);

	// Open a popup
	const popupPageId: PageId = 'popup';
	const popup = await openPopup(page0, popupPageId);

	// Wait for extension to handle it
	await page0.waitForTimeout(TEST_TIMEOUT_MS);
	expect(popup).toBeTruthy();

	const tabs = filterTestTabs(await getTabs());

	// Check that tabs are in expected order
	const expectedOrder: PageId[] = [0];
	expectedOrder.splice(expectedIndex, 0, popupPageId);
	expectTabOrder(tabs, expectedOrder);

	await page0.close();
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
