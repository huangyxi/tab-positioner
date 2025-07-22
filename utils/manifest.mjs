
import path from 'node:path';
import fs from 'node:fs/promises';
import { Merge } from "@11ty/eleventy-utils";
import sharp from 'sharp';

/**
 * @typedef {Object} ManifestPluginOptions
 * @property {string} manifestInPath Relative to the project root
 * @property {string} manifestOutPath Relative to the output directory
 * @property {string} iconInPath Relative to the project root
 * @property {number[]} iconOutSizes Array of icon sizes in pixels
 * @property {function(number): string} iconOutFilename Function to generate icon file names based on size
 * @property {string} version Should be up to 4 dot-separated numbers
 * @property {string} version_name If empty (Default), will not patch this field in the manifest.json
 */

/** @type {ManifestPluginOptions} */
const DEFAULT_OPTIONS = {
	manifestInPath: './manifest.json',
	manifestOutPath: 'manifest.json',
	iconInPath: './icon.svg',
	iconOutSizes: [16, 32, 48, 128],
	iconOutFilename: (size) => `icon-${size}.png`,
	version: '0.0.0.1',
	version_name: '',
};

class ManifestPlugin {

	/** @type {import("@11ty/eleventy/src/Util/ProjectDirectories.js").default} */
	directories;

	/** @type {import("@11ty/eleventy/src/Util/ConsoleLogger.js").default} */
	logger;

	/** @type {ManifestPluginOptions} */
	options;

	constructor(elventyConfig, options = {}) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		this.options = Merge({}, DEFAULT_OPTIONS, options);
	}

	async patch() {
		const outDir = this.directories.output;
		const icons = {};
		await fs.mkdir(outDir, { recursive: true });
		for (const size of this.options.iconOutSizes) {
			const iconOutputFilename = this.options.iconOutFilename(size);
			const iconOutputPath = path.join(outDir, iconOutputFilename)
			await sharp(this.options.iconInPath)
				.resize(size, size)
				.png()
				.toFile(iconOutputPath);
			icons[size] = iconOutputFilename;
		}
		const manifestData = await fs.readFile(this.options.manifestInPath, 'utf8');
		const manifest = JSON.parse(manifestData);
		manifest.icons = icons;
		manifest.version = this.options.version;
		if (this.options.version_name) {
			manifest.version_name = this.options.version_name;
		}
		const manifestOutputPath = path.join(outDir, this.options.manifestOutPath);
		await fs.writeFile(manifestOutputPath, JSON.stringify(manifest, null, '\t'), 'utf8');
		this.logger.logWithOptions({
			prefix: '[Manifest]',
			message: `Icons and ${this.options.manifestOutPath} generated ` +
			`with version ${this.options.version} (${this.options.version_name})`,
			type: 'info',
		});
	}
}

/**
 * @param {import("@11ty/eleventy/UserConfig").default} eleventyConfig
 * @param {ManifestPluginOptions} options
 */
export default function (eleventyConfig, options = {}) {
	const plugin = new ManifestPlugin(eleventyConfig, options);

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
		await plugin.patch();

	})
}
