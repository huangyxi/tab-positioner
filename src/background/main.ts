import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';
import { registerTabCreatedListener } from './tabcreation';
import { registerTabRemovedListener } from './tabactivation';

async function main() {
	if (DEBUG) {
		console.log('Tab Positioner background script started');
	}

	const apiRuntime = api.runtime;
	const apiStorage = api.storage;
	const apiTabs = api.tabs;

	SyncSettings.registerListeners(apiRuntime, apiStorage);

	// In right order to ensure the listeners in TABS_INFO are registered before others.
	// Subsequent events may fire before earlier ones finish processing if the earlier ones take too long.
	// - Create: 1.onCreated -> 2.onCreated -> 1.onActivated -> 2.onActivated
	// - Remove: 1.onRemoved -> 2.onRemoved -> 1.onActivated -> 2.onActivated
	// - Move between Windows: 1.onDetached -> 2.onDetached ( -> 1.onActivated -> 2.onActivated )
	//   -> 1.onAttached -> 2.onAttached -> 1.onActivated -> 2.onActivated
	TabsInfo.registerListeners(apiRuntime, apiTabs);
	registerTabCreatedListener(apiTabs);
	registerTabRemovedListener(apiTabs);
}

main();
