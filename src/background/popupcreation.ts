import { DEBUG } from '../shared/debug';
import type { TabCreationPosition } from '../shared/settings';

import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';
import { tabMover } from './tabmover';

export async function createdPopupMover(
	apiTabs: typeof api.tabs,
	tabsInfo: TabsInfo,
	tabId: number,
	hasLoaded: boolean,

) {
	DEBUG && console.log('  P1. Popup created');
	const windowId = tabsInfo.getRecentNormalWindowId();
	DEBUG && console.log('  P2 Window ID for opener tab:', windowId);
	const settings = await SyncSettings.getInstance();
	const setting = settings.get('_popup_position');
	DEBUG && console.log('  P3. Popup creation setting:', setting);
	if (setting === 'default') return;
	// Should get the window again with populate: true to ensure tabs are included.
	// const newTab = newWindow.tabs?.[0];
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
	DEBUG && console.log('  P4->c. Tab creation setting for popup:', tabCreationSetting);
	if (tabCreationSetting === 'default') return;
	await tabMover(
		apiTabs,
		tabsInfo,
		tabId,
		windowId,
		tabCreationSetting,
		undefined,
		hasLoaded,
	);
	if (setting === 'new_foreground_tab') {
		DEBUG && console.log('  P5. Activating new foreground tab');
		await apiTabs.update(tabId, { active: true });
	}
}
