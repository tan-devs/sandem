<script lang="ts">
	/**
	 * routes/(app)/+layout.svelte
	 *
	 * App shell layout — sits between the root layout and [repo]/+layout.svelte.
	 * Wraps both (home) and [repo] routes. Fully transparent — renders no UI.
	 *
	 * Responsibilities:
	 *   1. Initialize the Better Auth client (createSvelteAuthClient) so that
	 *      useAuth() works in all child layouts and pages
	 *   2. Boot WebContainer as early as possible (fire-and-forget, no spinner)
	 *   3. Silently preload the user's projects while they're on the home page
	 *   4. Set sandbox context so [repo]/+layout.svelte can consume both
	 *      without re-fetching or re-booting
	 */

	import { browser } from '$app/environment';
	import { type Snippet } from 'svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';

	import { createSvelteAuthClient } from '$lib/svelte';
	import { authClient } from '$lib/context/auth';
	import { setSandboxContext } from '$lib/context/webcontainer';
	import { wcSingleton } from '$lib/services/webcontainer';
	import { AppHeader } from '$lib/components/workspace';

	import type { Id } from '$convex/_generated/dataModel.js';
	import type { AppLayoutData } from '$types/routes.js';

	let { children, data }: { children: Snippet; data: AppLayoutData } = $props();

	// ── Auth client ───────────────────────────────────────────────────────────
	// Must be called here so useAuth() is available in (home) and [repo] children.
	// Seeds the client-side session from the SSR hint — no round-trip needed.

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });

	// ── Derive identity from SSR data ─────────────────────────────────────────

	const currentUser = $derived(data.currentUser);
	const isGuest = $derived(!currentUser);
	const ownerId = $derived<Id<'users'> | null>(currentUser?._id ?? null);

	// ── Silent project preload ────────────────────────────────────────────────
	// Skip if guest — guests have no projects. keepPreviousData prevents flicker
	// if the user navigates home → repo → home.

	const projectsResponse = useQuery(
		api.projects.getAllProjects,
		() => (ownerId ? { ownerId } : 'skip'),
		() => ({ initialData: data.projects, keepPreviousData: true })
	);

	// ── Boot WebContainer ─────────────────────────────────────────────────────
	// Called synchronously (not in onMount) so the boot promise is in-flight
	// before any child layout mounts and calls wcSingleton.waitForWebcontainer().
	//
	// Svelte fires onMount bottom-up (children before parents), so if this were
	// inside onMount, [repo]/+layout.svelte's onMount would call
	// waitForWebcontainer() before boot() had ever been invoked — hanging forever.
	//
	// Guarded by `browser` because WebContainer is client-only and this script
	// runs on the server during SSR.

	if (browser) {
		void wcSingleton.boot().catch((err) => {
			console.warn('[AppLayout] WebContainer pre-boot failed:', err);
		});
	}

	// ── Sandbox context ───────────────────────────────────────────────────────
	// Set after boot() is called so wcSingleton already has its internal promise
	// initialised by the time any child reads it via requireSandboxContext().

	setSandboxContext({
		wc: wcSingleton,
		getPreloadedProjects: () => projectsResponse.data ?? data.projects ?? [],
		isGuest: () => isGuest
	});
</script>

<!-- html -->

<AppHeader />

{@render children()}

<!-- /html -->
