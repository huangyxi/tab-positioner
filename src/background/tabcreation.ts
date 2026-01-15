import { DEBUG } from '../shared/debug';
import type { TabCreationPositionKey } from '../shared/settings';
import { NEW_PAGE_URIS } from '../shared/constants';
import { Listeners } from '../shared/listeners';

import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';
import { tabMover } from './tabmover';
import { createdPopupMover } from './popupcreation';

async function getTabCreationSetting(
	newTab: api.tabs.Tab,
) {
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl ?? newTab.url ?? '');
	let settingKey: TabCreationPositionKey;
	if (isNewTabPage) {
		settingKey = 'new_tab_position';
	} else {
		if (newTab.active) {
			settingKey = 'foreground_link_position';
		} else {
			settingKey = 'background_link_position';
		}
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
	apiWindows: typeof api.windows,
	newTab: api.tabs.Tab,
) {
	DEBUG && console.log('  C1. Tab created');
	const tabsInfo = await TabsInfo.getInstance();
	const hasLoaded = tabsInfo.hasTabActivated();
	// The above line should be executed ASAP before the new tab is activated
	const tabId = newTab.id;
	DEBUG && console.log('  C2. Tab ID:', tabId);
	if (!tabId || tabId === -1) return; // api.tabs.TAB_ID_NONE
	const nTabs = tabsInfo.getCurrentTabs(newTab.windowId).length;
	DEBUG && console.log('  C3. Current tabs count:', nTabs);
	if (nTabs <= 1) {
		const window = await apiWindows.get(newTab.windowId);
		if (window.type === 'popup') {
			DEBUG && console.log('  C6->P. Popup window, dispatching to popup mover');
			return await createdPopupMover(
				apiTabs,
				tabsInfo,
				tabId,
				hasLoaded,
			);
		}
		return;
	}
	const {setting, settingKey, tabBatchThresholdMs} = await getTabCreationSetting(newTab);
	DEBUG && console.log('  C4. Tab creation setting:', setting);
	if (setting === 'default') return;
	const delay = tabsInfo.getCreationDelay();
	DEBUG && console.log('  C5. Creation delay:', delay);
	if (delay < tabBatchThresholdMs) {
		return;
	}
	DEBUG && console.log('  C6->c. Normal window, moving tab');
	await tabMover(
		apiTabs,
		tabsInfo,
		tabId,
		newTab.windowId,
		setting,
		newTab.index,
		hasLoaded,
	);
}

export async function registerTabCreatedListener(
	listeners: Listeners,
	apiTabs: typeof api.tabs,
	apiWindows: typeof api.windows,
) {
	listeners.add(apiTabs.onCreated,
		createdTabMover.bind(null, apiTabs, apiWindows)
	);
}
