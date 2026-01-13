import { test, expect, type Fixtures, type ExtensionSettings } from './fixtures';
import { PAGE, TEST_TIMEOUT } from './constants';

async function verifyTabCreation(
	fixtures: Partial<Fixtures>,
	settings: Partial<ExtensionSettings>,
	action: 'new_foreground' | 'new_background',
	// Initial: 0, 1(active), 2(from 1), 3.
	expectedOrder: string[],
) {
	const { context, configureSettings, getTabs } = fixtures as Fixtures;

	const page0 = await context.newPage(); await page0.goto(PAGE(0));
	const page1 = await context.newPage(); await page1.goto(PAGE(1));
	const page3 = await context.newPage(); await page3.goto(PAGE(3));

	// Open the PAGE2 from PAGE1's background link
	await page1.bringToFront();
	const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
	await page1.evaluate((url) => {
		const a = document.createElement('a');
		a.href = url;
		a.id = 'setup-link';
		a.innerText = 'Setup P2';
		document.body.appendChild(a);
	}, PAGE(2));

	await page1.keyboard.down(modifier);
	await page1.click('#setup-link');
	await page1.keyboard.up(modifier);

	const page2 = await context.waitForEvent('page');
	// Wait for background tab to be somewhat ready
	try { await page2.waitForLoadState(); } catch (e) { }

	await configureSettings(settings);

	// RE-ACTIVATE after settings page closed
	await page1.bringToFront();
	await page1.waitForTimeout(500);

	// test a new PAGE()'s behavior
	const newUrl = PAGE('new');
	if (action === 'new_foreground') {
		await page1.evaluate((url) => {
			const a = document.createElement('a');
			a.href = url;
			a.target = '_blank';
			a.id = 'fg-link';
			a.innerText = 'FG Link';
			document.body.appendChild(a);
		}, newUrl);
		await page1.click('#fg-link');
		const newPage = await context.waitForEvent('page');
		await newPage.waitForLoadState();
	} else if (action === 'new_background') {
		await page1.evaluate((url) => {
			const a = document.createElement('a');
			a.href = url;
			a.id = 'bg-link';
			a.innerText = 'Click Me';
			document.body.appendChild(a);
		}, newUrl);

		await page1.keyboard.down(modifier);
		await page1.click('#bg-link');
		await page1.keyboard.up(modifier);

		const newPage = await context.waitForEvent('page');
		try { await newPage.waitForLoadState(); } catch (e) { }
	}

	await page1.waitForTimeout(TEST_TIMEOUT);

	const tabs = await getTabs();
	// Filter to only test tabs
	const testTabs = tabs.filter(t => t.url?.includes(PAGE()));

	// We expect the exact URLs in expectedOrder
	expect(testTabs.length).toBe(expectedOrder.length);
	testTabs.forEach((tab, index) => {
		expect(tab.url).toContain(expectedOrder[index]);
	});
}

test.describe('Tab Creation Behavior', () => {
	[
		{
			title: 'foreground_link_position: after_active',
			settings: { foreground_link_position: 'after_active' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [PAGE(0), PAGE(1), PAGE('new'), PAGE(2), PAGE(3)],
		},
		{
			title: 'foreground_link_position: before_active',
			settings: { foreground_link_position: 'before_active' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [PAGE(0), PAGE('new'), PAGE(1), PAGE(2), PAGE(3)],
		},
		{
			title: 'foreground_link_position: window_last',
			settings: { foreground_link_position: 'window_last' } as const,
			action: 'new_foreground' as const,
			expectedOrder: [PAGE(0), PAGE(1), PAGE(2), PAGE(3), PAGE('new')],
		},
		{
			title: 'background_link_position: after_active',
			settings: { background_link_position: 'window_first' } as const,
			action: 'new_background' as const,
			expectedOrder: [PAGE('new'), PAGE(0), PAGE(1), PAGE(2), PAGE(3)],
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
