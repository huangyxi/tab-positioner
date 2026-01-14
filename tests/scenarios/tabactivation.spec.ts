import { test, expect, type Fixtures, ExtensionSettings } from '../fixtures';
import { PAGE, TEST_TIMEOUT } from '../constants';

async function verifyTabActivation(
	fixtures: Partial<Fixtures>,
	activationSetting: ExtensionSettings['after_close_activation'],
	expectedActivePage: number,
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;

	await configureSettings({ after_close_activation: activationSetting });

	// 1. Create P1 first (safeguard)
	const page1 = await context.newPage(); await page1.goto(PAGE(1));

	// 2. Cleanup any initial pages (about:blank) to ensure P1 is index 0
	const pages = context.pages();
	for (const p of pages) {
		if (p !== page1) await p.close();
	}

	// 3. Create P2, P3
	const page2 = await context.newPage(); await page2.goto(PAGE(2));
	const page3 = await context.newPage(); await page3.goto(PAGE(3));

	// 4. Activate P2
	await page2.bringToFront();
	await page1.waitForTimeout(TEST_TIMEOUT); // Sync state

	// Verify P2 is active and correct setup
	let tabs = await getTabs();
	expect(tabs.find(t => t.url?.includes(PAGE(2)))?.active).toBe(true);
	expect(tabs.length).toBe(3);

	// 5. Close P2
	await page2.close();

	// 6. Wait for P2 to be gone from Chrome
	await expect.poll(async () => {
		const t = await getTabs();
		return t.find(x => x.url?.includes(PAGE(2)));
	}).toBeUndefined();

	// 7. Check Activation
	tabs = await getTabs();
	const activeTab = tabs.find(t => t.active);
	expect(activeTab).toBeDefined();
	expect(activeTab?.url).toContain(PAGE(expectedActivePage));
}

test.describe('Tab Activation Behavior', () => {
	[
		{
			title: 'after_close_activation: before_removed',
			activationSetting: 'before_removed' as const,
			expectedActivePage: 1,
		},
		{
			title: 'after_close_activation: after_removed',
			activationSetting: 'after_removed' as const,
			expectedActivePage: 3,
		},
		{
			title: 'after_close_activation: window_first',
			activationSetting: 'window_first' as const,
			expectedActivePage: 1,
		},
		{
			title: 'after_close_activation: window_last',
			activationSetting: 'window_last' as const,
			expectedActivePage: 3,
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
