<script lang="ts">
	import { onMount } from 'svelte';
	import { SunIcon, MoonIcon } from '@lucide/svelte';
	import Button from '$lib/components/primitives/Button.svelte';

	let mode = $state<'light' | 'dark'>('dark');

	onMount(() => {
		// Read the already-applied attribute instead of localStorage
		mode = (document.documentElement.getAttribute('data-mode') as 'light' | 'dark') ?? 'dark';
	});

	$effect(() => {
		const root = document.documentElement;
		root.setAttribute('data-mode', mode);
		root.classList.toggle('dark', mode === 'dark');
		root.style.colorScheme = mode;
		localStorage.setItem('mode', mode);
	});

	function toggle() {
		mode = mode === 'light' ? 'dark' : 'light';
	}
</script>

<Button
	onclick={toggle}
	variant="ghost"
	tone={mode === 'light' ? 'warning' : 'info'}
	size="icon"
	aria-label="Toggle {mode === 'light' ? 'Dark' : 'Light'} Mode"
	class="mode-toggle"
>
	{#if mode === 'light'}
		<SunIcon size={18} />
	{:else}
		<MoonIcon size={18} />
	{/if}
</Button>

<style>
	:global(.mode-toggle) {
		border-radius: 4px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--muted);
	}
	:global(.mode-toggle:hover) {
		background: var(--fg);
		color: var(--text);
	}
</style>
