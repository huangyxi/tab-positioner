import type { BrowserContext, Page } from '@playwright/test';
import { expect as baseExpect } from '@playwright/test';
import { isExtensionUri } from './fixtures';

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
	const match = uri.match(/about:blank\?page=(.*)$/);
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
	return tabs.find(t => t.url === pageUri(pageId));
}

export const expect = baseExpect.extend({
	/**
	 * Expects the current tabs to match the specified pageIds in order.
	 *
	 * @param currentTabs - The current array of tabs
	 * @param expectedPageIds - The expected pageIds in order
	 * @returns
	 */
	async toMatchPageIds(
		currentTabs: chrome.tabs.Tab[],
		expectedPageIds: PageId[],
	) {
		const assertionName = 'toMatchPageIds';
		let pass: boolean;
		const actualTabIds = currentTabs
			.filter(t => isTestTabUri(t.url ?? ''))
			.sort((a, b) => (a.index - b.index))
			.map(t => t.url!)
			.map(uri => pageId(uri));
		pass = actualTabIds.length === expectedPageIds.length &&
			actualTabIds.every((value, index) =>
				String(value) === String(expectedPageIds[index])
			);
		if (this.isNot) {
			pass = !pass;
		}
		const message = pass
			? () => this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
				'\n\n' +
				`Current tab IDs: ${this.utils.printReceived(actualTabIds)}\n` +
				`Expected not to equal: ${this.utils.printExpected(expectedPageIds)}`
			: () => this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
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
	 * @param currentTabs - Current array of tabs
	 * @param expectedPageId - Expected active pageId
	 * @returns
	 */
	async toMatchActiveTab(
		currentTabs: chrome.tabs.Tab[],
		expectedPageId: PageId,
	) {
		const assertionName = 'toMatchActiveTab';
		const activeTab = currentTabs.find(t => t.active && isTestTabUri(t.url ?? ''));
		const actualPageId = activeTab ? pageId(activeTab.url!) : null;
		const uriHint = actualPageId === null ? ` (URI: ${activeTab?.url})` : '';
		let pass = actualPageId !== null && String(actualPageId) === String(expectedPageId);
		if (this.isNot) {
			pass = !pass;
		}
		const message = pass
			? () => this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
				'\n\n' +
				`Active pageId: ${this.utils.printReceived(actualPageId)}${uriHint}\n` +
				`Expected not to be: ${this.utils.printExpected(expectedPageId)}`
			: () => this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
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
})


/**
 * Creates a new page and navigates to the specified URI.
 *
 * @param context - The browser context
 * @param pageId - The page identifier (number or string)
 * @returns The newly created page
 */
export async function createPage(
	context: BrowserContext,
	pageId: PageId,
): Promise<Page> {
	const page = await context.newPage();
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
export async function openLink(
	page: Page,
	pageId: PageId,
	background: boolean = false,
	linkId?: 'fg-link' | 'bg-link' | 'setup-link',
	target: string = '_blank',
): Promise<Page> {
	const effectiveLinkId = linkId ?? (background ? 'bg-link' : 'fg-link');
	const context = page.context();
	const uri = pageUri(pageId);
	const domId = effectiveLinkId + '-' + Date.now();
	await page.evaluate((args) => {
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
	}, { uri, domId, effectiveLinkId, target });
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
export async function openPopup(
	page: Page,
	pageId: PageId,
	features = 'popup=yes,width=400,height=400',
): Promise<Page> {
	const uri = pageUri(pageId);
	const context = page.context();
	const popupPromise = context.waitForEvent('page');
	await page.evaluate((args) => {
		window.open(args.uri, 'popup_window', args.features);
	}, { uri, features });
	const popup = await popupPromise;
	await popup.waitForLoadState();
	return popup;
}

/**
 * Closes all pages in the context that are not test tabs.
 * It's useful when tab activation settings might activate non-test tabs.
 *
 * @param context - The browser context
 */
export async function closeNonTestPages(
	context: BrowserContext,
): Promise<void> {
	for (const page of context.pages()) {
		const url = page.url();
		if (!isTestTabUri(url)) {
			await page.close();
		}
	}
}

/**
 * Forces the extension service worker to go idle by stopping it via Chrome DevTools Protocol.
 * This clears all in-memory variables but keeps event listeners registered at the browser level.
 * The next extension event will trigger a cold start with listeners still active.
 *
 * @param context - The browser context
 */
export async function idleExtensionWorker(
	context: BrowserContext,
): Promise<void> {
	const pages = context.pages();
	const page = pages.length > 0 ? pages[0] : await context.newPage();

	const client = await context.newCDPSession(page);

	try {
		const { targetInfos } = await (client as any).send('Target.getTargets');
		for (const target of (targetInfos || [])) {
			if (target.type === 'service_worker' && isExtensionUri(target.url)) {
				console.log(`[TEST] Stopping service worker: ${target.url}`);
				await (client as any).send('Target.closeTarget', {
					targetId: target.targetId
				});
			}
		}
	} finally {
		await client.detach();
	}
}
