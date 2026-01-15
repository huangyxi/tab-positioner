import type { BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export type PageId = number | string;

function PAGE(pageId: PageId = ''): string {
	return `https://example.com/${pageId}`;
}

/**
 * Filters tabs to only include test pages (example.com).
 *
 * @param tabs - The array of tabs to filter
 * @returns Array of test tabs
 */
export function filterTestTabs(tabs: chrome.tabs.Tab[]): chrome.tabs.Tab[] {
	return tabs.filter(t => t.url?.includes('example.com'));
}

/**
 * Finds a specific tab by page identifier.
 *
 * @param tabs - The array of tabs to search
 * @param pageId - The page identifier to find
 * @returns The tab matching the page identifier, or undefined
 */
export function findTabByPage(tabs: chrome.tabs.Tab[], pageId: PageId): chrome.tabs.Tab | undefined {
	return tabs.find(t => t.url?.includes(`example.com/${pageId}`));
}

/**
 * Creates a new page and navigates to the specified URL.
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
	await page.goto(PAGE(pageId));
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
		expect(tab.url).toContain(PAGE(expectedPages[index]));
	});
}

/**
 * Asserts that the active tab contains the expected URL.
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
	expect(activeTab?.url).toContain(PAGE(expectedPage));
}

/**
 * Opens a foreground link from the given page.
 * Creates an anchor element with target="_blank" and clicks it.
 *
 * @param page - The page to open the link from
 * @param pageId - The page identifier to navigate to
 * @param linkId - The ID for the link element (default: 'fg-link')
 * @returns The newly opened page
 */
export async function openForegroundLink(
	page: Page,
	pageId: PageId,
	linkId = 'fg-link',
): Promise<Page> {
	const context = page.context();
	const url = PAGE(pageId);

	await page.evaluate((args) => {
		const a = document.createElement('a');
		a.href = args.url;
		a.target = '_blank';
		a.id = args.linkId;
		a.innerText = 'FG Link';
		document.body.appendChild(a);
	}, { url, linkId });

	await page.click(`#${linkId}`);
	const newPage = await context.waitForEvent('page');
	await newPage.waitForLoadState();

	return newPage;
}

/**
 * Opens a background link from the given page.
 * Creates an anchor element and clicks it with Cmd/Ctrl modifier.
 *
 * @param page - The page to open the link from
 * @param pageId - The page identifier to navigate to
 * @param linkId - The ID for the link element (default: 'bg-link')
 * @returns The newly opened page
 */
export async function openBackgroundLink(
	page: Page,
	pageId: PageId,
	linkId: 'bg-link' | 'setup-link' = 'bg-link',
): Promise<Page> {
	const context = page.context();
	const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
	const url = PAGE(pageId);

	await page.evaluate((args) => {
		const a = document.createElement('a');
		a.href = args.url;
		a.id = args.linkId;
		a.innerText = 'BG Link';
		document.body.appendChild(a);
	}, { url, linkId });

	await page.keyboard.down(modifier);
	await page.click(`#${linkId}`);
	await page.keyboard.up(modifier);

	const newPage = await context.waitForEvent('page');
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
	const context = page.context();
	const popupPromise = context.waitForEvent('page');
	const url = PAGE(pageId);

	await page.evaluate((args) => {
		window.open(args.url, 'popup_window', args.features);
	}, { url, features });

	const popup = await popupPromise;
	return popup;
}
