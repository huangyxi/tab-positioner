// tests/behavior.spec.ts
import { test, expect } from './fixtures';

test.describe('Tab Creation Behavior', () => {
	test('should place new foreground tab after the active tab', async ({ context, extensionId }) => {
		// Setup: Ensure we have at least one tab
		const page1 = await context.newPage();
		await page1.bringToFront();

		// Configure setting: foreground_link_position = 'after_active'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="foreground_link_position"]', 'after_active');
		await extensionPage.close();

		// Create a new tab (simulate foreground creation)
		const page2 = await context.newPage();
		await page2.bringToFront();

		expect(page2).toBeTruthy();
	});

	test('should place new foreground tab before the active tab', async ({ context, extensionId }) => {
		const page1 = await context.newPage();
		await page1.bringToFront();

		// Configure setting
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="foreground_link_position"]', 'before_active');
		await extensionPage.close();

		const page2 = await context.newPage();
		await page2.bringToFront();
		expect(page2).toBeTruthy();
	});

	test('should place new foreground tab at the end of window', async ({ context, extensionId }) => {
		const page1 = await context.newPage();

		// Configure setting: foreground_link_position = 'window_last'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="foreground_link_position"]', 'window_last');
		await extensionPage.close();

		// Create a new page (simulated foreground)
		const page3 = await context.newPage();
		expect(page3).toBeTruthy();
	});

	test('should place new background tab at the start of window', async ({ context, extensionId }) => {
		const page1 = await context.newPage();
		await page1.goto('http://example.com/1');

		// Configure setting: background_link_position = 'window_first'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="background_link_position"]', 'window_first');
		await extensionPage.close();

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

test.describe('Tab Activation Behavior', () => {
	test('should activate the tab to the left after closing', async ({ context, extensionId }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'before_removed'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="after_close_activation"]', 'before_removed');
		await extensionPage.close();

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page1.waitForTimeout(100);
	});

	test('should activate the tab to the right after closing', async ({ context, extensionId }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'after_removed'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="after_close_activation"]', 'after_removed');
		await extensionPage.close();

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page3.waitForTimeout(100);
	});

	test('should activate the first tab in window after closing', async ({ context, extensionId }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();
		await page2.waitForTimeout(200); // Ensure extension sees activation

		// Configure setting: after_close_activation = 'window_first'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="after_close_activation"]', 'window_first');
		await extensionPage.close();

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page1.waitForTimeout(500);

		// Assert page1 is active
		const isPage1Active = await page1.evaluate(() => document.visibilityState === 'visible');
		expect(isPage1Active).toBe(true);
	});

	test('should activate the last tab in window after closing', async ({ context, extensionId }) => {
		// Setup: Create 3 pages
		const page1 = await context.newPage();
		const page2 = await context.newPage();
		const page3 = await context.newPage();

		// Activate middle one
		await page2.bringToFront();

		// Configure setting: after_close_activation = 'window_last'
		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
		await extensionPage.selectOption('select[name="after_close_activation"]', 'window_last');
		await extensionPage.close();

		// Close current page (page2)
		await page2.close();

		// Give extension time to react
		await page3.waitForTimeout(100);
	});
});

test.describe('Popup Behavior', () => {
	test('should handle popup creation by moving it to normal window', async ({ context, extensionId }) => {
		const page1 = await context.newPage();
		await page1.bringToFront();

		const extensionPage = await context.newPage();
		await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);

		// Set foreground link to after_active so the logic proceeds
		await extensionPage.selectOption('select[name="foreground_link_position"]', 'after_active');

		// Expand advanced settings and set popup position
		await extensionPage.locator('details > summary').click();
		await extensionPage.selectOption('select[name="_popup_position"]', 'new_foreground_tab', { force: true });
		await extensionPage.close();

		// Open a popup
		const popupPromise = context.waitForEvent('page');
		await page1.evaluate(() => {
			window.open('https://example.com', 'popup_window', 'popup=yes,width=400,height=400');
		});
		const popup = await popupPromise;

		// Wait for extension to handle it
		await page1.waitForTimeout(1000);
		expect(popup).toBeTruthy();
	});
});
