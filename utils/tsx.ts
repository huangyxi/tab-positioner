import fs from 'node:fs/promises';
import path from 'node:path';
import { Merge } from '@11ty/eleventy-utils';
import 'tsx/esm';
import { jsxToString } from 'jsx-async-runtime';

interface TsxPluginOptions {
	/** Entry points for the TSX build */
	entries: string[];
	/** Banner for the output files, should be <!-- ... --> */
	banner: string;
	/** Whether to ignore files other than TSX that are not entry points */
	ignoreOthers: boolean;
}

const DEFAULT_OPTIONS: TsxPluginOptions = {
	entries: [],
	banner: '',
	ignoreOthers: false,
};

class TsxPlugin {
	static LOGGER_PREFIX = '[TSX]';

	/** @type {import("@11ty/eleventy/src/Util/ProjectDirectories.js").default} */
	directories;

	/** @type {import("@11ty/eleventy/src/Util/ConsoleLogger.js").default} */
	logger;

	entries: string[];
	inputDir: string;
	banner: string;
	ignoreOthers: boolean;

	constructor(
		elventyConfig: {
			directories: any;
			logger: any;
		},
		options: TsxPluginOptions = {} as TsxPluginOptions,
	) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		options = Merge({}, DEFAULT_OPTIONS, options);
		this.entries = this.normalizeEntries(options.entries);
		this.inputDir = this.getInputDirectory();
		this.banner = options.banner ? `${options.banner}\n` : '';
		this.ignoreOthers = options.ignoreOthers;
	}

	private normalizeEntries(entries: string[]) {
		const cwd = process.cwd();
		const normalizedEntries: string[] = [];
		for (const entry of entries) {
			const normalizedEntry = path.relative(cwd, path.resolve(entry));
			normalizedEntries.push(normalizedEntry);
		}
		return normalizedEntries;
	}

	private getInputDirectory(): string {
		if (this.directories.input !== undefined) {
			return this.directories.input;
		}
		const entries = this.entries;
		if (entries.length === 0) {
			this.logger.logWithOptions({
				message: `${TsxPlugin.LOGGER_PREFIX} No input directory set, using './' as default.`,
				level: 'warn',
			});
			return './';
		}
		let commonDir = path.dirname(entries[0]);
		let commonSegments = commonDir.split(path.sep);
		for (const entry of entries) {
			const entryDir = path.dirname(entry);
			const entrySegments = entryDir.split(path.sep);
			let i = 0;
			while (i < Math.min(commonSegments.length, entrySegments.length)) {
				if (commonSegments[i] !== entrySegments[i]) {
					break;
				}
				i++;
			}
			commonSegments = commonSegments.slice(0, i);
		}
		commonDir = commonSegments.join(path.sep);
		const inputDir = commonDir;
		this.logger.logWithOptions({
			message: `${TsxPlugin.LOGGER_PREFIX} No input directory set, using '${inputDir}' as default.`,
			level: 'warn',
		})
		return inputDir;
	}

	private async walkDirectory(dir: string, fileList: string[] = []): Promise<string[]> {
		const files = await fs.readdir(dir, { withFileTypes: true });
		for (const file of files) {
			const filePath = path.join(dir, file.name);
			if (file.isDirectory()) {
				await this.walkDirectory(filePath, fileList);
			} else if (file.isFile()) {
				fileList.push(filePath);
			}
		}
		return fileList;
	}

	public async getIgnores(): Promise<string[]> {
		const files = await this.walkDirectory(this.inputDir);
		const ignores = files.filter(file => {
			return !this.entries.includes(file)
				&& (this.ignoreOthers || path.extname(file) === '.tsx');
		});
		return ignores;
	}

	public tsxCompile(inputContent: any, inputPath: any) {
		const banner = this.banner;
		return async function (
			this: { defaultRenderer: (input: any) => Promise<any> },
			data: any,
		) {
			const content = await this.defaultRenderer(inputContent);
			const result = await jsxToString(content);
			return `${banner}<!DOCTYPE html>\n${result}`;
		};
	};
}

/**
 * @param {import("@11ty/eleventy/src/EleventyConfig.js").default} elventyConfig
 * @param {TsxPluginOptions} options
 */
export default async function (
	elventyConfig: {
		directories: any;
		logger: any;
		ignores: {
			add: (path: string) => void;
		}
		addTemplateFormats: (formats: string | string[]) => void;
		addExtension: (extensions: string| string[], options: any) => void;
	},
	options: TsxPluginOptions = {} as TsxPluginOptions,
) {
	const plugin = new TsxPlugin(elventyConfig, options);
	elventyConfig.addTemplateFormats('tsx');
	elventyConfig.addExtension('tsx', {
		key: '11ty.js',
		compile: plugin.tsxCompile.bind(plugin),
	});
	const ignores = await plugin.getIgnores();
	for (const ignore of ignores) {
		elventyConfig.ignores.add(ignore);
	}
}
