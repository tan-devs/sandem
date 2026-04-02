/**
 * sandbox-context.ts
 *
 * Svelte context that carries the WC singleton and preloaded project data
 * from (app)/+layout.svelte down to [repo]/+layout.svelte across the
 * SvelteKit routing boundary (where props can't cross).
 *
 * Set once in (app)/+layout.svelte.
 * Read in [repo]/+layout.svelte via requireSandboxContext().
 */

import { setContext, getContext } from 'svelte';
import type { wcSingleton } from '$lib/services/webcontainer/createWebcontainerSingleton.svelte';
import type { RepoLayoutData } from '$types/routes';

const SANDBOX_KEY = Symbol('Sandbox');

export type SandboxContext = {
	/** The module-level WC singleton — already booting by the time [repo] mounts. */
	wc: typeof wcSingleton;
	/** Projects fetched silently at app layout level. May be empty for guests. */
	getPreloadedProjects: () => RepoLayoutData['projects'];
	/** Whether the current session is a guest (no auth). */
	isGuest: () => boolean;
};

export function setSandboxContext(ctx: SandboxContext): void {
	setContext(SANDBOX_KEY, ctx);
}

export function getSandboxContext(): SandboxContext | null {
	return getContext<SandboxContext | undefined>(SANDBOX_KEY) ?? null;
}

export function requireSandboxContext(): SandboxContext {
	const ctx = getSandboxContext();
	if (!ctx) throw new Error('SandboxContext required but not found.');
	return ctx;
}
