import { WebContainer } from '@webcontainer/api';
import { buildFileSystemTree } from '$lib/utils/vfs';
import { createError } from '$lib/sveltekit/index.js';
import type { FileSystemTree } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';

type ProjectDoc = Doc<'projects'>;

// ── Singleton boot ────────────────────────────────────────────────────────────
// WebContainer can only be booted once per page origin. This module-level
// variable ensures all callers share the same instance.

let _instance: WebContainer | null = null;

export async function getWebContainer(): Promise<WebContainer> {
	if (!_instance) {
		_instance = await WebContainer.boot();
	}
	return _instance;
}

export async function mountProject(
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string }>
): Promise<WebContainer> {
	const instance = await getWebContainer();
	const tree = buildFileSystemTree(nodes);
	await instance.mount(tree);

	if (tree['package.json']) {
		const install = await instance.spawn('npm', ['install']);
		await install.exit;
	}

	return instance;
}

// ── Runtime manager ───────────────────────────────────────────────────────────

export type RuntimePhase = 'idle' | 'mounting' | 'installing' | 'ready' | 'failed';

export type RuntimeManagerOptions = {
	isDemo: () => boolean;
	getProjects: () => ProjectDoc[];
	getEntryPath: () => string;
	getWorkspaceTree: () => FileSystemTree;
};

/**
 * createRuntimeManager
 *
 * Manages the WebContainer boot → mount → install lifecycle and tracks
 * runtime phase as reactive $state. Called internally by
 * createWorkspaceRuntime — not meant to be used directly by components.
 *
 * Uses the page-scoped singleton (getWebContainer) so only one WebContainer
 * instance is ever booted per origin, regardless of how many times
 * startRuntime is called.
 */
export function createRuntimeManager(options: RuntimeManagerOptions) {
	let runtimePhase = $state<RuntimePhase>('idle');
	let runtimeError = $state<ReturnType<typeof createError> | null>(null);
	let webcontainer = $state<WebContainer | null>(null);

	const ready = $derived(runtimePhase === 'ready');

	async function startRuntime(): Promise<void> {
		// Guard against concurrent or redundant boots.
		if (runtimePhase === 'mounting' || runtimePhase === 'installing' || runtimePhase === 'ready') {
			return;
		}

		runtimePhase = 'mounting';
		runtimeError = null;

		try {
			webcontainer = await getWebContainer();
			await webcontainer.mount(options.getWorkspaceTree());

			runtimePhase = 'installing';

			const install = await webcontainer.spawn('npm', ['install']);
			const exitCode = await install.exit;

			if (exitCode !== 0) {
				throw new Error(`npm install failed with exit code ${exitCode}`);
			}

			runtimePhase = 'ready';
		} catch (err) {
			failRuntimeWithError(createError('Failed to start the sandbox runtime.'), err);
		}
	}

	async function stopRuntime(): Promise<void> {
		webcontainer?.teardown();
		webcontainer = null;
		runtimePhase = 'idle';
		runtimeError = null;
	}

	function failRuntimeWithError(err: ReturnType<typeof createError>, cause?: unknown): void {
		runtimePhase = 'failed';
		runtimeError = err;
		console.error('[RuntimeManager] Unrecoverable error:', cause ?? err);
	}

	return {
		get runtimePhase() {
			return runtimePhase;
		},
		get runtimeError() {
			return runtimeError;
		},
		get ready() {
			return ready;
		},
		get webcontainer() {
			return webcontainer;
		},
		startRuntime,
		stopRuntime,
		failRuntimeWithError
	};
}

export type RuntimeManager = ReturnType<typeof createRuntimeManager>;
