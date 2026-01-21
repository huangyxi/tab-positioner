declare module '@11ty/eleventy' {
	export class Eleventy {
		constructor(input?: string, output?: string, options?: {
			dryRun?: boolean;
			config?: string;
		});
		initializeConfig(): Promise<void>;
		eleventyConfig: {
			directories: {
				input: string;
				output: string;
			};
			logger: {
				logWithOptions(options: {
					prefix?: string;
					message: string;
					type: 'info' | 'warn' | 'error' | 'log';
				}): void;
			};
		};
	}
}

declare module '@11ty/eleventy-utils' {
	export function Merge<T>(target: Partial<T>, ...sources: Partial<T>[]): T;
}
