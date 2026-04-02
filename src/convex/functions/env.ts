export function convexEnv() {
	return {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? '',
		SITE_URL: process.env.SITE_URL ?? '',
		GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? '',
		GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? ''
	};
}
