// Processing TSX files with Eleventy
export const data = {
	permalink: "options.html",
};

import { getMessage as _, createI18nAttribute as _a } from '../shared/i18n';
import type { SettingKey, SettingSchemas, SettingText } from '../shared/settings';
import { SETTING_SCHEMAS } from '../shared/settings';

function buildBoolean<K extends SettingKey>(
	settingKey: K,
	setting: SettingSchemas[K],
): JSX.Element {
	if (setting.type !== 'boolean') {
		return;
	}
	return (
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
	);
}

function buildNumber<K extends SettingKey>(
	settingKey: K,
	setting: SettingSchemas[K],
): JSX.Element {
	if (setting.type !== 'number') {
		return;
	}
	const { min, max, step } = setting;
	return (
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
	);
}

function buildChoices<K extends SettingKey>(
	settingKey: K,
	setting: SettingSchemas[K],
): JSX.Element {
	if (setting.type !== 'choices') {
		return;
	}
	return (
		<div class="select-group">
			<label
				for={settingKey}
				{..._a(setting.i18nKey)}
			>
				{_(setting.i18nKey)}
			</label>
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
			<button
				id={`reset-${settingKey}`}
				type="button"
				class="reset"
				{..._a('resetSettingTooltip', 'title')}
			></button>
		</div>
	);
}

function buildSettings<K extends SettingKey>(
	advanced: boolean,
): JSX.Element {
	const settings = Object.entries(SETTING_SCHEMAS) as Array<[K, SettingSchemas[K]]>;
	const filteredSettings = advanced
		? settings.filter(([settingKey, _]) => settingKey.startsWith('$'))
		: settings.filter(([settingKey, _]) => !settingKey.startsWith('$'));
	return filteredSettings.map(([settingKey, setting]) => <>
		{buildBoolean(settingKey, setting)}
		{buildNumber(settingKey, setting)}
		{buildChoices(settingKey, setting)}
	</>);
}

export default function OptionsPage(): JSX.Element {
	return (
		<html lang="en">

			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>{_('settingsTitle')}</title>
				{/* relative to the output directory ('dist/'), preprocessed by Vite in Eleventy */}
				<link rel="stylesheet" href="./options.css" />
				{/* relative to the output directory ('dist/'), preprocessed by Vite in Eleventy */}
				<script type="module" src="./options.js"></script>
			</head>

			<body>
				<div class="container">

					<header>
						<h1 {..._a('settingsTitle')}>{_('settingsTitle')}</h1>
					</header>

					<main>
						{buildSettings(false)}
						<details>
							<summary>
								{_('advancedSettingsSummary')}
							</summary>
							<div class="details-content">
								{buildSettings(true)}
							</div>
						</details>
					</main>

					<footer>
						<div id="status" class="status"></div>
						<button
							id="reset-all"
							type="button"
							class="reset-all"
							{..._a('resetAllButton')}
						>
							{_('resetAllButton')}
						</button>
					</footer>

				</div>
			</body>

		</html>
	)
};
