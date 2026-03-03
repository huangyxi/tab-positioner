import fs from 'node:fs/promises';
import path from 'node:path';

import type { Eleventy } from '@11ty/eleventy/';
import type UserConfig from '@11ty/eleventy/UserConfig';
import { Merge } from '@11ty/eleventy-utils';
import sharp from 'sharp';

type Manifest = typeof import('../manifest.json') & {
	icons: Record<number, string>;
	version_name: string;
};

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
	iconOutSizes: [
		16,
		32,
		48,
		128,
	],
	iconOutFilename: (size) => `icon-${size.toFixed()}.png`,
	version: '0.0.0.1',
	version_name: '',
};

class ManifestPlugin {
	static LOGGER_PREFIX = '[Manifest]';

	private readonly directories: Eleventy['directories'];
	private readonly logger: Eleventy['logger'];
	private readonly options: ManifestPluginOptions;

	constructor(elventyConfig: Eleventy, options: Partial<ManifestPluginOptions> = {}) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		this.options = Merge({}, DEFAULT_OPTIONS, options);
	}

	async patch() {
		const outDir = this.directories.output as string;
		const icons: { [size: number]: string } = {};
		await fs.mkdir(outDir, { recursive: true });
		for (const size of this.options.iconOutSizes) {
			const iconOutputFilename = this.options.iconOutFilename(size);
			const iconOutputPath = path.join(outDir, iconOutputFilename);
			await sharp(this.options.iconInPath).resize(size, size).png().toFile(iconOutputPath);
			icons[size] = iconOutputFilename;
		}
		const manifestData = await fs.readFile(this.options.manifestInPath, 'utf8');
		const manifest = JSON.parse(manifestData) as Manifest;
		manifest.icons = icons;
		manifest.version = this.options.version;
		if (this.options.version_name) {
			manifest.version_name = this.options.version_name;
		}
		const manifestOutputPath = path.join(outDir, this.options.manifestOutPath);
		await fs.writeFile(manifestOutputPath, JSON.stringify(manifest, null, '\t'), 'utf8');
		this.logger.logWithOptions({
			prefix: ManifestPlugin.LOGGER_PREFIX,
			message:
				`Icons and ${this.options.manifestOutPath} generated ` +
				`with version ${this.options.version} (${this.options.version_name})`,
			type: 'info',
		});
	}
}

export default function (eleventyConfig: UserConfig, options: Partial<ManifestPluginOptions> = {}) {
	const plugin = new ManifestPlugin(eleventyConfig as unknown as Eleventy, options);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	eleventyConfig.once('eleventy.before', async ({ directories, runMode, outputMode }: any) => {
		if (runMode === 'serve' || outputMode === 'json' || outputMode === 'ndjson') {
			return;
		}
		await plugin.patch();
	});
}
