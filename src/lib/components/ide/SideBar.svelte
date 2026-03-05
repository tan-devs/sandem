<script lang="ts">
	import Form from '$lib/components/ui/Form.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import FileTree from '$lib/components/ui/FileTree.svelte';
</script>

<div class="sidebar">
	<Form ariaLabel="explorer" preset="plain">
		<span class="title">
			<p>EXPLORER</p>
		</span>
		<Accordion title="project">
			<FileTree />
		</Accordion>
	</Form>
</div>

<style>
	.sidebar {
		grid-area: sidebar;

		height: 100%;
		background: hsl(0, 0%, 15%);
	}
	:global(#settings) {
		margin-top: auto;
	}

	.title {
		display: grid;
		grid-template-columns: 1fr auto;
	}
</style>
