import type { TabActivationPosition } from '../shared/settings';
import { errorHandler } from '../shared/logging';
import { getSettings } from '../shared/settings';

import { TABS_INFO } from './tabsinfo';

function getTabActivationSetting(): TabActivationPosition {
	const settings = getSettings();
	return settings['after_close_activation'];
}

async function tabRemovedActivater(
	apiTabs: typeof chrome.tabs,
	tabId: number,
) {
	if (DEBUG) {
		console.log('  R1. Tab removed:', tabId);
	}
	const recentTab = TABS_INFO.getRecent();
	if (DEBUG) {
		console.log('  R2. Recent tab:', recentTab);
	}
	if (tabId !== recentTab.id) return;
	const setting = getTabActivationSetting();
	if (DEBUG) {
		console.log('  R3. Tab activation setting:', setting);
	}
	if (setting === 'default') return;

	// currentTabs should retrieve ASAP before the new tab is activated
	const currentTabs = TABS_INFO.getCurrents(recentTab.windowId);
	if (DEBUG) {
		console.log('  R4. Get current tabs');
	}

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
	if (DEBUG) {
		console.log(`  R5. New index: ${newIndex}, New tab ID: ${newTabId}`);
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
