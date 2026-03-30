import type { IDEContext } from '$lib/context/';
import type { IDEPanels, PanelKey, EditorStore } from '$lib/stores';

export interface EditorActionContext {
	ide: IDEContext;
	editorStore: EditorStore;
	services: {
		autoSaver: ReturnType<typeof import('$lib/services/editor').createEditorAutoSaver>;
		fileWriter: ReturnType<typeof import('$lib/services/editor').createEditorFileWriter>;
		runtime: ReturnType<typeof import('$lib/services/editor').createEditor>;
		lifecycle: ReturnType<typeof import('$lib/hooks').useEditor>;
	};
	getPanels: () => IDEPanels | undefined;
}

/**
 * Pure action handler surface for the editor pane.
 *
 * All dependencies are injected via EditorActionContext — nothing is
 * imported directly. This makes every handler independently testable.
 *
 * Shutdown sequence matters: drain autoSaver first (Convex writes),
 * then drain fileWriter (WebContainer writes), then destroy the runtime.
 * Reversing this order would write to a destroyed Monaco instance.
 */
export function createEditorActions(ctx: EditorActionContext) {
	return {
		async initialize(element: HTMLDivElement) {
			await ctx.services.lifecycle.initializeEditor(element);
		},

		syncAfterActivePathChange() {
			ctx.services.lifecycle.syncAfterActivePathChange();
		},

		/**
		 * Full shutdown in dependency order:
		 *   1. Drain Convex saves (autoSaver)
		 *   2. Drain WebContainer writes (fileWriter)
		 *   3. Destroy Monaco + Yjs (lifecycle → runtime)
		 */
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
			if (panels) panels[panel] = !panels[panel];
		}
	};
}
