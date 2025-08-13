import { getGitInfo } from './utils/gitinfo.ts';
import { docComments, xmlComments } from './utils/comments.ts';
import TsxPlugin from './utils/tsx.ts';
import ManifestPlugin from './utils/manifest.ts';
import VitePlugin from './utils/vite.ts';

import manifest from './manifest.json' with { type: "json" };

/** @param {import('@11ty/eleventy/UserConfig').default} eleventyConfig */
async function eleventySetup(eleventyConfig){
	const logger = eleventyConfig.logger;
	eleventyConfig.setOutputDirectory('./dist');
	eleventyConfig.setInputDirectory('./src');
	eleventyConfig.addPassthroughCopy('./_locales/');
	// eleventyConfig.addPassthroughCopy('**/*.css'); // Handled by Vite
	eleventyConfig.addWatchTarget('./'); // .gitignore suppresses this
	eleventyConfig.setWatchJavaScriptDependencies(false); // Allow `eleventy --serve` without occurring an error
	const { version, version_name } = await getGitInfo(logger, 'minor');
	const datetime = new Date().toISOString();
	const comments = [
		`MIT License. ${manifest.homepage_url}`,
		`${manifest.name} ${version_name}`,
		`Build date: ${datetime}`,
	]
	if (true
		&& process.env.GITHUB_SERVER_URL
		&& process.env.GITHUB_REPOSITORY
		&& process.env.GITHUB_RUN_ID
	) {
		comments.push(`GitHub Actions Build URI: ${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`);
	}
	eleventyConfig.addPlugin(TsxPlugin, {
		entries: [
			'./src/options/index.tsx',
		],
		banner: xmlComments(comments),
	});
	eleventyConfig.addPlugin(ManifestPlugin, {
		iconInPath: './icon.svg',
		manifestInPath: './manifest.json',
		version: version,
		version_name: version_name,
	});
	eleventyConfig.addPlugin(VitePlugin, {
		entries: {
			'background': './src/background/main.ts',
			'options': './src/options/options.ts',
			'options.css': './src/options/options.scss',
		},
		minify: false, // Disable minification for potential faster reviews
		banner: docComments(comments),
		version: version_name,
	});
}

export default eleventySetup;
