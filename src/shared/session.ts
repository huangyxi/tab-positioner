import { DEBUG } from './debug';
import { errorHandler } from './logging';
import { STATE_SAVE_DELAY_MS } from './constants';

const storageSession = api.storage.session;

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
 * Provides methods to save and load state (members of the inherited class, not start with '_') automatically.
 * All subclasses should call `getInstance()` to get the singleton instance.
 * @note members of the inherited class should be serializable to JSON, Maps, Sets, and other complex types are not supported.
 */
export abstract class SessionSingleton {
	private static _instances: Map<typeof SessionSingleton, SessionSingleton> = new Map();
	private static _initializationPromises: Map<typeof SessionSingleton, Promise<SessionSingleton>> = new Map();
	private static _saveLocks: Map<typeof SessionSingleton, Promise<void>> = new Map();
	private static _saveControllers: Map<typeof SessionSingleton, AbortController> = new Map();

	// DO NOT call this constructor directly.
	// Use `getInstance()` to get the singleton instance.
	public constructor() { }

	private skipProperty(property: string): boolean {
		return property.startsWith('_')
	}

	public static hasLoaded<T extends typeof SessionSingleton>(
		this: T,
	): boolean {
		if (this === SessionSingleton) {
			return true;
		}
		const superCls = Object.getPrototypeOf(this);
		return this._instances.has(this) && superCls.hasLoaded();
	}

	public static getLoadedInstance<T extends typeof SessionSingleton>(
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
			return this.getLoadedInstance();
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
				if (await instance.isStateSaved()) {
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

	protected async saveState(
		properties?: Array<keyof this & string>,
	) {
		if (properties === undefined) {
			properties = this.properties() as any[];
		}
		if (properties.length === 0) return;
		const cls = this.constructor as typeof SessionSingleton;
		cls._saveControllers.get(cls)?.abort();
		const previousLock = cls._saveLocks.get(cls) ?? Promise.resolve();
		const controller = new AbortController();
		cls._saveControllers.set(cls, controller);
		let release: () => void;
		const currentLock = new Promise<void>((resolve) => {
			release = resolve;
		});
		cls._saveLocks.set(cls, currentLock);
		const abortException = new Error('saveState aborted');
		try {
			await previousLock;
			if (DEBUG) {
				console.log(`_${this.name}: Saving state`);
			}
			const timestamp = DEBUG ? Date.now() : 0;
			await new Promise((resolve, reject) => {
				const timeout = setTimeout(resolve, STATE_SAVE_DELAY_MS);
				controller.signal.addEventListener('abort', () => {
					clearTimeout(timeout);
					reject(abortException);
				}, { once: true });
			});
			for (const property of properties) {
				if (controller.signal.aborted) throw abortException;
				if (this.skipProperty(property)) continue;
				const value = (this as any)[property];
				if (value === undefined) continue;
				await setSessionState(this.sessionKeyFor(property), JSON.stringify(value));
			}
			await this.flagState();
			if (DEBUG) {
				console.log(`_${this.name}: State saved in ${Date.now() - timestamp}ms`);
			}
		} catch (error) {
			if (error === abortException) {
				if (DEBUG) {
					console.log(`_${this.name}: Save aborted due to a new save request.`);
				}
			} else {
				errorHandler(`_${this.name}: Save error:`, error);
			}
		} finally {
			release!();
		}
	}

	private async loadState() {
		if (DEBUG) {
			console.log(`_${this.name}: Loading state`);
		}
		const timestamp = DEBUG ? Date.now() : 0;
		for (const property of this.properties()) {
			if (this.skipProperty(property)) {
				continue; // Skip special properties
			}
			const value = await getSessionState(this.sessionKeyFor(property));
			if (value === undefined) continue;
			(this as any)[property] = JSON.parse(value);
		}
		if (DEBUG) {
			console.log(`_${this.name}: State loaded in ${Date.now() - timestamp}ms`);
		}
	}

	// Use property name '_instances' to avoid conflicts with other properties in subclasses.
	private async flagState() {
		await setSessionState(this.sessionKeyFor('_instances'), JSON.stringify(true));
	}

	private async isStateSaved(): Promise<boolean> {
		const value = await getSessionState(this.sessionKeyFor('_instances'));
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
	private sessionKeyFor(property: string): string {
		return `${this.name}:${property}`;
	}

	private properties(): string[] {
		return Object.getOwnPropertyNames(this);
	}
}
