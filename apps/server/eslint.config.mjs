import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
		plugins: { js },
		extends: ['js/recommended'],
		languageOptions: { globals: globals.node }
	},
	tseslint.configs.recommended,
	globalIgnores(['node_modules', 'build', 'uploads']),
	{
		rules: {
			'padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: 'import', next: '*' },
				{ blankLine: 'never', prev: 'import', next: 'import' },
				{ blankLine: 'always', prev: 'export', next: '*' },
				{ blankLine: 'always', prev: '*', next: 'export' },
				{ blankLine: 'always', prev: ['var', 'let', 'const'], next: '*' },
				{ blankLine: 'always', prev: '*', next: ['var', 'let', 'const'] },
				{
					blankLine: 'never',
					prev: ['var', 'let', 'const'],
					next: ['var', 'let', 'const']
				},
				{ blankLine: 'always', prev: 'block-like', next: '*' },
				{ blankLine: 'always', prev: '*', next: 'block-like' },
				{ blankLine: 'never', prev: 'if', next: 'if' },
				{ blankLine: 'any', prev: 'for', next: 'for' },
				{ blankLine: 'never', prev: 'expression', next: 'expression' },
				{ blankLine: 'never', prev: '*', next: 'return' }
			]
		}
	}
]);
