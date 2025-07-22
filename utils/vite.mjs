
import path from 'node:path';
import fs from 'node:fs/promises';
import { Merge } from "@11ty/eleventy-utils";
import { build as viteBuild } from 'vite';

/**
 * @typedef {Object} VitePluginOptions
 * @property {string[]} entries The entry points for the Vite build.
 * @property {boolean} minify Whether to minify the output files. (default: false)
 * @property {string} banner The banner of the output files, should be \/*! xxx *\/
 */

/** @type {VitePluginOptions} */
const DEFAULT_OPTIONS = {
	entries: [],
	minify: false,
	banner: '',
};

class VitePlugin {
	static LOGGER_PREFIX = '[Vite]';

	/** @type {import("@11ty/eleventy/src/Util/ProjectDirectories.js").default} */
	directories;

	/** @type {import("@11ty/eleventy/src/Util/ConsoleLogger.js").default} */
	logger;

	/** @type {VitePluginOptions} */
	options;

	constructor(elventyConfig, options = {}) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		this.options = Merge({}, DEFAULT_OPTIONS, options);
	}

	async build() {
		try {
			await viteBuild({
				build: {
					emptyOutDir: false, // Keep Eleventy passthroughed files
					minify: this.options.minify, // Disable minification for potential faster reviews
					rollupOptions: {
						input: this.options.entries,
						output: {
							entryFileNames: '[name].js',
							assetFileNames: '[name][extname]',
							chunkFileNames: 'asset-[hash].js',
							banner: this.options.banner,
						},
					},
				},
			});
			this.logger.logWithOptions({
				prefix: VitePlugin.LOGGER_PREFIX,
				message: `Built assets with Vite to ${this.directories.output}`,
				type: 'info',
			});
		} catch (error) {
			this.logger.logWithOptions({
				prefix: VitePlugin.LOGGER_PREFIX,
				message: `Failed to build with Vite: ${error.message}`,
				type: 'error',
				color: 'red',
			});
			throw error;
		}
	}
}

/**
 * @param {import("@11ty/eleventy/UserConfig").default} eleventyConfig
 * @param {VitePluginOptions} options
 */
export default function (eleventyConfig, options = {}) {
	const plugin = new VitePlugin(eleventyConfig, options);

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
		await plugin.build();
	})

	// import EleventyVitePlugin from '@11ty/eleventy-plugin-vite';
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
