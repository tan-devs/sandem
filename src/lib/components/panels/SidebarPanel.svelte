<script lang="ts">
	import type { TabId } from '$lib/stores/activity/index.js';

	import Explorer from '$lib/components/explorer/Explorer.svelte';
	import SearchPanel from '$lib/components/search/Search.svelte';
	import Git from '$lib/components/git/Git.svelte';
	import Debug from '$lib/components/debug/Debug.svelte';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------

	interface Props {
		/**
		 * The currently active activity tab.
		 * Injected from +layout.svelte via useActivity — never read from the
		 * store directly so this component stays decoupled from global state.
		 */
		activeTab: TabId;
	}

	let { activeTab }: Props = $props();

	// ---------------------------------------------------------------------------
	// Panel map
	// ---------------------------------------------------------------------------

	// Keys must exactly match TabId values.
	const PANEL_MAP = {
		explorer: Explorer,
		search: SearchPanel,
		git: Git,
		run: Debug
	} satisfies Record<TabId, unknown>;

	const ActivePanel = $derived(PANEL_MAP[activeTab] ?? Explorer);
</script>

<aside>
	<ActivePanel />
</aside>

<style>
	aside {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-width: 0;
		height: 100%;
		overflow: hidden;
		background: color-mix(in srgb, var(--mg) 92%, var(--bg));
		border-right: 1px solid color-mix(in srgb, var(--border) 64%, transparent);
	}
</style>
