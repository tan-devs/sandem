<script lang="ts">
	import type { TabId } from '$lib/stores/activity/index.js';
	import type { IDEPanelsAdapter } from '$lib/controllers/panels';

	import Explorer from '$lib/components/explorer/Explorer.svelte';
	import SearchPanel from '$lib/components/search/Search.svelte';
	import Git from '$lib/components/git/Git.svelte';
	import Debug from '$lib/components/debug/Debug.svelte';

	interface Props {
		activeTab: TabId;
		getPanels: () => IDEPanelsAdapter | undefined;
	}

	let { activeTab, getPanels }: Props = $props();
</script>

<aside>
	{#if activeTab === 'explorer'}
		<Explorer {activeTab} />
	{:else if activeTab === 'search'}
		<SearchPanel />
	{:else if activeTab === 'git'}
		<Git />
	{:else if activeTab === 'run'}
		<Debug {getPanels} />
	{/if}
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
