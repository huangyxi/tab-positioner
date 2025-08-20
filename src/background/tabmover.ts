import { DEBUG } from "../shared/debug";
import { TabCreationPosition } from "../shared/settings";
import { FIRST_ACTIVATION_DELAY_MS } from "../shared/constants";
import { errorHandler } from "../shared/logging";

import { TabsInfo } from "./tabsinfo";

export async function tabMover(
	apiTabs: typeof api.tabs,
	tabsInfo: TabsInfo,
	tabId: number,
	windowId: number,
	setting: TabCreationPosition,
	index: number | undefined,
	hasLoaded: boolean,
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
				DEBUG && console.log('  c2a. Active tab again');
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
	DEBUG && console.log('  c3->X. Tab moved');
}
