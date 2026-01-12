// tests/fixtures.ts
import { test as base, chromium, type BrowserContext, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const test = base.extend<{
	context: BrowserContext;
	extensionId: string;
}>({
	context: async ({ }, use) => {
		const pathToExtension = path.join(__dirname, '../dist');
		const headless = process.env.HEADLESS === 'true' || !!process.env.CI;
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
});

export { expect };
