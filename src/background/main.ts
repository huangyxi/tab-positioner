import { loadSettings, saveSettings } from '../shared/storage';
import { setSettings } from '../shared/settings';
import { TABS_INFO } from './tabsinfo';
import { registerTabCreatedListener } from './tabcreation';
import { registerTabRemovedListener } from './tabactivation';

async function main() {
	if (DEBUG) {
		console.log('Tab Positioner background script started');
	}
	api.runtime.onInstalled.addListener(async () => {
		const settings = await loadSettings();
		setSettings(settings);
		await saveSettings(settings);
	});

	api.runtime.onStartup.addListener(async () => {
		const settings = await loadSettings();
		setSettings(settings);
		await saveSettings(settings);
	});

	api.storage.onChanged.addListener(async (changes, areaName) => {
		if (areaName !== 'sync') {
			return;
		}
		const settings = await loadSettings();
		setSettings(settings);
		if (DEBUG) {
			console.log('Settings changed:', changes);
		}
		await saveSettings(settings);
	});


	// In right order to ensure the listeners in TABS_INFO are registered before others.
	// Subsequent events may fire before earlier ones finish processing if the earlier ones take too long.
	// - Create: 1.onCreated -> 2.onCreated -> 1.onActivated -> 2.onActivated
	// - Remove: 1.onRemoved -> 2.onRemoved -> 1.onActivated -> 2.onActivated
	// - Move between Windows: 1.onDetached -> 2.onDetached ( -> 1.onActivated -> 2.onActivated )
	//   -> 1.onAttached -> 2.onAttached -> 1.onActivated -> 2.onActivated
	TABS_INFO.registerListeners(api.runtime, api.tabs);
	registerTabCreatedListener(api.tabs);
	registerTabRemovedListener(api.tabs);
}

main();
