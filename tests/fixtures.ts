// tests/fixtures.ts
import { test as base, chromium, type BrowserContext, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { type ExtensionSettings } from '../src/shared/settings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
	context: BrowserContext;
	extensionId: string;
	configureSettings: (settings: Partial<ExtensionSettings>) => Promise<void>;
	getTabs: () => Promise<any[]>;
}>({
	context: async ({ }, use) => {
		const pathToExtension = path.join(__dirname, '../dist');
		const headless = process.env.CI !== 'false';
		const args = [
			`--disable-extensions-except=${pathToExtension}`,
			`--load-extension=${pathToExtension}`,
		];
		if (headless) {
			args.push('--headless=new');
		}

		const context = await chromium.launchPersistentContext('', {
			headless: false,
			args,
		});

		// Enable Debug Mode for improved coverage
		const [background] = context.serviceWorkers().length ? context.serviceWorkers() : [await context.waitForEvent('serviceworker')];
		await background.evaluate(() => {
			return new Promise<void>((resolve) => {
				(self as any).chrome.storage.sync.set({ '_debug_mode': true }, resolve);
			});
		});

		await use(context);

		if (process.env.COVERAGE) {
			const coverage = await context.serviceWorkers()[0].evaluate(() => (self as any).__coverage__);
			if (coverage) {
				const coveragePath = path.join(__dirname, '../.nyc_output');
				if (!fs.existsSync(coveragePath)) fs.mkdirSync(coveragePath);
				fs.writeFileSync(path.join(coveragePath, `coverage-${Date.now()}.json`), JSON.stringify(coverage));
			}
		}

		await context.close();
	},
	extensionId: async ({ context }, use) => {
		// for manifest v3:
		let [background] = context.serviceWorkers();
		if (!background)
			background = await context.waitForEvent('serviceworker');

		const extensionId = background.url().split('/')[2];
		await use(extensionId);
	},
	configureSettings: async ({ context, extensionId }, use) => {
		await use(async (settings: Partial<ExtensionSettings>) => {
			const extensionPage = await context.newPage();
			await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);

			for (const [key, value] of Object.entries(settings)) {
				// Handle advanced settings which are inside a details element
				if (key.startsWith('_')) {
					// Ensure advanced settings are visible
					const details = extensionPage.locator('details');
					if (await details.isVisible()) {
						if (!(await details.evaluate((el: HTMLDetailsElement) => el.open))) {
							await details.locator('summary').click();
						}
					}
				}

				if (typeof value === 'boolean') {
					await extensionPage.locator(`input[name="${key}"]`).setChecked(value);
				} else {
					await extensionPage.selectOption(`select[name="${key}"]`, String(value), { force: true });
				}
			}

			await extensionPage.close();
		});
	},
	getTabs: async ({ context }, use) => {
		await use(async () => {
			const [background] = context.serviceWorkers().length ? context.serviceWorkers() : [await context.waitForEvent('serviceworker')];
			return await background.evaluate(async () => {
				const tabs = await (self as any).chrome.tabs.query({ lastFocusedWindow: true });
				return tabs.sort((a: any, b: any) => a.index - b.index);
			});
		});
	},
});

export { expect };
