// Processing TSX files with Eleventy
export const data = {
	permalink: "options.html",
};

import { getMessage as _, createI18nAttribute as _a } from '../shared/i18n';
import { Settings } from './settings';

export default function OptionsPage(): JSX.Element {
	return <>
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
						<Settings advanced={false} />
						<details>
							<summary>
								{_('advancedSettingsSummary')}
							</summary>
							<div class="details-content">
								<Settings advanced={true} />
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
	</>
};
