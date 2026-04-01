<script lang="ts">
	import Editor from '$lib/components/editor/Editor.svelte';
	import Terminal from '$lib/components/terminal/Terminal.svelte';
	import RightSidebar from '$lib/components/preview/RightSidebar.svelte';
	import { WorkspacePaneLayout } from '$lib/components/workspace';
	import { requireIDEContext } from '$lib/context';

	// Panels are owned by PanelsController and exposed through IDE context.
	// They cannot be passed as a prop across the SvelteKit routing boundary
	// (+layout.svelte → +page.svelte), so IDE context is the correct DI path.
	const ide = requireIDEContext();
</script>

<WorkspacePaneLayout panels={ide.getPanels!()}>
	{#snippet editor()}
		<section aria-label="leftpane pane">
			<Editor />
		</section>
	{/snippet}

	{#snippet terminal()}
		<section class="downpane" aria-label="downpane pane">
			<Terminal />
		</section>
	{/snippet}

	{#snippet preview()}
		<aside aria-label="rightpane pane">
			<RightSidebar />
		</aside>
	{/snippet}
</WorkspacePaneLayout>

<style>
	section,
	aside {
		width: 100%;
		height: 100%;
		overflow: hidden;
		background: var(--bg);
	}

	.downpane {
		border-top: 1px solid var(--border);
	}
</style>
