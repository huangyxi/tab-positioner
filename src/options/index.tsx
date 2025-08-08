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
				<title
					{..._a('title_settings')}
				>{_('title_settings')}</title>
				{/* relative to the output directory ('dist/'), preprocessed by Vite in Eleventy */}
				<link rel="stylesheet" href="./options.css" />
				{/* relative to the output directory ('dist/'), preprocessed by Vite in Eleventy */}
				<script type="module" src="./options.js"></script>
			</head>

			<body>
				<div class="container">

					<header>
						<h1 {..._a('title_settings')}>{_('title_settings')}</h1>
					</header>

					<main>
						<Settings advanced={false} />
						<details>
							<summary
								{..._a('summary_advanced_settings')}
							>
								{_('summary_advanced_settings')}
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
							{..._a('botton_reset_all')}
						>
							{_('botton_reset_all')}
						</button>
					</footer>

				</div>
			</body>

		</html>
	</>
};
