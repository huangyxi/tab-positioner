import { DEBUG } from '../shared/debug';
import type { TabCreationPositionKey } from '../shared/settings';
import { NEW_PAGE_URIS } from '../shared/constants';
import { Listeners } from '../shared/listeners';
import { errorHandler } from '../shared/logging';

import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';


async function getTabCreationSetting(
	newTab: api.tabs.Tab,
) {
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl || newTab.url || '');
	let settingKey: TabCreationPositionKey;
	if (isNewTabPage) {
		settingKey = 'new_tab_position';
	} else {
		settingKey = 'background_link_position';
	}
	const settings = await SyncSettings.getInstance();
	return {
		setting: settings.get(settingKey),
		settingKey,
		tabBatchThresholdMs: settings.get('_tab_batch_creation_threshold_ms'),
	}
}

async function createdTabMover(
	apiTabs: typeof api.tabs,
	newTab: api.tabs.Tab,
) {
	if (DEBUG) {
		console.log('  C1. Tab created');
	}
	const tabsInfo = await TabsInfo.getInstance();
	const hasLoaded = tabsInfo.hasTabActivated();
	// The above line should be executed ASAP before the new tab is activated
	const {setting, settingKey, tabBatchThresholdMs} = await getTabCreationSetting(newTab);
	if (DEBUG) {
		console.log('  C2. Tab creation setting:', setting);
	}
	if (setting === 'default') return;
	const delay = tabsInfo.getCreationDelay();
	if (DEBUG) {
		console.log('  C3. Creation delay:', delay);
	}
	if (delay < tabBatchThresholdMs) {
		return;
	}
	const currentTab = tabsInfo.getRecent(newTab.windowId);
	const currentIndex = currentTab.index;
	const tabId = newTab.id;
	if (DEBUG) {
		console.log('  C4. Tab ID:', tabId);
	}
	if (!tabId || tabId === -1) return; // api.tabs.TAB_ID_NONE
	let newIndex: number = -1; // Default to 'last'
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
		default:
			const _exhaustive: never = setting;
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
		if (!hasLoaded) {
			await new Promise((resolve) => setTimeout(resolve, tabBatchThresholdMs));
			const [tab] = await apiTabs.query({
				active: true,
				windowId: newTab.windowId,
			});
			if (tab?.id === tabId) {
				console.log('  C6. Tab active again');
				tabsInfo.activateTab(tab.windowId, tabId, newIndex);
			}
		}
	} catch (error: any) {
		errorHandler(error);
	}
	if (DEBUG) {
		console.log('  C7. Tab moved');
	}
}

export async function registerTabCreatedListener(
	listeners: Listeners,
	apiTabs: typeof api.tabs,
) {
	listeners.add(apiTabs.onCreated,
		createdTabMover.bind(null, apiTabs)
	);
}
