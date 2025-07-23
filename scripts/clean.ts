#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { Eleventy } from '@11ty/eleventy';

const SCRIPT_FILENAME = path.basename(process.argv[1]);

export async function main(argv: string[]) {
	let output;
	const args = [...argv]; // Copy to avoid modifying the original array
	while (args.length) {
		const arg = args.shift() as string;
		switch (arg) {
			case '--help':
			case '-h':
				console.log(`Usage: node ${SCRIPT_FILENAME} [options]`);
				console.log(`       npm run clean -- [options]`);
				console.log(`\nOptions:` +
					'\n  -h, --help      Show this help message' +
					'\n  --output <path> Specify output directory to clean'
				);
				console.log(`\nDefaults:` +
					`\n  output: Defined in 'eleventy.config.mjs'`)
				process.exit(0);
			case '--output':
				output = args.shift();
				// Commented to use the same logic as Eleventy where output can be undefined
				// if (!output) {
				// 	console.error('Missing output path after --output');
				// 	process.exit(1);
				// }
				break;
			default:
				console.error(`Unknown argument: ${arg}`);
				process.exit(1);
		}
	}
	const eleventy = new Eleventy(
		undefined,
		output || undefined,
		{
			dryRun: true,
		},
	);
	try {
		await eleventy.initializeConfig();
	} catch (error) {
		console.error('Failed to setup Eleventy:', error);
		process.exit(1);
	}
	const eleventyConfig = eleventy.eleventyConfig;
	const outDir = output || eleventyConfig.directories.output;
	await fs.rm(outDir, { force: true, recursive: true });
	eleventyConfig.logger.logWithOptions({
		prefix: '[Clean]',
		message: `Cleaned output directory ${outDir}`,
		type: 'info',
	});
}

main(process.argv.slice(2));
