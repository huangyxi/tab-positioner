import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

/**
 * @type {import('eslint').Linter.Config[]}
 */
export default [
	{
		ignores: [
			'node_modules/',
			'dist/',
			'coverage/',
			'playwright-report/',
			'test-results/',
		],
	},
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: 'latest',
				sourceType: 'module',
				project: './tsconfig.json',
				ecmaFeatures: {
					jsx: true,
				},
			},
			globals: {
				console: 'readonly',
				chrome: 'readonly',
				browser: 'readonly',
				VERSION: 'readonly',
				api: 'readonly',
				process: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': tseslint,
		},
		rules: {
			...tseslint.configs['recommended'].rules,
			...tseslint.configs['recommended-requiring-type-checking'].rules,
			'indent': ['error', 'tab', {
				SwitchCase: 1,
			}],
			'quotes': ['error', 'single', {
				avoidEscape: true,
				allowTemplateLiterals: true,
			}],
			'semi': ['error', 'always'],
			'comma-dangle': ['error', 'always-multiline'],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': ['error', {
				argsIgnorePattern: '.*',
				varsIgnorePattern: '^_',
			}],
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'no-console': 'off',
			'eol-last': ['error', 'always'],
			'no-trailing-spaces': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', {
				prefer: 'type-imports',
				disallowTypeAnnotations: false,
			}],
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-call': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unsafe-return': 'warn',
			'@typescript-eslint/no-floating-promises': 'warn',
			"@typescript-eslint/no-redundant-type-constituents": "off",
			'@typescript-eslint/no-duplicate-type-constituents': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unsafe-function-type': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-unused-expressions': 'off',
		},
	},
];
