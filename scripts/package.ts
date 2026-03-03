#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import { BlobWriter, Uint8ArrayReader, ZipWriter } from '@zip.js/zip.js';

const DEFAULT_OUTPUT = 'chrome-extension.zip';
const DEFAULT_INPUTS = './dist';
const SKIP_FILES = [/^\..*/, /.*\.map$/];
const SCRIPT_FILENAME = path.basename(process.argv[1]);

function toRelPath(p: string): string {
	// cwd is the root of the extension project if running by `npm run`
	return path.relative(process.cwd(), p);
}

function parseArgs(argv: string[]) {
	const args = [...argv]; // Copy to avoid modifying the original array
	const inputPaths: string[] = [];
	let outputPath = DEFAULT_OUTPUT;
	let verbose = false;
	let preserveRoot = false;

	while (args.length) {
		const arg = args.shift() as string;
		switch (arg) {
			case '--help':
			case '-h':
				console.log(`Usage: node ${SCRIPT_FILENAME} [options] <inputs>...`);
				console.log(`       npm run package -- [options] <inputs>...`);
				console.log(
					`\nArguments:` +
						'\n  -h, --help,         Show this help message' +
						'\n  -o, --output <path> Specify output zip file' +
						'\n  -p, --preserve-root Preserve root directory structure' +
						'\n  -v, --verbose       Enable verbose output' +
						'\n  <inputs>            One or more input files or directories to zip',
				);
				console.log('\nDefaults:' + `\n  inputs: ${DEFAULT_INPUTS}` + `\n  output: ${DEFAULT_OUTPUT}`);
				process.exit(0);
			case '--output':
			case '-o':
				outputPath = args.shift() as string;
				if (!outputPath) throw new Error('Missing output path after --output');
				break;
			case '--preserve-root':
			case '-p':
				preserveRoot = true;
				break;
			case '--verbose':
			case '-v':
				verbose = true;
				break;
			default:
				inputPaths.push(arg);
		}
	}

	if (inputPaths.length === 0) {
		inputPaths.push(DEFAULT_INPUTS);
	}

	return { inputPaths, outputPath, preserveRoot, verbose };
}

interface WalkDirEntry {
	absPath: string;
	relPath: string;
	skip: boolean;
}

// Walk a directory and yield { absPath, relPath } for all visible files
async function* walkDir(rootDir: string, baseDir: string = ''): AsyncGenerator<WalkDirEntry> {
	const entries = await fs.readdir(rootDir, { withFileTypes: true });
	for (const entry of entries) {
		const absPath = path.join(rootDir, entry.name);
		const relPath = path.join(baseDir, entry.name);
		if (SKIP_FILES.some((pattern) => pattern.test(entry.name))) {
			yield { absPath, relPath, skip: true };
			continue;
		}
		if (entry.isFile()) {
			yield { absPath, relPath, skip: false };
			continue;
		}
		if (entry.isDirectory()) {
			yield* walkDir(absPath, relPath);
		}
	}
}

async function zipAppend<T>(zipWriter: ZipWriter<T>, fsPath: string, zipPath: string, verbose: boolean) {
	const data = await fs.readFile(fsPath);
	await zipWriter.add(zipPath, new Uint8ArrayReader(data));
	if (data.length === 0) {
		if (verbose) console.warn(` ! Empty file: ${toRelPath(fsPath)}`);
		return 1; // Indicate empty file
	}
	return 0;
}

async function zipInputs(
	inputPaths: string[],
	outputZipPath: any,
	preserveRoot: boolean = false,
	verbose: boolean = false,
) {
	let ret = 0;
	const zipWriter = new ZipWriter(new BlobWriter());
	for (const input of inputPaths) {
		const stats = await fs.stat(input);
		const base = path.basename(input);
		if (stats.isFile()) {
			ret = (await zipAppend(zipWriter, input, base, verbose)) === 0 ? ret : 1;
			if (verbose) console.log('📄 Adding file:', toRelPath(input));
			continue;
		}
		if (stats.isDirectory()) {
			if (verbose) console.log('📁 Adding directory:', toRelPath(input));
			const inputBase = preserveRoot ? base : '';
			for await (const entry of walkDir(input, inputBase)) {
				if (entry.skip) {
					if (verbose) console.log(' ⊘', toRelPath(entry.absPath), '[skipped]');
					continue;
				}
				ret = (await zipAppend(zipWriter, entry.absPath, entry.relPath, verbose)) === 0 ? ret : 1;
				if (verbose) console.log(' +', toRelPath(entry.absPath));
			}
		}
	}
	const blob = await zipWriter.close();
	await fs.writeFile(outputZipPath, Buffer.from(await blob.arrayBuffer()));
	return ret;
}

export async function main(argv: string[]) {
	const { inputPaths, outputPath, preserveRoot, verbose } = parseArgs(argv);
	try {
		const resolvedInputs = inputPaths.map((p) => path.resolve(p));
		const resolvedOutput = path.resolve(outputPath);
		if (verbose) {
			console.log('📦 Zipping the following:');
			for (const input of resolvedInputs) console.log(' -', toRelPath(input));
			console.log('➡️  Output:', toRelPath(resolvedOutput));
		}
		const ret = await zipInputs(resolvedInputs, resolvedOutput, preserveRoot, verbose);
		if (ret === 0) {
			console.log(`✅ Packed extension to ${toRelPath(resolvedOutput)}`);
		} else {
			console.log('⚠️ Some empty files inside the extension, please check.');
			process.exit(1);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error('❌ Failed to create zip:', message);
		process.exit(1);
	}
}

await main(process.argv.slice(2));
