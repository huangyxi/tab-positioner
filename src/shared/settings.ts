import { I18nKey } from './i18n';
import { errorHandler } from './logging';
import * as C from './constants';
const DEFAULT_VALUE = 'default';

/**
 * @note Advanced settings (collapsed by default) are started with `_`.
 */
export type SettingKey = never
	| 'new_tab_position'
	| 'foreground_link_position'
	| 'background_link_position'
	| 'popup_position'
	| 'after_close_activation'
	| '_tab_batch_creation_threshold_ms'
	| '_tab_batch_activation_threshold_ms'
	| '_persistent_background'
	| '_debug_mode'
	| never;

export interface SettingText {
	i18nKey: I18nKey;
}

// type NormedKey<T extends string> = T extends `$${infer U}` ? U : T;

type SettingChoices<T extends string> = {
	[K in T]: SettingText & {
		i18nKey: `option_${K}` | `option_${K}_${string}`;
	};
};

export type TabCreationPosition = typeof DEFAULT_VALUE
	| 'before_active'
	| 'after_active'
	| 'window_first'
	| 'window_last'
	| never;
const TAB_CREATION_POSITION_CHOICES: SettingChoices<TabCreationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'option_default' },
	before_active: { i18nKey: 'option_before_active_creation' },
	after_active: { i18nKey: 'option_after_active_creation' },
	window_first: { i18nKey: 'option_window_first_creation' },
	window_last: { i18nKey: 'option_window_last_creation' },
} as const;

export type PopupCreationPosition = typeof DEFAULT_VALUE
	| 'new_foreground_tab'
	| 'new_background_tab'
	| never;
const POPUP_POSITION_CHOICES: SettingChoices<PopupCreationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'option_default' },
	new_foreground_tab: { i18nKey: 'option_new_foreground_tab_popup' },
	new_background_tab: { i18nKey: 'option_new_background_tab_popup' },
} as const;

export type TabActivationPosition = typeof DEFAULT_VALUE
	| 'before_removed'
	| 'after_removed'
	| 'window_first'
	| 'window_last'
	// | 'activation_history'
	| never;
const TAB_ACTIVATION_POSITION_CHOICES: SettingChoices<TabActivationPosition> = {
	[DEFAULT_VALUE]: { i18nKey: 'option_default' },
	before_removed: { i18nKey: 'option_before_removed_activation' },
	after_removed: { i18nKey: 'option_after_removed_activation' },
	window_first: { i18nKey: 'option_window_first_activation' },
	window_last: { i18nKey: 'option_window_last_activation' },
	// activation_history: { i18nKey: 'option.activation_history.activation' },
} as const;

export const DEFAULT_SETTINGS = {
	new_tab_position: DEFAULT_VALUE as TabCreationPosition,
	foreground_link_position: DEFAULT_VALUE as TabCreationPosition,
	background_link_position: DEFAULT_VALUE as TabCreationPosition,
	popup_position: DEFAULT_VALUE as PopupCreationPosition,
	after_close_activation: DEFAULT_VALUE as TabActivationPosition,
	_tab_batch_creation_threshold_ms: C.TAB_BATCH_CREATION_THRESHOLD_MS,
	_tab_batch_activation_threshold_ms: C.TAB_BATCH_ACTIVATION_THRESHOLD_MS,
	_debug_mode: false,
	_persistent_background: false,
} satisfies Record<SettingKey, any>;
// export interface ExtensionSettings extends Record<SettingKey, ChoiceValue> {
// 	new_tab_position: TabCreationPosition;
// 	background_link_position: TabCreationPosition;
// 	// foreground_link_position: TabCreationPosition;
// 	after_close_activation: TabActivationPosition;
// }
export type ExtensionSettings = typeof DEFAULT_SETTINGS;

type SettingKeys<T extends ExtensionSettings[SettingKey]> = {
	[K in SettingKey]: ExtensionSettings[K] extends T ? K : never;
}[SettingKey];

export type TabCreationPositionKey = SettingKeys<TabCreationPosition>;
export type PopupCreationPositionKey = SettingKeys<PopupCreationPosition>;
export type TabActivationPositionKey = SettingKeys<TabActivationPosition>;

type SettingValue<K extends SettingKey> =
	| ExtensionSettings[K] extends boolean ? {
		i18nKey: `label_${K}`,
		type: 'boolean',
	} : never
	| ExtensionSettings[K] extends number ? { // Integer only
		i18nKey: `label_${K}`,
		type: 'number',
		min?: number,
		max?: number,
		step?: number,
	} : never
	| ExtensionSettings[K] extends string ? {
		i18nKey: `label_${K}`,
		type: 'choices',
		choices: SettingChoices<ExtensionSettings[K]>,
	} : never

export type SettingSchemas = {
	[K in keyof ExtensionSettings]:
		SettingText & SettingValue<K>
};

export const SETTING_SCHEMAS: SettingSchemas = {
	new_tab_position: {
		i18nKey: 'label_new_tab_position',
		type: 'choices',
		choices: TAB_CREATION_POSITION_CHOICES,
	},
	foreground_link_position: {
		i18nKey: 'label_foreground_link_position',
		type: 'choices',
		choices: TAB_CREATION_POSITION_CHOICES,
	},
	background_link_position: {
		i18nKey: 'label_background_link_position',
		type: 'choices',
		choices: TAB_CREATION_POSITION_CHOICES,
	},
	popup_position: {
		i18nKey: 'label_popup_position',
		type: 'choices',
		choices: POPUP_POSITION_CHOICES,
	},
	after_close_activation: {
		i18nKey: 'label_after_close_activation',
		type: 'choices',
		choices: TAB_ACTIVATION_POSITION_CHOICES,
	},
	_tab_batch_creation_threshold_ms: {
		i18nKey: 'label__tab_batch_creation_threshold_ms',
		type: 'number',
		min: 0,
		max: 1_000, // 1 second
	},
	_tab_batch_activation_threshold_ms: {
		i18nKey: 'label__tab_batch_activation_threshold_ms',
		type: 'number',
		min: 0,
		max: 1_000, // 1 second
	},
	_persistent_background: {
		i18nKey: 'label__persistent_background',
		type: 'boolean',
	},
	_debug_mode: {
		i18nKey: 'label__debug_mode',
		type: 'boolean',
	},
} as const;

export function sanitizeSettings<T extends Partial<Record<SettingKey, any>>>(
	settings: T,
	settingName?: string,
): T extends Record<SettingKey, any> ? ExtensionSettings : Partial<ExtensionSettings> {
	const sanitizedSettings: Partial<Record<keyof T, any>> = {};
	for (const [key, value] of Object.entries(settings) as Array<[SettingKey, any]>) {
		const setting = SETTING_SCHEMAS[key];
		const type = setting.type;
		switch (type) {
			case 'boolean':
				if (typeof value === 'boolean') {
					sanitizedSettings[key] = value;
					continue;
				}
				break;
			case 'number':
				if (typeof value === 'number' && !isNaN(value)) {
					const { min, max, step } = setting;
					if (min !== undefined && value < min) break;
					if (max !== undefined && value > max) break;
					sanitizedSettings[key] = Math.round(value);
					continue;
				}
				break;
			case 'choices':
				if (value in setting.choices) {
					sanitizedSettings[key] = value;
					continue;
				}
				break;
			default:
				const _exhaustive: never = type;
		}
		errorHandler(
			`Invalid setting value for ${key}: ${value}${settingName ? ` in '${settingName}'` : ''}`
		);
		sanitizedSettings[key] = DEFAULT_SETTINGS[key];
	}
	return sanitizedSettings as any;
}
