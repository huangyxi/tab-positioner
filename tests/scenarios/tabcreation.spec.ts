import { test, type Fixtures, type ExtensionSettings } from '../fixtures';
import { TEST_TIMEOUT_MS } from '../constants';
import { createPage, openForegroundLink, openBackgroundLink, expectTabOrder, filterTestTabs, type PageId } from '../helpers';

async function verifyTabCreation(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	action: 'new_foreground' | 'new_background',
	// Initial: 0, 1(active), 2(from 1), 3.
	expectedOrder: PageId[],
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;

	const page0 = await createPage(context, 0);
	const page1 = await createPage(context, 1);
	const page3 = await createPage(context, 3);

	// Open the PAGE2 from PAGE1's background link
	await page1.bringToFront();
	const page2 = await openBackgroundLink(page1, 2, 'setup-link');

	await configureSettings(settings);

	// RE-ACTIVATE after settings page closed
	await page1.bringToFront();
	await page1.waitForTimeout(500);

	// test a new page's behavior
	const newPageId: PageId = 'new';
	if (action === 'new_foreground') {
		await openForegroundLink(page1, newPageId);
	} else if (action === 'new_background') {
		await openBackgroundLink(page1, newPageId);
	}

	await page1.waitForTimeout(TEST_TIMEOUT_MS);

	const tabs = await getTabs();
	// Filter to only test tabs
	const testTabs = filterTestTabs(tabs);

	// We expect the exact URLs in expectedOrder
	expectTabOrder(testTabs, expectedOrder);
}

test.describe('Tab Creation Behavior', () => {
	[
		{
			title: 'foreground_link_position: after_active',
			settings: { foreground_link_position: 'after_active' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [0, 1, 'new', 2, 3] as PageId[],
		},
		{
			title: 'foreground_link_position: before_active',
			settings: { foreground_link_position: 'before_active' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [0, 'new', 1, 2, 3] as PageId[],
		},
		{
			title: 'foreground_link_position: window_last',
			settings: { foreground_link_position: 'window_last' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [0, 1, 2, 3, 'new'] as PageId[],
		},
		{
			title: 'background_link_position: window_first',
			settings: { background_link_position: 'window_first' } as const,
			action: 'new_background' as const,
			expectedOrder: ['new', 0, 1, 2, 3] as PageId[],
		}
	].forEach(({ title, settings, action, expectedOrder }) => {
		test(title, async ({ context, configureSettings, getTabs }) => {
			await verifyTabCreation(
				{ context, configureSettings, getTabs },
				settings,
				action,
				expectedOrder,
			);
		});
	});
});
