import { test, type Fixtures, type ExtensionSettings } from '../fixtures';
import { expect, createPage, openPopup, idleExtensionWorker, type PageId } from '../helpers';
import { TEST_TIMEOUT_MS } from '../constants';

async function verifyPopupPosition(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	expectedIndex: number,
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;
	const page0 = await createPage(context, 0);

	await configureSettings(settings);
	await page0.waitForTimeout(TEST_TIMEOUT_MS);

	const popupPageId: PageId = 'popup';
	const popup = await openPopup(page0, popupPageId);
	await page0.waitForTimeout(TEST_TIMEOUT_MS);

	// Check that tabs are in expected order
	const expectedOrder: PageId[] = [0];
	expectedOrder.splice(expectedIndex, 0, popupPageId);
	await expect(await getTabs()).toMatchPageIds(expectedOrder);
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
		{
			title: '_popup_position: new_background_tab -> window_first',
			settings: { _popup_position: 'new_background_tab', background_link_position: 'window_first' } as const,
			expectedIndex: 0,
		},
	].forEach(({ title, settings, expectedIndex }) => {
		test(title, async ({ context, configureSettings, getTabs }) => {
			await verifyPopupPosition(
				{ context, configureSettings, getTabs },
				settings,
				expectedIndex,
			);
		});
	});


	test('[IDLE] popup_position: new_foreground_tab -> window_first', async ({ context, configureSettings, getTabs }) => {
		await configureSettings({ _popup_position: 'new_foreground_tab', foreground_link_position: 'window_first' });
		const page0 = await createPage(context, 0);
		await idleExtensionWorker(context);
		const popup = await openPopup(page0, 1);
		await page0.waitForTimeout(TEST_TIMEOUT_MS);
		expect(await getTabs()).toMatchPageIds([1, 0]);
		if (!popup.isClosed()) await popup.close();
	});
});
