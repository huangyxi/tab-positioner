import type { ExtensionSettings, Fixtures, PageId } from '../fixtures';
import { expect, test } from '../fixtures';

async function verifyTabCreation(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	action: 'new_foreground' | 'new_background',
	// Initial: 0, 1(active), 2(from 1), 3.
	expectedOrder: PageId[],
) {
	const { extensionManager, pageManager } = fixtures as Fixtures;

	const _page0 = await pageManager.createPage(0);
	const page1 = await pageManager.createPage(1);
	const _page3 = await pageManager.createPage(3);

	// Open the PAGE2 from PAGE1's background link
	await page1.bringToFront();
	const _page2 = await pageManager.openLink(page1, 2, true);

	await extensionManager.configureSettings(settings);

	// RE-ACTIVATE after settings page closed
	await page1.bringToFront();
	await extensionManager.delayForActionCompletion();

	// test a new page's behavior
	const newPageId: PageId = 'new';
	switch (action) {
		case 'new_foreground':
			await pageManager.openLink(page1, newPageId);
			break;
		case 'new_background':
			await pageManager.openLink(page1, newPageId, true);
			break;
		default:
			const _exhaustive: never = action;
	}
	await extensionManager.delayForActionCompletion();

	// We expect the exact URLs in expectedOrder
	await expect(pageManager).toMatchPageIds(expectedOrder);
}

test.describe('Tab Creation Behavior', () => {
	[
		{
			title: 'foreground_link_position: after_active',
			settings: { foreground_link_position: 'after_active' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [
				0,
				1,
				'new',
				2,
				3,
			] as PageId[],
		},
		{
			title: 'foreground_link_position: before_active',
			settings: { foreground_link_position: 'before_active' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [
				0,
				'new',
				1,
				2,
				3,
			] as PageId[],
		},
		{
			title: 'foreground_link_position: window_last',
			settings: { foreground_link_position: 'window_last' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [
				0,
				1,
				2,
				3,
				'new',
			] as PageId[],
		},
		{
			title: 'background_link_position: window_first',
			settings: { background_link_position: 'window_first' } as const,
			action: 'new_background' as const,
			expectedOrder: [
				'new',
				0,
				1,
				2,
				3,
			] as PageId[],
		},
	].forEach(({ title, settings, action, expectedOrder }) => {
		test(title, async ({ extensionManager, pageManager }) => {
			await verifyTabCreation({ extensionManager, pageManager }, settings, action, expectedOrder);
		});
	});

	test('new_tab_position: after_active', async ({ extensionManager, pageManager }) => {
		const _page0 = await pageManager.createPage(0);
		const page1 = await pageManager.createPage(1);
		const _page2 = await pageManager.createPage(2);
		await page1.bringToFront();
		await extensionManager.configureSettings({ new_tab_position: 'after_active' }, true);
		const newPage = await pageManager.newTab();
		await extensionManager.delayForActionCompletion();
		await extensionManager.configureSettings(
			{
				new_tab_position: 'default',
				foreground_link_position: 'after_active',
			},
			true,
		);
		await pageManager.openLink(newPage, 'new', false);
		await extensionManager.delayForActionCompletion();
		await expect(pageManager).toMatchPageIds([
			0,
			1,
			'new',
			2,
		]);
	});

	test('Auto New Tab in the last collapsed group', async ({ context, extensionManager, pageManager }) => {
		const _page0 = await pageManager.createPage(0);
		const page1 = await pageManager.createPage(1);
		const _page2 = await pageManager.createPage(2);
		const groupId = await pageManager.createGroup([0, 1, 2]);
		await pageManager.closeNonTestPages();
		await page1.bringToFront();
		await extensionManager.configureSettings({ new_tab_position: 'after_active' }, true);
		const newPagePromise = context.waitForEvent('page');
		await pageManager.collapseGroup(groupId);
		const newPage = await newPagePromise;
		await extensionManager.delayForActionCompletion();
		await extensionManager.configureSettings({ foreground_link_position: 'after_active' }, true);
		await pageManager.openLink(newPage, 'new', false);
		await extensionManager.delayForActionCompletion();
		await expect(pageManager).toMatchPageIds([
			0,
			1,
			2,
			'new',
		]);
	});

	test('[IDLE] foreground_link_position: window_first', async ({ extensionManager, pageManager }) => {
		await extensionManager.configureSettings({ foreground_link_position: 'window_first' });
		const page0 = await pageManager.createPage(0);
		await extensionManager.idleExtensionWorker();
		const _page1 = await pageManager.openLink(page0, 1);
		await extensionManager.delayForActionCompletion();
		await expect(pageManager).toMatchPageIds([1, 0]);
	});

	test('[IDLE] background_link_position: window_first', async ({ extensionManager, pageManager }) => {
		await extensionManager.configureSettings({ background_link_position: 'window_first' });
		const page0 = await pageManager.createPage(0);
		await extensionManager.idleExtensionWorker();
		const _page1 = await pageManager.openLink(page0, 1, true);
		await extensionManager.delayForActionCompletion();
		await expect(pageManager).toMatchPageIds([1, 0]);
	});
});
