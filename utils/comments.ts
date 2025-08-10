export function docComments(
	comments: string[],
): string {
	return '/*!\n' +
		comments.map((comment) => ` * ${comment}`).join('\n') +
		'\n */';
}

export function xmlComments(
	comments: string[],
): string {
	return `<!--\n` +
		comments.map((comment) => `\t${comment}`).join('\n') +
		`\n-->`;
}
