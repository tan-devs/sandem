/// <reference types="@sveltejs/kit" />

// Manually declare the SvelteKit env modules that TypeScript sometimes
// can't infer in certain tooling environments (Vitest, custom builds, etc.).
// The build itself generates accurate d.ts files under .svelte-kit/ but
// editors/test runners don't always pick them up, hence this fallback.

// Export at least the variables this repo uses. Add more as needed.

declare module '$env/static/public' {
	export const PUBLIC_CONVEX_URL: string;
	export const PUBLIC_CONVEX_SITE_URL: string;
	export const PUBLIC_SITE_URL: string;
	export const PUBLIC_LIVEBLOCKS_KEY: string;
}

declare module '$env/dynamic/public' {
	export const PUBLIC_CONVEX_URL: string;
	export const PUBLIC_CONVEX_SITE_URL: string;
	export const PUBLIC_SITE_URL: string;
	export const PUBLIC_LIVEBLOCKS_KEY: string;
}

declare module '$env/static/private' {
	export const LIVEBLOCKS_SECRET_KEY: string;
	export const SITE_URL: string;
	export const GITHUB_CLIENT_ID: string;
	export const GITHUB_CLIENT_SECRET: string;
}

declare module '$env/dynamic/private' {
	export const LIVEBLOCKS_SECRET_KEY: string;
	export const SITE_URL: string;
	export const GITHUB_CLIENT_ID: string;
	export const GITHUB_CLIENT_SECRET: string;
}

declare namespace NodeJS {
	interface ProcessEnv {
		SITE_URL: string;
		GITHUB_CLIENT_ID: string;
		GITHUB_CLIENT_SECRET: string;
	}
}
