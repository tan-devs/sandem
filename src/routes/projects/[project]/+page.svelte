<script lang="ts">
	import Editor from '$lib/components/ide/Editor.svelte';
	import Terminal from '$lib/components/ide/Terminal.svelte';
	import Preview from '$lib/components/ide/Preview.svelte';

	import { getIDEContext } from '$lib/context/ide-context.js';

	let { data } = $props();
	const ideContext = getIDEContext();

	const ID = data.project._id || null;
	const DATA = ideContext || null;
</script>

<section>
	<div class="editor"><Editor {ID} /></div>
	<div class="terminal"><Terminal {ID} /></div>
	<div class="preview"><Preview {ID} /></div>
</section>

<style>
	section {
		display: grid;
		grid-template-columns: 1fr 1fr;
		grid-template-rows: 1fr 1fr;
		grid-template-areas:
			'editor preview'
			'terminal preview';
	}

	.editor {
		grid-area: editor;
	}
	.terminal {
		grid-area: terminal;
	}
	.preview {
		grid-area: preview;
	}
</style>
