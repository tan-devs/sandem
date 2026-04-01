/**
 * workspace.store.svelte.ts
 *
 * Composition root for all workspace reactive state.
 * Instantiated once in WorkspaceController and injected downward.
 * Never imported as a singleton.
 *
 * Mirrors createTerminalStore() in the terminal system.
 */

import { createPanelsStore } from '$lib/stores/panels';
import { createWorkspaceProjectsStore } from './workspace.projects.store.svelte.js';

export type { PanelsStore } from '$lib/stores/panels';
export type { WorkspaceProjectsStore } from './workspace.projects.store.svelte.js';

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

export function createWorkspaceStore() {
	const panels = createPanelsStore();
	const projects = createWorkspaceProjectsStore();

	return { panels, projects };
}
