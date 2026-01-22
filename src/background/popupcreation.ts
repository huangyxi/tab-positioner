import type { TabCreationPosition } from '../shared/settings';
import { logClosure } from '../shared/logging';

import { SyncSettings } from './syncsettings';
import type { TabsInfo } from './tabsinfo';
import { tabMover } from './tabmover';

export async function createdPopupMover(
	apiTabs: typeof api.tabs,
	tabsInfo: TabsInfo,
	tabId: number,
	hasLoaded: boolean,

) {
	const logger = logClosure('  popupCreation');
	logger.debug('Popup created mover called');
	const windowId = tabsInfo.getRecentNormalWindowId();
	logger.debug('Opener window ID:', windowId);
	const settings = await SyncSettings.getInstance();
	const setting = settings.get('_popup_position');
	logger.debug('Popup creation setting:', setting);
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
	logger.debug('Determined tab creation setting for popup:', tabCreationSetting);
	if (tabCreationSetting === 'default') return;
	logger.info('Moving created popup tab according to setting');
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
		logger.info('Activating new foreground tab');
		await apiTabs.update(tabId, { active: true });
	}
	logger.debug('Popup created mover process completed');
}
