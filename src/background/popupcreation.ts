import { DEBUG } from '../shared/debug';
import type { TabCreationPosition } from '../shared/settings';

import { Listeners } from '../shared/listeners';

import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';
import { tabMover } from './tabcreation';

async function createdPopupMover(
	apiWindows: typeof api.windows,
	apiTabs: typeof api.tabs,
	newWindow: api.windows.Window,
) {
	DEBUG && console.log('  P1. Popup created');
	const tabsInfo = await TabsInfo.getInstance();
	const hasLoaded = tabsInfo.hasTabActivated();
	if (!newWindow.id) return;
	const settings = await SyncSettings.getInstance();
	const setting = settings.get('_popup_position');
	DEBUG && console.log('  P2. Popup creation setting:', setting);
	if (setting === 'default') return;
	// Should get the window again with populate: true to ensure tabs are included.
	// const newTab = newWindow.tabs?.[0];
	const window = await apiWindows.get(newWindow.id, {populate: true});
	const newTab = window.tabs?.[0];
	DEBUG && console.log('  P3. Tab ID:', newTab?.id);
	if (!newTab || !newTab.id) return;
	// Is there any openerTabId for popup tabs?
	// const windowId = tabsInfo.findTab(newTab.openerTabId ?? -1) ?? tabsInfo.getRecentNormalWindowId();
	const windowId = tabsInfo.getRecentNormalWindowId();
	DEBUG && console.log('  P4 Window ID for opener tab:', windowId);
	let tabCreationSetting: TabCreationPosition = 'default';
	switch (setting) {
		case 'new_foreground_tab':
			tabCreationSetting = settings.get('foreground_link_position');
			break;
		case 'new_background_tab':
			tabCreationSetting = settings.get('background_link_position');
			break;
		default:
			const _exhaustive: never = setting;
	}
	await tabMover(
		apiTabs,
		tabsInfo,
		newTab.id,
		windowId,
		tabCreationSetting,
		undefined,
		hasLoaded,
	);
	if (setting === 'new_foreground_tab') {
		DEBUG && console.log('  P5. Activating new foreground tab');
		await apiTabs.update(newTab.id, { active: true });
	}
}

export function registerPopupCreatedListener(
	listeners: Listeners,
	apiWindows: typeof api.windows,
	apiTabs: typeof api.tabs,
) {
	listeners.add(apiWindows.onCreated,
		createdPopupMover.bind(null, apiWindows, apiTabs), {
			windowTypes: ['popup'],
		}
	);
}
