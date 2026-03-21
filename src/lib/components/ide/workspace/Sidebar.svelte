<script lang="ts">
	import { activity, type TabId } from '$lib/stores/activity/activityStore.svelte.js';

	import Explorer from '../activities/Explorer.svelte';
	import SearchPanel from '../activities/Search.svelte';
	import Git from '../activities/Git.svelte';
	import Debug from '../activities/Debug.svelte';

	// Map tab id → component. Keys must exactly match TabId values.
	// ✅ 'run' key aligns with TabId and ActivityBar's corrected id: 'run'.
	const activityMap = {
		explorer: Explorer,
		search: SearchPanel,
		git: Git,
		run: Debug
	} satisfies Record<TabId, unknown>;

	const FallbackPanel = Explorer;
	let ActivePanel = $derived(activityMap[activity.tab] ?? FallbackPanel);
</script>

<aside>
	<ActivePanel />
</aside>

<style>
	aside {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--mg);
		border-right: 1px solid var(--border);
	}
</style>
