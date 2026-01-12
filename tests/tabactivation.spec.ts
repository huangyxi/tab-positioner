import { test, expect } from './fixtures';
import { TEST_TIMEOUT } from './constants';

test.describe('Tab Activation Behavior', () => {

	test('should activate the tab to the left after closing', async ({ context, configureSettings, getTabs }) => {
		await configureSettings({ after_close_activation: 'before_removed' });

		// 1. Create P1 first (safeguard)
		const page1 = await context.newPage(); await page1.goto('http://example.com/1');

		// 2. Cleanup any initial pages (about:blank) to ensure P1 is index 0
		const pages = context.pages();
		for (const p of pages) {
			if (p !== page1) await p.close();
		}

		// 3. Create P2, P3
		const page2 = await context.newPage(); await page2.goto('http://example.com/2');
		const page3 = await context.newPage(); await page3.goto('http://example.com/3');

		// 4. Activate P2
		await page2.bringToFront();
		await page1.waitForTimeout(TEST_TIMEOUT); // Sync state

		// Verify P2 is active and correct setup
		let tabs = await getTabs();
		expect(tabs.find(t => t.url.includes('example.com/2'))?.active).toBe(true);
		expect(tabs.length).toBe(3);

		// 5. Close P2
		await page2.close();

		// 6. Wait for P2 to be gone from Chrome
		await expect.poll(async () => {
			const t = await getTabs();
			return t.find(x => x.url.includes('example.com/2'));
		}).toBeUndefined();

		// 7. Check Activation (Expect P1 - "before_removed")
		// P1 should be index 0
		tabs = await getTabs();
		const activeTab = tabs.find(t => t.active);
		expect(activeTab).toBeDefined();
		expect(activeTab?.url).toContain('example.com/1');
	});

	test('should activate the tab to the right after closing', async ({ context, configureSettings, getTabs }) => {
		await configureSettings({ after_close_activation: 'after_removed' });

		const page1 = await context.newPage(); await page1.goto('http://example.com/1');
		for (const p of context.pages()) { if (p !== page1) await p.close(); }

		const page2 = await context.newPage(); await page2.goto('http://example.com/2');
		const page3 = await context.newPage(); await page3.goto('http://example.com/3');

		await page2.bringToFront();
		await page1.waitForTimeout(TEST_TIMEOUT);

		let activeCheck = await getTabs();
		expect(activeCheck.find(t => t.url.includes('/2'))?.active).toBe(true);

		await page2.close();

		await expect.poll(async () => {
			const t = await getTabs();
			return t.find(x => x.url.includes('example.com/2'));
		}).toBeUndefined();

		const tabs = await getTabs();
		// Expect P3 (Right of P2)
		const activeTab = tabs.find(t => t.active);
		expect(activeTab).toBeDefined();
		expect(activeTab?.url).toContain('example.com/3');
	});

	test('should activate the first tab in window after closing', async ({ context, configureSettings, getTabs }) => {
		await configureSettings({ after_close_activation: 'window_first' });

		const page1 = await context.newPage(); await page1.goto('http://example.com/1');
		for (const p of context.pages()) { if (p !== page1) await p.close(); }

		const page2 = await context.newPage(); await page2.goto('http://example.com/2');
		const page3 = await context.newPage(); await page3.goto('http://example.com/3');

		await page2.bringToFront();
		await page1.waitForTimeout(TEST_TIMEOUT);

		await page2.close();

		await expect.poll(async () => {
			const t = await getTabs();
			return t.find(x => x.url.includes('example.com/2'));
		}).toBeUndefined();

		const tabs = await getTabs();
		// Expect P1 (Index 0)
		const activeTab = tabs.find(t => t.active);
		expect(activeTab).toBeDefined();
		expect(activeTab?.url).toContain('example.com/1');
	});

	test('should activate the last tab in window after closing', async ({ context, configureSettings, getTabs }) => {
		await configureSettings({ after_close_activation: 'window_last' });

		const page1 = await context.newPage(); await page1.goto('http://example.com/1');
		for (const p of context.pages()) { if (p !== page1) await p.close(); }

		const page2 = await context.newPage(); await page2.goto('http://example.com/2');
		const page3 = await context.newPage(); await page3.goto('http://example.com/3');

		await page2.bringToFront();
		await page1.waitForTimeout(TEST_TIMEOUT);

		await page2.close();

		await expect.poll(async () => {
			const t = await getTabs();
			return t.find(x => x.url.includes('example.com/2'));
		}).toBeUndefined();

		const tabs = await getTabs();
		// Expect P3 (Last Index)
		const activeTab = tabs.find(t => t.active);
		expect(activeTab).toBeDefined();
		expect(activeTab?.url).toContain('example.com/3');
	});
});
