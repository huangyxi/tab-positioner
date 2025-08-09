import { getGitInfo } from './utils/gitinfo.ts';
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
	eleventyConfig.addPlugin(TsxPlugin, {
		entries: [
			'./src/options/index.tsx',
		],
		ignoreTsxOnly: true,
	});

	const { version, version_name } = await getGitInfo(logger, 'minor');
	eleventyConfig.addPlugin(ManifestPlugin, {
		iconInPath: './icon.svg',
		manifestInPath: './manifest.json',
		version: version,
		version_name: version_name,
	});
	const datetime = new Date();
	eleventyConfig.addPlugin(VitePlugin, {
		entries: {
			'background': './src/background/main.ts',
			'options': './src/options/options.ts',
			'options.css': './src/options/options.scss',
		},
		minify: false, // Disable minification for potential faster reviews
		banner: `/*!`+
			`\n * MIT License. ${manifest.homepage_url}` +
			`\n * ${manifest.name} ${version_name}` +
			`\n * Build date: ${datetime.toISOString()}` +
			`\n */`,
		version: version_name,
	});
}

export default eleventySetup;
