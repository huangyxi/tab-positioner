import 'tsx/esm';
import { jsxToString } from 'jsx-async-runtime';

export function tsxCompile(inputContent: any, inputPath: any) {
	return async function (
		this: { defaultRenderer: (input: any) => Promise<any> },
		data: any,
	) {
		const content = await this.defaultRenderer(inputContent);
		const result = await jsxToString(content);
		return `<!DOCTYPE html>\n${result}`;
	};
}
