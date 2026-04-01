/**
 * workspace.projects.store.svelte.ts
 *
 * Pure reactive state for the workspace project list and UI selection.
 * No IO. No derived state. No Convex or localStorage calls.
 *
 * hydrate() is the injection point — useWorkspace.mount() populates it
 * from SSR data on first boot, keeping IO entirely outside the store.
 *
 * Persistence (localStorage write) lives in useWorkspace's $effect.
 * Sync from the live Convex subscription lives in useWorkspace's $effect.
 * Project CRUD mutations are delegated to createWorkspaceRuntime.
 *
 * Pure $state.
 */

import type { Doc } from '$convex/_generated/dataModel.js';

type ProjectDoc = Doc<'projects'>;

export type WorkspaceProjectsStore = ReturnType<typeof createWorkspaceProjectsStore>;

export function createWorkspaceProjectsStore() {
	let projects = $state<ProjectDoc[]>([]);
	let activeProjectId = $state<string | null>(null);
	let renamingProjectId = $state<string | null>(null);
	let pendingDeleteProjectId = $state<string | null>(null);

	/**
	 * Called once by useWorkspace.mount() with the SSR-seeded initial list.
	 * Prevents a hydration flash before the Convex subscription fires.
	 */
	function hydrate(initial: ProjectDoc[]): void {
		projects = initial;
		activeProjectId = initial[0]?._id ?? null;
	}

	function setProjects(next: ProjectDoc[]): void {
		projects = next;
	}

	function setActiveProjectId(id: string | null): void {
		activeProjectId = id;
	}

	function selectProject(id: string): void {
		activeProjectId = id;
		pendingDeleteProjectId = null;
		renamingProjectId = null;
	}

	function startRename(id: string): void {
		renamingProjectId = id;
		pendingDeleteProjectId = null;
	}

	function cancelRename(): void {
		renamingProjectId = null;
	}

	function requestDelete(id: string): void {
		// Toggle: clicking the active delete target dismisses the confirmation UI.
		pendingDeleteProjectId = pendingDeleteProjectId === id ? null : id;
		renamingProjectId = null;
	}

	return {
		get projects() {
			return projects;
		},
		get activeProjectId() {
			return activeProjectId;
		},
		get renamingProjectId() {
			return renamingProjectId;
		},
		get pendingDeleteProjectId() {
			return pendingDeleteProjectId;
		},

		hydrate,
		setProjects,
		setActiveProjectId,
		selectProject,
		startRename,
		cancelRename,
		requestDelete
	};
}
