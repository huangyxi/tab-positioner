import { getSettings, setSettings, getSessionState, setSessionState } from '../shared/storage';
import { TABS_INFO } from './tabsinfo';
import { registerTabCreatedListener } from './tabcreated';

async function main() {
	chrome.runtime.onInstalled.addListener(async () => {
		const settings = await getSettings(true);
		await setSettings(settings);
	});

	// In right order to ensure the listeners in ACTIVATION_STACK are registered before others
	// - Create: 1.onCreated -> 2.onCreated -> 1.onActivated -> 2.onActivated
	// - Remove: 1.onRemoved -> 2.onRemoved -> 1.onActivated -> 2.onActivated
	// - Move between Windows: 1.onDetached -> 2.onDetached ( -> 1.onActivated -> 2.onActivated )
	//   -> 1.onAttached -> 2.onAttached -> 1.onActivated -> 2.onActivated
	TABS_INFO.registerListeners(chrome.runtime, chrome.tabs);
	registerTabCreatedListener(chrome.tabs);

}

main();
