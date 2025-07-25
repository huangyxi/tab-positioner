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
	windowId: WindowId;
}

class TabsInfo {
	private currentTabs = new Map<WindowId, Map<TabId, TabInfo>>();

	private recentTab: RecentTabInfo = {
		id: -1,
		index: -1,
		windowId: -1,
	};

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
	 * @returns The recent tab info, or an object with -1 values if no tab is active.
	 */
	public getRecent(): RecentTabInfo {
		return this.recentTab;
	}

	/**
	 * @param normalTabs Tabs with `windowType: 'normal'` to initialize the TabsInfo,
	 * where the `windowId` and `id` are defined.
	 */
	private initialize(normalTabs: chrome.tabs.Tab[]) {
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
			this.recentTab = {
				id: tab.id!,
				index: tab.index,
				windowId: tab.windowId,
			};
		}
	}

	private addTab(windowId: WindowId, tabId: TabId, openerTabId?: TabId) {
		if (!this.currentTabs.has(windowId)) {
			this.currentTabs.set(windowId, new Map<TabId, TabInfo>());
		}
		this.currentTabs.get(windowId)!.set(tabId, {
			id: tabId,
			lastAccessed: Date.now(),
			openerTabId: openerTabId,
		});
	}

	private removeTab(windowId: WindowId, tabId: TabId, isWindowClosing: boolean) {
		if (!this.currentTabs.has(windowId)) {
			return;
		}
		const windowTabs = this.currentTabs.get(windowId)!;
		// 'detach' the last tab would not fire onRemoved event, so compare the size
		if (isWindowClosing || windowTabs.size === 1) {
			this.currentTabs.delete(windowId);
			return;
		}
		windowTabs.delete(tabId);
	}

	private activateTab(windowId: WindowId, tabId: TabId, index: TabIndex) {
		console.log(`Activating tab ${tabId} in window ${windowId} at index ${index}`);
		const windowTabs = this.currentTabs.get(windowId);
		if (!windowTabs) {
			return;
		}
		const tabInfo = windowTabs!.get(tabId);
		if (tabInfo) {
			tabInfo.lastAccessed = Date.now();
		}
		this.recentTab = {
			id: tabId,
			index: index,
			windowId: windowId,
		};
	}

	public registerListeners(
		apiRuntime: typeof chrome.runtime,
		apiTabs: typeof chrome.tabs,
	) {
		apiRuntime.onInstalled.addListener(async () => {
			const tabs = await apiTabs.query({ windowType: 'normal' });
			this.initialize(tabs);
		});

		apiRuntime.onStartup.addListener(async () => {
			const tabs = await apiTabs.query({ windowType: 'normal' });
			this.initialize(tabs);
		});

		apiTabs.onCreated.addListener((tab) => {
			if (tab.id === undefined || tab.id === apiTabs.TAB_ID_NONE) {
				return;
			}
			this.addTab(tab.windowId, tab.id, tab.openerTabId);
		});

		apiTabs.onRemoved.addListener((tabId, removeInfo) => {
			this.removeTab(removeInfo.windowId, tabId, removeInfo.isWindowClosing);
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
	}
}

export const TABS_INFO = new TabsInfo();
