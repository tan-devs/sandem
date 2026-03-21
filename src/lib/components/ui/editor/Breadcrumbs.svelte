<script lang="ts">
	import { ChevronRightIcon } from '@lucide/svelte';
	let { path }: { path: string | null } = $props();
</script>

{#if path}
	<nav class="breadcrumb" aria-label="File path">
		{#each path.split('/') as segment, depth}
			{#if depth > 0}<span class="breadcrumb-sep"><ChevronRightIcon /></span>{/if}
			<span class="breadcrumb-segment" class:last={depth === path.split('/').length - 1}>
				{segment}
			</span>
		{/each}
	</nav>
{/if}

<style>
	/* ── Breadcrumb ─────────────────────────────────────────── */
	.breadcrumb {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 14px;
		height: 22px;
		font-size: 11px;
		font-family: 'Segoe UI', system-ui, sans-serif;
		color: color-mix(in srgb, var(--muted) 88%, var(--text));
		background: color-mix(in srgb, var(--bg) 86%, black);
		border-bottom: 1px solid color-mix(in srgb, var(--border) 68%, transparent);
		flex-shrink: 0;
		overflow: hidden;
		white-space: nowrap;
	}

	.breadcrumb-sep {
		color: color-mix(in srgb, var(--border) 80%, transparent);
		font-size: 12px;
		line-height: 1;
	}

	.breadcrumb-segment {
		color: color-mix(in srgb, var(--muted) 92%, var(--text));
		cursor: default;
	}

	.breadcrumb-segment.last {
		color: color-mix(in srgb, var(--text) 96%, white);
		font-weight: 500;
	}
</style>
