import { Merge } from '@11ty/eleventy-utils';
import { build as viteBuild } from 'vite';
import banner from 'vite-plugin-banner';

interface VitePluginOptions {
	/** Entry points for the Vite build */
	entries: string[];
	/** Whether to minify the output files */
	minify: boolean;
	/** Banner for the output files, should be \/*! ... *\/ */
	banner: string;
	/** Version of the extension */
	version: string;
}

const DEFAULT_OPTIONS: VitePluginOptions = {
	entries: [],
	minify: false,
	banner: '',
	version: 'v0.0.0.1',
};

class VitePlugin {
	static LOGGER_PREFIX = '[Vite]';

	/** @type {import("@11ty/eleventy/src/Util/ProjectDirectories.js").default} */
	directories;

	/** @type {import("@11ty/eleventy/src/Util/ConsoleLogger.js").default} */
	logger;

	options: VitePluginOptions;

	constructor(
		elventyConfig: {
			directories: any;
			logger: any;
		},
		options: VitePluginOptions = {} as VitePluginOptions,
	) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		this.options = Merge({}, DEFAULT_OPTIONS, options);
	}

	async build() {
		try {
			await viteBuild({
				define: {
					'api': 'chrome',
					'VERSION': JSON.stringify(this.options.version),
					// 'DEBUG': JSON.stringify(process.env.DEBUG),
				},
				build: {
					emptyOutDir: false, // Keep Eleventy passthroughed files
					minify: this.options.minify, // Disable minification for potential faster reviews
					rollupOptions: {
						input: this.options.entries,
						output: {
							entryFileNames: '[name].js',
							assetFileNames: '[name][extname]',
							chunkFileNames: 'asset-[hash].js',
						},
					},
				},
				plugins: [
					banner(this.options.banner),
				],
			});
			this.logger.logWithOptions({
				prefix: VitePlugin.LOGGER_PREFIX,
				message: `Built assets with Vite to ${this.directories.output}`,
				type: 'info',
			});
		} catch (error: any) {
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
export default function (
	eleventyConfig: {
		directories: any;
		logger: any;
		on: (event: string, callback: Function) => void;
	},
	options: VitePluginOptions = {} as VitePluginOptions,
) {
	const plugin = new VitePlugin(eleventyConfig, options);

	eleventyConfig.on('eleventy.before', async ({
		directories, runMode, outputMode
	}: any) => {
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
