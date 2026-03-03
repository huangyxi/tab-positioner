declare module '@11ty/eleventy-utils' {
	export function Merge<T>(target: Partial<T>, ...sources: Partial<T>[]): T;
}
