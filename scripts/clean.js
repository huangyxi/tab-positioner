#!/usr/bin/env node

import fs from 'node:fs/promises';
import Eleventy from '@11ty/eleventy';

async function main() {
	const eleventy = new Eleventy(
		undefined,
		undefined,
		{
			dryRun: true,
		}
	);
	try {
		await eleventy.initializeConfig();
	} catch (error) {
		console.error('Failed to setup Eleventy:', error);
		process.exit(1);
	}
	const eleventyConfig = eleventy.eleventyConfig;
	const outDir = eleventyConfig.directories.output;
	await fs.rm(outDir, { force: true, recursive: true });
	eleventyConfig.logger.logWithOptions({
		prefix: '[Clean]',
		message: `Cleaned output directory ${outDir}`,
		type: 'info',
	});
}

main()
