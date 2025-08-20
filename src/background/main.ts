import { DEBUG } from '../shared/debug';
import { Listeners } from '../shared/listeners';
import { SyncSettings } from './syncsettings';
import { TabsInfo } from './tabsinfo';
import { registerTabCreatedListener } from './tabcreation';
import { registerTabRemovedListener } from './tabactivation';


// MUST be Synchronous to ensure the listeners are registered before any events are fired.
function main() {
	if (DEBUG) {
		console.log('Tab Positioner background script started', VERSION);
	}

	const listeners = new Listeners();

	const apiRuntime = api.runtime;
	const apiStorage = api.storage;
	const apiTabs = api.tabs;
	const apiWindows = api.windows;

	SyncSettings.startup(apiRuntime); // no await here
	SyncSettings.registerListeners(listeners, apiRuntime, apiStorage);

	TabsInfo.startup(apiTabs, apiWindows); // no await here
	TabsInfo.registerListeners(listeners, apiTabs, apiWindows);

	// In right order to ensure the listeners in TabsInfo are registered before others.
	// Subsequent events may fire before earlier ones finish processing if the earlier ones take too long.
	// - Create: 1.onCreated -> 2.onCreated -> 1.onActivated -> 2.onActivated
	// - Remove: 1.onRemoved -> 2.onRemoved -> 1.onActivated -> 2.onActivated
	// - Move between Windows: 1.onDetached -> 2.onDetached ( -> 1.onActivated -> 2.onActivated )
	//   -> 1.onAttached -> 2.onAttached -> 1.onActivated -> 2.onActivated
	registerTabCreatedListener(listeners, apiTabs, apiWindows);
	registerTabRemovedListener(listeners, apiTabs);

	listeners.resolve();
}

main();
