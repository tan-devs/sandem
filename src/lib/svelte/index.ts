// Convenience re-exports for the Svelte auth integration. Importing
// from this file keeps other parts of the app from needing to know the
// internal path to `client.svelte.js`.
export { createSvelteAuthClient, useAuth } from './client.svelte.js';
export type { AuthClient, ConvexAuthClient, InitialAuthState } from './client.svelte.js';
