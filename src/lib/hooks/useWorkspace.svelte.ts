/**
 * useWorkspace.svelte.ts
 *
 * Svelte 5 hook. Must be called during component/controller initialization
 * so its $effect registrations execute in the correct reactive context.
 *
 * Mirrors useTerminal in the terminal system.
 *
 * Responsibilities:
 *   1. Sync live Convex project subscription → store            (replaces syncRepoProjects)
 *   2. Sidebar expand/collapse DOM side-effect on panel change
 *   3. Persist activeProjectId to localStorage
 *   4. mount() — boots runtime, registers window error guards, returns cleanup
 *
 * Nothing in this hook owns state. All state writes go through the store.
 * All IO (localStorage, window event listeners) lives here — not in the store.
 */

import { untrack } from 'svelte';
import { createError } from '$lib/sveltekit/index.js';
import { uniqueProjects, areProjectsEqual } from '$lib/utils';
import type { WorkspaceStore } from '$lib/stores/workspace/workspace.store.svelte.js';
import type { WorkspaceRuntime } from '$lib/services/workspace/createWorkspaceRuntime.svelte.js';
import type { RepoLayoutData } from '$types/routes.js';

const STORAGE_KEY = 'sandem.activeProjectId';

export type UseWorkspaceOptions = {
	store: WorkspaceStore;
	runtime: WorkspaceRuntime;
	getProjectsData: () => RepoLayoutData['projects'] | undefined;
	getProjectsError: () => unknown;
	getInitialProjects: () => RepoLayoutData['projects'];
	isGuest: () => boolean;
};

export type UseWorkspaceResult = {
	mount: () => (() => void) | void;
};

export function useWorkspace(opts: UseWorkspaceOptions): UseWorkspaceResult {
	const { store, runtime, isGuest } = opts;

	// ── Effect 1: Project sync ─────────────────────────────────────────────────
	//
	// Single effect handles both the SSR seed (before subscription fires) and
	// live Convex subscription updates. Replaces the former two-effect pattern
	// in +layout.svelte and the standalone syncRepoProjects() function.
	$effect(() => {
		const projectsData = opts.getProjectsData();
		const projectsError = opts.getProjectsError();
		const initialProjects = opts.getInitialProjects();

		if (isGuest()) {
			syncProjects(initialProjects);
			return;
		}

		if (projectsError) {
			runtime.failRuntimeWithError(
				createError('Failed to load projects for this workspace.', { code: 'INTERNAL_ERROR' }),
				projectsError
			);
			return;
		}

		syncProjects(projectsData ?? initialProjects);
	});

	// ── Effect 2: Persist active project selection ─────────────────────────────
	//
	// IO stays here so the store remains pure and localStorage-free.
	$effect(() => {
		const id = store.projects.activeProjectId;
		if (id && typeof window !== 'undefined') {
			untrack(() => window.localStorage.setItem(STORAGE_KEY, id));
		}
	});

	// ── Project sync helper ────────────────────────────────────────────────────

	function syncProjects(next: RepoLayoutData['projects']): void {
		const unique = uniqueProjects(next);

		// untrack the read so this function doesn't become a reactive dependency itself.
		if (
			!areProjectsEqual(
				untrack(() => store.projects.projects),
				unique
			)
		) {
			store.projects.setProjects(unique);
		}

		const currentId = untrack(() => store.projects.activeProjectId);
		if (!currentId || !unique.some((p) => p._id === currentId)) {
			const nextId = unique[0]?._id ?? null;
			if (currentId !== nextId) store.projects.setActiveProjectId(nextId);
		}
	}

	// ── Mount ──────────────────────────────────────────────────────────────────

	function mount(): (() => void) | void {
		// Seed the project list from SSR data on first boot, before the Convex
		// subscription fires and Effect 1 takes over.
		if (!isGuest() && store.projects.projects.length === 0) {
			store.projects.hydrate(uniqueProjects(opts.getInitialProjects().slice()));
		}

		// Restore the last active project from localStorage.
		if (!isGuest() && typeof window !== 'undefined') {
			const fromStorage = window.localStorage.getItem(STORAGE_KEY);
			if (fromStorage && store.projects.projects.some((p) => p._id === fromStorage)) {
				store.projects.setActiveProjectId(fromStorage);
			}
		}

		void runtime.startRuntime();

		// Guard against unhandled WebContainer errors bubbling to window.
		const onUnhandledError = (event: ErrorEvent) => {
			const message = event.error instanceof Error ? event.error.message : event.message;
			if (!message || !/webcontainer|sandbox|terminal|mount/i.test(message)) return;
			runtime.failRuntimeWithError(
				createError('A runtime error occurred.'),
				event.error ?? message
			);
		};

		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			const message = event.reason instanceof Error ? event.reason.message : String(event.reason);
			if (!/webcontainer|sandbox|terminal|mount/i.test(message)) return;
			runtime.failRuntimeWithError(
				createError('A runtime promise rejection occurred.'),
				event.reason
			);
		};

		window.addEventListener('error', onUnhandledError);
		window.addEventListener('unhandledrejection', onUnhandledRejection);

		return () => {
			window.removeEventListener('error', onUnhandledError);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
			void runtime.stopRuntime();
		};
	}

	return { mount };
}
