import { Listeners } from '../shared/listeners';
import { SessionSingleton } from '../shared/session';
import { loadSettings, saveSettings } from '../shared/storage';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { errorHandler } from '../shared/logging';
import { KEEP_ALIVE_TIMEOUT_MS } from '../shared/constants';

export let DEBUG = true;
api.storage.sync.get(DEFAULT_SETTINGS).then((settings) => {
	DEBUG = (settings as typeof DEFAULT_SETTINGS)['_debug_mode'] ?? true;
}).catch((error) => {
	console.error('Failed to get debug mode setting:', error);
});

export class SyncSettings extends SessionSingleton {
	private settings = DEFAULT_SETTINGS;
	private _keepAliveController = new AbortController();

	public get<T extends keyof typeof DEFAULT_SETTINGS>(
		key: T
	): typeof DEFAULT_SETTINGS[T] {
		return this.settings[key];
	}

	/**
	 * User-configurable persistent background worker (configured in Advanced Settings).
	 */
	public async keepAlive(apiRuntime: typeof api.runtime) {
		const abortException = new Error('Keep alive aborted');
		this._keepAliveController.abort();
		const controller = new AbortController();
		this._keepAliveController = controller;
		let timeout: NodeJS.Timeout;
		let rejectFn: (reason?: any) => void = () => { };
		controller.signal.addEventListener('abort', () => {
			clearTimeout(timeout!);
			rejectFn(abortException);
		}, { once: true });
		try {
			while (this.get('_persistent_background')) {
				if (DEBUG) {
					console.log(' syncSettings: Keeping alive');
				}
				await apiRuntime.getPlatformInfo(); // ping API
				await new Promise((resolve, reject) => {
					timeout = setTimeout(resolve, KEEP_ALIVE_TIMEOUT_MS);
					rejectFn = reject;
				});
			}
		} catch (error: any) {
			if (error === abortException) {
				if (DEBUG) {
					console.log(' syncSettings: Keep alive aborted due to a new request');
				}
			} else {
				errorHandler('syncSettings: Keep alive error:', error);
			}
		}
	}

	private setDebugMode() {
		const debug = this.get('_debug_mode');
		console.log(' syncSettings: Setting debug mode to', debug);
		DEBUG = debug;
	}

	private async saveSettings() {
		const settings = await loadSettings();
		this.settings = settings;
		if (DEBUG) {
			console.log(' syncSettings: Settings saved:', settings);
		}
		this.saveState();
		await saveSettings(settings);
	}

	/**
	 * Ensures initialization after the background script starts,
	 * when api.runtime.onStartup and api.runtime.onInstalled events are not fired after restoring from suspension or being disabled.
	 */
	public static async startup(apiRuntime: typeof api.runtime) {
		const instance = await this.getInstance();
		if (DEBUG) {
			console.log(' syncSettings: Instance created at startup');
		}
		await instance.saveSettings();
		await instance.keepAlive(apiRuntime);
	}

	public static registerListeners(
		listeners: Listeners,
		apiRuntime: typeof api.runtime,
		apiStorage: typeof api.storage,
	) {
		listeners.add(apiStorage.onChanged, async (changes, areaName) => {
			if (areaName !== 'sync') {
				return;
			}
			const instance = await this.getInstance();
			const debugModeKey: keyof typeof DEFAULT_SETTINGS = '_debug_mode';
			if (debugModeKey in changes) instance.setDebugMode();
			if (DEBUG) {
				console.log(' syncSettings: Settings changed:', changes);
			}
			await instance.saveSettings();
			instance.keepAlive(apiRuntime);
		});
	}
}
