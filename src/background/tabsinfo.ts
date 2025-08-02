import { SessionSingleton } from "../shared/storage";

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

	// Updating the indexes of all current tabs immediately after each event may cause performance issues,
	// so we only store the indexes of the most recently active tab for each window.
	private currentTabs: Record<WindowId, Record<TabId, TabInfo>> = {};


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

	/**
	 * Get the **current** tabs in a window.
	 * The result is updated immediately after each event, but **before** other events in the event queue.
	 * @param windowId - The ID of the window to retrieve tabs for.
	 * @returns An array of TabInfo objects, sorted with the most recently accessed tabs first.
	 */
	public getCurrents(
		windowId: WindowId,
	): TabInfo[] {
		const windowTabs = this.currentTabs[windowId];
		if (!windowTabs) {
			return [];
		}
		const sortedTabs = Object.values(windowTabs)
			.sort((a, b) => b.lastAccessed - a.lastAccessed) // Sort by last accessed time, descending
		return sortedTabs;
	}

	/**
	 * Get the **recent** tab info.
	 * The result is updated immediately after 'onActivated' event,
	 * which is the only event that updates the **recent** tab info.
	 * @param windowId - The ID of the window to retrieve the recent tab info for.
	 * @returns The recent tab info, or an object with -1 values if no tab is active.
	 */
	public getRecent(windowId: WindowId): RecentTabInfo {
		return this.recentTabs[windowId] ?? {
			id: -1,
			index: -1,
		}
	}

	/**
	 * Get the recent removed tab info.
	 * @returns The removed tab info, or an object with -1 values if no tab was removed.
	 */
	public getRemoved(): RemovedTabInfo {
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

	/**
	 * @param normalTabs Tabs with `windowType: 'normal'` to initialize the TabsInfo,
	 * where the `windowId` and `id` are defined.
	 */
	public async initialize(
		normalTabs: api.tabs.Tab[],
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Initialized', this);
		}
		for (const tab of normalTabs) {
			if (tab.windowId === undefined || tab.id === undefined) continue;

			if (!this.currentTabs[tab.windowId]) {
				this.currentTabs[tab.windowId] = {};
			}
			this.currentTabs[tab.windowId][tab.id] = {
				id: tab.id,
				lastAccessed: tab.lastAccessed,
				openerTabId: tab.openerTabId,
			};
			if (!tab.active) {
				continue;
			}
			this.recentTabs[tab.windowId] = {
				id: tab.id,
				index: tab.index,
			};
		}
		await this.saveState();
	}

	/**
	 * Updates the recent tabs with the current active tabs.
	 * This is used to update the recent tab info when the index of the recent tab has likely changed,
	 * but the 'onActivated' event was not fired.
	 * @param normalActiveTabs - Tabs with `windowType: 'normal'` and 'active: true` to update the recent tabs,
	 * where the `windowId` and `id` are defined.
	 */
	private async updateRecentTabs(
		normalActiveTabs: api.tabs.Tab[],
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Recent tabs updated');
		}
		for (const tab of normalActiveTabs) {
			this.recentTabs[tab.windowId] = {
				id: tab.id!,
				index: tab.index,
			};
		}
		await this.saveState();
	}

	private async addTab(
		windowId: WindowId,
		tabId: TabId,
		openerTabId?: TabId,
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Adding tab');
		}
		this.recentCreatedAt = this.currentCreatedAt;
		this.currentCreatedAt = Date.now();
		if (!this.currentTabs[windowId]) {
			this.currentTabs[windowId] = {};
		}
		this.currentTabs[windowId][tabId] = {
			id: tabId,
			lastAccessed: Date.now(),
			openerTabId: openerTabId,
		};
		await this.saveState();
	}

	private async removeTab(
		windowId: WindowId,
		tabId: TabId,
		isWindowClosing: boolean,
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Removing tab');
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
		if (isWindowClosing || Object.keys(windowTabs).length === 1) {
			delete this.currentTabs[windowId];
			delete this.recentTabs[windowId];
			return;
		}
		delete windowTabs[tabId];
		await this.saveState();
	}

	public async activateTab(
		windowId: WindowId,
		tabId: TabId,
		index: TabIndex,
	) {
		if (DEBUG) {
			console.log(`TABS_INFO: Activating tab ${tabId} in window ${windowId} at index ${index}`);
		}
		const windowTabs = this.currentTabs[windowId];
		if (!windowTabs) {
			return;
		}
		const tabInfo = windowTabs[tabId];
		if (tabInfo) {
			tabInfo.lastAccessed = Date.now();
		}
		this.recentTabs[windowId] = {
			id: tabId,
			index: index,
		};
		await this.saveState();
	}

	public static registerListeners(
		apiRuntime: typeof api.runtime,
		apiTabs: typeof api.tabs,
	) {
		apiRuntime.onInstalled.addListener(async () => {
			const instance = await this.getInstance();
			const normalTabs = await apiTabs.query({ windowType: 'normal' });
			await instance.initialize(normalTabs);
		});

		apiRuntime.onStartup.addListener(async () => {
			const instance = await this.getInstance();
			const normalTabs = await apiTabs.query({ windowType: 'normal' });
			await instance.initialize(normalTabs);
		});

		apiTabs.onCreated.addListener(async (tab) => {
			if (tab.id === undefined || tab.id === apiTabs.TAB_ID_NONE) {
				return;
			}
			const instance = await this.getInstance();
			await instance.addTab(tab.windowId, tab.id, tab.openerTabId);
		});

		apiTabs.onRemoved.addListener(async (tabId, removeInfo) => {
			const instance = await this.getInstance();
			await instance.removeTab(removeInfo.windowId, tabId, removeInfo.isWindowClosing);
			if (instance.recentTabs[removeInfo.windowId]?.id !== tabId) {
				const normalActiveTabs = await apiTabs.query({
					windowType: 'normal',
					active: true,
					windowId: removeInfo.windowId,
				});
				await instance.updateRecentTabs(normalActiveTabs);
			}
		});

		apiTabs.onAttached.addListener(async (tabId, attachInfo) => {
			const instance = await this.getInstance();
			await instance.addTab(attachInfo.newWindowId, tabId);
		});

		apiTabs.onDetached.addListener(async (tabId, detachInfo) => {
			const instance = await this.getInstance();
			await instance.removeTab(detachInfo.oldWindowId, tabId, false);
		});

		apiTabs.onActivated.addListener(async (activeInfo) => {
			const tab = await apiTabs.get(activeInfo.tabId);
			if (tab.id === undefined || tab.id === apiTabs.TAB_ID_NONE) {
				return;
			}
			const instance = await this.getInstance();
			await instance.activateTab(activeInfo.windowId, activeInfo.tabId, tab.index);
		});

		apiTabs.onUpdated.addListener(async (_tabId, changeInfo, _tab) => {
			if (DEBUG) {
				console.log('TABS_INFO: Tab updated', _tabId, changeInfo);
			}
			if (changeInfo.pinned === true) {
				const instance = await this.getInstance();
				const normalActiveTabs = await apiTabs.query({
					windowType: 'normal',
					active: true,
				});
				await instance.updateRecentTabs(normalActiveTabs);
			}
		});
	}
}
