import { FIRST_ACTIVATION_DELAY_MS } from '../shared/constants';
import { logClosure } from '../shared/logging';
import type { TabCreationPosition } from '../shared/settings';
import type { TabsInfo } from './tabsinfo';

export async function tabMover(
	apiTabs: typeof api.tabs,
	tabsInfo: TabsInfo,
	tabId: number,
	windowId: number,
	setting: TabCreationPosition,
	index: number | undefined,
	hasLoaded: boolean,
) {
	const logger = logClosure('  tabMover');
	logger.debug('Tab mover called');
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
	logger.debug('Determined new index:', newIndex);
	if (newIndex === index) return;
	try {
		await apiTabs.move(tabId, {
			index: newIndex,
			windowId: windowId === -1 ? undefined : windowId,
		});
		logger.info('Tab moved to index:', newIndex);
		if (!hasLoaded) {
			await new Promise((resolve) => setTimeout(resolve, FIRST_ACTIVATION_DELAY_MS));
			const [tab] = await apiTabs.query({
				active: true,
				windowId: windowId,
			});
			if (tab?.id === tabId) {
				logger.info('Re-activating moved tab');
				tabsInfo.activateTab(windowId, tabId, newIndex);
			}
		}
	} catch (error) {
		logger.error(error);
	}
	logger.debug('Tab move process completed');
}
