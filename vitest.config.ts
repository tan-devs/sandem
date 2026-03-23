import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		// Unit tests
		include: ['src/**/*.{test,spec}.{js,ts}'],
		exclude: ['e2e/**/*'],

		// Environment
		environment: 'jsdom',

		// Setup files
		setupFiles: ['./scripts/setup-test-client.ts'],

		// Coverage quality gate
		coverage: {
			enabled: true,
			provider: 'v8',
			reporter: ['text', 'html', 'lcov'],
			include: ['src/**/*.{ts,js,svelte}'],
			exclude: [
				'src/**/*.d.ts',
				'src/**/_generated/**',
				'src/**/index.ts',
				'src/**/*.spec.{ts,js}',
				'src/**/*.test.{ts,js}',
				'src/demo.spec.ts'
			],
			thresholds: {
				branches: 4,
				functions: 2,
				lines: 3,
				statements: 3
			}
		}
	}
});
