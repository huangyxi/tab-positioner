import { Listeners } from '../shared/listeners';
import { SessionSingleton } from '../shared/session';
import { loadSettings, saveSettings } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/settings';

export class SyncSettings extends SessionSingleton {
	private settings = DEFAULT_SETTINGS;
	private _keepAlivePromise: Promise<void> | null = null;

	public get<T extends keyof typeof DEFAULT_SETTINGS>(
		key: T
	): typeof DEFAULT_SETTINGS[T] {
		return this.settings[key];
	}

	/**
	 * Users configurable persistent background worker.
	 */
	private keepAlive() {
		if (this._keepAlivePromise) return;
		this._keepAlivePromise = (async () => {
			while (this.get('$persistent_background')) {
				await new Promise(resolve => setTimeout(resolve, 20_000));
				if (DEBUG) {
					console.log('syncSettings: Keeping alive');
				}
				await this.loadState(); // ping API
			}
			this._keepAlivePromise = null;
		})();
	}

	public static registerListeners(
		listeners: Listeners,
		apiRuntime: typeof api.runtime,
		apiStorage: typeof api.storage,
	) {
		listeners.add(apiRuntime.onInstalled, async () => {
			const instance = await this.getInstance();
			const settings = await loadSettings();
			instance.settings = settings;
			instance.saveState();
			if (DEBUG) {
				console.log(' syncSettings: Settings loaded on install:', settings);
			}
			await saveSettings(settings);
			instance.keepAlive();
		});

		listeners.add(apiRuntime.onStartup, async () => {
			const instance = await this.getInstance();
			const settings = await loadSettings();
			instance.settings = settings;
			instance.saveState();
			if (DEBUG) {
				console.log(' syncSettings: Settings loaded on startup:', settings);
			}
			await saveSettings(settings);
			instance.keepAlive();
		});

		listeners.add(apiStorage.onChanged, async (changes, areaName) => {
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
			instance.keepAlive();
		});
	}
}
