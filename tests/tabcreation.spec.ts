import { test, expect } from './fixtures';
import { PAGE, TEST_TIMEOUT } from './constants';

test.describe('Tab Creation Behavior', () => {
	test('should place new foreground tab after the active tab', async ({ context, configureSettings, getTabs }) => {
		// Setup: Ensure we have at least one tab
		const page1 = await context.newPage();
		await page1.goto(PAGE(1));
		await page1.bringToFront();

		// Configure setting: foreground_link_position = 'after_active'
		await configureSettings({
			foreground_link_position: 'after_active'
		});

		// Create a new tab (simulate foreground creation)
		const page2 = await context.newPage();
		await page2.goto(PAGE(2));
		await page2.bringToFront();

		// Allow extension logic to run
		await page1.waitForTimeout(TEST_TIMEOUT);

		const tabs = await getTabs();
		// We expect page2 to be after page1
		// Since page1 was active, page2 should be at index of page1 + 1
		// Current tabs: [extension (bg?), page1, page2] or something.
		// Let's filter by url to be safe
		const testTabs = tabs.filter(t => t.url?.includes(PAGE()));
		expect(testTabs.length).toBe(2);
		expect(testTabs[0].url).toContain(PAGE(1));
		expect(testTabs[1].url).toContain(PAGE(2));
		expect(testTabs[1].index).toBeGreaterThan(testTabs[0].index);
	});

	test('should place new foreground tab before the active tab', async ({ context, extensionId, configureSettings, getTabs }) => {
		const page1 = await context.newPage();
		await page1.goto(PAGE(1));
		await page1.bringToFront();

		// Configure setting
		await configureSettings({
			foreground_link_position: 'before_active'
		});

		const page2 = await context.newPage();
		await page2.goto(PAGE(2));
		await page2.bringToFront();

		await page1.waitForTimeout(TEST_TIMEOUT);

		const tabs = await getTabs();
		const testTabs = tabs.filter(t => t.url?.includes(PAGE()));
		expect(testTabs.length).toBe(2);
		// Expect: [page2, page1]
		expect(testTabs[0].url).toContain(PAGE(2));
		expect(testTabs[1].url).toContain(PAGE(1));
		expect(testTabs[0].index).toBeLessThan(testTabs[1].index);
	});

	test('should place new foreground tab at the end of window', async ({ context, extensionId, configureSettings, getTabs }) => {
		const page1 = await context.newPage();
		await page1.goto(PAGE(1));

		// Configure setting: foreground_link_position = 'window_last'
		await configureSettings({
			foreground_link_position: 'window_last'
		});

		// Create a new page (simulated foreground)
		const page3 = await context.newPage();
		await page3.goto(PAGE(3));

		await page1.waitForTimeout(TEST_TIMEOUT);

		const tabs = await getTabs();
		const testTabs = tabs.filter(t => t.url?.includes(PAGE()));
		// Should be last
		const lastTab = testTabs[testTabs.length - 1];
		expect(lastTab.url).toContain(PAGE(3));
	});

	test('should place new background tab at the start of window', async ({ context, extensionId, configureSettings, getTabs }) => {
		const page1 = await context.newPage();
		await page1.goto(PAGE(1));

		// Configure setting: background_link_position = 'window_first'
		await configureSettings({
			background_link_position: 'window_first'
		});

		// Create a link and click it with modifier to open in background
		// Mac: Meta, Windows/Linux: Control
		const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

		await page1.evaluate((url) => {
			const a = document.createElement('a');
			a.href = url;
			a.id = 'bg-link';
			a.innerText = 'Click Me';
			document.body.appendChild(a);
		}, PAGE(3));

		await page1.keyboard.down(modifier);
		await page1.click('#bg-link');
		await page1.keyboard.up(modifier);

		// Wait for the new tab to exist
		let page3 = await context.waitForEvent('page');
		try {
			await page3.waitForLoadState();
		} catch (e) {
			// ignore timeouts if about:blank
		}

		// Allow extension logic to run
		await page1.waitForTimeout(TEST_TIMEOUT);

		const tabs = await getTabs();
		const testTabs = tabs.filter(t => t.url?.includes(PAGE()));

		// Expect: [page3, page1]
		expect(testTabs[0].url).toContain(PAGE(3));
		expect(testTabs[1].url).toContain(PAGE(1));
		expect(testTabs[0].index).toBeLessThan(testTabs[1].index);
	});
});
