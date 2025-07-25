import type { TabActivationPosition } from '../shared/settings';
import { errorHandler } from '../shared/logging';
import { getSettings } from '../shared/storage';

import { TABS_INFO } from './tabsinfo';

async function getTabActivationSetting(): Promise<TabActivationPosition> {
	const settings = await getSettings(true);
	return settings['after_close_activation'];
}

async function tabRemovedActivater(
	apiTabs: typeof chrome.tabs,
	tabId: number,
) {
	const recentTab = TABS_INFO.getRecent();
	if (tabId !== recentTab.id) return;
	// currentTabs should retrieve ASAP before the new tab is activated
	const currentTabs = TABS_INFO.getCurrents(recentTab.windowId);
	// The above lines should be executed ASAP before the new default tab is activated

	const setting = await getTabActivationSetting();
	if (setting === 'default') return;
	// No tabs remain in the current window to activate; this is handled by the browser.
	if (currentTabs.length === 0) return;
	const currentTab = currentTabs[0];
	let newIndex: number; // Exhaustiveness checked by `tsc`
	let newTabId: number | undefined;
	switch (setting) {
		case 'before_removed':
			newIndex = recentTab.index - 1;
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
	}
	if (newTabId === undefined) {
		const newTabIds = await apiTabs.query({
			windowType: 'normal',
			windowId: recentTab.windowId,
			index: newIndex,
		});
		if (newTabIds.length === 0) return; // No tab found at the specified index
		newTabId = newTabIds[0].id!;
	}
	try {
		await apiTabs.update(newTabId, { active: true });
	} catch (error: any) {
		errorHandler(error);
	}
}

export function registerTabRemovedListener(apiTabs: typeof chrome.tabs) {
	apiTabs.onRemoved.addListener(
		tabRemovedActivater.bind(null, apiTabs)
	);
}
