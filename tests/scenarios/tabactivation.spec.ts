import { test, expect, type Fixtures, ExtensionSettings } from '../fixtures';
import { TEST_TIMEOUT_MS } from '../constants';
import { createPage, expectActiveTab, findTabByPage, type PageId } from '../helpers';

async function verifyTabActivation(
	fixtures: Partial<Fixtures>,
	activationSetting: ExtensionSettings['after_close_activation'],
	expectedActivePage: PageId,
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;

	await configureSettings({ after_close_activation: activationSetting });

	// 1. Create P0 first (safeguard)
	const page0 = await createPage(context, 0);

	// 2. Cleanup any initial pages (about:blank) to ensure P0 is index 0
	const pages = context.pages();
	for (const p of pages) {
		if (p !== page0) await p.close();
	}

	// 3. Create P1, P2
	const page1 = await createPage(context, 1);
	const page2 = await createPage(context, 2);

	// 4. Activate P1
	await page1.bringToFront();
	await page0.waitForTimeout(TEST_TIMEOUT_MS); // Sync state

	// Verify P1 is active and correct setup
	let tabs = await getTabs();
	expectActiveTab(tabs, 1);

	// 5. Close P1
	await page1.close();

	// 6. Wait for P1 to be gone from Chrome
	await expect.poll(async () => {
		const t = await getTabs();
		return findTabByPage(t, 1);
	}).toBeUndefined();

	// 7. Check Activation
	tabs = await getTabs();
	expectActiveTab(tabs, expectedActivePage);
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
		}
	].forEach(({ title, activationSetting, expectedActivePage }) => {
		test(title, async ({ context, configureSettings, getTabs }) => {
			await verifyTabActivation(
				{ context, configureSettings, getTabs },
				activationSetting,
				expectedActivePage,
			);
		});
	});
});
