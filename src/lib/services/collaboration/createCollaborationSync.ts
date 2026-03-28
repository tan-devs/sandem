import type * as Monaco from 'monaco-editor';
import type { Room } from '@liveblocks/client';

export type EditorSyncContext = {
	editor: Monaco.editor.IStandaloneCodeEditor;
	room: Room;
};

function toProjectPath(model: Monaco.editor.ITextModel | null | undefined): string {
	const path = model?.uri.path ?? '';
	return path.replace(/^\/+/, '');
}

/**
 * Wires Monaco editor cursor/selection/blur events to `room.updatePresence`.
 *
 * Injected: `EditorSyncContext` (editor instance + Liveblocks room).
 * Returns a `dispose` function — call it when tearing down the session.
 *
 * No stores are accessed here; presence propagation is handled separately in
 * `createCollaborationPresence`.
 */
export function createCollaborationEditorSync(ctx: EditorSyncContext): { dispose: () => void } {
	const disposables: Monaco.IDisposable[] = [];

	disposables.push(
		ctx.editor.onDidChangeCursorPosition((event) => {
			const path = toProjectPath(ctx.editor.getModel());
			ctx.room.updatePresence({
				cursor: {
					path,
					line: event.position.lineNumber,
					column: event.position.column
				}
			});
		})
	);

	disposables.push(
		ctx.editor.onDidChangeCursorSelection((event) => {
			const path = toProjectPath(ctx.editor.getModel());
			const { selection } = event;
			ctx.room.updatePresence({
				selection: {
					path,
					startLine: selection.startLineNumber,
					startColumn: selection.startColumn,
					endLine: selection.endLineNumber,
					endColumn: selection.endColumn
				}
			});
		})
	);

	disposables.push(
		ctx.editor.onDidBlurEditorText(() => {
			ctx.room.updatePresence({ cursor: null, selection: null });
		})
	);

	return {
		dispose() {
			for (const d of disposables) d.dispose();
		}
	};
}
