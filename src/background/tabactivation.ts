import type { Listeners } from '../shared/listeners';
import { logClosure } from '../shared/logging';

import { TabsInfo } from './tabsinfo';
import { SyncSettings } from './syncsettings';

async function getTabActivationSetting() {
	const settings = await SyncSettings.getInstance();
	return {
		setting: settings.get('after_close_activation'),
		tabBatchThresholdMs: settings.get('_tab_batch_activation_threshold_ms'),
	};
}

async function tabRemovedActivater(apiTabs: typeof api.tabs, tabId: number) {
	const logger = logClosure('  tabActivation');
	logger.debug('Tab removal activation process started for tab ID:', tabId);
	const tabsInfo = await TabsInfo.getInstance();
	const { setting, tabBatchThresholdMs } = await getTabActivationSetting();
	logger.debug('Tab activation setting:', setting);
	if (setting === 'default') return;
	const delay = tabsInfo.getRemovalDelay();
	logger.debug('Removal delay:', delay);
	if (delay < tabBatchThresholdMs) {
		return;
	}
	const removedTab = tabsInfo.getRemovedTab();
	logger.debug('Removed tab info:', removedTab);
	if (tabId !== removedTab.id) return;
	const windowId = removedTab.windowId;
	const recentTab = tabsInfo.getRecentTab(windowId);
	logger.debug('Recent tab info:', recentTab);
	if (removedTab.id !== recentTab.id) return;
	const currentTabs = tabsInfo.getCurrentTabs(windowId);
	logger.debug('Get current tabs');
	// No tabs remain in the current window to activate; this is handled by the browser.
	if (currentTabs.length === 0) return;
	let newIndex: number = -1;
	let newTabId: number | undefined;
	switch (setting) {
		case 'before_removed':
			newIndex = Math.max(0, recentTab.index - 1);
			break;
		case 'after_removed':
			newIndex = recentTab.index;
			break;
		case 'window_first':
			newIndex = 0;
			break;
		case 'window_last':
			newIndex = currentTabs.length - 1;
			break;
		// case 'activation_history':
		// 	newTabId = currentTab.id;
		// 	newIndex = recentTab.index;
		// 	break;
		default:
			const _exhaustive: never = setting;
	}
	logger.debug('Determined new index:', newIndex, 'New tab ID:', newTabId);
	if (newTabId === undefined) {
		const newTabIds = await apiTabs.query({
			windowType: 'normal',
			windowId: windowId,
			index: newIndex,
		});
		if (newTabIds.length === 0) return; // No tab found at the specified index
		newTabId = newTabIds[0].id ?? api.tabs.TAB_ID_NONE;
	}
	logger.debug('Final new tab ID to activate:', newTabId);
	try {
		await apiTabs.update(newTabId, { active: true });
		logger.info('Activated tab ID:', newTabId);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (message.startsWith('No tab with id:')) {
			logger.warn('Tab to activate not found:', newTabId);
		} else {
			logger.error(error);
		}
	}
	logger.debug('Tab removal activation process completed');
}

export function registerTabRemovedListener(listeners: Listeners, apiTabs: typeof api.tabs) {
	listeners.add(apiTabs.onRemoved, tabRemovedActivater.bind(null, apiTabs));
}
