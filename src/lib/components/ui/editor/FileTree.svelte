<script lang="ts">
	import { ArrowDownIcon, ArrowRightIcon, FileCodeIcon, FolderIcon } from '@lucide/svelte';
	import type { FileTreeItem } from '$types/editor.js';

	const defaultItems: FileTreeItem[] = [
		{
			name: 'src',
			type: 'folder',
			isOpen: true,
			children: [
				{ name: 'lib', type: 'folder', isOpen: false, children: [] },
				{ name: 'app.css', type: 'file' },
				{ name: '+page.svelte', type: 'file' }
			]
		},
		{ name: 'package.json', type: 'file' },
		{ name: 'vite.config.ts', type: 'file' }
	];

	type Props = {
		items?: FileTreeItem[];
		selected?: string;
		variant?: 'default' | 'compact';
		onSelect?: (name: string, item: FileTreeItem) => void;
	};

	let { items, selected = $bindable('app.css'), variant = 'default', onSelect }: Props = $props();

	let files = $state<FileTreeItem[]>(structuredClone(defaultItems));

	$effect(() => {
		files = structuredClone(items ?? defaultItems);
	});

	function toggleFolder(folder: FileTreeItem) {
		folder.isOpen = !folder.isOpen;
	}

	function selectFile(item: FileTreeItem) {
		selected = item.name;
		onSelect?.(item.name, item);
	}
</script>

<ul class="tree-root" data-variant={variant}>
	{#each files as item}
		<li class="tree-item">
			{#if item.type === 'folder'}
				<button class="item-label folder" onclick={() => toggleFolder(item)}>
					<span class="chevron">
						{#if item.isOpen}<ArrowDownIcon size={14} />{:else}<ArrowRightIcon size={14} />{/if}
					</span>
					<FolderIcon size={16} class="icon-folder" />
					{item.name}
				</button>

				{#if item.isOpen}
					<ul class="sub-tree">
						{#each item.children ?? [] as child}
							<li class="tree-item">
								{#if child.type === 'folder'}
									<button class="item-label folder" onclick={() => toggleFolder(child)}>
										<span class="chevron">
											{#if child.isOpen}<ArrowDownIcon size={14} />{:else}<ArrowRightIcon
													size={14}
												/>{/if}
										</span>
										<FolderIcon size={16} class="icon-folder" />
										{child.name}
									</button>
								{:else}
									<button
										class="item-label file"
										class:active={selected === child.name}
										onclick={() => selectFile(child)}
									>
										<FileCodeIcon size={16} class="icon-file" />
										{child.name}
									</button>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
			{:else}
				<button
					class="item-label file"
					class:active={selected === item.name}
					onclick={() => selectFile(item)}
				>
					<FileCodeIcon size={16} class="icon-file" />
					{item.name}
				</button>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.tree-root {
		list-style: none;
		padding: 0.4rem 0;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 13px;
	}

	.tree-root {
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--fg);
	}

	.tree-root[data-variant='compact'] {
		font-size: 12px;
	}

	.sub-tree {
		list-style: none;
		padding: 0;
		padding-left: 1rem;
	}

	.item-label {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 0.3rem 0.75rem;
		background: transparent;
		border: none;
		color: var(--muted);
		cursor: pointer;
		text-align: left;
		gap: 6px;
		white-space: nowrap;
	}

	.item-label:hover {
		background: var(--glint); /* Subtle hover token */
		color: var(--text);
	}

	.item-label.active {
		background: color-mix(in srgb, var(--accent) 12%, var(--mg));
		color: color-mix(in srgb, var(--accent) 70%, var(--text));
	}

	.chevron {
		display: flex;
		align-items: center;
		width: 16px;
	}

	.tree-root :global(.icon-folder) {
		color: var(--info);
	}
	.tree-root :global(.icon-file) {
		color: var(--muted);
	}

	.tree-root :global(.item-label.active .icon-file) {
		color: var(--accent);
	}
</style>
