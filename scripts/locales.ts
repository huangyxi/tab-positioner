#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import messages from '../_locales/en/messages.json' with { type: 'json' };

const LOCALES_DIR = path.resolve('_locales');
const BASE_LOCALE = 'en';

function validateLocale(json: any, locale: string): string[] {
	const errors: string[] = [];
	for (const key in messages) {
		if (!(key in json)) {
			errors.push(`Missing key "${key}"`);
			continue;
		}
		if (typeof json[key].message !== 'string') {
			errors.push(`Key "${key}" has invalid or missing "message" string`);
		}
	}
	for (const key in json) {
		if (!(key in messages)) {
			errors.push(`Unexpected key "${key}"`);
		}
	}
	return errors;
}

async function main() {
	const locales = await fs.readdir(LOCALES_DIR);
	const localeErrors: Record<string, string[]> = {};

	for (const locale of locales) {
		if (locale === BASE_LOCALE) continue;
		const filePath = path.join(LOCALES_DIR, locale, 'messages.json');
		try {
			const raw = await fs.readFile(filePath, 'utf-8');
			const json = JSON.parse(raw);
			const errs = validateLocale(json, locale);
			if (errs.length) {
				localeErrors[locale] = errs;
			} else {
				console.log(`✓ ${locale}`);
			}
		} catch (e: any) {
			localeErrors[locale] = [`File/parse error: ${e.message}`];
		}
	}

	const failedLocales = Object.keys(localeErrors);
	if (failedLocales.length === 0) {
		return
	}
	console.error('\nLocale validation errors:');
	for (const loc of failedLocales) {
		console.error(`\n✗ ${loc}`);
		for (const msg of localeErrors[loc]) {
			console.error(`  - ${msg}`);
		}
	}
	console.error(`\n${failedLocales.length} locale(s) failed.`);
	process.exit(1);
}

try {
	await main();
} catch (error: any) {
	console.error(`Unexpected error: ${error.message}`);
	process.exit(1);
}
