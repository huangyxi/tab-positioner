import { I18nKey } from './i18n';
// import { errorHandler } from './logging';

const DEFAULT_VALUE = 'default';
type TabCreationPosition = typeof DEFAULT_VALUE
	| 'left'
	| 'right'
	| 'first'
	| 'last'
	| never;
type TabActivationPosition = typeof DEFAULT_VALUE
	| 'left'
	| 'right'
	| 'first'
	| 'last'
	| 'history'
	| never;
type SettingValue = string; // TabCreationPosition | TabActivationPosition;

export interface ExtensionSettings {
	// new_tab_position: TabCreationPosition;
	// foreground_link_position: TabCreationPosition;
	background_link_position: TabCreationPosition;
	// after_close_activation: TabActivationPosition;
}

export type SettingKey = keyof ExtensionSettings;

type SettingKeys<T extends ExtensionSettings[keyof ExtensionSettings]> = {
	[K in keyof ExtensionSettings]: ExtensionSettings[K] extends T ? K : never;
}[keyof ExtensionSettings];

export type TabCreationPositionKey = SettingKeys<TabCreationPosition>;
// type TabActivationPositionKey = SettingKeys<TabActivationPosition>;

export const DEFAULT_SETTINGS: ExtensionSettings = {
	// new_tab_position: DEFAULT_VALUE,
	// foreground_link_position: DEFAULT_VALUE,
	background_link_position: DEFAULT_VALUE,
	// after_close_activation: DEFAULT_VALUE,
} as const;

interface SettingChoice {
	i18nKey: I18nKey;
}

type SettingChoices<T extends SettingValue> = {
	[K in T]: SettingChoice;
};

export type SettingSchemas = {
	[K in keyof ExtensionSettings]:
		SettingChoice & {
		choices: SettingChoices<ExtensionSettings[K]>;
	};
};

const TAB_CREATION_POSITION_CHOICES: SettingChoices<TabCreationPosition> = {
	default: { i18nKey: 'optionDefault' },
	left: { i18nKey: 'optionInsertLeft' },
	right: { i18nKey: 'optionInsertRight' },
	first: { i18nKey: 'optionInsertFirst' },
	last: { i18nKey: 'optionInsertLast' },
} as const;

const TAB_ACTIVATION_POSITION_CHOICES: SettingChoices<TabActivationPosition> = {
	default: { i18nKey: 'optionDefault' },
	left: { i18nKey: 'optionActivationLeft' },
	right: { i18nKey: 'optionActivationRight' },
	first: { i18nKey: 'optionActivationFirst' },
	last: { i18nKey: 'optionActivationLast' },
	history: { i18nKey: 'optionActivationHistory' },
} as const;

export const SETTING_SCHEMAS: SettingSchemas = {
	// new_tab_position: {
	// 	i18nKey: 'newTabPositionLabel',
	// 	choices: TAB_CREATION_POSITION_CHOICES,
	// },
	// foreground_link_position: {
	// 	i18nKey: 'foregroundLinkPositionLabel',
	// 	choices: TAB_CREATION_POSITION_CHOICES,
	// },
	background_link_position: {
		i18nKey: 'backgroundTabPositionLabel',
		choices: TAB_CREATION_POSITION_CHOICES,
	},
	// after_close_activation: {
	// 	i18nKey: 'afterCloseActivationLabel',
	// 	choices: TAB_ACTIVATION_POSITION_CHOICES,
	// }
} as const;

export function sanitizeSettings<T extends Partial<Record<SettingKey, string>>>(
	settings: T,
	settingName?: string,
): T extends Record<SettingKey, string> ? ExtensionSettings : Partial<ExtensionSettings> {
	const sanitizedSettings: Partial<Record<keyof T, string>> = {};
	for (const [key, value] of Object.entries(settings) as Array<[SettingKey, string]>) {
		if (value in SETTING_SCHEMAS[key].choices) {
			sanitizedSettings[key] = value;
			continue;
		}
		console.error(
			`Invalid setting value for ${key}: ${value}${settingName ? ` in '${settingName}'` : ''}`
		);
		sanitizedSettings[key] = DEFAULT_SETTINGS[key];
	}
	return sanitizedSettings as any;
}
