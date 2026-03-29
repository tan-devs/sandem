import type * as Monaco from 'monaco-editor';
import type { CollaborationRoom } from './createRoom.svelte.js';

export type CursorSyncContext = {
	editor: Monaco.editor.IStandaloneCodeEditor;
	room: CollaborationRoom;
};

function modelPath(model: Monaco.editor.ITextModel | null | undefined): string {
	return (model?.uri.path ?? '').replace(/^\/+/, '');
}

/**
 * Wires Monaco cursor/selection/blur events to `room.updatePresence`.
 * Returns `dispose` — call it when tearing down the session.
 *
 * Presence propagation to stores is handled separately in `syncPresence`.
 */
export function bindEditorCursor(ctx: CursorSyncContext): { dispose: () => void } {
	const disposables: Monaco.IDisposable[] = [];

	disposables.push(
		ctx.editor.onDidChangeCursorPosition((event) => {
			ctx.room.updatePresence({
				cursor: {
					path: modelPath(ctx.editor.getModel()),
					line: event.position.lineNumber,
					column: event.position.column
				}
			});
		})
	);

	disposables.push(
		ctx.editor.onDidChangeCursorSelection((event) => {
			const { selection } = event;
			ctx.room.updatePresence({
				selection: {
					path: modelPath(ctx.editor.getModel()),
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
