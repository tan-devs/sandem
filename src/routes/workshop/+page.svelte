<script lang="ts">
	import Preview from '$lib/components/ide/Preview.svelte';
	import Terminal from '$lib/components/ide/Terminal.svelte';
	import Editor from '$lib/components/ide/Editor.svelte';

	import Button from '$lib/components/ui/Button.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import MenuBar from '$lib/components/ui/MenuBar.svelte';
	import Form from '$lib/components/ui/Form.svelte';
	import Accordion from '$lib/components/ui/Accordion.svelte';
	import FileTree from '$lib/components/ui/FileTree.svelte';

	import {
		File,
		Search,
		GitBranch,
		Bug,
		Monitor,
		Boxes,
		FlaskConical,
		Container,
		Settings
	} from '@lucide/svelte';

	const menus: string[] = [
		'file',
		'edit',
		'selection',
		'view',
		'go',
		'run',
		'terminal',
		'help',
		'docs'
	];

	let searchValue = $state('');
</script>

<!-- ── Header ── -->
<MenuBar ariaLabel="application menu" padding="0" gap="0">
	{#snippet children()}
		{#each menus as menu}
			<Button variant="ghost">{menu}</Button>
		{/each}
	{/snippet}

	{#snippet actions()}
		<SearchBar bind:value={searchValue} placeholder="search">
			{#snippet icon()}<Search size={14} />{/snippet}
		</SearchBar>
		<Button variant="ghost" size="icon">😊</Button>
		<Button variant="ghost" size="icon">😣</Button>
		<Button variant="ghost" size="icon">😅</Button>
	{/snippet}
</MenuBar>

<!-- ── Body ── -->
<div class="body">
	<!-- ── Sidebar ── -->
	<div class="sidebar">
		<nav class="activity-bar">
			<Button variant="ghost" size="icon"><File /></Button>
			<Button variant="ghost" size="icon"><Search /></Button>
			<Button variant="ghost" size="icon"><GitBranch /></Button>
			<Button variant="ghost" size="icon"><Bug /></Button>
			<Button variant="ghost" size="icon"><Monitor /></Button>
			<Button variant="ghost" size="icon"><Boxes /></Button>
			<Button variant="ghost" size="icon"><FlaskConical /></Button>
			<Button variant="ghost" size="icon"><Container /></Button>
			<Button variant="ghost" size="icon" href="/home"><Settings /></Button>
		</nav>

		<Form ariaLabel="explorer" preset="plain">
			<Accordion title="explorer">
				<FileTree />
			</Accordion>
		</Form>
	</div>

	<!-- ── Main ── -->
	<div class="main">
		<article class="editor">
			<Editor />
		</article>

		<article class="terminal">
			<Terminal />
		</article>

		<aside class="preview">
			<Preview />
		</aside>
	</div>
</div>

<div class="footer">footer</div>

<style>
	:global(main) {
		/*
		 * main is the 1fr row inside .container which already has a definite
		 * height (100% of the viewport minus the navbar). We use height: 100%
		 * here — NOT 100dvh — so we don't break out of that constraint.
		 * overflow: hidden prevents any IDE child from triggering scroll.
		 */
		height: 100%;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto 1fr auto;
	}

	.body {
		display: grid;
		grid-template-columns: auto 1fr;
		min-height: 0;
	}

	/* ── Sidebar ── */
	.sidebar {
		display: flex;
		width: 16rem;
		border-right: 1px solid var(--border, white);
	}

	.activity-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 1rem 0;
		width: 4rem;
		border-right: 1px solid var(--border, white);
	}

	/* Settings button pushed to bottom */
	.activity-bar :global(.btn:last-child) {
		margin-top: auto;
	}

	/* ── Main ── */
	.main {
		display: grid;
		grid-template-areas:
			'editor   editor   preview'
			'terminal terminal preview';
		min-height: 0;
	}

	.editor {
		grid-area: editor;
		border: 1px solid var(--border, white);
		min-height: 0;
		overflow: hidden;
	}

	.terminal {
		grid-area: terminal;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border, white);
		min-height: 0;
		overflow: hidden;
	}

	.preview {
		grid-area: preview;
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border, white);
		min-height: 0;
		overflow: hidden;
	}

	/* Let the URL SearchBar fill the preview toolbar */
	.preview :global(.search-container) {
		flex: 1;
	}

	.footer {
		border-top: 1px solid var(--border, white);
		padding: 0.25rem 1rem;
		font-size: 0.75rem;
		color: var(--muted);
	}
</style>
