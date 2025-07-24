import type { TabCreationPosition, TabCreationPositionKey } from '../shared/settings';
import { getSettings } from '../shared/storage';
import { NEW_PAGE_URIS } from '../shared/constants';
import { errorHandler } from '../shared/logging';

import { TABS_INFO } from './tabsinfo';

async function getCreatedTabSettings(
	newTab: chrome.tabs.Tab,
): Promise<[TabCreationPositionKey, TabCreationPosition]> {
	const windowId = newTab.windowId;
	const currentWindowId = TABS_INFO.getCurrentWindowId();
	console.log('getCreatedTabSettings', windowId, currentWindowId, newTab);
	if (windowId !== currentWindowId) {
		return ['new_tab_position', 'default'] as const;
	}
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl || newTab.url || '');
	const currentIndex = TABS_INFO.getCurrentIndex(windowId);
	let settingKey: TabCreationPositionKey;
	if (isNewTabPage) {
		settingKey = 'new_tab_position';
	} else {
		settingKey = 'background_link_position';
	}
	const settings = await getSettings(true);
	return [settingKey, settings[settingKey]] as const;
}

async function createdTabMover(newTab: chrome.tabs.Tab) {
	console.log(1);
	const tabId = newTab.id;
	if (!tabId || tabId === -1) return; // chrome.tabs.TAB_ID_NONE
	console.log(2, tabId, newTab.windowId);
	const [settingKey, setting] = await getCreatedTabSettings(newTab);
	if (setting === 'default') return;
	console.log(3, settingKey, setting);
	const windowId = newTab.windowId;
	const currentWindowId = TABS_INFO.getCurrentWindowId();
	const currentIndex = TABS_INFO.getCurrentIndex(windowId);

	// let index = -1; // Default to 'last'
	let index: number; // Exhaustness checked by `tsc`
	switch (setting) {
		case 'before_active':
			index = currentIndex;
			break;
		case 'after_active':
			index = currentIndex + 1;
			break;
		case 'window_first':
			index = 0;
			break;
		case 'window_last':
			index = -1;
			break;
	}
	console.log(4, index);
	try {
		await chrome.tabs.move(tabId, { index: index });
	} catch (e: any) {
		errorHandler(e);
	}
}

export async function registerTabCreatedListener(apiTabs: typeof chrome.tabs) {
	console.log('Registering tab created listener');
	apiTabs.onCreated.addListener(createdTabMover);
}
