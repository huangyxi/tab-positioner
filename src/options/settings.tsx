
import { getMessage as _, createI18nAttribute as _a } from '../shared/i18n';
import type { SettingKey, SettingSchemas, SettingText } from '../shared/settings';
import { SETTING_SCHEMAS } from '../shared/settings';

interface SettingPair<K extends SettingKey> {
	settingKey: K;
	setting: SettingSchemas[K];
}

function BooleanSetting<K extends SettingKey>({
	settingKey,
	setting,
}: SettingPair<K>): JSX.Element {
	if (setting.type !== 'boolean') {
		return;
	}
	return <>
		<label class="checkbox-group">
			<input type="checkbox" id={settingKey} />
			<span class="checkbox-visual"></span>
			<span class="checkbox-label">
				{_(setting.i18nKey)}
			</span>
			<button
				id={`reset-${settingKey}`}
				type="button"
				class="reset"
				{..._a('resetSettingTooltip', 'title')}
			></button>
		</label>
	</>;
}

function NumberSetting<K extends SettingKey>({
	settingKey,
	setting,
}: SettingPair<K>): JSX.Element {
	if (setting.type !== 'number') {
		return;
	}
	const { min, max, step } = setting;
	return <>
		<div class="input-group">
			<input
				type="number"
				id={settingKey}
				min={min}
				max={max}
				step={step}
			/>
			<label for={settingKey}>
				{_(setting.i18nKey)}
			</label>
			<button
				id={`reset-${settingKey}`}
				type="button"
				class="reset"
				{..._a('resetSettingTooltip', 'title')}
			></button>
		</div>
	</>;
}

function ChoicesSetting<K extends SettingKey>({
	settingKey,
	setting,
}: SettingPair<K>): JSX.Element {
	if (setting.type !== 'choices') {
		return;
	}
	return <>
		<div class="select-group">
			<select id={settingKey}>
				{(Object.entries(setting.choices) as Array<[string, SettingText]>).map(
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
			<label for={settingKey} {..._a(setting.i18nKey)}>
				{_(setting.i18nKey)}
			</label>
			<button
				id={`reset-${settingKey}`}
				type="button"
				class="reset"
				{..._a('resetSettingTooltip', 'title')}
			></button>
		</div>
	</>;
}

export function Settings<K extends SettingKey>({
	advanced = false,
}: {
	advanced?: boolean;
}): JSX.Element {
	const settings = Object.entries(SETTING_SCHEMAS) as Array<[K, SettingSchemas[K]]>;
	const filteredSettings = advanced
		? settings.filter(([settingKey, _]) => settingKey.startsWith('$'))
		: settings.filter(([settingKey, _]) => !settingKey.startsWith('$'));
	return <>
		{filteredSettings.map(([settingKey, setting]) => <>
				<BooleanSetting settingKey={settingKey} setting={setting} />
				<NumberSetting settingKey={settingKey} setting={setting} />
				<ChoicesSetting settingKey={settingKey} setting={setting} />
		</>)}
	</>;
}
