import type { TabActivationPosition } from '../shared/settings';
import { errorHandler } from '../shared/logging';
import { getSettings } from '../shared/settings';
import { MAX_BATCH_DELAY_MS } from '../shared/constants';

import { TABS_INFO } from './tabsinfo';

function getTabActivationSetting(): TabActivationPosition {
	const settings = getSettings();
	return settings['after_close_activation'];
}

async function tabRemovedActivater(
	apiTabs: typeof api.tabs,
	tabId: number,
) {
	if (DEBUG) {
		console.log('  R1. Tab removed:', tabId);
	}
	const delay = TABS_INFO.getRemovalDelay();
	if (DEBUG) {
		console.log('  R2. Removal delay:', delay);
	}
	if (delay < MAX_BATCH_DELAY_MS) {
		return;
	}
	const removedTab = TABS_INFO.getRemoved();
	if (DEBUG) {
		console.log('  R3. Removed tab:', removedTab);
	}
	if (tabId !== removedTab.id) return;
	const windowId = removedTab.windowId;
	const recentTab = TABS_INFO.getRecent(windowId);
	if (DEBUG) {
		console.log('  R4. Recent tab:', recentTab);
	}
	if (removedTab.id !== recentTab.id) return;
	const setting = getTabActivationSetting();
	if (DEBUG) {
		console.log('  R5. Tab activation setting:', setting);
	}
	if (setting === 'default') return;

	// currentTabs should retrieve ASAP before the new tab is activated
	const currentTabs = TABS_INFO.getCurrents(windowId);
	if (DEBUG) {
		console.log('  R6. Get current tabs');
	}

	// No tabs remain in the current window to activate; this is handled by the browser.
	if (currentTabs.length === 0) return;
	let newIndex: number; // Exhaustiveness checked by `tsc`
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
	}
	if (DEBUG) {
		console.log(`  R7. New index: ${newIndex}, New tab ID: ${newTabId}`);
	}
	if (newTabId === undefined) {
		const newTabIds = await apiTabs.query({
			windowType: 'normal',
			windowId: windowId,
			index: newIndex,
		});
		if (newTabIds.length === 0) return; // No tab found at the specified index
		newTabId = newTabIds[0].id!;
	}
	if (DEBUG) {
		console.log('  R8. New tab ID:', newTabId, 'New index:', newIndex);
	}
	try {
		await apiTabs.update(newTabId, { active: true });
	} catch (error: any) {
		errorHandler(error);
	}
	if (DEBUG) {
		console.log('  R9. Tab activated');
	}
}

export function registerTabRemovedListener(apiTabs: typeof api.tabs) {
	apiTabs.onRemoved.addListener(
		tabRemovedActivater.bind(null, apiTabs)
	);
}
