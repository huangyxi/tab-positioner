#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { ZipWriter, BlobWriter, Uint8ArrayReader } from '@zip.js/zip.js';

const DEFAULT_OUTPUT = 'chrome-extension.zip';
const DEFAULT_INPUTS = './dist';
const SKIP_FILES = [
	/^\..*/,
	/.*\.map$/,
];
const SCRIPT_FILENAME = path.basename(process.argv[1]);

function toRelPath(p) {
	// cwd is the root of the extension project if running by `npm run`
	return path.relative(process.cwd(), p);
}

function parseArgs(argv) {
	const args = [...argv];
	const inputPaths = [];
	let outputPath = DEFAULT_OUTPUT;
	let verbose = false;

	while (args.length) {
		const arg = args.shift();
		switch (arg) {
			case '--help':
			case '-h':
				console.log(`Usage: node ${SCRIPT_FILENAME} [options] <inputs>...`);
				console.log(`       npm run package -- [options] <inputs>...`);
				console.log(
					`\nArguments:` +
					'\n  -h, --help,         Show this help message' +
					'\n  -o, --output <path> Specify output zip file' +
					'\n  -v, --verbose       Enable verbose output' +
					'\n  <inputs>            One or more input files or directories to zip'
				);
				console.log(
					'\nDefaults:' +
					`\n  inputs: ${DEFAULT_INPUTS}` +
					`\n  output: ${DEFAULT_OUTPUT}`
				);
				process.exit(0);
			case '--output':
			case '-o':
				outputPath = args.shift();
				if (!outputPath) throw new Error('Missing output path after --output');
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

	return { inputPaths, outputPath, verbose };
}

// Walk a directory and yield { absPath, relPath } for all visible files
async function* walkDir(rootDir, baseDir = '') {
	const entries = await fs.readdir(rootDir, { withFileTypes: true });
	for (const entry of entries) {
		const absPath = path.join(rootDir, entry.name);
		const relPath = path.join(baseDir, entry.name);
		if (SKIP_FILES.some(pattern => pattern.test(entry.name))) {
			yield { skip: true, absPath, relPath };
			continue;
		}
		if (entry.isFile()) {
			yield { absPath, relPath };
			continue;
		}
		if(entry.isDirectory()) {
			yield* walkDir(absPath, relPath);
		}
	}
}

async function zipAppend(zipWriter, fsPath, zipPath, verbose) {
	const data = await fs.readFile(fsPath);
	await zipWriter.add(zipPath, new Uint8ArrayReader(data));
	if (data.length === 0) {
		if (verbose) console.warn(` ! Empty file: ${toRelPath(fsPath)}`);
		return 1; // Indicate empty file
	}
	return 0;
}


async function zipInputs(inputPaths, outputZipPath, verbose = false) {
	let ret = 0;
	const zipWriter = new ZipWriter(new BlobWriter());
	for (const input of inputPaths) {
		const stats = await fs.stat(input);
		const base = path.basename(input);
		if (stats.isFile()) {
			ret = await zipAppend(zipWriter, input, base, verbose) === 0 ? ret : 1;
			if (verbose) console.log('📄 Adding file:', toRelPath(input));
			continue;
		}
		if (stats.isDirectory()) {
			if (verbose) console.log('📁 Adding directory:', toRelPath(input));
			for await (const entry of walkDir(input, base)) {
				if (entry.skip) {
					if (verbose) console.log(' ⊘', toRelPath(entry.absPath), '[skipped]');
					continue;
				}
				ret = await zipAppend(zipWriter, entry.absPath, entry.relPath, verbose) === 0 ? ret : 1
				if (verbose) console.log(' +', toRelPath(entry.absPath));
			}
		}
	}
	const blob = await zipWriter.close();
	await fs.writeFile(outputZipPath, Buffer.from(await blob.arrayBuffer()));
	return ret;
}

export async function main(argv) {
	const { inputPaths, outputPath, verbose } = parseArgs(argv);
	try {
		const resolvedInputs = inputPaths.map(p => path.resolve(p));
		const resolvedOutput = path.resolve(outputPath);
		if (verbose) {
			console.log('📦 Zipping the following:');
			for (const input of resolvedInputs) console.log(' -', toRelPath(input));
			console.log('➡️  Output:', toRelPath(resolvedOutput));
		}
		const ret = await zipInputs(resolvedInputs, resolvedOutput, verbose);
		if (ret === 0) {
			console.log(`✅ Packed extension to ${toRelPath(resolvedOutput)}`);
		} else {
			console.log('⚠️ Some empty files inside the extension, please check.');
			process.exit(1);
		}

	} catch (err) {
		console.error('❌ Failed to create zip:', err.message);
		process.exit(1);
	}
}

main(process.argv.slice(2));
