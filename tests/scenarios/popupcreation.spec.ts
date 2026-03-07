import { TEST_TIMEOUT_MS } from '../constants';
import type { ExtensionSettings, Fixtures, PageId } from '../fixtures';
import { expect, test } from '../fixtures';

async function verifyPopupPosition(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	expectedIndex: number,
) {
	const { extensionManager, pageManager } = fixtures as Fixtures;
	const page0 = await pageManager.createPage(0);

	await extensionManager.configureSettings(settings);
	await page0.waitForTimeout(TEST_TIMEOUT_MS);

	const popupPageId: PageId = 'popup';
	const popup = await pageManager.openPopup(page0, popupPageId);
	await page0.waitForTimeout(TEST_TIMEOUT_MS);

	// Check that tabs are in expected order
	const expectedOrder: PageId[] = [0];
	expectedOrder.splice(expectedIndex, 0, popupPageId);
	await expect(pageManager).toMatchPageIds(expectedOrder);
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
		test(title, async ({ extensionManager, pageManager }) => {
			await verifyPopupPosition({ extensionManager, pageManager }, settings, expectedIndex);
		});
	});

	test('[IDLE] popup_position: new_foreground_tab -> window_first', async ({ extensionManager, pageManager }) => {
		await extensionManager.configureSettings({
			_popup_position: 'new_foreground_tab',
			foreground_link_position: 'window_first',
		});
		const page0 = await pageManager.createPage(0);
		await pageManager.idleExtensionWorker();
		const popup = await pageManager.openPopup(page0, 1);
		await page0.waitForTimeout(TEST_TIMEOUT_MS);
		await expect(pageManager).toMatchPageIds([1, 0]);
		if (!popup.isClosed()) await popup.close();
	});
});
