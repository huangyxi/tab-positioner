import { I18nKey } from './i18n';
// import { errorHandler } from './logging';

const DEFAULT_VALUE = 'default';

export type SettingKey = never
	// | 'new_tab_position'
	// | 'foreground_link_position'
	| 'background_link_position'
	// | 'after_close_activation'
	| never;

interface SettingChoice {
	i18nKey: I18nKey;
}

type SettingChoices<T extends string> = {
	[K in T]: SettingChoice;
};

type TabCreationPosition = typeof DEFAULT_VALUE
	| 'before_active'
	| 'after_active'
	| 'as_first'
	| 'as_last'
	| never;
const TAB_CREATION_POSITION_CHOICES: SettingChoices<TabCreationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'optionDefault' },
	before_active: { i18nKey: 'optionCreateBeforeActive' },
	after_active: { i18nKey: 'optionCreateAfterActive' },
	as_first: { i18nKey: 'optionCreateAsFirst' },
	as_last: { i18nKey: 'optionCreateAsLast' },
} as const;

type TabActivationPosition = typeof DEFAULT_VALUE
	| never;
const TAB_ACTIVATION_POSITION_CHOICES: SettingChoices<TabActivationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'optionDefault' },
	// left: { i18nKey: 'optionActivateBeforeActive' },
	// right: { i18nKey: 'optionActivateAfterActive' },
	// first: { i18nKey: 'optionActivateFirst' },
	// last: { i18nKey: 'optionActivatieLast' },
	// history: { i18nKey: 'optionActivateHistory' },
} as const;

type SettingValue = string; // TabCreationPosition | TabActivationPosition;

export const DEFAULT_SETTINGS = {
	// new_tab_position: DEFAULT_VALUE as TabCreationPosition,
	// foreground_link_position: DEFAULT_VALUE as TabCreationPosition,
	background_link_position: DEFAULT_VALUE as TabCreationPosition,
	// after_close_activation: DEFAULT_VALUE as TabActivationPosition,
} as const satisfies Record<SettingKey, SettingValue>;
export type ExtensionSettings = typeof DEFAULT_SETTINGS;

type SettingKeys<T extends ExtensionSettings[SettingKey]> = {
	[K in SettingKey]: ExtensionSettings[K] extends T ? K : never;
}[SettingKey];

export type TabCreationPositionKey = SettingKeys<TabCreationPosition>;
// type TabActivationPositionKey = SettingKeys<TabActivationPosition>;

export type SettingSchemas = {
	[K in keyof ExtensionSettings]:
		SettingChoice & {
		choices: SettingChoices<ExtensionSettings[K]>;
	};
};

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
