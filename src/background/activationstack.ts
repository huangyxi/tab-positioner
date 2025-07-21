import { getSessionState, setSessionState } from '../shared/storage';

type WindowId = number;
type TabId = number;
export type ActivationStack = Record<WindowId, TabId[]>;

const ACTIVATION_STACK_KEY = 'activation_stack';

export async function getActivationStack(): Promise<ActivationStack> {
	const activationStack = await getSessionState(ACTIVATION_STACK_KEY);
	if (!activationStack) {
		return {};
	}
	return activationStack as ActivationStack;
}

async function setActivationStack(activationStack: ActivationStack): Promise<void> {
	await setSessionState(ACTIVATION_STACK_KEY, activationStack);
}

async function initializeActivationStack() {
	const tabs = (await chrome.tabs.query({}))
		.filter(tab => tab.id !== undefined)
	const windowIds = tabs.map(t => t.windowId);
	const activationStack: Partial<Record<number, number[]>> = {};
	for (const windowId of windowIds) {
		const tabsInWindow = tabs.filter(t => t.windowId === windowId);
		const activeTabs = tabsInWindow.filter(t => t.active)
		const inactiveTabs = tabsInWindow.filter(t => !t.active);
		activationStack[windowId] = [
			...activeTabs.map(t => t.id as number),
			...inactiveTabs.map(t => t.id as number),
		];
	}
	await setActivationStack(activationStack as any);
}

async function addTabToActivationStack(tabId: number, windowId: number) {
	let activationStack = await getActivationStack();
	if (!activationStack[windowId]) {
		activationStack[windowId] = [];
	}
	activationStack[windowId].filter(id => id !== tabId); // Remove any existing entry for this tab
	activationStack[windowId].unshift(tabId); // Add the new tab to the
	await setActivationStack(activationStack);
}

async function removeTabFromActivationStack(tabId: number, windowId: number, isWindowClosing: boolean) {
	let activationStack = await getActivationStack();
	if (!activationStack[windowId]) return; // No tabs in this window
	if (isWindowClosing) {
		delete activationStack[windowId];
		return await setActivationStack(activationStack);
	}
	activationStack[windowId] = activationStack[windowId].filter(id => id !== tabId);
	if (activationStack[windowId].length === 0) {
		delete activationStack[windowId];
	}
	await setActivationStack(activationStack);
}

export function registerActivationStackListeners(
	chromeRuntime: typeof chrome.runtime,
	chromeTabs: typeof chrome.tabs,
) {
	chromeRuntime.onStartup.addListener(initializeActivationStack);

	chromeTabs.onActivated.addListener(async (activeInfo) => {
		await addTabToActivationStack(activeInfo.tabId, activeInfo.windowId);
	});

	chromeTabs.onRemoved.addListener(async (tabId, removeInfo) => {
		await removeTabFromActivationStack(tabId, removeInfo.windowId, removeInfo.isWindowClosing);
	});
}
