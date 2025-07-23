import path from 'node:path';
import fs from 'node:fs/promises';
import { Merge } from '@11ty/eleventy-utils';
import sharp from 'sharp';

interface ManifestPluginOptions {
	/** Relative to the project root */
	manifestInPath: string;
	/** Relative to the output directory */
	manifestOutPath: string;
	/** Relative to the project root */
	iconInPath: string;
	/** Array of icon sizes in pixels */
	iconOutSizes: number[];
	/** Function to generate icon file names based on size */
	iconOutFilename: (size: number) => string;
	/** Should be up to 4 dot-separated numbers */
	version: string;
	/** If empty (default), will not patch this field in the manifest.json */
	version_name: string;
}

const DEFAULT_OPTIONS: ManifestPluginOptions = {
	manifestInPath: './manifest.json',
	manifestOutPath: 'manifest.json',
	iconInPath: './icon.svg',
	iconOutSizes: [16, 32, 48, 128],
	iconOutFilename: (size) => `icon-${size}.png`,
	version: '0.0.0.1',
	version_name: '',
};

class ManifestPlugin {
	static LOGGER_PREFIX = '[Manifest]';

	/** @type {import("@11ty/eleventy/src/Util/ProjectDirectories.js").default} */
	directories;

	/** @type {import("@11ty/eleventy/src/Util/ConsoleLogger.js").default} */
	logger;

	options: ManifestPluginOptions;

	constructor(
		elventyConfig: {
			directories: any;
			logger: any;
		},
		options: ManifestPluginOptions = {} as ManifestPluginOptions,
	) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		this.options = Merge({}, DEFAULT_OPTIONS, options);
	}

	async patch() {
		const outDir = this.directories.output;
		const icons: { [size: number]: string } = {};
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
			prefix: ManifestPlugin.LOGGER_PREFIX,
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
export default function (
	eleventyConfig: {
		directories: any;
		logger: any;
		once: (event: string, callback: Function) => void;
	},
	options: ManifestPluginOptions = {} as ManifestPluginOptions,
) {
	const plugin = new ManifestPlugin(eleventyConfig, options);

	eleventyConfig.once('eleventy.before', async ({
		directories, runMode, outputMode
	}: any) => {
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
