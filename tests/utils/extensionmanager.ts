import type { BrowserContext, Page, Worker } from '@playwright/test';

import manifest from '../../manifest.json' with { type: 'json' };
import { SETTING_SCHEMAS } from '../../src/shared/settings';
import type { ExtensionSettings } from '../fixtures';

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
}
