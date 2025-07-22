import 'tsx/esm';
import { jsxToString } from 'jsx-async-runtime';

export function tsxCompile(inputContent, inputPath) {
	return async function (data) {
		const content = await this.defaultRenderer(inputContent);
		const result = await jsxToString(content);
		return `<!DOCTYPE html>\n${result}`;
	};
}
