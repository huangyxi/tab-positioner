import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type PageId = number | string;

function pageUri(pageId: PageId = ''): string {
	return `about:blank?page=${pageId}`;
}

/**
 * Filters tabs to only include test pages.
 *
 * @param tabs - The array of tabs to filter
 * @returns Array of test tabs
 */
export function filterTestTabs(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
	return tabs.filter(t => t.url?.startsWith(pageUri()));
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
	return page;
}

/**
 * Asserts that tabs are in the expected order.
 *
 * @param tabs - The array of tabs to verify
 * @param expectedPages - The expected page identifiers in order
 */
export function expectTabOrder(
	tabs: chrome.tabs.Tab[],
	expectedPages: PageId[],
): void {
	expect(tabs.length).toBe(expectedPages.length);
	tabs.forEach((tab, index) => {
		expect(tab.url).toEqual(pageUri(expectedPages[index]));
	});
}

/**
 * Asserts that the active tab matches the expected page.
 *
 * @param tabs - The array of tabs to check
 * @param expectedPage - The expected page identifier in the active tab
 */
export function expectActiveTab(
	tabs: chrome.tabs.Tab[],
	expectedPage: PageId,
): void {
	const activeTab = tabs.find(t => t.active);
	expect(activeTab).toBeDefined();
	expect(activeTab?.url).toEqual(pageUri(expectedPage));
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
