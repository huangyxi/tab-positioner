
import { getMessage as _, createI18nAttribute as _a } from '../shared/i18n';
import type { SettingKey, SettingSchemas, SettingText, ExtensionSettings } from '../shared/settings';
import { SETTING_SCHEMAS, DEFAULT_SETTINGS } from '../shared/settings';

function _t(
	key: Parameters<typeof _a>[0],
) {
	const property = 'title';
	return {
		[property]: _(key),
		..._a(key, property),
	};
}

function _st(
	settingKey: SettingKey,
) {
	const property = 'title';
	const titleKey = `${property}_${settingKey}`;
	const message = _(titleKey as any);
	if (!message) {
		return {};
	}
	return {
		[property]: message,
		..._a(titleKey as any, property),
	};
}

type SettingType<K extends SettingKey> = SettingSchemas[K]['type'];
type TypeKey<
	T extends SettingType<SettingKey>,
> = {
	[K in SettingKey]: SettingType<K> extends T ? K : never
}[SettingKey];

interface SettingPair<
	T extends SettingType<SettingKey>,
	K extends TypeKey<T> = TypeKey<T>,
> {
	settingKey: K;
	setting: SettingSchemas[K];
}

function BooleanSetting({
	settingKey,
	setting,
}: SettingPair<'boolean'>): JSX.Element {
	if (setting.type !== 'boolean') {
		return;
	}
	return <>
		<form
			id={settingKey}
			autocomplete='off'
		>
			<div
				class="checkbox-group"
				{..._st(settingKey)}
			>
				<label>
					<input
						type="checkbox"
						id={settingKey}
						checked={DEFAULT_SETTINGS[settingKey]}
					/>
					{/* <span class="checkbox-visual"></span> */}
					<span>
						{_(setting.i18nKey)}
					</span>
				</label>
				<button
					type="reset"
					class="reset"
					{..._t('botton_reset_setting')}
				></button>
			</div>
		</form>
	</>;
}

function NumberSetting({
	settingKey,
	setting,
}: SettingPair<'number'>): JSX.Element {
	if (setting.type !== 'number') {
		return;
	}
	const { min, max, step } = setting;
	return <>
		<form
			id={settingKey}
			autocomplete='off'
		>
			<div
				class="input-group"
				{..._st(settingKey)}
			>
				<label for={settingKey}>
					{_(setting.i18nKey)}
				</label>
				<input
					type="number"
					id={settingKey}
					// set default value
					value={DEFAULT_SETTINGS[settingKey]}
					min={min}
					max={max}
					step={step}
				/>
				<button
					type="reset"
					class="reset"
					{..._t('botton_reset_setting')}
				></button>
			</div>
		</form>
	</>;
}

function ChoicesSetting<K extends TypeKey<'choices'>>({
	settingKey,
	setting,
}: SettingPair<'choices', K>): JSX.Element {
	if (setting.type !== 'choices') {
		return;
	}
	const defaultChoiceKey = DEFAULT_SETTINGS[settingKey];
	const defaultChoice: SettingText = setting.choices[defaultChoiceKey];
	const otherChoices = (Object.entries(setting.choices) as Array<[string, SettingText]>).filter(
		([choiceKey, _]) => choiceKey !== defaultChoiceKey
	);
	return <>
		<form
			id={settingKey}
			autocomplete='off'
		>
			<div
				class="select-group"
				{..._st(settingKey)}
			>
				<label
					for={settingKey}
					{..._a(setting.i18nKey)}
				>
					{_(setting.i18nKey)}
				</label>
				<select id={settingKey}>
					{/* Make sure the default choice is always the first option for resetting */}
					<option
						value={defaultChoiceKey}
						{..._a(defaultChoice.i18nKey)}
					>
						{_(defaultChoice.i18nKey)}
					</option>
					{otherChoices.map(
						([choiceKey, choice]) => (
							<option
								value={choiceKey}
								{..._a(choice.i18nKey)}
							>
								{_(choice.i18nKey)}
							</option>
						)
					)}
				</select>
				<button
					type="reset"
					class="reset"
					{..._t('botton_reset_setting')}
				></button>
			</div>
		</form>
	</>;
}

function Setting<T extends SettingSchemas[SettingKey]['type']>({
	settingKey,
	setting,
}: SettingPair<T>
): JSX.Element {
	const type = setting.type;
	switch (type) {
		case 'boolean':
			return BooleanSetting({settingKey, setting} as SettingPair<'boolean'>);
		case 'number':
			return <NumberSetting settingKey={settingKey as any} setting={setting as any} />;
		case 'choices':
			return <ChoicesSetting settingKey={settingKey as any} setting={setting as any} />;
		default:
			const _exhaustive: never = type;
	}
}

export function Settings<K extends SettingKey>({
	advanced = false,
}: {
	advanced?: boolean;
}): JSX.Element {
	const settings = Object.entries(SETTING_SCHEMAS) as Array<[K, SettingSchemas[K]]>;
	const filteredSettings = advanced
		? settings.filter(([settingKey, _]) => settingKey.startsWith('_'))
		: settings.filter(([settingKey, _]) => !settingKey.startsWith('_'));
	return <>
		{filteredSettings.map(([settingKey, setting]) => <>
				<Setting settingKey={settingKey as any} setting={setting as any} />
		</>)}
	</>;
}
