import type { TabCreationPosition, TabCreationPositionKey } from '../shared/settings';
import { getSettings } from '../shared/settings';
import { NEW_PAGE_URIS, MAX_BATCH_DELAY_MS } from '../shared/constants';
import { errorHandler } from '../shared/logging';
import { TABS_INFO } from './tabsinfo';


function getTabCreationSetting(
	newTab: api.tabs.Tab,
): TabCreationPosition {
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl || newTab.url || '');
	let settingKey: TabCreationPositionKey;
	if (isNewTabPage) {
		settingKey = 'new_tab_position';
	} else {
		settingKey = 'background_link_position';
	}
	const settings = getSettings();
	return settings[settingKey];
}

async function createdTabMover(
	apiTabs: typeof api.tabs,
	newTab: api.tabs.Tab,
) {
	if (DEBUG) {
		console.log('  C1. Tab created');
	}
	const delay = TABS_INFO.getCreationDelay();
	if (DEBUG) {
		console.log('  C2. Creation delay:', delay);
	}
	if (delay < MAX_BATCH_DELAY_MS) {
		return;
	}
	const currentTab = TABS_INFO.getRecent(newTab.windowId);
	const currentIndex = currentTab.index;
	// The above line should be executed ASAP before the new tab is activated
	const tabId = newTab.id;
	if (DEBUG) {
		console.log('  C3. Tab ID:', tabId);
	}
	if (!tabId || tabId === -1) return; // api.tabs.TAB_ID_NONE
	const setting = getTabCreationSetting(newTab);
	if (DEBUG) {
		console.log('  C4. Tab creation setting:', setting);
	}
	if (setting === 'default') return;
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
	if (DEBUG) {
		console.log(`  C5. New index: ${newIndex}`);
	}
	if (newIndex == newTab.index) {
		return;
	}
	if (DEBUG) {
		console.log('  C6. Moving tab');
	}
	try {
		await apiTabs.move(tabId, { index: newIndex });
	} catch (error: any) {
		errorHandler(error);
	}
	if (DEBUG) {
		console.log('  C7. Tab moved');
	}
}

export async function registerTabCreatedListener(apiTabs: typeof api.tabs) {
	apiTabs.onCreated.addListener(
		createdTabMover.bind(null, apiTabs)
	);
}
