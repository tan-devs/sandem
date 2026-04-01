/**
 * workspace.store.svelte.ts
 *
 * Composition root for workspace reactive state.
 * Instantiated once in WorkspaceController and injected downward.
 * Never imported as a singleton.
 *
 * Mirrors createTerminalStore() in the terminal system.
 *
 * NOTE: Panels state is intentionally NOT composed here.
 * Panels have their own store, service, and hook — all owned by
 * createPanelsController() inside WorkspaceController. Keeping them
 * separate means the panel system can be instantiated, tested, and
 * reasoned about without touching workspace project state.
 */

import { createWorkspaceProjectsStore } from './workspace.projects.store.svelte.js';

export type { WorkspaceProjectsStore } from './workspace.projects.store.svelte.js';

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;

export function createWorkspaceStore() {
	const projects = createWorkspaceProjectsStore();

	return { projects };
}
