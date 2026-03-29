<script lang="ts">
	import { Plus, X, Pencil, ArrowLeft, ArrowRight } from '@lucide/svelte';
	import Button from '$lib/components/ui/primitives/Button.svelte';
	import type { TerminalPanelTab } from '$lib/controllers/TerminalPanelController.svelte.js';
	import type { TerminalSessionMeta } from '$lib/controllers/TerminalSessionsController.svelte.js';

	type Props = {
		activeTab: TerminalPanelTab;
		sessions: Array<TerminalSessionMeta & { isReady: boolean }>;
		activeSessionId: string;
		onSelectSession: (id: string) => void;
		onCloseSession: (id: string) => void;
		onEnsureShell: (id: string) => void;
		onCreateSession: () => void;
		onRenameSession: (id: string, label: string) => void;
		onMoveSession: (id: string, direction: 'left' | 'right') => void;
	};

	let {
		activeTab,
		sessions,
		activeSessionId,
		onSelectSession,
		onCloseSession,
		onEnsureShell,
		onCreateSession,
		onRenameSession,
		onMoveSession
	}: Props = $props();

	let renamingId = $state<string | null>(null);
	let renameValue = $state('');

	function startRename() {
		const active = sessions.find((s) => s.id === activeSessionId);
		if (!active) return;
		renamingId = active.id;
		renameValue = active.label;
	}

	function cancelRename() {
		renamingId = null;
		renameValue = '';
	}

	function confirmRename() {
		if (!renamingId) return;
		onRenameSession(renamingId, renameValue);
		cancelRename();
	}
</script>

{#if activeTab === 'TERMINAL'}
	<div class="toolbar">
		<!-- Session tabs -->
		<div class="sessions" role="tablist" aria-label="Terminal sessions">
			{#each sessions as session (session.id)}
				<div class="tab" class:active={session.id === activeSessionId}>
					<button
						role="tab"
						aria-selected={session.id === activeSessionId}
						onclick={() => {
							onSelectSession(session.id);
							onEnsureShell(session.id);
						}}
					>
						<span class="dot" class:ready={session.isReady}></span>
						{session.label}
					</button>
					<button
						class="close"
						aria-label={`Close ${session.label}`}
						onclick={() => onCloseSession(session.id)}
					>
						<X size={10} strokeWidth={2.5} />
					</button>
				</div>
			{/each}
		</div>

		<!-- Rename strip (inline) -->
		{#if renamingId}
			<div class="rename">
				<input
					type="text"
					value={renameValue}
					oninput={(e) => (renameValue = (e.currentTarget as HTMLInputElement).value)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							confirmRename();
						}
						if (e.key === 'Escape') {
							e.preventDefault();
							cancelRename();
						}
					}}
				/>
				<Button size="sm" variant="ghost" onclick={confirmRename}>Save</Button>
				<Button size="sm" variant="ghost" onclick={cancelRename}>Cancel</Button>
			</div>
		{/if}

		<!-- Actions -->
		<div class="actions">
			<Button
				size="icon"
				variant="ghost"
				title="Move Left"
				onclick={() => onMoveSession(activeSessionId, 'left')}
			>
				<ArrowLeft size={13} strokeWidth={1.7} />
			</Button>
			<Button
				size="icon"
				variant="ghost"
				title="Move Right"
				onclick={() => onMoveSession(activeSessionId, 'right')}
			>
				<ArrowRight size={13} strokeWidth={1.7} />
			</Button>
			<Button size="icon" variant="ghost" title="Rename" onclick={startRename}>
				<Pencil size={13} strokeWidth={1.7} />
			</Button>
			<Button size="icon" variant="ghost" title="New Terminal" onclick={onCreateSession}>
				<Plus size={14} strokeWidth={1.7} />
			</Button>
		</div>
	</div>
{/if}

<style>
	.toolbar {
		display: flex;
		align-items: center;
		height: 28px;
		padding-inline: 6px;
		gap: 4px;
		border-bottom: 1px solid var(--border);
		background: var(--bg);
		flex-shrink: 0;
	}

	.sessions {
		display: flex;
		align-items: center;
		gap: 2px;
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		border-radius: 4px;
		padding: 0 2px 0 6px;
		height: 20px;
		border: 1px solid transparent;
		color: var(--muted);
	}

	.tab.active {
		color: var(--text);
		background: color-mix(in srgb, var(--fg) 60%, var(--bg));
		border-color: var(--border);
	}

	.tab button {
		background: none;
		border: none;
		cursor: pointer;
		font-size: 11px;
		font-weight: 500;
		color: inherit;
		padding: 0;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		white-space: nowrap;
	}

	.tab .close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 14px;
		height: 14px;
		border-radius: 3px;
		opacity: 0.5;
	}

	.tab .close:hover {
		opacity: 1;
		background: color-mix(in srgb, var(--fg) 75%, var(--bg));
	}

	.dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--muted);
		flex-shrink: 0;
	}

	.dot.ready {
		background: #22c55e;
	}

	.rename {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding-inline: 6px;
		border-left: 1px solid var(--border);
	}

	.rename input {
		height: 20px;
		width: 140px;
		padding: 0 6px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--bg);
		color: var(--text);
		font-size: 11px;
		outline: none;
	}

	.rename input:focus {
		border-color: color-mix(in srgb, var(--text) 40%, var(--border));
	}

	.actions {
		display: flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
		flex-shrink: 0;
	}
</style>
