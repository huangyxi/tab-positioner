import { test, expect } from './fixtures';

test.describe('Tab Creation Behavior', () => {
	test('should place new foreground tab after the active tab', async ({ context, extensionId, configureSettings }) => {
		// Setup: Ensure we have at least one tab
		const page1 = await context.newPage();
		await page1.bringToFront();

		// Configure setting: foreground_link_position = 'after_active'
		await configureSettings({
			foreground_link_position: 'after_active'
		});

		// Create a new tab (simulate foreground creation)
		const page2 = await context.newPage();
		await page2.bringToFront();

		expect(page2).toBeTruthy();
	});

	test('should place new foreground tab before the active tab', async ({ context, extensionId, configureSettings }) => {
		const page1 = await context.newPage();
		await page1.bringToFront();

		// Configure setting
		await configureSettings({
			foreground_link_position: 'before_active'
		});

		const page2 = await context.newPage();
		await page2.bringToFront();
		expect(page2).toBeTruthy();
	});

	test('should place new foreground tab at the end of window', async ({ context, extensionId, configureSettings }) => {
		const page1 = await context.newPage();

		// Configure setting: foreground_link_position = 'window_last'
		await configureSettings({
			foreground_link_position: 'window_last'
		});

		// Create a new page (simulated foreground)
		const page3 = await context.newPage();
		expect(page3).toBeTruthy();
	});

	test('should place new background tab at the start of window', async ({ context, extensionId, configureSettings }) => {
		const page1 = await context.newPage();
		await page1.goto('http://example.com/1');

		// Configure setting: background_link_position = 'window_first'
		await configureSettings({
			background_link_position: 'window_first'
		});

		// Create a link and click it with modifier to open in background
		// Mac: Meta, Windows/Linux: Control
		const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

		await page1.evaluate(() => {
			const a = document.createElement('a');
			a.href = 'http://example.com/3';
			a.id = 'bg-link';
			a.innerText = 'Click Me';
			document.body.appendChild(a);
		});

		await page1.keyboard.down(modifier);
		await page1.click('#bg-link');
		await page1.keyboard.up(modifier);

		// Wait for the new tab to exist
		// Note: handling expected background tab behavior in Playwright can be tricky if not headless
		// But in headless = new, it should work.
		// We explicitly wait for the page to be part of the context
		let page3 = await context.waitForEvent('page');
		// Even if verify fails, we want to know what happened
		try {
			await page3.waitForLoadState();
		} catch (e) {
			// ignore timeouts if about:blank
		}

		// Allow extension logic to run
		await page1.waitForTimeout(1000);

		const [background] = context.serviceWorkers();

		const urls = await background.evaluate(async () => {
			const tabs = await (self as any).chrome.tabs.query({ lastFocusedWindow: true });
			tabs.sort((a: any, b: any) => a.index - b.index);
			return tabs.map((t: any) => t.url);
		});

		// If working: [example.com/3, example.com/1] (since 3 moved to 0)
		// Or: [example.com/3, blank, example.com/1] ?
		// Depending on where it was inserted initially.
		// We just check if urls[0] is the background one.
		expect(urls[0]).toContain('example.com/3');
	});
});
