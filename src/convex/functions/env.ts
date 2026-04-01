/**
 * convex/env.ts
 *
 * Validates that required Convex environment variables are present.
 *
 * These variables are NOT read from .env.local — they live in Convex's own
 * environment and must be set via:
 *
 *   npx convex env set VARIABLE_NAME "value"
 *
 * or in the Convex dashboard → Settings → Environment Variables.
 *
 * Import `convexEnv` wherever you need these values instead of reading
 * process.env directly, so you get an early, readable error if something
 * is missing rather than a cryptic downstream failure.
 */

const REQUIRED_VARS = [
	'BETTER_AUTH_SECRET',
	'SITE_URL',
	'GITHUB_CLIENT_ID',
	'GITHUB_CLIENT_SECRET'
] as const;

type ConvexEnv = Record<(typeof REQUIRED_VARS)[number], string>;

function validateEnv(): ConvexEnv {
	const missing: string[] = [];

	for (const key of REQUIRED_VARS) {
		if (!process.env[key]) {
			missing.push(key);
		}
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required Convex environment variable(s): ${missing.join(', ')}\n\n` +
				`These are set in Convex's cloud environment, NOT in .env.local.\n` +
				`Run the following for each missing variable:\n\n` +
				missing.map((k) => `  npx convex env set ${k} "your-value"`).join('\n') +
				`\n\nSee the Convex dashboard → Settings → Environment Variables for more.`
		);
	}

	return Object.fromEntries(REQUIRED_VARS.map((k) => [k, process.env[k]])) as ConvexEnv;
}

export const convexEnv = validateEnv();
