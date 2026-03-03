import { KEEP_ALIVE_TIMEOUT_MS } from '../shared/constants';
import type { Listeners } from '../shared/listeners';
import { log, setGlobalLogLevel } from '../shared/logging';
import { SessionSingleton } from '../shared/session';
import { DEFAULT_SETTINGS } from '../shared/settings';
import { loadSettings, saveSettings } from '../shared/storage';

export class SyncSettings extends SessionSingleton {
	private settings = DEFAULT_SETTINGS;
	private _keepAliveController = new AbortController();

	public get<T extends keyof typeof DEFAULT_SETTINGS>(key: T): (typeof DEFAULT_SETTINGS)[T] {
		return this.settings[key];
	}

	/**
	 * User-configurable persistent background worker (configured in Advanced Settings).
	 * Keeps the service worker alive from going idle by periodically pinging the runtime API.
	 * https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle#idle-shutdown
	 */
	public async keepAlive(apiRuntime: typeof api.runtime) {
		const abortException = new Error('Keep alive aborted');
		this._keepAliveController.abort();
		const controller = new AbortController();
		this._keepAliveController = controller;
		let timeout!: NodeJS.Timeout;
		let rejectFn: (reason?: unknown) => void = () => {};
		controller.signal.addEventListener(
			'abort',
			() => {
				clearTimeout(timeout);
				rejectFn(abortException);
			},
			{ once: true },
		);
		try {
			while (this.get('_persistent_background')) {
				log('debug', ' syncSettings: pinging runtime API');
				await apiRuntime.getPlatformInfo(); // ping API
				await new Promise((resolve, reject) => {
					timeout = setTimeout(resolve, KEEP_ALIVE_TIMEOUT_MS);
					rejectFn = reject;
				});
			}
		} catch (error) {
			if (error === abortException) {
				log('debug', ' syncSettings: Keep alive aborted due to a new request');
			} else {
				log('error', ' syncSettings: Keep alive error:', error);
			}
		}
	}

	private async saveSettings() {
		const settings = await loadSettings();
		this.settings = settings;
		log('info', ' syncSettings: Settings reloaded and saved:', settings);
		void this.saveState();
		await saveSettings(settings);
	}

	public static async setDebugMode(debugMode?: boolean) {
		if (debugMode === undefined) {
			const settings = await loadSettings();
			debugMode = settings['_debug_mode'];
		}
		setGlobalLogLevel(debugMode ? 'debug' : 'error');
	}

	/**
	 * Ensures initialization after the background script starts,
	 * when api.runtime.onStartup and api.runtime.onInstalled events are not fired after restoring from suspension or being disabled.
	 */
	public static async startup(apiRuntime: typeof api.runtime) {
		await this.setDebugMode();
		const instance = await this.getInstance();
		log('info', ' syncSettings: Instance created at startup');
		await instance.saveSettings();
		void instance.keepAlive(apiRuntime);
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
			if (debugModeKey in changes) await this.setDebugMode(changes[debugModeKey].newValue as boolean);
			log('info', ' syncSettings: Settings changed:', changes);
			await instance.saveSettings();
			void instance.keepAlive(apiRuntime);
		});
	}
}
