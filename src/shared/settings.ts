import { I18nKey } from './i18n';
import { errorHandler } from './logging';

const DEFAULT_VALUE = 'default';

export type SettingKey = never
	| 'new_tab_position'
	| 'background_link_position'
	// | 'foreground_link_position'
	| 'after_close_activation'
	| never;

interface SettingText {
	i18nKey: I18nKey;
}

type SettingChoices<T extends string> = {
	[K in T]: SettingText;
};

export type TabCreationPosition = typeof DEFAULT_VALUE
	| 'before_active'
	| 'after_active'
	| 'window_first'
	| 'window_last'
	| never;
const TAB_CREATION_POSITION_CHOICES: SettingChoices<TabCreationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'optionDefault' },
	before_active: { i18nKey: 'optionCreateBeforeActive' },
	after_active: { i18nKey: 'optionCreateAfterActive' },
	window_first: { i18nKey: 'optionCreateWindowFirst' },
	window_last: { i18nKey: 'optionCreateWindowLast' },
} as const;

export type TabActivationPosition = typeof DEFAULT_VALUE
	| 'before_removed'
	| 'after_removed'
	| 'window_first'
	| 'window_last'
	// | 'activation_history'
	| never;
const TAB_ACTIVATION_POSITION_CHOICES: SettingChoices<TabActivationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'optionDefault' },
	before_removed: { i18nKey: 'optionActivateBeforeRemoved' },
	after_removed: { i18nKey: 'optionActivateAfterRemoved' },
	window_first: { i18nKey: 'optionActivateWindowFirst' },
	window_last: { i18nKey: 'optionActivateWindowLast' },
	// activation_history: { i18nKey: 'optionActivateActivationHistory' },
} as const;

export const DEFAULT_SETTINGS = {
	new_tab_position: DEFAULT_VALUE as TabCreationPosition,
	background_link_position: DEFAULT_VALUE as TabCreationPosition,
	// foreground_link_position: DEFAULT_VALUE as TabCreationPosition,
	after_close_activation: DEFAULT_VALUE as TabActivationPosition,
} satisfies Record<SettingKey, any>;
// export interface ExtensionSettings extends Record<SettingKey, ChoiceValue> {
// 	new_tab_position: TabCreationPosition;
// 	background_link_position: TabCreationPosition;
// 	// foreground_link_position: TabCreationPosition;
// 	after_close_activation: TabActivationPosition;
// }
export type ExtensionSettings = typeof DEFAULT_SETTINGS;
const CURRENT_SETTINGS: ExtensionSettings = {
	...DEFAULT_SETTINGS,
}

type SettingKeys<T extends ExtensionSettings[SettingKey]> = {
	[K in SettingKey]: ExtensionSettings[K] extends T ? K : never;
}[SettingKey];

export type TabCreationPositionKey = SettingKeys<TabCreationPosition>;
export type TabActivationPositionKey = SettingKeys<TabActivationPosition>;

type SettingValue<K extends SettingKey> =
	| ExtensionSettings[K] extends string ? { type: 'choices', choices: SettingChoices<ExtensionSettings[K]> } : never
	| ExtensionSettings[K] extends boolean ? { type: 'boolean' } : never
	| ExtensionSettings[K] extends number ? { type: 'number' } : never

export type SettingSchemas = {
	[K in keyof ExtensionSettings]:
		SettingText & SettingValue<K>
};

export const SETTING_SCHEMAS: SettingSchemas = {
	new_tab_position: {
		i18nKey: 'newTabPositionLabel',
		type: 'choices',
		choices: TAB_CREATION_POSITION_CHOICES,
	},
	background_link_position: {
		i18nKey: 'backgroundTabPositionLabel',
		type: 'choices',
		choices: TAB_CREATION_POSITION_CHOICES,
	},
	// foreground_link_position: {
	// 	i18nKey: 'foregroundTabPositionLabel',
	// 	choices: TAB_CREATION_POSITION_CHOICES,
	// },
	after_close_activation: {
		i18nKey: 'afterCloseActivationLabel',
		type: 'choices',
		choices: TAB_ACTIVATION_POSITION_CHOICES,
	},
} as const;

export function sanitizeSettings<T extends Partial<Record<SettingKey, any>>>(
	settings: T,
	settingName?: string,
): T extends Record<SettingKey, any> ? ExtensionSettings : Partial<ExtensionSettings> {
	const sanitizedSettings: Partial<Record<keyof T, any>> = {};
	for (const [key, value] of Object.entries(settings) as Array<[SettingKey, string]>) {
		const setting = SETTING_SCHEMAS[key];
		switch (setting.type) {
			// case 'boolean':
			// 	if (typeof value === 'boolean') {
			// 		sanitizedSettings[key] = value;
			// 		continue;
			// 	}
			// 	break;
			// case 'number':
			// 	if (typeof value === 'number' && !isNaN(value)) {
			// 		sanitizedSettings[key] = value;
			// 		continue;
			// 	}
			// 	break;
			case 'choices':
				if (value in setting.choices) {
					sanitizedSettings[key] = value;
					continue;
				}
				break;
		}
		errorHandler(
			`Invalid setting value for ${key}: ${value}${settingName ? ` in '${settingName}'` : ''}`
		);
		sanitizedSettings[key] = DEFAULT_SETTINGS[key];
	}
	return sanitizedSettings as any;
}
