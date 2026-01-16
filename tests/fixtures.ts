import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { test as base, chromium } from '@playwright/test';
import type { BrowserContext, Worker, Page } from '@playwright/test';

import { type ExtensionSettings, SETTING_SCHEMAS } from '../src/shared/settings';
import manifest from '../manifest.json' with { type: 'json' };
import test_manifest from './ext/manifest.json' with { type: 'json' };

export type { ExtensionSettings };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Fixtures = {
	context: BrowserContext;
	extensionOrigin: string;
	extensionPage: Page;
	testWorker: Worker;
	configureSettings: (settings: Partial<ExtensionSettings>) => Promise<void>;
	getTabs: () => Promise<chrome.tabs.Tab[]>;
};

const EXTENSION_SERVICE_WORKER = manifest.background.service_worker;
const TEST_SERVICE_WORKER = test_manifest.background.service_worker;

export function isExtensionUri(
	uri: string,
	service_worker: string = EXTENSION_SERVICE_WORKER,
): boolean {
	return uri.split('/').pop() === service_worker;
}

async function getExtensionWorker(
	context: BrowserContext,
	service_worker: string = EXTENSION_SERVICE_WORKER,
): Promise<Worker> {
	const serviceWorkers = context.serviceWorkers();
	let extensionWorker = serviceWorkers.find(sw => isExtensionUri(sw.url()));
	if (!extensionWorker) {
		extensionWorker = await context.waitForEvent('serviceworker', sw => sw.url().includes(manifest.background.service_worker));
	}
	return extensionWorker;
}

async function getTestWorker(context: BrowserContext): Promise<Worker> {
	return getExtensionWorker(context, TEST_SERVICE_WORKER);
}


export const test = base.extend<Fixtures>({
	context: async ({ }, use) => {
		const pathToExtension = path.join(__dirname, '../dist');
		const pathToTestExtension = path.join(__dirname, 'ext');
		const headless = JSON.parse(process.env.CI ?? 'false');
		const args = [
			`--disable-extensions-except=${pathToExtension},${pathToTestExtension}`,
			`--load-extension=${pathToExtension},${pathToTestExtension}`,
		];
		// Keep both the CLI headless flag and the context headless option; removing / modifying either breaks headless runs.
		if (headless) {
			args.push('--headless=new');
		}
		const context = await chromium.launchPersistentContext('', {
			headless: false,
			args,
		});
		const extensionWorker = await getExtensionWorker(context);
		extensionWorker.on('console', msg => {
			console.log(`[EXTENSION][${msg.type()}] ${msg.text()}`);
		});

		const pages = context.pages();
		const extensionPage = await context.newPage();
		await extensionPage.goto(extensionWorker.url().replace(manifest.background.service_worker, manifest.options_page));
		for (const page of pages) {
			await page.close();
		}
		await extensionPage.waitForLoadState();
		const debug_mode_setting: keyof ExtensionSettings = '_debug_mode';
		const debug_mode_element = extensionPage.locator(
			`input[name="${debug_mode_setting}"]`
		);
		await debug_mode_element.setChecked(true);

		await use(context);

		try {
			const coverage = await extensionWorker.evaluate(() => (self as any).__coverage__);
			if (coverage) {
				const coveragePath = path.join(__dirname, '../.nyc_output');
				await fs.mkdir(coveragePath, { recursive: true });
				await fs.writeFile(path.join(coveragePath, `coverage-${Date.now()}.json`), JSON.stringify(coverage));
			}
		} catch (error: any) {
			// Worker might have been terminated, skip coverage collection
			if (error.message?.includes('Execution context was destroyed')) {
				console.log('[TEST] Skipping coverage collection - worker was terminated');
			} else {
				throw error;
			}
		}
		await context.close();
	},
	extensionOrigin: async ({ context }, use) => {
		const extensionWorker = await getExtensionWorker(context);
		const extensionUri = extensionWorker.url(); // `chrome-extension://${extensionId}/background.js`;
		const extensionOrigin = extensionUri.split('/').slice(0, 3).join('/');
		await use(extensionOrigin);
	},
	extensionPage: async ({ context, extensionOrigin }, use) => {
		const extensionPage = context.pages().find(
			tab => tab.url().startsWith(extensionOrigin)
		) ?? await context.newPage();
		if (!extensionPage.url().startsWith(extensionOrigin)) {
			await extensionPage.goto(`${extensionOrigin}/${manifest.options_page}`);
		}
		await use(extensionPage);
	},
	testWorker: async ({ context }, use) => {
		const testWorker = await getTestWorker(context);
		await use(testWorker);
	},
	configureSettings: async ({ context, extensionPage, extensionOrigin }, use) => {
		await use(async (settings: Partial<ExtensionSettings>) => {
			let hasExtensionPage = !extensionPage.isClosed();
			if (!hasExtensionPage) {
				extensionPage = await context.newPage();
				await extensionPage.goto(`${extensionOrigin}/${manifest.options_page}`);
				await extensionPage.waitForLoadState();
			}
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
			if (!hasExtensionPage) {
				await extensionPage.close();
			}
		});
	},
	getTabs: async ({ testWorker }, use) => {
		await use(async () => {
			const tabs: chrome.tabs.Tab[] = await testWorker.evaluate(async () => {
				return await chrome.tabs.query({});
			});
			return tabs;
		});
	}
});
