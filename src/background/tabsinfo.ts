import { DEBUG } from '../shared/debug';
import { Listeners } from "../shared/listeners";
import { SessionSingleton } from "../shared/session";
import { FIRST_ACTIVATION_DELAY_MS } from "../shared/constants";
import { errorHandler } from '../shared/logging';

type WindowId = number;
type TabId = number;
// TabInfo does not store the index, as it can change.
interface TabInfo {
	id: TabId;
	lastAccessed: number;
	openerTabId?: number;
}
type TabIndex = number;
interface RecentTabInfo {
	id: TabId;
	index: TabIndex;
}
interface RemovedTabInfo {
	id: TabId;
	windowId: WindowId;
}
type DateTime = number;

export class TabsInfo extends SessionSingleton {

	private recentNormalWindowId: WindowId = -1;

	// Updating the indexes of all current tabs immediately after each event may cause performance issues,
	// so we only store the indexes of the most recently active tab for each window.
	// private currentTabs: Record<WindowId, Record<TabId, TabInfo>> = {};

	// The current tabs in a window, sorted with the most recently accessed tabs last.
	private currentTabs: Record<WindowId, TabId[]> = {};


	// Switching windows does not trigger any event if no other tab becomes active,
	// so we need to track the recent tab info for each window to store the index of the removed tab,
	// since this information can't be retrieved from the API once the tab is removed.
	private recentTabs: Record<WindowId, RecentTabInfo> = {};

	// Removed tab may not be the recent tab,
	// so we need to store the removed tab info separately.
	private removedTab: RemovedTabInfo = {
		id: -1,
		windowId: -1,
	}

	// Used to skip tab processing in batches.
	private currentCreatedAt: DateTime = Date.now();
	private recentCreatedAt: DateTime = 0;
	private currentRemovedAt: DateTime = Date.now();
	private recentRemovedAt: DateTime = 0;

	// Used to track if the background worker has been offloaded.
	private _hasTabActivated = false;

	/**
	 * Get the **current** tabs in a window.
	 * The result is updated immediately after each event, but **before** other events in the event queue.
	 * @param windowId - The ID of the window to retrieve tabs for.
	 * @returns An array of TabInfo objects, sorted with the most recently accessed tabs first.
	 */
	public getCurrentTabs(
		windowId: WindowId,
	): TabId[] {
		const windowTabs = this.currentTabs[windowId];
		if (!windowTabs) {
			return [];
		}
		return windowTabs;
	}

	/**
	 * Get the **recent** tab info.
	 * The result is updated immediately after 'onActivated' event,
	 * which is the only event that updates the **recent** tab info.
	 * @param windowId - The ID of the window to retrieve the recent tab info for.
	 * @returns The recent tab info, or an object with -1 values if no tab is active.
	 */
	public getRecentTab(windowId: WindowId): RecentTabInfo {
		return this.recentTabs[windowId] ?? {
			id: -1,
			index: -1,
		}
	}

	/**
	 * Get the recent removed tab info.
	 * @returns The removed tab info, or an object with -1 values if no tab was removed.
	 */
	public getRemovedTab(): RemovedTabInfo {
		return this.removedTab;
	}

	/**
	 * Get the time difference between the most recent tab creation and the previous one.
	 * This is used to determine if the tab creation is part of a batch operation.
	 * @returns The time difference in milliseconds.
	 */
	public getCreationDelay(): DateTime {
		return this.currentCreatedAt - this.recentCreatedAt;
	}

	/**
	 * Get the time difference between the most recent tab removal and the previous one.
	 * This is used to determine if the tab removal is part of a batch operation.
	 * @returns The time difference in milliseconds.
	 */
	public getRemovalDelay(): DateTime {
		return this.currentRemovedAt - this.recentRemovedAt;
	}

	public findTab(tabId: TabId): WindowId | undefined {
		for (const windowId in this.currentTabs) {
			if (!this.currentTabs[windowId].includes(tabId)) continue;
			return parseInt(windowId, 10);
		}
		return undefined;
	}

	public getRecentNormalWindowId(): WindowId {
		return this.recentNormalWindowId;
	}

	public hasTabActivated(): boolean {
		return this._hasTabActivated;
	}

	/**
	 * @param normalTabs Tabs with `windowType: 'normal'` to initialize the TabsInfo,
	 * where the `windowId` and `id` are defined.
	 */
	private async initialize(
		normalTabs: api.tabs.Tab[],
		recentWindowId: WindowId = -1,
	) {
		if (DEBUG) {
			console.log(' tabsInfo: Initialized', this);
		}
		this.currentTabs = {};
		this.recentTabs = {};
		const sortedTabs = normalTabs.sort((a, b) => a.lastAccessed - b.lastAccessed);
		for (const tab of sortedTabs) {
			if (tab.windowId === undefined || tab.id === undefined) continue;

			if (!this.currentTabs[tab.windowId]) {
				this.currentTabs[tab.windowId] = [];
			}
			this.currentTabs[tab.windowId].push(tab.id);
			if (!tab.active) {
				continue;
			}
			this.recentTabs[tab.windowId] = {
				id: tab.id,
				index: tab.index,
			};
		}
		this.recentNormalWindowId = recentWindowId;
		this.saveState();
	}

	/**
	 * Updates the recent tabs with the current active tabs.
	 * This is used to update the recent tab info when the index of the recent tab has likely changed,
	 * but the 'onActivated' event was not fired.
	 * @param normalActiveTabs - Tabs with `windowType: 'normal'` and 'active: true` to update the recent tabs,
	 * where the `windowId` and `id` are defined.
	 */
	private updateRecentTabs(
		normalActiveTabs: api.tabs.Tab[],
	) {
		if (DEBUG) {
			console.log(' tabsInfo: Recent tabs updated');
		}
		for (const tab of normalActiveTabs) {
			this.recentTabs[tab.windowId] = {
				id: tab.id!,
				index: tab.index,
			};
		}
		this.saveState();
	}

	private addTab(
		windowId: WindowId,
		tabId: TabId,
		openerTabId?: TabId,
	) {
		if (DEBUG) {
			console.log(' tabsInfo: Adding tab');
		}
		this.recentCreatedAt = this.currentCreatedAt;
		this.currentCreatedAt = Date.now();
		if (!this.currentTabs[windowId]) {
			this.currentTabs[windowId] = [];
		}
		this.currentTabs[windowId].push(tabId);
		this.saveState();
	}

	private removeTab(
		windowId: WindowId,
		tabId: TabId,
		isWindowClosing: boolean,
	) {
		if (DEBUG) {
			console.log(' tabsInfo: Removing tab');
		}
		this.recentRemovedAt = this.currentRemovedAt;
		this.currentRemovedAt = Date.now();
		const windowTabs = this.currentTabs[windowId];
		if (!windowTabs) {
			return;
		}

		this.removedTab = {
			id: tabId,
			windowId: windowId,
		};
		// 'detach' the last tab would not fire onRemoved event, so compare the size
		this.currentTabs[windowId] = windowTabs.filter(id => id !== tabId);
		if (isWindowClosing || this.currentTabs[windowId].length === 0) {
			delete this.currentTabs[windowId];
			delete this.recentTabs[windowId];
			return;
		}
		this.saveState();
	}

	public activateTab(
		windowId: WindowId,
		tabId: TabId,
		index: TabIndex,
	) {
		if (DEBUG) {
			console.log(` tabsInfo: Activating tab ${tabId} in window ${windowId} at index ${index}`);
		}
		const windowTabs = this.currentTabs[windowId];
		if (!windowTabs) {
			return;
		}
		this.currentTabs[windowId] = windowTabs.filter(id => id !== tabId);
		this.currentTabs[windowId].push(tabId);
		this.recentTabs[windowId] = {
			id: tabId,
			index: index,
		};
		this.saveState();
	}

	/**
	 * Ensures initialization after the background script starts,
	 * when api.runtime.onStartup and api.runtime.onInstalled events are not fired after restoring from suspension or being disabled.
	 */
	public static async startup(
		apiTabs: typeof api.tabs,
		apiWindows: typeof api.windows,
	) {
		const instance = await this.getInstance();
		if (DEBUG) {
			console.log(' tabsInfo: Instance created at startup');
		}
		const normalTabs = await apiTabs.query({ windowType: 'normal' });
		const currentWindow = await apiWindows.getCurrent();
		const recentWindowId = currentWindow?.id ?? -1;
		await instance.initialize(normalTabs, recentWindowId);
	}

	public static registerListeners(
		listeners: Listeners,
		apiTabs: typeof api.tabs,
		apiWindows: typeof api.windows,
	) {
		listeners.add(apiTabs.onCreated, async (tab) => {
			if (false
				|| tab.id === undefined
				|| tab.id === apiTabs.TAB_ID_NONE
			) {
				return;
			}
			const instance = await this.getInstance();
			instance.addTab(tab.windowId, tab.id, tab.openerTabId);
		});

		listeners.add(apiTabs.onRemoved, async (tabId, removeInfo) => {
			const instance = await this.getInstance();
			instance.removeTab(removeInfo.windowId, tabId, removeInfo.isWindowClosing);
			if (instance.recentTabs[removeInfo.windowId]?.id !== tabId) {
				const normalActiveTabs = await apiTabs.query({
					active: true,
					windowId: removeInfo.windowId,
					windowType: 'normal',
				});
				instance.updateRecentTabs(normalActiveTabs);
			}
		});

		listeners.add(apiTabs.onAttached, async (tabId, attachInfo) => {
			const instance = await this.getInstance();
			instance.addTab(attachInfo.newWindowId, tabId);
		});

		listeners.add(apiTabs.onDetached, async (tabId, detachInfo) => {
			const instance = await this.getInstance();
			instance.removeTab(detachInfo.oldWindowId, tabId, false);
		});

		listeners.add(apiTabs.onActivated, async (activeInfo) => {
			let tab: api.tabs.Tab;
			try {
				tab = await apiTabs.get(activeInfo.tabId);
			} catch (error: any) {
				if (DEBUG) {
					if (error.message.startsWith('No tab with id:')) {
						console.log(` tabsInfo: Tab ${activeInfo.tabId} not found`);
					}
					else {
						errorHandler(error);
					}
				}
				return;
			}
			if (tab.id !== activeInfo.tabId) {
				if (DEBUG) {
					console.log(` tabsInfo: Tab ID mismatch: ${tab.id} !== ${activeInfo.tabId}`);
				}
				return;
			}
			const instance = await this.getInstance();
			if (!instance._hasTabActivated) {
				await new Promise(resolve => setTimeout(resolve, FIRST_ACTIVATION_DELAY_MS));
				instance._hasTabActivated = true;
			}
			instance.activateTab(activeInfo.windowId, activeInfo.tabId, tab.index);
		});

		listeners.add(apiTabs.onUpdated, async (tabId, changeInfo, tab) => {
			if (changeInfo.pinned === undefined || changeInfo.pinned === false) {
				return; // Only handle pinned state changes
			}
			if (DEBUG) {
				console.log(' tabsInfo: Tab pinned', tabId, changeInfo);
			}
			const instance = await this.getInstance();
			const normalActiveTabs = await apiTabs.query({
				active: true,
				windowType: 'normal',
			});
			instance.updateRecentTabs(normalActiveTabs);
		});

		listeners.add(apiTabs.onMoved, async (tabId, moveInfo) => {
			if (DEBUG) {
				console.log(' tabsInfo: Tab moved', tabId, moveInfo);
			}
			const instance = await this.getInstance();
			instance._hasTabActivated = true;
			const normalTabs = await apiTabs.query({ windowType: 'normal' });
			await instance.initialize(normalTabs);
		});

		listeners.add(apiWindows.onFocusChanged, async (windowId) => {
			if (DEBUG) {
				console.log(' tabsInfo: Window focus changed', windowId);
			}
			const instance = await this.getInstance();
			if (windowId !== -1) { // api.windows.WINDOW_ID_NONE
				instance.recentNormalWindowId = windowId;
			}
		}, { windowTypes: ['normal'] });
	}

}
