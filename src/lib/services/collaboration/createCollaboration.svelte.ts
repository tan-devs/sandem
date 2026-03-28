import type * as Monaco from 'monaco-editor';
import type { PROJECT } from '$types/projects.js';
import type { EditorRuntimeDependencies } from '$types/hooks.js';
import type { ModelBinding } from '../../utils/bindings';
import type { LiveblocksYjsProvider } from '@liveblocks/yjs';
import type * as Y from 'yjs';
import { resetCollaborationStores } from '$lib/stores';
import { getLiveblocksClient } from '$lib/liveblocks.config.js';

import { createCollaborationPresence } from './createCollaborationPresence.js';
import { createCollaborationEditorSync } from './createCollaborationSync.js';
import { createCollaborationYDoc } from './createCollaborationDoc.js';
import { createCollaborationBindings } from './createCollaborationBindings.js';
import type { Room } from '@liveblocks/client';

// ---------------------------------------------------------------------------
// Public types (unchanged surface — callers don't need to know the internals)
// ---------------------------------------------------------------------------

export type SetupCollaborationOptions = {
	project: PROJECT;
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

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Bootstraps a full collaboration session.
 *
 * Responsibilities of this file are limited to **wiring** — every piece of
 * real logic lives in the module it belongs to:
 *
 *   createCollaborationRoom       → Liveblocks enterRoom
 *   createCollaborationPresence   → room presence → stores
 *   createCollaborationEditorSync → Monaco events → room.updatePresence
 *   createCollaborationYDoc       → Yjs doc + provider + callbacks
 *   createCollaborationBindings   → MonacoBinding per file
 *
 * Returns `null` when the project has no room slug or when called server-side.
 */
export async function createCollaboration(
	options: SetupCollaborationOptions
): Promise<CollaborationSession | null> {
	if (!options.project.room || typeof window === 'undefined') return null;

	// 1. Enter the Liveblocks room.
	const liveblocksClient = getLiveblocksClient();
	const entered = liveblocksClient.enterRoom(options.project.room, {
		initialPresence: { cursor: null, selection: null }
	});
	const room = entered.room as Room;
	const leave = entered.leave;

	const teardowns: Array<() => void> = [];
	let disposed = false;

	// 2. Wire presence → collaboration stores.
	const presence = createCollaborationPresence({ room, roomId: options.project.room });
	teardowns.push(() => presence.dispose());

	// 3. Wire Monaco editor events → room.updatePresence.
	const editorSync = createCollaborationEditorSync({ editor: options.editor, room });
	teardowns.push(() => editorSync.dispose());

	// 4. Create Yjs doc + provider, inject sync and update callbacks.
	const ydocSession = createCollaborationYDoc({
		room,
		onSync(isSynced) {
			if (isSynced) options.seedProjectFromConvex();
		},
		onUpdate(ydoc, origin) {
			options.onYDocUpdate(ydoc, origin);
		}
	});
	teardowns.push(() => ydocSession.dispose());

	// 5. Create Monaco ↔ Yjs bindings for every project file.
	const bindingsSession = await createCollaborationBindings({
		files: options.project.files ?? [],
		ydoc: ydocSession.ydoc,
		provider: ydocSession.provider,
		editor: options.editor,
		instance: options.instance,
		bindings: options.bindings,
		toWebPath: options.toWebPath
	});
	teardowns.push(() => bindingsSession.dispose());

	// ---------------------------------------------------------------------------
	// Dispose + leaveRoom
	// ---------------------------------------------------------------------------

	function dispose() {
		if (disposed) return;
		disposed = true;
		for (const teardown of teardowns.splice(0)) teardown();
		resetCollaborationStores();
	}

	return {
		provider: ydocSession.provider,
		ydoc: ydocSession.ydoc,
		dispose,
		leaveRoom() {
			dispose();
			leave();
		}
	};
}
