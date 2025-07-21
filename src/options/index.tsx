// Processing TSX files with Eleventy
export const data = {
	permalink: "options.html",
};

import { getMessage as _, createI18nAttribute as _a } from '../shared/i18n';
import { SETTING_SCHEMAS } from '../shared/settings';

export default function OptionsPage() {
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
						{Object.entries(SETTING_SCHEMAS).map(([settingKey, setting]) => (
							// buildSelectGroup(settingKey as keyof typeof SETTING_SCHEMAS, setting)
							<div class="select-group">
								<label for={settingKey} {..._a(setting.i18nKey)}>{_(setting.i18nKey)}</label>
								<select id={settingKey}>
									{Object.entries(setting.choices).map(
										([choiceKey, choice]) => (
											<option value={choiceKey} {..._a(choice.i18nKey)}>{_(choice.i18nKey)}</option>
										)
									)}
								</select>
								<button id={`reset-${settingKey}`} type="button" class="reset" {..._a('resetSettingTooltip', 'title')}></button>
							</div>
						))}
					</main>

					<footer>
						<div id="status" class="status"></div>
						<button type="button" id="reset-all" class="reset-all" {..._a('resetAllButton')}>
							{_('resetAllButton')}
						</button>
					</footer>
				</div>
			</body>
		</html>
	)
};
