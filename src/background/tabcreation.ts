import type { TabCreationPosition, TabCreationPositionKey } from '../shared/settings';
import { getSettings } from '../shared/storage';
import { NEW_PAGE_URIS } from '../shared/constants';
import { errorHandler } from '../shared/logging';
import { TABS_INFO } from './tabsinfo';

async function getTabCreationSetting(
	newTab: chrome.tabs.Tab,
): Promise<TabCreationPosition> {
	const windowId = newTab.windowId;
	const recentTab = TABS_INFO.getRecent();
	if (windowId !== recentTab.windowId) {
		return 'default';
	}
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl || newTab.url || '');
	let settingKey: TabCreationPositionKey;
	if (isNewTabPage) {
		settingKey = 'new_tab_position';
	} else {
		settingKey = 'background_link_position';
	}
	const settings = await getSettings(true);
	return settings[settingKey];
}

async function createdTabMover(
	apiTabs: typeof chrome.tabs,
	newTab: chrome.tabs.Tab,
) {
	const tabId = newTab.id;
	if (!tabId || tabId === -1) return; // chrome.tabs.TAB_ID_NONE
	const setting = await getTabCreationSetting(newTab);
	if (setting === 'default') return;
	const currentIndex = TABS_INFO.getRecent().index;
	// let index = -1; // Default to 'last'
	let newIndex: number; // Exhaustness checked by `tsc`
	switch (setting) {
		case 'before_active':
			newIndex = currentIndex;
			break;
		case 'after_active':
			newIndex = currentIndex + 1;
			break;
		case 'window_first':
			newIndex = 0;
			break;
		case 'window_last':
			newIndex = -1;
			break;
	}
	try {
		await apiTabs.move(tabId, { index: newIndex });
	} catch (error: any) {
		errorHandler(error);
	}
}

export async function registerTabCreatedListener(apiTabs: typeof chrome.tabs) {
	apiTabs.onCreated.addListener(
		createdTabMover.bind(null, apiTabs)
	);
}
