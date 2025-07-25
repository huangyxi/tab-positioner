import { getSettings, setSettings } from '../shared/storage';
import { TABS_INFO } from './tabsinfo';
import { registerTabCreatedListener } from './tabcreation';
import { registerTabRemovedListener } from './tabactivation';

async function main() {
	chrome.runtime.onInstalled.addListener(async () => {
		const settings = await getSettings(true);
		await setSettings(settings);
	});

	// In right order to ensure the listeners in TABS_INFO are registered before others.
	// Subsequent events may fire before earlier ones finish processing if the earlier ones take too long.
	// - Create: 1.onCreated -> 2.onCreated -> 1.onActivated -> 2.onActivated
	// - Remove: 1.onRemoved -> 2.onRemoved -> 1.onActivated -> 2.onActivated
	// - Move between Windows: 1.onDetached -> 2.onDetached ( -> 1.onActivated -> 2.onActivated )
	//   -> 1.onAttached -> 2.onAttached -> 1.onActivated -> 2.onActivated
	TABS_INFO.registerListeners(chrome.runtime, chrome.tabs);
	registerTabCreatedListener(chrome.tabs);
	registerTabRemovedListener(chrome.tabs);
}

main();
