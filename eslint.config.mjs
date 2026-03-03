import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

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
			'simple-import-sort': simpleImportSort,
		},
		rules: {
			...tseslint.configs['recommended-type-checked'].rules,
			// ...tseslint.configs['strict-type-checked'].rules,
			// ...tseslint.configs['stylistic-type-checked'].rules,
			semi: ['error', 'always'],
			'no-trailing-spaces': 'error',
			'comma-dangle': ['error', 'always-multiline'],
			'eol-last': ['error', 'always'],
			quotes: [
				'error',
				'single',
				{
					avoidEscape: true,
					allowTemplateLiterals: true,
				},
			],
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '.*',
					varsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{
					prefer: 'type-imports',
					disallowTypeAnnotations: false,
				},
			],
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',
		},
	},
	{
		files: ['{scripts,utils}/*.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-function-type': 'off',
		},
	},
];
