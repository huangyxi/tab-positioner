import type { Eleventy } from '@11ty/eleventy';
import type UserConfig from '@11ty/eleventy/UserConfig';
import { Merge } from '@11ty/eleventy-utils';
import type { PluginOption } from 'vite';
import { build as viteBuild } from 'vite';
import banner from 'vite-plugin-banner';
import istanbul from 'vite-plugin-istanbul';

interface VitePluginOptions {
	/** Entry points for the Vite build */
	entries: string[];
	/** Whether to minify the output files */
	minify: boolean;
	/** Banner for the output files, should be \/*! ... *\/ */
	banner: string;
	/** Version of the extension */
	version: string;
	/** Whether to instrument code for coverage */
	coverage: boolean;
}

const DEFAULT_OPTIONS: VitePluginOptions = {
	entries: [],
	minify: false,
	banner: '',
	version: 'v0.0.0.1',
	coverage: false,
};

class VitePlugin {
	static LOGGER_PREFIX = '[Vite]';

	private readonly directories: Eleventy['directories'];
	private readonly logger: Eleventy['logger'];

	private readonly options: VitePluginOptions;

	constructor(elventyConfig: Eleventy, options: Partial<VitePluginOptions> = {}) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		this.options = Merge({}, DEFAULT_OPTIONS, options);
	}

	async build() {
		try {
			await viteBuild({
				define: {
					api: 'chrome',
					VERSION: JSON.stringify(this.options.version),
					// 'DEBUG': JSON.stringify(process.env.DEBUG),
				},
				build: {
					outDir: this.directories.output as string,
					emptyOutDir: false, // Keep Eleventy passthroughed files
					minify: this.options.minify, // Disable minification for potential faster reviews
					sourcemap: this.options.coverage,
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
					this.options.coverage
						? istanbul({
								include: 'src/**',
								extension: ['.ts', '.tsx'],
								requireEnv: false,
								forceBuildInstrument: true,
							})
						: undefined,
				].filter(Boolean) as PluginOption[],
			});
			this.logger.logWithOptions({
				prefix: VitePlugin.LOGGER_PREFIX,
				message: `Built assets with Vite to ${this.directories.output}`,
				type: 'info',
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.logger.logWithOptions({
				prefix: VitePlugin.LOGGER_PREFIX,
				message: `Failed to build with Vite: ${message}`,
				type: 'error',
				color: 'red',
			});
			throw error;
		}
	}
}

export default function (eleventyConfig: UserConfig, options: Partial<VitePluginOptions> = {}) {
	const plugin = new VitePlugin(eleventyConfig as unknown as Eleventy, options);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	eleventyConfig.on('eleventy.before', async ({ directories, runMode, outputMode }: any) => {
		if (runMode === 'serve' || outputMode === 'json' || outputMode === 'ndjson') {
			return;
		}
		await plugin.build();
	});

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
