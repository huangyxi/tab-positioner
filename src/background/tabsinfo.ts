// import { getSessionState, setSessionState } from '../shared/storage';

type WindowId = number;
type TabId = number;
interface TabInfo {
	id: TabId;
	lastAccessed: number;
	openerTabId?: number;
}
type TabIndex = number;

class TabsInfo {
	private info = new Map<WindowId, Map<TabId, TabInfo>>();

	private windowId: WindowId = -1; // Default value for no window

	private indexes = new Map<WindowId, TabIndex>();

	/**
	 * Get the **current** tabs in a window.
	 * The result is updated immediately after each event, but **before** other events in the stack.
	 * @param windowId - The ID of the window to retrieve tabs for.
	 * @param count - The number of tabs to return, sorted by last accessed time.
	 * @returns An array of TabInfo objects, sorted with the most recently accessed tabs first.
	 */
	public getCurrentTabs(
		windowId: WindowId,
		count: number = 1,
	): TabInfo[] {
		if (!this.info.has(windowId)) {
			return [];
		}
		const windowStack = this.info.get(windowId)!;
		const sortedTabs = Array.from(windowStack.values())
			.sort((a, b) => b.lastAccessed - a.lastAccessed) // Sort by last accessed time, descending
			.slice(0, count);
		return sortedTabs;
	}

	/**
	 * Get the **current** windowId.
	 * The result is updated immediately after each event, but **before** other events in the stack.
	 * @returns The windowId of the last accessed window, or -1 if no window is currently active.
	 */
	public getCurrentWindowId(): WindowId {
		return this.windowId;
	}

	/**
	 * Get the **current** index of the last accessed tab in a window.
	 * The result is updated immediately after each event, but **before** other events in the stack.
	 * @param windowId - The ID of the window to retrieve tabs for.
	 * @returns The index of the last accessed tab in the window, or -1 if no tabs are present.
	 */
	public getCurrentIndex(windowId: WindowId): TabIndex {
		return this.indexes.get(windowId) ?? -1; // Return -1 if not found
	}

	private initialize(tabs: chrome.tabs.Tab[]) {
		for (const tab of tabs) {
			if (!this.info.has(tab.windowId)) {
				this.info.set(tab.windowId, new Map<TabId, TabInfo>());
			}
			this.info.get(tab.windowId)!.set(tab.id!, {
				id: tab.id!,
				lastAccessed: tab.lastAccessed,
				openerTabId: tab.openerTabId,
			});
			if (tab.active) {
				this.windowId = tab.windowId;
				this.indexes.set(tab.windowId, tab.index);
			}
		}
	}

	private addTab(windowId: WindowId, tabId: TabId, openerTabId?: TabId) {
		if (!this.info.has(windowId)) {
			this.info.set(windowId, new Map<TabId, TabInfo>());
		}
		this.info.get(windowId)!.set(tabId, {
			id: tabId,
			lastAccessed: Date.now(),
			openerTabId: openerTabId,
		});
	}

	private removeTab(windowId: WindowId, tabId: TabId, isWindowClosing: boolean) {
		if (!this.info.has(windowId)) {
			return;
		}
		const windowStack = this.info.get(windowId)!;
		windowStack.delete(tabId);
		// 'detach' the last tab would not emit onRemoved event, so compare the size
		if (isWindowClosing || windowStack.size === 0) {
			this.info.delete(windowId);
			this.indexes.delete(windowId);
		}
	}

	private activateTab(windowId: WindowId, tabId: TabId, index: TabIndex) {
		if (!this.info.has(windowId)) {
			return;
		}
		const tabInfo = this.info.get(windowId)!.get(tabId);
		if (tabInfo) {
			tabInfo.lastAccessed = Date.now();
		}
		this.windowId = windowId;
		this.indexes.set(windowId, index);
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
