import type chrome from 'chrome-types';

declare global {
	const chrome: typeof chrome;
}
