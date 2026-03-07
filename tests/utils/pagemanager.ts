import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect as baseExpect } from '@playwright/test';

export type PageId = number | string;

/**
 * Constructs a test page URI based on the given page identifier.
 *
 * @param pageId - The page identifier (number or string)
 * @returns The constructed URI
 */
function pageUri(pageId: PageId = ''): string {
	return `about:blank?page=${pageId}`;
}

/**
 * Extracts the page identifier from a given URI.
 *
 * @param uri - The URI to extract the page identifier from
 * @returns The page identifier, or null if not found
 */
function pageId(uri: string): PageId | null {
	const match = /about:blank\?page=(.*)$/.exec(uri);
	if (!match) {
		return null;
	}
	const id = match[1];
	const numId = Number(id);
	return isNaN(numId) ? id : numId;
}

/**
 * Checks if a URI corresponds to a test tab.
 *
 * @param uri - The URI to check
 * @returns True if the URI is a test tab, false otherwise
 */
function isTestTabUri(uri: string): boolean {
	return uri.startsWith(pageUri());
}

/**
 * Finds a specific tab by page identifier.
 *
 * @param tabs - The array of tabs to search
 * @param pageId - The page identifier to find
 * @returns The tab matching the page identifier, or undefined
 */
export function findTabByPage(tabs: chrome.tabs.Tab[], pageId: PageId): chrome.tabs.Tab | undefined {
	return tabs.find((t) => t.url === pageUri(pageId));
}

export const expect = baseExpect.extend({
	/**
	 * Expects the current tabs to match the specified pageIds in order.
	 *
	 * @param pageManager - The page manager
	 * @param expectedPageIds - The expected pageIds in order
	 * @returns
	 */
	async toMatchPageIds(pageManager: PageManager, expectedPageIds: PageId[]) {
		const assertionName = 'toMatchPageIds';
		let pass: boolean;
		const currentTabs = await pageManager.getTabs();
		const actualTabIds = currentTabs
			.filter((t) => isTestTabUri(t.url ?? ''))
			.sort((a, b) => a.index - b.index)
			.map((t) => t.url ?? '')
			.map((uri) => pageId(uri));
		pass =
			actualTabIds.length === expectedPageIds.length &&
			actualTabIds.every((value, index) => String(value) === String(expectedPageIds[index]));
		if (this.isNot) {
			pass = !pass;
		}
		const message = pass
			? () =>
					this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
					'\n\n' +
					`Current tab IDs: ${this.utils.printReceived(actualTabIds)}\n` +
					`Expected not to equal: ${this.utils.printExpected(expectedPageIds)}`
			: () =>
					this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
					'\n\n' +
					`Current tab IDs: ${this.utils.printReceived(actualTabIds)}\n` +
					`Expected to equal: ${this.utils.printExpected(expectedPageIds)}`;
		return {
			message,
			pass,
			name: assertionName,
			expected: expectedPageIds,
			actual: actualTabIds,
		};
	},

	/**
	 * Expects the active tab to match the specified pageId.
	 *
	 * @param pageManager - The page manager
	 * @param expectedPageId - Expected active pageId
	 * @returns
	 */
	async toMatchActiveTab(pageManager: PageManager, expectedPageId: PageId) {
		const assertionName = 'toMatchActiveTab';
		const currentTabs = await pageManager.getTabs();
		const activeTab = currentTabs.find((t) => t.active && isTestTabUri(t.url ?? ''));
		const actualPageId = activeTab ? pageId(activeTab.url ?? '') : null;
		const uriHint = actualPageId === null ? ` (URI: ${activeTab?.url})` : '';
		let pass = actualPageId !== null && String(actualPageId) === String(expectedPageId);
		if (this.isNot) {
			pass = !pass;
		}
		const message = pass
			? () =>
					this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
					'\n\n' +
					`Active pageId: ${this.utils.printReceived(actualPageId)}${uriHint}\n` +
					`Expected not to be: ${this.utils.printExpected(expectedPageId)}`
			: () =>
					this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
					'\n\n' +
					`Active pageId: ${this.utils.printReceived(actualPageId)}${uriHint}\n` +
					`Expected to be: ${this.utils.printExpected(expectedPageId)}`;
		return {
			message,
			pass,
			name: assertionName,
			expected: expectedPageId,
			actual: actualPageId,
		};
	},
});

export class PageManager {
	private readonly context: BrowserContext;
	private readonly testWorker: Worker;

	constructor(context: BrowserContext, worker: Worker) {
		this.context = context;
		this.testWorker = worker;
	}

	async getTabs(): Promise<chrome.tabs.Tab[]> {
		return this.testWorker.evaluate(async () => {
			return chrome.tabs.query({});
		});
	}

	/**
	 * Creates a new page and navigates to the specified URI.
	 *
	 * @param pageId - The page identifier (number or string)
	 * @returns The newly created page
	 */
	async createPage(pageId: PageId): Promise<Page> {
		const page = await this.context.newPage();
		await page.goto(pageUri(pageId));
		await page.waitForLoadState();
		return page;
	}

	/**
	 * Opens a link from the given page, either in the foreground or background.
	 *
	 * @param page - The page to open the link from
	 * @param pageId - The page identifier to navigate to
	 * @param background - Whether to open the link in the background (default: false)
	 * @param linkId - The ID for the link element (optional)
	 * @param target - The target attribute for the link (optional)
	 * @returns The newly opened page
	 */
	async openLink(
		page: Page,
		pageId: PageId,
		background: boolean = false,
		linkId?: 'fg-link' | 'bg-link' | 'setup-link',
		target: string = '_blank',
	): Promise<Page> {
		const effectiveLinkId = linkId ?? (background ? 'bg-link' : 'fg-link');
		const context = page.context();
		const uri = pageUri(pageId);
		// Create a unique DOM id in order to avoid selector conflicts
		const domId = effectiveLinkId + '-' + Date.now().toFixed();
		await page.evaluate(
			(args) => {
				const existing = document.getElementById(args.domId);
				if (existing) {
					existing.remove();
				}
				const a = document.createElement('a');
				a.href = args.uri;
				a.id = args.domId;
				a.target = args.target;
				a.innerText = `${args.effectiveLinkId} -> ${args.uri} (#${args.domId})\n`;
				document.body.appendChild(a);
			},
			{ uri, domId, effectiveLinkId, target },
		);
		const newPagePromise = context.waitForEvent('page');
		if (background) {
			const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
			await page.keyboard.down(modifier);
			await page.click(`#${domId}`);
			await page.keyboard.up(modifier);
		} else {
			await page.click(`#${domId}`);
		}
		const newPage = await newPagePromise;
		await newPage.waitForLoadState();
		return newPage;
	}

	/**
	 * Opens a popup window from the given page.
	 *
	 * @param page - The page to open the popup from
	 * @param pageId - The page identifier for the popup
	 * @param features - Window features (default: 'popup=yes,width=400,height=400')
	 * @returns The newly opened popup page
	 */
	async openPopup(page: Page, pageId: PageId, features = 'popup=yes,width=400,height=400'): Promise<Page> {
		const uri = pageUri(pageId);
		const context = page.context();
		const popupPromise = context.waitForEvent('page');
		await page.evaluate(
			(args) => {
				window.open(args.uri, 'popup_window', args.features);
			},
			{ uri, features },
		);
		const popup = await popupPromise;
		await popup.waitForLoadState();
		return popup;
	}

	/**
	 * Closes all pages in the context that are not test tabs.
	 * It's useful when tab activation settings might activate non-test tabs.
	 */
	async closeNonTestPages(): Promise<void> {
		for (const page of this.context.pages()) {
			const url = page.url();
			if (!isTestTabUri(url)) {
				await page.close();
			}
		}
	}
}
