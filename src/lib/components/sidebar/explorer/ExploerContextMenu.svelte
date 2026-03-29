<script lang="ts">
	import { tick } from 'svelte';
	import type { ContextMenuState, ContextMenuAction } from '$types/explorer';

	// ---------------------------------------------------------------------------
	// Types
	// ---------------------------------------------------------------------------

	type ContextMenuEntry =
		| {
				id: string;
				type: 'item';
				label: string;
				action?: ContextMenuAction;
				danger?: boolean;
				disabled?: boolean;
				/** If true, clicking closes the menu without firing onAction. */
				close?: boolean;
		  }
		| { id: string; type: 'separator' };

	interface Props {
		contextMenu: ContextMenuState;
		selectedPath: string | null;
		onAction: (action: ContextMenuAction) => void;
		onClose: () => void;
	}

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	let { contextMenu, selectedPath, onAction, onClose }: Props = $props();

	// ---------------------------------------------------------------------------
	// Menu entries — derived so disabled state reacts to selectedPath changes
	// ---------------------------------------------------------------------------

	const entries = $derived<ContextMenuEntry[]>([
		{ id: 'new-file', type: 'item', label: 'New File', action: 'new-file' },
		{ id: 'new-folder', type: 'item', label: 'New Folder', action: 'new-folder' },
		{ id: 'sep-1', type: 'separator' },
		{ id: 'rename', type: 'item', label: 'Rename', action: 'rename', disabled: !selectedPath },
		{
			id: 'delete',
			type: 'item',
			label: 'Delete',
			action: 'delete',
			danger: true,
			disabled: !selectedPath
		},
		{ id: 'sep-2', type: 'separator' },
		{ id: 'refresh', type: 'item', label: 'Refresh Explorer', action: 'refresh' },
		{ id: 'close', type: 'item', label: 'Close', close: true }
	]);

	const items = $derived(entries.filter((e) => e.type === 'item'));

	// ---------------------------------------------------------------------------
	// Keyboard navigation state
	// ---------------------------------------------------------------------------

	let menuEl: HTMLDivElement | null = $state(null);
	let activeIndex = $state(-1);
	let wasOpen = false;
	let lastPath = $state<string | null>(null);

	function enabledIndexes(): number[] {
		return items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
	}

	function itemIndexById(id: string): number {
		return items.findIndex((item) => item.id === id);
	}

	function menuButtons(): HTMLButtonElement[] {
		return menuEl
			? Array.from(menuEl.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
			: [];
	}

	async function focusActive() {
		await tick();
		menuButtons()[activeIndex]?.focus();
	}

	function move(step: 1 | -1) {
		const enabled = enabledIndexes();
		if (!enabled.length) return;
		const cur = enabled.indexOf(activeIndex);
		const next = cur === -1 ? 0 : (cur + step + enabled.length) % enabled.length;
		activeIndex = enabled[next] ?? enabled[0] ?? -1;
		void focusActive();
	}

	function setFirst() {
		activeIndex = enabledIndexes()[0] ?? -1;
	}

	function setLast() {
		const enabled = enabledIndexes();
		activeIndex = enabled[enabled.length - 1] ?? -1;
	}

	function restoreFocus(path: string | null) {
		if (!path) return;
		const rows = document.querySelectorAll<HTMLElement>('[data-tree-path]');
		for (const row of rows) {
			if (row.dataset.treePath === path) {
				row.focus();
				return;
			}
		}
	}

	function activate(id: string) {
		const item = items.find((e) => e.id === id);
		if (!item || item.disabled) return;
		if (item.close) {
			onClose();
			return;
		}
		if (item.action) onAction(item.action);
	}

	function onKeydown(event: KeyboardEvent) {
		if (!contextMenu.open) return;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				move(1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				move(-1);
				break;
			case 'Home':
				event.preventDefault();
				setFirst();
				void focusActive();
				break;
			case 'End':
				event.preventDefault();
				setLast();
				void focusActive();
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				activate(items[activeIndex]?.id ?? '');
				break;
			case 'Escape':
				event.preventDefault();
				onClose();
				break;
		}
	}

	// Track open transitions for focus management
	$effect(() => {
		if (contextMenu.open && contextMenu.path) lastPath = contextMenu.path;
		if (contextMenu.open && !wasOpen) {
			setFirst();
			void focusActive();
		}
		if (!contextMenu.open && wasOpen) {
			restoreFocus(lastPath);
			activeIndex = -1;
		}
		wasOpen = contextMenu.open;
	});
</script>

{#if contextMenu.open}
	<div
		bind:this={menuEl}
		id="explorer-context-menu"
		class="context-menu"
		style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
		role="menu"
		aria-label="Explorer context menu"
		tabindex="-1"
		onpointerdown={(e) => e.stopPropagation()}
		onkeydown={onKeydown}
	>
		{#each entries as entry (entry.id)}
			{#if entry.type === 'separator'}
				<div class="menu-divider" role="separator"></div>
			{:else}
				{@const idx = itemIndexById(entry.id)}
				<button
					type="button"
					class="menu-item"
					class:danger={entry.danger}
					role="menuitem"
					aria-disabled={entry.disabled ? 'true' : undefined}
					tabindex={activeIndex === idx ? 0 : -1}
					disabled={entry.disabled}
					onfocus={() => {
						activeIndex = idx;
					}}
					onpointerenter={() => {
						if (!entry.disabled) activeIndex = idx;
					}}
					onclick={() => activate(entry.id)}
				>
					{entry.label}
				</button>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.context-menu {
		position: fixed;
		z-index: 30;
		width: 180px;
		padding: 4px;
		border-radius: 4px;
		border: 1px solid color-mix(in srgb, var(--border) 75%, transparent);
		background: color-mix(in srgb, var(--mg) 92%, var(--bg));
		box-shadow:
			0 8px 22px color-mix(in srgb, var(--text) 16%, transparent),
			0 0 0 1px color-mix(in srgb, var(--border) 30%, transparent);
	}

	.menu-item {
		display: flex;
		align-items: center;
		width: 100%;
		height: 24px;
		padding: 0 8px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: var(--text);
		font-size: 11px;
		text-align: left;
		cursor: pointer;
	}

	.menu-item:hover:not(:disabled) {
		background: color-mix(in srgb, var(--fg) 70%, transparent);
	}

	.menu-item:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.menu-item.danger:hover:not(:disabled) {
		background: color-mix(in srgb, var(--error) 18%, transparent);
		color: var(--error);
	}

	.menu-divider {
		height: 1px;
		margin: 4px 0;
		background: color-mix(in srgb, var(--border) 60%, transparent);
	}
</style>
