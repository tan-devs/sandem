import { createAuthClient } from 'better-auth/svelte';
import { convexClient } from '@convex-dev/better-auth/client/plugins';

export type CollaborationRole = 'owner' | 'editor' | 'viewer';

export const authClient = createAuthClient({
	plugins: [convexClient()]
});

export function canWriteForRole(role: CollaborationRole | null | undefined) {
	return role === 'owner' || role === 'editor';
}
