import * as Y from 'yjs';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';
import type { CollaborationRoom } from './createRoom.svelte.js';

export type YjsDocContext = {
	room: CollaborationRoom;
	onSync: (isSynced: boolean) => void;
	onUpdate: (ydoc: Y.Doc, origin: unknown) => void;
};

export type YjsDocSession = {
	ydoc: Y.Doc;
	provider: LiveblocksYjsProvider;
	dispose: () => void;
};

function detachListener(
	provider: LiveblocksYjsProvider,
	event: string,
	handler: (...args: unknown[]) => void
) {
	const emitter = provider as unknown as {
		off?: (e: string, fn: (...a: unknown[]) => void) => void;
		removeListener?: (e: string, fn: (...a: unknown[]) => void) => void;
		removeEventListener?: (e: string, fn: (...a: unknown[]) => void) => void;
	};
	emitter.off?.(event, handler);
	emitter.removeListener?.(event, handler);
	emitter.removeEventListener?.(event, handler);
}

/**
 * Creates a Yjs document and a LiveblocksYjsProvider bound to `room`.
 *
 * `dispose` detaches all listeners and destroys the provider.
 * The ydoc is intentionally left alive — Monaco bindings may still hold a
 * reference; callers can `ydoc.destroy()` themselves after bindings are gone.
 */
export function createYjsDoc(ctx: YjsDocContext): YjsDocSession {
	const ydoc = new Y.Doc();
	const provider = new LiveblocksYjsProvider(ctx.room, ydoc);

	const onSync = (isSynced: boolean) => ctx.onSync(isSynced);
	provider.on('sync', onSync);

	const onUpdate = (_update: Uint8Array, origin: unknown) => ctx.onUpdate(ydoc, origin);
	ydoc.on('update', onUpdate);

	return {
		ydoc,
		provider,
		dispose() {
			detachListener(provider, 'sync', onSync as (...args: unknown[]) => void);
			ydoc.off('update', onUpdate);
			provider.destroy();
		}
	};
}
