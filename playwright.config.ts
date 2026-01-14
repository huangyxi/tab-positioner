import { defineConfig, devices } from '@playwright/test';

const ci = !!JSON.parse(process.env.CI ?? 'false');

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: ci,
	retries: ci ? 2 : 0,
	workers: ci ? 1 : undefined,
	reporter: [
		[ ci ? 'github' : 'list' ],
		['html', { open: ci ? 'never' : 'on-failure' }],
	],
	use: {
		trace: 'on-first-retry',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
