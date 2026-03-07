import type { BrowserContext, Page, Worker } from '@playwright/test';

import manifest from '../../manifest.json' with { type: 'json' };
import { SETTING_SCHEMAS } from '../../src/shared/settings';
import type { ExtensionSettings } from '../fixtures';
import { isExtensionUri } from '../fixtures';

export class ExtensionManager {
	private readonly context: BrowserContext;
	private readonly extensionWorker: Worker;

	constructor(context: BrowserContext, extensionWorker: Worker) {
		this.context = context;
		this.extensionWorker = extensionWorker;
	}

	private getOrigin(): string {
		return this.extensionWorker.url().split('/').slice(0, 3).join('/');
	}

	public getOptionsPageUri(): string {
		return this.getOrigin() + '/' + manifest.options_page;
	}

	public getPopupUri(): string {
		return this.getOrigin() + '/' + manifest.action.default_popup;
	}

	private async gotoOptionsPage(): Promise<{
		optionsPage: Page;
		hasOptionsPage: boolean;
	}> {
		const optionsPage =
			this.context.pages().find((tab) => tab.url() == this.getOptionsPageUri()) ?? (await this.context.newPage());
		const hasOptionsPage = optionsPage.url() == this.getOptionsPageUri();
		if (!hasOptionsPage) {
			await optionsPage.goto(
				this.extensionWorker.url().replace(manifest.background.service_worker, manifest.options_page),
			);
			await optionsPage.waitForLoadState();
		}
		return { optionsPage, hasOptionsPage };
	}

	private async configureSettingsForeground(settings: Partial<ExtensionSettings>): Promise<void> {
		const { optionsPage, hasOptionsPage } = await this.gotoOptionsPage();
		for (const [key, value] of Object.entries(settings)) {
			if (key.startsWith('_')) {
				const details = optionsPage.locator('details');
				if (await details.isVisible()) {
					if (!(await details.evaluate((el: HTMLDetailsElement) => el.open))) {
						await details.locator('summary').click();
					}
				}
			}
			switch (SETTING_SCHEMAS[key as keyof ExtensionSettings].type) {
				case 'boolean':
					await optionsPage.locator(`input[name="${key}"]`).setChecked(value as boolean);
					break;
				case 'number':
					await optionsPage.fill(`input[name="${key}"]`, String(value as number));
					break;
				case 'choices':
					await optionsPage.selectOption(`select[name="${key}"]`, String(value), { force: true });
					break;
				default:
					throw new Error(`Unsupported setting type for key: ${key}`);
			}
		}
		if (!hasOptionsPage) {
			await optionsPage.close();
		}
	}

	private async configureSettingsBackground(settings: Partial<ExtensionSettings>): Promise<void> {
		await this.extensionWorker.evaluate(async (settings) => {
			await chrome.storage.sync.set(settings);
		}, settings);
	}

	public async configureSettings(settings: Partial<ExtensionSettings>, useWorker: boolean = false): Promise<void> {
		if (useWorker) {
			await this.configureSettingsBackground(settings);
		} else {
			await this.configureSettingsForeground(settings);
		}
	}

	/**
	 * Forces the extension service worker to go idle by stopping it via Chrome DevTools Protocol.
	 * This clears all in-memory variables but keeps event listeners registered at the browser level.
	 * The next extension event will trigger a cold start with listeners still active.
	 */
	async idleExtensionWorker(): Promise<void> {
		const pages = this.context.pages();
		const page = pages.length > 0 ? pages[0] : await this.context.newPage();

		const client = await this.context.newCDPSession(page);

		try {
			const { targetInfos } = await client.send('Target.getTargets');
			for (const target of targetInfos) {
				if (target.type === 'service_worker' && isExtensionUri(target.url)) {
					console.log(`[TEST] Stopping service worker: ${target.url}`);
					await client.send('Target.closeTarget', {
						targetId: target.targetId,
					});
				}
			}
		} finally {
			await client.detach();
		}
	}
}
