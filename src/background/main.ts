import { getSettings, setSettings, getSessionState, setSessionState } from '../shared/storage';
import { registerActivationStackListeners } from './activationstack';
import { registerTabCreatedListener } from './tabcreated';

async function main() {
	chrome.runtime.onInstalled.addListener(async () => {
		const settings = await getSettings(true);
		await setSettings(settings);
	});

	// registerActivationStackListeners(chrome.runtime, chrome.tabs);
	registerTabCreatedListener(chrome.tabs);

}

main();
