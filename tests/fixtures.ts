import { test as base, chromium, expect } from '@playwright/test';
import type { BrowserContext, Worker } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { type ExtensionSettings, SETTING_SCHEMAS } from '../src/shared/settings';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
	context: BrowserContext;
	background: Worker;
	extensionId: string;
	configureSettings: (settings: Partial<ExtensionSettings>) => Promise<void>;
	getTabs: () => Promise<api.tabs.Tab[]>;
}>({
	context: async ({ }, use) => {
		const pathToExtension = path.join(__dirname, '../dist');
		const headless = JSON.parse(process.env.CI ?? 'false');
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
		const [background] = context.serviceWorkers().length ? context.serviceWorkers() : [await context.waitForEvent('serviceworker')];
		await background.evaluate(() => {
			return new Promise<void>((resolve) => {
				(self as any).chrome.storage.sync.set({ '_debug_mode': true } satisfies Partial<ExtensionSettings>, resolve);
			});
		});
		await use(context);
		const coverage = await context.serviceWorkers()[0].evaluate(() => (self as any).__coverage__);
		if (coverage) {
			const coveragePath = path.join(__dirname, '../.nyc_output');
			if (!(await fs.stat(coveragePath)).isDirectory()) {
				await fs.mkdir(coveragePath);
			}
			await fs.writeFile(path.join(coveragePath, `coverage-${Date.now()}.json`), JSON.stringify(coverage));
		}
		await context.close();
	},
	background: async ({ context }, use) => {
		const [serviceworker] = context.serviceWorkers().length ? context.serviceWorkers() : [await context.waitForEvent('serviceworker')];
		await use(serviceworker);
	},
	extensionId: async ({ background }, use) => {
		const extensionId = background.url().split('/')[2];
		await use(extensionId);
	},
	configureSettings: async ({ context, extensionId }, use) => {
		await use(async (settings: Partial<ExtensionSettings>) => {
			const extensionPage = await context.newPage();
			await extensionPage.goto(`chrome-extension://${extensionId}/options.html?context=page`);
			for (const [key, value] of Object.entries(settings)) {
				if (key.startsWith('_')) {
					const details = extensionPage.locator('details');
					if (await details.isVisible()) {
						if (!(await details.evaluate((el: HTMLDetailsElement) => el.open))) {
							await details.locator('summary').click();
						}
					}
				}
				switch (SETTING_SCHEMAS[key as keyof ExtensionSettings].type) {
					case 'boolean':
						await extensionPage.locator(`input[name="${key}"]`).setChecked(value as boolean);
						break;
					case 'number':
						await extensionPage.fill(`input[name="${key}"]`, String(value as number));
						break;
					case 'choices':
						await extensionPage.selectOption(`select[name="${key}"]`, String(value), { force: true });
						break;
					default:
						throw new Error(`Unsupported setting type for key: ${key}`);
				}
			}
			await extensionPage.close();
		});
	},
	getTabs: async ({ background }, use) => {
		await use(async () => {
			return await background.evaluate(async () => {
				const tabs: api.tabs.Tab[] = await (self as any).chrome.tabs.query({ lastFocusedWindow: true });
				return tabs.sort((a: any, b: any) => a.index - b.index);
			});
		});
	},
});

export { expect };
