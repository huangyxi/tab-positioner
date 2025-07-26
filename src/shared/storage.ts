import { ExtensionSettings, DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { errorHandler } from './logging';

const storageSync = api.storage.sync;
// const storageSession = api.storage.session;

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

// export async function getSessionState(key: string): Promise<any | undefined> {
// 	try {
// 		const session = await storageSession.get(key);
// 		return session[key] ?? undefined;
// 	} catch (error) {
// 		errorHandler(error);
// 		return undefined;
// 	}
// }

// export async function setSessionState(
// 	key: string,
// 	value: any,
// ): Promise<void> {
// 	try {
// 		await storageSession.set({ [key]: value });
// 	} catch (error) {
// 		errorHandler(error);
// 	}
// }
