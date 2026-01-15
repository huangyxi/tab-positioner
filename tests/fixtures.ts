import { test as base, chromium, expect } from '@playwright/test';
import type { BrowserContext, Worker } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { type ExtensionSettings, SETTING_SCHEMAS } from '../src/shared/settings';

export { expect };
export type { ExtensionSettings };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Fixtures = {
	context: BrowserContext;
	extensionWorker: Worker;
	extensionOrigin: string;
	configureSettings: (settings: Partial<ExtensionSettings>) => Promise<void>;
	getTabs: () => Promise<api.tabs.Tab[]>;
};

export const test = base.extend<Fixtures>({
	context: async ({ }, use) => {
		const pathToExtension = path.join(__dirname, '../dist');
		const headless = JSON.parse(process.env.CI ?? 'false');
		const args = [
			`--disable-extensions-except=${pathToExtension}`,
			`--load-extension=${pathToExtension}`,
		];
		// Keep both the CLI headless flag and the context headless option; removing / modifying either breaks headless runs.
		if (headless) {
			args.push('--headless=new');
		}
		const context = await chromium.launchPersistentContext('', {
			headless: false,
			args,
		});
		const [extensionWorker] = context.serviceWorkers().length ? context.serviceWorkers() : [await context.waitForEvent('serviceworker')];

		extensionWorker.on('console', msg => {
			console.log(`  [EXTENSION][${msg.type()}] ${msg.text()}`);
		});

		// Wait for startup to complete before setting debug mode
		// This prevents a race condition where startup's saveSettings() overwrites our debug mode setting
		// We poll the session storage to determine when SyncSettings has completed initialization
		await extensionWorker.evaluate(async () => {
			const maxWaitMs = 2000;
			const pollIntervalMs = 50;
			const startTime = Date.now();

			while (Date.now() - startTime < maxWaitMs) {
				try {
					// Check if SyncSettings instance exists in session storage
					// The SessionSingleton base class stores a flag at 'ClassName:_instances'
					const sessionData = await chrome.storage.session.get('SyncSettings:_instances');
					if (sessionData['SyncSettings:_instances']) {
						// SyncSettings is initialized and has saved its state
						break;
					}
				} catch (e) {
					// Session storage might not be ready yet
				}
				await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
			}
		});

		// Set debug mode in storage - the storage change listener will update the DEBUG variable
		await extensionWorker.evaluate(async () => {
			await chrome.storage.sync.set({
				_debug_mode: true,
			} satisfies Partial<ExtensionSettings>);

			// Wait for the DEBUG variable to actually be updated
			// This is more reliable than a fixed timeout
			const maxWaitMs = 500;
			const pollIntervalMs = 10;
			const startTime = Date.now();

			while (Date.now() - startTime < maxWaitMs) {
				// Check if debug mode is actually enabled by checking storage
				const result = await chrome.storage.sync.get('_debug_mode');
				if (result._debug_mode === true) {
					// Give the storage listener a moment to process and update DEBUG
					await new Promise(resolve => setTimeout(resolve, 50));
					break;
				}
				await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
			}
		});
		await use(context);
		const coverage = await extensionWorker.evaluate(() => (self as any).__coverage__);
		if (coverage) {
			const coveragePath = path.join(__dirname, '../.nyc_output');
			await fs.mkdir(coveragePath, { recursive: true });
			await fs.writeFile(path.join(coveragePath, `coverage-${Date.now()}.json`), JSON.stringify(coverage));
		}
		await context.close();
	},
	extensionWorker: async ({ context }, use) => {
		const [serviceworker] = context.serviceWorkers();
		await use(serviceworker);
	},
	extensionOrigin: async ({ extensionWorker }, use) => {
		const extensionUri = extensionWorker.url(); // `chrome-extension://${extensionId}/background.js`;
		const extensionOrigin = extensionUri.split('/').slice(0, 3).join('/');
		await use(extensionOrigin);
	},
	configureSettings: async ({ context, extensionOrigin }, use) => {
		await use(async (settings: Partial<ExtensionSettings>) => {
			const extensionPage = await context.newPage();
			await extensionPage.goto(`${extensionOrigin}/options.html?context=page`);
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
	getTabs: async ({ extensionWorker }, use) => {
		await use(async () => {
			return await extensionWorker.evaluate(async () => {
				const tabs: api.tabs.Tab[] = await (self as any).chrome.tabs.query({ lastFocusedWindow: true });
				return tabs.sort((a: any, b: any) => a.index - b.index);
			});
		});
	},
});
