import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

export const authClient = createAuthClient({
	plugins: [convexClient()],
	baseURL: 'https://pastel-cardinal-852.eu-west-1.convex.site'
});
