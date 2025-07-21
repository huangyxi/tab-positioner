import path from 'node:path';
import fs from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import 'tsx/esm';
import { jsxToString } from 'jsx-async-runtime';
import sharp from 'sharp';
// import EleventyVitePlugin from '@11ty/eleventy-plugin-vite';
import { build as viteBuild } from 'vite';
import banner from 'vite-plugin-banner';

import manifest from './manifest.json' with { type: "json" };

const execAsync = promisify(exec);

async function getGitInfo(logger) {
	let version = '0.0.0';
	try {
		const { stdout } = await execAsync('git describe --tags --always --dirty');
		version = stdout.trim();
		version = version.replace(/^v/, ''); // Remove leading 'v' if present
	} catch (error) {
		logger.logWithOptions({
			prefix: '[GitInfo]',
			message: `Failed to get git version, using default version ${version}`,
			type: 'warn',
		})
	}
	let version_name = 'v' + version + '-unknown';
	try {
		const { stdout } = await execAsync('git rev-parse HEAD');
		const commit = stdout.trim();
		version_name = 'v' + version + '-' + commit.slice(0, 8);
	} catch (error) {
		logger.logWithOptions({
			prefix: '[GitInfo]',
			message: `Failed to get git commit, using default version name ${version_name}`,
			type: 'warn',
		})
	}
	return { version, version_name };
}

/** @param {import('@11ty/eleventy/UserConfig').default} eleventyConfig */
async function eleventySetup(eleventyConfig){
	const logger = eleventyConfig.logger;
	eleventyConfig.setOutputDirectory('./dist');
	// Get output directory only after internal merging
	const outDir = () => {
		return eleventyConfig.directories.output;
	};
	eleventyConfig.setInputDirectory('./src/options'); // Flatten output directory
	eleventyConfig.addPassthroughCopy('./_locales/');
	// eleventyConfig.addPassthroughCopy('**/*.css'); // Handled by Vite
	const svgPath = './icon.svg';
	const iconSizes = [16, 32, 48, 128];
	const { version, version_name } = await getGitInfo(logger);
	const viteInput = {
		'background': './src/background/main.ts',
		'options': './src/options/index.ts',
		'options.css': './src/options/options.css',
	};
	eleventyConfig.addWatchTarget('./'); // .gitignore suppresses this

	eleventyConfig.addTemplateFormats('tsx');
	eleventyConfig.addExtension(['tsx'], {
		key: '11ty.js',
		compile: function (inputContent, inputPath) {
			return async function (data) {
				const content = await this.defaultRenderer(inputContent);
				const result = await jsxToString(content);
				return `<!DOCTYPE html>\n${result}`;
			};
		},
	});

	// Convert SVG icon to PNGs and update version in manifest
	eleventyConfig.once('eleventy.before', async ({
		directories, runMode, outputMode
	}) => {
		if (
			runMode === 'serve' ||
			outputMode === "json" ||
			outputMode === "ndjson"
		) {
			return;
		}
		const icons = {};
		await fs.mkdir(outDir(), { recursive: true });
		for (const size of iconSizes) {
			const outputName = `icon-${size}.png`;
			const outputPath = path.join(outDir(), outputName)
			await sharp(svgPath).resize(size, size).png().toFile(outputPath);
			icons[size] = outputName;
		}
		const manifestOutputPath = path.join(outDir(), 'manifest.json');
		manifest.icons = icons;
		manifest.version = version;
		manifest.version_name = version_name;
		await fs.writeFile(manifestOutputPath, JSON.stringify(manifest, null, '\t'), 'utf8');
		logger.logWithOptions({
			prefix: '[Manifest]',
			message: `Generated icons and updated manifest.json with version ${version} (${version_name})`,
			type: 'info',
		});
	});

	// Bundle with Vite
	eleventyConfig.on('eleventy.before', async ({
		directories, runMode, outputMode
	}) => {
		if (
			runMode === 'serve' ||
			outputMode === "json" ||
			outputMode === "ndjson"
		) {
			return;
		}
		try {
			await viteBuild({
				build: {
					emptyOutDir: false, // Keep Eleventy passthroughed files
					minify: false, // Disable minification for potential faster reviews
					rollupOptions: {
						input: viteInput,
						output: {
							entryFileNames: '[name].js',
							assetFileNames: '[name][extname]',
							chunkFileNames: 'asset-[hash].js',
						},
					},
					outDir: outDir(),
				},
				plugins: [
					banner(
						`/**`+
						`\n * MIT License. ${manifest.homepage_url}` +
						`\n * ${manifest.name} ${version_name}` +
						`\n */`
					),
				],
			});
			logger.logWithOptions({
				prefix: '[Vite]',
				message: `Built assets with Vite to ${outDir()}`,
				type: 'info',
			});
		} catch (error) {
			logger.logWithOptions({
				prefix: '[Vite]',
				message: `Failed to build with Vite: ${error.message}`,
				type: 'error',
			});
			throw error;
		}
	});
	// eleventyConfig.addPlugin(EleventyVitePlugin, {
	// 	/** @type {import('vite').UserConfig} */
	// 	viteOptions: {
	// 		build: {
	// 			emptyOutDir: false,
	// 			rollupOptions: {
	// 				output: {
	// 					entryFileNames: '[name].js',
	// 					assetFileNames: "[name][extname]",
	// 					// assetFileNames: '[name].[ext]',
	// 				},
	// 			},
	// 		},
	// 	},
	// });
}

export default eleventySetup;
