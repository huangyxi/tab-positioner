import type { TabCreationPositionKey } from '../shared/settings';
import { NEW_PAGE_URIS } from '../shared/constants';
import type { Listeners } from '../shared/listeners';
import { logClosure } from '../shared/logging';

import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';
import { tabMover } from './tabmover';
import { createdPopupMover } from './popupcreation';

async function getTabCreationSetting(newTab: api.tabs.Tab, apiTabs: typeof api.tabs) {
	const isNewTabPage = NEW_PAGE_URIS.includes(newTab.pendingUrl ?? newTab.url ?? '');

	// Detect duplicates (vs opening a link twice) by further ensuring `openerTabId` matches the previous tab.
	let isDuplicate = false;
	const newTabUrl = newTab.pendingUrl ?? newTab.url;
	if (newTab.index > 0 && newTabUrl) {
		const allTabs = await apiTabs.query({ windowId: newTab.windowId });
		const previousTab = allTabs.find((tab) => tab.index === newTab.index - 1);
		if (previousTab) {
			const previousUrl = previousTab.pendingUrl ?? previousTab.url;
			const isOpenerMatch = newTab.openerTabId !== undefined && newTab.openerTabId === previousTab.id;
			isDuplicate = newTabUrl === previousUrl && isOpenerMatch;
		}
	}

	let settingKey: TabCreationPositionKey;
	if (isNewTabPage) {
		// The New Tab Page rule applies superiorly
		settingKey = 'new_tab_position';
	} else if (isDuplicate) {
		// When duplicating a tab, the new tab appears right after the source with the same URL
		settingKey = '_duplicate_tab_position';
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
	};
}

async function createdTabMover(apiTabs: typeof api.tabs, apiWindows: typeof api.windows, newTab: api.tabs.Tab) {
	const logger = logClosure('  tabCreation');
	logger.debug('Tab creation process started');
	const tabsInfo = await TabsInfo.getInstance();
	const hasLoaded = tabsInfo.hasTabActivated();
	// The above line should be executed ASAP before the new tab is activated
	const tabId = newTab.id;
	logger.debug('New tab ID:', tabId);
	if (!tabId || tabId === -1) return; // api.tabs.TAB_ID_NONE
	const nTabs = tabsInfo.getCurrentTabs(newTab.windowId).length;
	logger.debug('Current tabs count in window:', nTabs);
	if (nTabs <= 1) {
		const window = await apiWindows.get(newTab.windowId);
		if (window.type === 'popup') {
			logger.info('Popup window, dispatching to popup mover');
			await createdPopupMover(apiTabs, tabsInfo, tabId, hasLoaded);
			return;
		}
		return;
	}
	const { setting, settingKey: _, tabBatchThresholdMs } = await getTabCreationSetting(newTab, apiTabs);
	logger.debug('Tab creation setting:', setting);
	if (setting === 'default') return;
	const delay = tabsInfo.getCreationDelay();
	logger.debug('Creation delay:', delay);
	if (delay < tabBatchThresholdMs) {
		return;
	}
	logger.info('Normal window, moving tab');
	await tabMover(apiTabs, tabsInfo, tabId, newTab.windowId, setting, newTab.index, hasLoaded);
}

export function registerTabCreatedListener(
	listeners: Listeners,
	apiTabs: typeof api.tabs,
	apiWindows: typeof api.windows,
) {
	listeners.add(apiTabs.onCreated, createdTabMover.bind(null, apiTabs, apiWindows));
}
