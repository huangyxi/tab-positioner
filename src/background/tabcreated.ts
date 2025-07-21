import type { TabCreationPositionKey } from '../shared/settings';
import { getSettings } from '../shared/storage';
import { NEW_PAGE_URIS } from '../shared/constants';
import { errorHandler } from '../shared/logging';

async function getCreatedTabSettings(newTab: chrome.tabs.Tab) {
	const settings = await getSettings(true);
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl || newTab.url || '');
	let settingKey: TabCreationPositionKey;
	// if (isNewTabPage) {
	// 	settingKey = 'new_tab_position';
	// } else {
	// 	if (newTab.openerTabId) {
	// 		settingKey = 'foreground_link_position';
	// 	} else {
			settingKey = 'background_link_position';
	// 	}
	// }
	return [settingKey, settings[settingKey]] as const;
}

async function createdTabMover(newTab: chrome.tabs.Tab) {
	const [settingKey, setting] = await getCreatedTabSettings(newTab);
	const tabId = newTab.id;
	const windowId = newTab.windowId;
	if (setting === 'default' || !tabId) return;

	const [activeTab] = await chrome.tabs.query({
		active: true,
		windowId: windowId,
	});

	// let index = -1; // Default to 'last'
	let index: number; // Exhaustness checked by `tsc`
	switch (setting) {
		case 'left':
			index = activeTab.index;
			break;
		case 'right':
			index = activeTab.index + 1;
			break;
		case 'first':
			index = 0;
			break;
		case 'last':
			index = -1;
			break;
	}
	if (index !== -1) {
		// Use a small delay to prevent race conditions with Chrome's default behavior
		// setTimeout(async () => {
		try {
			await chrome.tabs.move(tabId, { index: index });
		} catch (e: any) {
			errorHandler(e);
		}
		// }, 50);
	}
}

export async function registerTabCreatedListener(chromeTabs: typeof chrome.tabs) {
	chromeTabs.onCreated.addListener(createdTabMover);
}
