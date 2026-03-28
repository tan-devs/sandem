// src/lib/controllers/editor/createEditorActionHandlers.svelte.ts

import type { IDEContext } from '$lib/context/ide/ide-context.js';
import type { EditorStore } from '$lib/stores/editorStore.svelte.js'; // <-- Import the new store type
import type { IDEPanels, PanelKey } from '$lib/stores/panelStore.svelte.js';

export interface EditorActionContext {
	ide: IDEContext;
	editorStore: EditorStore; // <-- Changed from EditorStatus to EditorStore
	services: {
		autoSaver: ReturnType<typeof import('$lib/services').createAutoSaver>;
		fileWriter: ReturnType<typeof import('$lib/services').createFileWriter>;
		runtime: ReturnType<typeof import('$lib/services').createEditorRuntime>;
		lifecycle: ReturnType<typeof import('$lib/hooks').useEditorLifecycle>;
	};
	getPanels: () => IDEPanels | undefined;
}

export function createEditorActionHandlers(ctx: EditorActionContext) {
	return {
		async initialize(element: HTMLDivElement) {
			await ctx.services.lifecycle.initializeEditor(element);
		},

		syncAfterActivePathChange() {
			ctx.services.lifecycle.syncAfterActivePathChange();
		},

		async shutdown() {
			// Sequence matters: Drain persistence, then clean up runtime
			await ctx.services.autoSaver.drainAndCleanup();
			await ctx.services.fileWriter.drainAndDispose();
			ctx.services.lifecycle.cleanup();
		},

		openFile(path: string) {
			ctx.editorStore.openFile(path);
		},

		closeTab(path: string) {
			ctx.editorStore.closeTab(path);
		},

		togglePanel(panel: PanelKey) {
			const panels = ctx.getPanels();
			if (panels) {
				panels[panel] = !panels[panel];
			}
		}
	};
}
