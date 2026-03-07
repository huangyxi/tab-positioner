import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { BrowserContext, Worker } from '@playwright/test';
import { chromium, test as base } from '@playwright/test';

import manifest from '../manifest.json' with { type: 'json' };
import type { ExtensionSettings } from '../src/shared/settings';
import test_manifest from './ext/manifest.json' with { type: 'json' };
import { ExtensionManager } from './utils/extensionmanager';
import { PageManager } from './utils/pagemanager';

export type { ExtensionSettings };
export type { PageId } from './utils/pagemanager';
export { expect } from './utils/pagemanager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Fixtures {
	context: BrowserContext;
	extensionManager: ExtensionManager;
	pageManager: PageManager;
}

const EXTENSION_SERVICE_WORKER = manifest.background.service_worker;
const TEST_SERVICE_WORKER = test_manifest.background.service_worker;

export function isExtensionUri(uri: string, serviceWorker: string = EXTENSION_SERVICE_WORKER): boolean {
	return uri.split('/').pop() === serviceWorker;
}

async function getExtensionWorker(
	context: BrowserContext,
	service_worker: string = EXTENSION_SERVICE_WORKER,
): Promise<Worker> {
	const serviceWorkers = context.serviceWorkers();
	let extensionWorker = serviceWorkers.find((sw) => isExtensionUri(sw.url(), service_worker));
	extensionWorker ??= await context.waitForEvent('serviceworker', (sw) => isExtensionUri(sw.url(), service_worker));
	return extensionWorker;
}

async function getTestWorker(context: BrowserContext): Promise<Worker> {
	return getExtensionWorker(context, TEST_SERVICE_WORKER);
}

export const test = base.extend<Fixtures>({
	context: async ({}, use) => {
		const pathToExtension = path.join(__dirname, '../dist');
		const pathToTestExtension = path.join(__dirname, 'ext');
		const headless: unknown = JSON.parse(process.env.CI ?? 'false');
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
		extensionWorker.on('console', (msg) => {
			console.log(`[EXTENSION][${msg.type()}] ${msg.text()}`);
		});

		const pages = context.pages();
		const extensionPage = await context.newPage();
		await extensionPage.goto(
			extensionWorker.url().replace(manifest.background.service_worker, manifest.options_page),
		);
		for (const page of pages) {
			await page.close();
		}
		await extensionPage.waitForLoadState();
		const debug_mode_setting: keyof ExtensionSettings = '_debug_mode';
		const debug_mode_element = extensionPage.locator(`input[name="${debug_mode_setting}"]`);
		await debug_mode_element.setChecked(true);

		await use(context);

		try {
			const coverage = await extensionWorker.evaluate(() => self.__coverage__ as unknown);
			if (coverage) {
				const coveragePath = path.join(__dirname, '../.nyc_output');
				await fs.mkdir(coveragePath, { recursive: true });
				await fs.writeFile(path.join(coveragePath, `coverage-${Date.now()}.json`), JSON.stringify(coverage));
			}
		} catch (error) {
			// Worker might have been terminated, skip coverage collection
			if (error instanceof Error && error.message.includes('Execution context was destroyed')) {
				console.log('[TEST] Skipping coverage collection - worker was terminated');
			} else {
				throw error;
			}
		}
		await context.close();
	},
	extensionManager: async ({ context }, use) => {
		const extensionWorker = await getExtensionWorker(context);
		await use(new ExtensionManager(context, extensionWorker));
	},
	pageManager: async ({ context }, use) => {
		const testWorker = await getTestWorker(context);
		await use(new PageManager(context, testWorker));
	},
});
