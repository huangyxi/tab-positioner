import { ExtensionSettings, DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { errorHandler } from './logging';

const storageSync = api.storage.sync;
const storageSession = api.storage.session;

/**
 * Loads the current settings from storage.
 * Does not update the local `CURRENT_SETTINGS` variable.
 * @returns A promise that resolves to the sanitized current settings.
 */
export async function loadSettings(): Promise<ExtensionSettings> {
	try {
		// filter out invalid settings
		const settings = await storageSync.get(DEFAULT_SETTINGS) as Record<keyof ExtensionSettings, string>;
		const sanitizedSettings = sanitizeSettings(settings);
		return sanitizedSettings;
	} catch (error) {
		errorHandler(error);
		return DEFAULT_SETTINGS;
	}
}

/**
 * Saves settings to storage.
 * Does not update the local `CURRENT_SETTINGS` variable.
 * @param settings The settings to save. Defaults to `DEFAULT_SETTINGS`.
 * @param sanitize Whether to sanitize the settings before saving. Defaults to `true`.
 * @returns A promise that resolves when the settings are saved.
 */
export async function saveSettings(
	settings: Partial<ExtensionSettings> = DEFAULT_SETTINGS,
	sanitize: boolean = true,
): Promise<void> {
	try {
		if (sanitize) {
			settings = sanitizeSettings(settings);
		}
		await storageSync.set(settings);
	} catch (error) {
		errorHandler(error);
	}
}

export async function clearSettings(): Promise<void> {
	try {
		await storageSync.clear();
	} catch (error) {
		errorHandler(error);
	}
}

async function getSessionState(key: string): Promise<any | undefined> {
	try {
		const session = await storageSession.get(key);
		return session[key] ?? undefined;
	} catch (error) {
		errorHandler(error);
		return undefined;
	}
}

async function setSessionState(
	key: string,
	value: any,
): Promise<void> {
	try {
		await storageSession.set({ [key]: value });
	} catch (error) {
		errorHandler(error);
	}
}

/**
 * Abstract class for session-based singletons.
 * Provides methods to save and load state (members of the inherited class) automatically.
 * All subclasses should call `getInstance()` to get the singleton instance.
 * @note members of the inherited class should be serializable to JSON, Maps, Sets, and other complex types are not supported.
 */
export abstract class SessionSingleton {
	private static _instances: Map<typeof SessionSingleton, SessionSingleton> = new Map();
	private static _initializationPromises: Map<typeof SessionSingleton, Promise<SessionSingleton>> = new Map();
	private static _savePromises: Map<typeof SessionSingleton, Promise<void> | null> = new Map();

	// DO NOT call this constructor directly.
	// Use `getInstance()` to get the singleton instance.
	public constructor() { }

	public static hasLoaded<T extends typeof SessionSingleton>(
		this: T,
	): boolean {
		return this._instances.has(this);
	}

	public static getSyncInstance<T extends typeof SessionSingleton>(
		this: T,
	): InstanceType<T> {
		return this._instances.get(this) as InstanceType<T>;
	}


	/**
	 * Gets the singleton instance of the class.
	 * If the instance does not exist, it will be created and initialized.
	 * If the instance has state saved, it will be loaded automatically.
	 * @template T The type of the class extending `SessionSingleton`.
	 * @param args The arguments to pass to the constructor of the class.
	 * @returns The singleton instance of the class.
	 */
	public static async getInstance<T extends typeof SessionSingleton>(
		this: T,
		...args: ConstructorParameters<T>
	): Promise<InstanceType<T>> {
		if (this.hasLoaded()) {
			return this.getSyncInstance();
		}
		if (this._initializationPromises.has(this)) {
			return this._initializationPromises.get(this) as Promise<InstanceType<T>>;
		}
		const loadingPromise = (async () => {
			try {
				if (DEBUG) {
					console.log(`_${this.name}: Creating new instance`);
				}
				const instance = new (this as any)(...args) as InstanceType<T>;
				if (await instance.hasState()) {
					await instance.loadState();
				}
				this._instances.set(this, instance);
				return instance;
			} finally {
				this._initializationPromises.delete(this);
			}
		})();
		this._initializationPromises.set(this, loadingPromise);
		return loadingPromise;
	}

	protected async saveState() {
		const cls = this.constructor as typeof SessionSingleton;
		const ongoing = cls._savePromises.get(cls);
		if (ongoing) {
			await ongoing;
		}
		if (DEBUG) {
			console.log(`_${this.name}: Saving state`);
		}
		const timestamp = DEBUG ? Date.now() : 0;
		const savePromise = (async () => {
			try {
				for (const property of Object.getOwnPropertyNames(this)) {
					const value = (this as any)[property];
					if (value === undefined) continue;
					await setSessionState(this.propertyKey(property), JSON.stringify(value));
				}
				await this.flagState();
				if (DEBUG) {
					console.log(`_${this.name}: State saved in ${Date.now() - timestamp}ms`);
				}
			} finally {
				cls._savePromises.delete(cls);
			}
		})();
		cls._savePromises.set(cls, savePromise);
		await savePromise;
	}

	private async loadState() {
		if (DEBUG) {
			console.log(`_${this.name}: Loading state`);
		}
		const timestamp = DEBUG ? Date.now() : 0;
		for (const property of Object.getOwnPropertyNames(this)) {
			const value = await getSessionState(this.propertyKey(property));
			if (value === undefined) continue;
			(this as any)[property] = JSON.parse(value);
		}
		if (DEBUG) {
			console.log(`_${this.name}: State loaded in ${Date.now() - timestamp}ms`);
		}
	}

	// Use property name '_instances' to avoid conflicts with other properties in subclasses.
	private async flagState() {
		await setSessionState(this.propertyKey('_instances'), JSON.stringify(true));
	}

	private async hasState(): Promise<boolean> {
		const value = await getSessionState(this.propertyKey('_instances'));
		return value !== undefined;
	}

	private get name() {
		return this.constructor.name;
	}

	/**
	 * Generates a unique key for the pair of class name and property name to store in session storage.
	 * @param property The name of the property.
	 * @returns A unique key for the property.
	 */
	private propertyKey(property: string): string {
		return `${this.name}:${property}`;
	}
}
