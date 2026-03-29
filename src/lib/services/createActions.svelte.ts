// src/lib/services/createEditorActionHandlers.svelte.ts

import type { IDEContext } from '$lib/context/';
import type { IDEPanels, PanelKey, EditorStore } from '$lib/stores';

export interface EditorActionContext {
	ide: IDEContext;
	editorStore: EditorStore;
	services: {
		autoSaver: ReturnType<typeof import('$lib/services').createAutoSaver>;
		fileWriter: ReturnType<typeof import('$lib/services').createFileWriter>;
		runtime: ReturnType<typeof import('$lib/services').createEditorRuntime>;
		lifecycle: ReturnType<typeof import('$lib/hooks').useEditor>;
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
			await ctx.services.autoSaver.drainAndCleanup();
			await ctx.services.fileWriter.drainAndDispose();
			ctx.services.lifecycle.destroy();
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
