import { Listeners } from '../shared/listeners';
import { SessionSingleton } from '../shared/session';
import { loadSettings, saveSettings } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { KEEP_ALIVE_TIMEOUT_MS } from '../shared/constants';

export let DEBUG = true;
api.storage.sync.get(DEFAULT_SETTINGS).then((settings) => {
	DEBUG = (settings as typeof DEFAULT_SETTINGS)['$debug_mode'] ?? true;
}).catch((error) => {
	console.error('Failed to get debug mode setting:', error);
});

export class SyncSettings extends SessionSingleton {
	private settings = DEFAULT_SETTINGS;
	private _keepAlivePromise: Promise<void> | null = null;

	public get<T extends keyof typeof DEFAULT_SETTINGS>(
		key: T
	): typeof DEFAULT_SETTINGS[T] {
		return this.settings[key];
	}

	/**
	 * User-configurable persistent background worker (configured in Advanced Settings).
	 */
	public keepAlive(apiRuntime: typeof api.runtime) {
		if (this._keepAlivePromise) return;
		this._keepAlivePromise = (async () => {
			while (this.get('$persistent_background')) {
				await new Promise(resolve => setTimeout(resolve, KEEP_ALIVE_TIMEOUT_MS));
				if (DEBUG) {
					console.log(' syncSettings: Keeping alive');
				}
				await apiRuntime.getPlatformInfo(); // ping API
			}
			this._keepAlivePromise = null;
		})();
	}

	private setDebugMode() {
		const debug = this.get('$debug_mode');
		console.log(' syncSettings: Setting debug mode to', debug);
		DEBUG = debug;
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
		});

		listeners.add(apiStorage.onChanged, async (changes, areaName) => {
			if (areaName !== 'sync') {
				return;
			}
			const instance = await this.getInstance();
			const settings = await loadSettings();
			instance.settings = settings;
			instance.setDebugMode();
			instance.saveState();
			if (DEBUG) {
				console.log(' syncSettings: Settings changed:', changes);
			}
			await saveSettings(settings);
			instance.keepAlive(apiRuntime);
		});
	}
}

/**
 * Run in the top-level scope to ensure execution after restoring from idle.
 */
SyncSettings.getInstance().then(instance => {
	if (DEBUG) {
		console.log(' syncSettings: Instance created');
	}
	instance.keepAlive(api.runtime);
}).catch(error => {
	console.error(' syncSettings: Failed to create instance:', error);
});
