import type { ExtensionSettings, Fixtures, PageId } from '../fixtures';
import { expect, test } from '../fixtures';

async function verifyTabActivation(
	fixtures: Partial<Fixtures>,
	activationSetting: ExtensionSettings['after_close_activation'],
	expectedActivePage: PageId,
) {
	const { extensionManager, pageManager } = fixtures as Fixtures;

	// Create P0 first (safeguard)
	const _page0 = await pageManager.createPage(0);
	await pageManager.closeNonTestPages();

	await extensionManager.configureSettings({ after_close_activation: activationSetting });
	const page1 = await pageManager.createPage(1);
	const _page2 = await pageManager.createPage(2);
	await page1.bringToFront();

	await page1.close();
	await extensionManager.delayForActionCompletion(); // Sync state

	await expect(pageManager).toMatchActiveTab(expectedActivePage);
}

test.describe('Tab Activation Behavior', () => {
	[
		{
			title: 'after_close_activation: before_removed',
			activationSetting: 'before_removed' as const,
			expectedActivePage: 0,
		},
		{
			title: 'after_close_activation: after_removed',
			activationSetting: 'after_removed' as const,
			expectedActivePage: 2,
		},
		{
			title: 'after_close_activation: window_first',
			activationSetting: 'window_first' as const,
			expectedActivePage: 0,
		},
		{
			title: 'after_close_activation: window_last',
			activationSetting: 'window_last' as const,
			expectedActivePage: 2,
		},
	].forEach(({ title, activationSetting, expectedActivePage }) => {
		test(title, async ({ extensionManager, pageManager }) => {
			await verifyTabActivation({ extensionManager, pageManager }, activationSetting, expectedActivePage);
		});
	});
});
