// import type { Eleventy } from '@11ty/eleventy';
declare module '@11ty/eleventy' {
	const Eleventy: any;
}

// import '@11ty/eleventy-utils';
declare module '@11ty/eleventy-utils' {
	export function Merge(output: any, ...inputs: any[]): any;
}
