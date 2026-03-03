import { test, type Fixtures, type ExtensionSettings } from '../fixtures';
import { expect, createPage, duplicateTab, openLink, type PageId } from '../helpers';
import { TEST_TIMEOUT_MS } from '../constants';

async function verifyTabDuplication(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	// Initial: 0, 1(active), 2(from 1), 3.
	duplicatePageId: PageId,
	expectedOrder: PageId[],
) {
	const { context, testWorker, configureSettings, getTabs } = fixtures as Fixtures;

	const _page0 = await createPage(context, 0);
	const page1 = await createPage(context, 1);
	const _page2 = await createPage(context, 2);
	const _page3 = await createPage(context, 3);

	await configureSettings(settings);

	// RE-ACTIVATE the target tab
	await page1.bringToFront();
	await page1.waitForTimeout(500);

	// Duplicate the specified tab
	const _duplicatedPage = await duplicateTab(context, testWorker, duplicatePageId);

	await page1.waitForTimeout(TEST_TIMEOUT_MS);

	// We expect the exact URLs in expectedOrder
	// The duplicated tab should have the same pageId as the original
	expect(await getTabs()).toMatchPageIds(expectedOrder);
}

test.describe('Tab Duplication Behavior', () => {
	[
		{
			title: '_duplicate_tab_position: default',
			settings: {
				_duplicate_tab_position: 'default',
			} satisfies Partial<ExtensionSettings>,
			duplicatePageId: 1,
			// Default Chrome behavior: duplicate appears right after the original
			expectedOrder: [
				0,
				1,
				1,
				2,
				3,
			],
		},
		{
			title: '_duplicate_tab_position: after_active',
			settings: {
				_duplicate_tab_position: 'after_active',
			} satisfies Partial<ExtensionSettings>,
			duplicatePageId: 1,
			// Duplicate appears right after currently active tab (1)
			expectedOrder: [
				0,
				1,
				1,
				2,
				3,
			],
		},
		{
			title: '_duplicate_tab_position: before_active',
			settings: {
				_duplicate_tab_position: 'before_active',
			} satisfies Partial<ExtensionSettings>,
			duplicatePageId: 1,
			// Duplicate appears right before currently active tab (1)
			expectedOrder: [
				0,
				1,
				1,
				2,
				3,
			],
		},
		{
			title: '_duplicate_tab_position: window_first',
			settings: {
				_duplicate_tab_position: 'window_first',
			} satisfies Partial<ExtensionSettings>,
			duplicatePageId: 1,
			// Duplicate appears at the beginning
			expectedOrder: [
				1,
				0,
				1,
				2,
				3,
			],
		},
		{
			title: '_duplicate_tab_position: window_last',
			settings: {
				_duplicate_tab_position: 'window_last',
			} satisfies Partial<ExtensionSettings>,
			duplicatePageId: 1,
			// Duplicate appears at the end
			expectedOrder: [
				0,
				1,
				2,
				3,
				1,
			],
		},
	].forEach(({ title, settings, duplicatePageId, expectedOrder }) => {
		test(title, async ({ context, testWorker, configureSettings, getTabs }) => {
			await verifyTabDuplication(
				{ context, testWorker, configureSettings, getTabs },
				settings,
				duplicatePageId,
				expectedOrder,
			);
		});
	});
});

async function verifyOpenLinkTwice(fixtures: Partial<Fixtures>, background: boolean) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;
	const _page0 = await createPage(context, 0);
	const page1 = await createPage(context, 1);
	// Current: [0, 1(active)]

	// Strategy: Link -> Start, Duplicate -> End
	await configureSettings({
		background_link_position: 'window_first',
		foreground_link_position: 'window_first',
		_duplicate_tab_position: 'window_last',
	});

	// 1. Open Link 2
	// Should be treated as LINK -> window_first
	await openLink(page1, 2, background);
	// Expect: [2, 0, 1] (Background order) or [2(active), 0, 1] (Foreground order)
	// In both cases, page 2 is at index 0.
	expect(await getTabs()).toMatchPageIds([2, 0, 1]);
	if (!background) {
		expect(await getTabs()).toMatchActiveTab(2);
	}

	// 2. Open Link 2 AGAIN
	if (!background) {
		// Go back to Page 1 to open link again
		await page1.bringToFront();
		await page1.waitForTimeout(200);
	}

	// Should be treated as LINK -> window_first
	// If treated as DUPLICATE -> window_last
	await openLink(page1, 2, background);

	// Expect Link behavior: [2, 2, 0, 1] (New 2 is at index 0)
	expect(await getTabs()).toMatchPageIds([
		2,
		2,
		0,
		1,
	]);
	if (!background) {
		expect(await getTabs()).toMatchActiveTab(2); // The new one
	}
}

test.describe('Distinguish Duplicate vs Open Link Twice', () => {
	test('Open Background Link Twice', async ({ context, configureSettings, getTabs, testWorker }) => {
		await verifyOpenLinkTwice({ context, configureSettings, getTabs, testWorker }, true);
	});

	test('Open Foreground Link Twice', async ({ context, configureSettings, getTabs, testWorker }) => {
		await verifyOpenLinkTwice({ context, configureSettings, getTabs, testWorker }, false);
	});
});
