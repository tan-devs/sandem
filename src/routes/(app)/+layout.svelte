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

	import { onMount, type Snippet } from 'svelte';
	import { useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';
	import { createSvelteAuthClient } from '$lib/svelte';
	import { authClient } from '$lib/context/auth';
	import { wcSingleton } from '$lib/services/webcontainer/createWebcontainerSingleton.svelte';
	import { setSandboxContext } from '$lib/context/webcontainer';
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

	// ── Sandbox context ───────────────────────────────────────────────────────
	// Set before any child mounts so [repo]/+layout.svelte can read it
	// synchronously at the top of its <script>.

	setSandboxContext({
		wc: wcSingleton,
		getPreloadedProjects: () => projectsResponse.data ?? data.projects ?? [],
		isGuest: () => isGuest
	});

	// ── Boot WebContainer ─────────────────────────────────────────────────────
	// Fire-and-forget on mount. No await — we don't want to block rendering.
	// wcSingleton.boot() is idempotent: safe to call multiple times.

	onMount(() => {
		void wcSingleton.boot().catch((err) => {
			console.warn('[AppLayout] WebContainer pre-boot failed:', err);
		});
	});
</script>

{@render children()}
