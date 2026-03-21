import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit(),
		devtoolsJson(),
		{
			name: 'strip-monaco-loader-sourcemap',
			enforce: 'pre',
			transform(code, id) {
				if (!/monaco-editor[\\/]((min|dev)[\\/])?vs[\\/]loader\.js$/.test(id)) {
					return null;
				}

				return {
					code: code.replace(/\n\s*\/\/# sourceMappingURL=.*$/m, ''),
					map: null
				};
			}
		}
	],
	build: {
		rollupOptions: {
			external: ['monaco-editor'],
			output: {
				globals: {
					'monaco-editor': 'monaco'
				}
			}
		}
	}
});
