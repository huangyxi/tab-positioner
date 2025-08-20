import { DEBUG } from '../shared/debug';
import type { TabCreationPositionKey, TabCreationPosition } from '../shared/settings';
import { NEW_PAGE_URIS, FIRST_ACTIVATION_DELAY_MS } from '../shared/constants';
import { Listeners } from '../shared/listeners';
import { errorHandler } from '../shared/logging';

import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';


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

export async function tabMover(
	apiTabs: typeof api.tabs,
	tabsInfo: TabsInfo,
	tabId: number,
	windowId: number,
	setting: TabCreationPosition,
	index?: number,
	hasLoaded: boolean = true,
) {
	DEBUG && console.log('  c0. Tab mover called');
	let newIndex: number = -1;
	const currentTab = tabsInfo.getRecentTab(windowId);
	const currentIndex = currentTab.index;
	switch (setting) {
		case 'default':
			return;
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
			newIndex = -1; // Last position
			break;
		default:
			const _exhaustive: never = setting;
	}
	DEBUG && console.log('  c1. New index:', newIndex);
	if (newIndex === index) return;
	DEBUG && console.log('  c2. Moving tab');
	try {
		await apiTabs.move(tabId, {
			index: newIndex,
			windowId: windowId === -1 ? undefined : windowId,
		});
		if (!hasLoaded) {
			await new Promise((resolve) => setTimeout(resolve, FIRST_ACTIVATION_DELAY_MS));
			const [tab] = await apiTabs.query({
				active: true,
				windowId: windowId,
			});
			if (tab?.id === tabId) {
				DEBUG && console.log('  c2a. Tab active again');
				tabsInfo.activateTab(
					windowId,
					tabId,
					newIndex
				);
			}
		}
	} catch (error: any) {
		errorHandler(error);
	}
	DEBUG && console.log('  c3. Tab moved');
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
	const tabId = newTab.id;
	if (DEBUG) {
		console.log('  C4. Tab ID:', tabId);
	}
	if (!tabId || tabId === -1) return; // api.tabs.TAB_ID_NONE
	const nTabs = tabsInfo.getCurrentTabs(newTab.windowId).length;
	DEBUG && console.log('  C5. Current tabs count:', nTabs);
	if (nTabs <= 1) return;
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
) {
	listeners.add(apiTabs.onCreated,
		createdTabMover.bind(null, apiTabs)
	);
}
