import { loadSettings, saveSettings } from '../shared/storage';
import { setSettings } from '../shared/settings';

export function registerSyncSettingsListeners(
	apiRuntime: typeof api.runtime,
	apiStorage: typeof api.storage,
) {
	apiRuntime.onInstalled.addListener(async () => {
		const settings = await loadSettings();
		setSettings(settings);
		await saveSettings(settings);
	});

	apiRuntime.onStartup.addListener(async () => {
		const settings = await loadSettings();
		setSettings(settings);
		await saveSettings(settings);
	});

	apiStorage.onChanged.addListener(async (changes, areaName) => {
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
}
