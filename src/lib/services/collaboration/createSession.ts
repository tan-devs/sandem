import type * as Monaco from 'monaco-editor';
import type * as Y from 'yjs';
import type { LiveblocksYjsProvider } from '@liveblocks/yjs';
import type { Doc } from '$convex/_generated/dataModel.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';
import type { ModelBinding } from '$lib/utils';
import { resetCollaborationStores } from '$lib/stores';

type ProjectDoc = Doc<'projects'> & { files?: Array<{ name: string; contents: string }> };

import { enterRoom } from './createRoom.js';
import { syncPresence } from './createPresence.js';
import { bindEditorCursor } from './createCursorSync.js';
import { createYjsDoc } from './createYjsDoc.js';
import { bindEditorModels } from './createModelBindings.js';

export type CollaborationOptions = {
	project: ProjectDoc;
	editor: Monaco.editor.IStandaloneCodeEditor;
	instance: typeof Monaco;
	bindings: Map<string, ModelBinding>;
	toWebPath: EditorRuntimeDependencies['toWebPath'];
	seedProjectFromConvex: () => void;
	onYDocUpdate: (ydoc: Y.Doc, origin: unknown) => void;
};

export type CollaborationSession = {
	provider: LiveblocksYjsProvider;
	ydoc: Y.Doc;
	dispose: () => void;
	leaveRoom: () => void;
};

/**
 * Bootstraps a full collaboration session.
 *
 * This file is wiring-only — every piece of real logic lives in the module
 * it belongs to:
 *
 *   room.ts          → enterRoom (Liveblocks)
 *   presence.ts      → syncPresence (room presence → stores)
 *   cursorSync.ts    → bindEditorCursor (Monaco events → room.updatePresence)
 *   yjsDoc.ts        → createYjsDoc (Yjs doc + provider + callbacks)
 *   modelBindings.ts → bindEditorModels (MonacoBinding per file)
 *
 * Returns `null` when the project has no room slug or when called server-side.
 */
export async function startCollaborationSession(
	options: CollaborationOptions
): Promise<CollaborationSession | null> {
	if (!options.project.room || typeof window === 'undefined') return null;

	const { room, leave } = enterRoom(options.project.room);

	const teardowns: Array<() => void> = [];
	let disposed = false;

	// 1. Room presence → collaboration stores
	const presence = syncPresence({ room, roomId: options.project.room });
	teardowns.push(() => presence.dispose());

	// 2. Monaco cursor/selection events → room.updatePresence
	const cursor = bindEditorCursor({ editor: options.editor, room });
	teardowns.push(() => cursor.dispose());

	// 3. Yjs doc + Liveblocks provider
	const yjsSession = createYjsDoc({
		room,
		onSync(isSynced) {
			if (isSynced) options.seedProjectFromConvex();
		},
		onUpdate(ydoc, origin) {
			options.onYDocUpdate(ydoc, origin);
		}
	});
	teardowns.push(() => yjsSession.dispose());

	// 4. Monaco ↔ Yjs model bindings for all project files
	const models = await bindEditorModels({
		files: options.project.files ?? [],
		ydoc: yjsSession.ydoc,
		provider: yjsSession.provider,
		editor: options.editor,
		instance: options.instance,
		bindings: options.bindings,
		toWebPath: options.toWebPath
	});
	teardowns.push(() => models.dispose());

	function dispose() {
		if (disposed) return;
		disposed = true;
		for (const teardown of teardowns.splice(0)) teardown();
		resetCollaborationStores();
	}

	return {
		provider: yjsSession.provider,
		ydoc: yjsSession.ydoc,
		dispose,
		leaveRoom() {
			dispose();
			leave();
		}
	};
}
