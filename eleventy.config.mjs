import { getGitInfo } from './utils/gitinfo.mjs';
import { tsxCompile } from './utils/tsx.mjs';
import ManifestPlugin from './utils/manifest.mjs';
import VitePlugin from './utils/vite.mjs';

import manifest from './manifest.json' with { type: "json" };

/** @param {import('@11ty/eleventy/UserConfig').default} eleventyConfig */
async function eleventySetup(eleventyConfig){
	const logger = eleventyConfig.logger;
	eleventyConfig.setOutputDirectory('./dist');
	eleventyConfig.setInputDirectory('./src/options'); // Flatten output directory
	eleventyConfig.addPassthroughCopy('./_locales/');
	// eleventyConfig.addPassthroughCopy('**/*.css'); // Handled by Vite
	eleventyConfig.addWatchTarget('./'); // .gitignore suppresses this

	eleventyConfig.addTemplateFormats('tsx');
	eleventyConfig.addExtension(['tsx'], {
		key: '11ty.js',
		compile: tsxCompile,
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
			'options': './src/options/index.ts',
			'options.css': './src/options/options.css',
		},
		minify: false, // Disable minification for potential faster reviews
		banner: `/*!`+
			`\n * MIT License. ${manifest.homepage_url}` +
			`\n * ${manifest.name} ${version_name}` +
			`\n * Build date: ${datetime.toISOString()}` +
			`\n */`,
	});
}

export default eleventySetup;
