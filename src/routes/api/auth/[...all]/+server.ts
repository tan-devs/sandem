// Authentication endpoint wrapper for Better Auth's SvelteKit adapter.
// The adapter provides GET/POST handlers that implement full auth/session
// management, so we simply re-export them here.
import { createSvelteKitHandler } from '$lib/sveltekit/index.js';

export const { GET, POST } = createSvelteKitHandler();
