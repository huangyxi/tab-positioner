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

class TabsInfo {
	// Updating the indexes of all current tabs immediately after each event may cause performance issues,
	// so we only store the indexes of the most recently active tab for each window.
	private currentTabs = new Map<WindowId, Map<TabId, TabInfo>>();

	// Switching windows does not trigger any event if no other tab becomes active,
	// so we need to track the recent tab info for each window to store the index of the removed tab,
	// since this information can't be retrieved from the API once the tab is removed.
	private recentTabs = new Map<WindowId, RecentTabInfo>();

	// Removed tab may not be the recent tab,
	// so we need to store the removed tab info separately.
	private removedTab: RemovedTabInfo = {
		id: -1,
		windowId: -1,
	}
	/**
	 * Get the **current** tabs in a window.
	 * The result is updated immediately after each event, but **before** other events in the event queue.
	 * @param windowId - The ID of the window to retrieve tabs for.
	 * @param count - The number of tabs to return, sorted by last accessed time.
	 * @returns An array of TabInfo objects, sorted with the most recently accessed tabs first.
	 */
	public getCurrents(
		windowId: WindowId,
	): TabInfo[] {
		if (!this.currentTabs.has(windowId)) {
			return [];
		}
		const windowTabs = this.currentTabs.get(windowId)!;
		const sortedTabs = Array.from(windowTabs.values())
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
		return this.recentTabs.get(windowId) ?? {
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
	 * @param normalTabs Tabs with `windowType: 'normal'` to initialize the TabsInfo,
	 * where the `windowId` and `id` are defined.
	 */
	private initialize(
		normalTabs: api.tabs.Tab[],
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Initialized');
		}
		for (const tab of normalTabs) {
			if (!this.currentTabs.has(tab.windowId)) {
				this.currentTabs.set(tab.windowId, new Map<TabId, TabInfo>());
			}
			this.currentTabs.get(tab.windowId)!.set(tab.id!, {
				id: tab.id!,
				lastAccessed: tab.lastAccessed,
				openerTabId: tab.openerTabId,
			});
			if (!tab.active) {
				continue;
			}
			this.recentTabs.set(tab.windowId, {
				id: tab.id!,
				index: tab.index,
			});
		}
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
			console.log('TABS_INFO: Recent tabs updated');
		}
		for (const tab of normalActiveTabs) {
			this.recentTabs.set(tab.windowId, {
				id: tab.id!,
				index: tab.index,
			});
		}
	}

	private addTab(
		windowId: WindowId,
		tabId: TabId,
		openerTabId?: TabId,
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Adding tab');
		}
		if (!this.currentTabs.has(windowId)) {
			this.currentTabs.set(windowId, new Map<TabId, TabInfo>());
		}
		this.currentTabs.get(windowId)!.set(tabId, {
			id: tabId,
			lastAccessed: Date.now(),
			openerTabId: openerTabId,
		});
	}

	private removeTab(
		windowId: WindowId,
		tabId: TabId,
		isWindowClosing: boolean,
	) {
		if (DEBUG) {
			console.log('TABS_INFO: Removing tab');
		}
		if (!this.currentTabs.has(windowId)) {
			return;
		}
		const windowTabs = this.currentTabs.get(windowId)!;
		// 'detach' the last tab would not fire onRemoved event, so compare the size
		this.removedTab = {
			id: tabId,
			windowId: windowId,
		};
		if (isWindowClosing || windowTabs.size === 1) {
			this.currentTabs.delete(windowId);
			this.recentTabs.delete(windowId);
			return;
		}
		windowTabs.delete(tabId);
	}

	private activateTab(
		windowId: WindowId,
		tabId: TabId,
		index: TabIndex,
	) {
		if (DEBUG) {
			console.log(`TABS_INFO: Activating tab ${tabId} in window ${windowId} at index ${index}`);
		}
		const windowTabs = this.currentTabs.get(windowId);
		if (!windowTabs) {
			return;
		}
		const tabInfo = windowTabs!.get(tabId);
		if (tabInfo) {
			tabInfo.lastAccessed = Date.now();
		}
		this.recentTabs.set(windowId, {
			id: tabId,
			index: index,
		});
	}

	public registerListeners(
		apiRuntime: typeof api.runtime,
		apiTabs: typeof api.tabs,
	) {
		apiRuntime.onInstalled.addListener(async () => {
			const normalTabs = await apiTabs.query({ windowType: 'normal' });
			this.initialize(normalTabs);
		});

		apiRuntime.onStartup.addListener(async () => {
			const normalTabs = await apiTabs.query({ windowType: 'normal' });
			this.initialize(normalTabs);
		});

		apiTabs.onCreated.addListener((tab) => {
			if (tab.id === undefined || tab.id === apiTabs.TAB_ID_NONE) {
				return;
			}
			this.addTab(tab.windowId, tab.id, tab.openerTabId);
		});

		apiTabs.onRemoved.addListener(async (tabId, removeInfo) => {
			this.removeTab(removeInfo.windowId, tabId, removeInfo.isWindowClosing);
			if (this.recentTabs.get(removeInfo.windowId)?.id !== tabId) {
				const normalActiveTabs = await apiTabs.query({
					windowType: 'normal',
					active: true,
					windowId: removeInfo.windowId,
				});
				this.updateRecentTabs(normalActiveTabs);
			}
		});

		apiTabs.onAttached.addListener((tabId, attachInfo) => {
			if (attachInfo.newWindowId !== undefined) {
				this.addTab(attachInfo.newWindowId, tabId);
			}
		});

		apiTabs.onDetached.addListener((tabId, detachInfo) => {
			if (detachInfo.oldWindowId !== undefined) {
				this.removeTab(detachInfo.oldWindowId, tabId, false);
			}
		});

		apiTabs.onActivated.addListener(async (activeInfo) => {
			const tab = await apiTabs.get(activeInfo.tabId);
			if (tab.id === undefined || tab.id === apiTabs.TAB_ID_NONE) {
				return;
			}
			this.activateTab(activeInfo.windowId, activeInfo.tabId, tab.index);
		});

		apiTabs.onUpdated.addListener(async (tabId, changeInfo) => {
			if (DEBUG) {
				console.log('TABS_INFO: Tab updated', tabId, changeInfo);
			}
			if (changeInfo.pinned === true) {
				const normalActiveTabs = await apiTabs.query({
					windowType: 'normal',
					active: true,
				});
				this.updateRecentTabs(normalActiveTabs);
			}
		});
	}
}

export const TABS_INFO = new TabsInfo();
