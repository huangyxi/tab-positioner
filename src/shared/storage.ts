import { ExtensionSettings, DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { errorHandler } from './logging';

const storageSync = chrome.storage.sync;
const storageSession = chrome.storage.session;

export async function getSettings(
	sanitize: boolean = true,
): Promise<ExtensionSettings> {
	try {
		// filter out invalid settings
		const settings = await storageSync.get(DEFAULT_SETTINGS) as Record<keyof ExtensionSettings, string>;
		if (sanitize) {
			return sanitizeSettings(settings as ExtensionSettings);
		} else {
			return settings as ExtensionSettings;
		}
	} catch (error) {
		errorHandler(error);
		return DEFAULT_SETTINGS;
	}
}
type SetSettingType<B extends boolean> = B extends true ? Partial<Record<keyof ExtensionSettings, string>> : Partial<ExtensionSettings>;
export async function setSettings(
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

export async function getSessionState(key: string): Promise<any | undefined> {
	try {
		const session = await storageSession.get(key);
		return session[key] ?? undefined;
	} catch (error) {
		errorHandler(error);
		return undefined;
	}
}

export async function setSessionState(
	key: string,
	value: any,
): Promise<void> {
	try {
		await storageSession.set({ [key]: value });
	} catch (error) {
		errorHandler(error);
	}
}
