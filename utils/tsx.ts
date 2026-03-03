import 'tsx/esm';

import fs from 'node:fs/promises';
import path from 'node:path';

import type { Eleventy } from '@11ty/eleventy';
import type UserConfig from '@11ty/eleventy/UserConfig';
import { Merge } from '@11ty/eleventy-utils';
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

	private readonly directories: Eleventy['directories'];
	private readonly logger: Eleventy['logger'];

	private readonly entries: string[];
	private readonly inputDir: string;
	private readonly banner: string;
	private readonly ignoreOthers: boolean;

	constructor(elventyConfig: Eleventy, options: Partial<TsxPluginOptions> = {}) {
		this.directories = elventyConfig.directories;
		this.logger = elventyConfig.logger;
		const _options = Merge({}, DEFAULT_OPTIONS, options);
		this.entries = this.normalizeEntries(_options.entries);
		this.inputDir = this.getInputDirectory();
		this.banner = _options.banner ? `${_options.banner}\n` : '';
		this.ignoreOthers = _options.ignoreOthers;
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
			return this.directories.input as string;
		}
		const entries = this.entries;
		if (entries.length === 0) {
			this.logger.logWithOptions({
				message: `${TsxPlugin.LOGGER_PREFIX} No input directory set, using './' as default.`,
				type: 'warn',
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
			type: 'warn',
		});
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
		const ignores = files.filter((file) => {
			return !this.entries.includes(file) && (this.ignoreOthers || path.extname(file) === '.tsx');
		});
		return ignores;
	}

	public tsxCompile(_inputContent: string, _inputPath: string) {
		const banner = this.banner;
		return async function (
			this: { defaultRenderer: (_data: Record<string, unknown>) => Promise<string> },
			data: Record<string, unknown>,
		) {
			const content = await this.defaultRenderer(data);
			const result = await jsxToString(content);
			return `${banner}<!DOCTYPE html>\n${result}`;
		};
	}
}

export default async function (elventyConfig: UserConfig, options: Partial<TsxPluginOptions> = {}) {
	const plugin = new TsxPlugin(elventyConfig as unknown as Eleventy, options);
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
