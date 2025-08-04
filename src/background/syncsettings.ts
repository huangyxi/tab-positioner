import { SessionSingleton } from '../shared/session';
import { loadSettings, saveSettings } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/settings';

export class SyncSettings extends SessionSingleton {
	private settings = DEFAULT_SETTINGS;

	public get<T extends keyof typeof DEFAULT_SETTINGS>(
		key: T
	): typeof DEFAULT_SETTINGS[T] {
		return this.settings[key];
	}

	public static registerListeners(
		apiRuntime: typeof api.runtime,
		apiStorage: typeof api.storage,
	) {
		apiRuntime.onInstalled.addListener(async () => {
			const instance = await this.getInstance();
			const settings = await loadSettings();
			instance.settings = settings;
			instance.saveState();
			if (DEBUG) {
				console.log(' syncSettings: Settings loaded on install:', settings);
			}
			await saveSettings(settings);
		});

		apiRuntime.onStartup.addListener(async () => {
			const instance = await this.getInstance();
			const settings = await loadSettings();
			instance.settings = settings;
			instance.saveState();
			if (DEBUG) {
				console.log(' syncSettings: Settings loaded on startup:', settings);
			}
			await saveSettings(settings);
		});

		apiStorage.onChanged.addListener(async (changes, areaName) => {
			if (areaName !== 'sync') {
				return;
			}
			const instance = await this.getInstance();
			const settings = await loadSettings();
			instance.settings = settings;
			instance.saveState();
			if (DEBUG) {
				console.log(' syncSettings: Settings changed:', changes);
			}
			await saveSettings(settings);
		});
	}
}
