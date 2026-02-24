<script lang="ts">
	import { onMount } from 'svelte';

	let currentTheme = $state('default');
	const themes = ['default', 'forest', 'solar', 'ocean'];

	onMount(() => {
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme && themes.includes(savedTheme)) {
			currentTheme = savedTheme;
		} else {
			document.documentElement.setAttribute('data-theme', currentTheme);
		}
	});

	$effect(() => {
		document.documentElement.setAttribute('data-theme', currentTheme);
		localStorage.setItem('theme', currentTheme);
	});
</script>

<div class="switcher-wrapper">
	<label for="theme-select">Active Theme</label>
	<select id="theme-select" bind:value={currentTheme} class="theme-select">
		{#each themes as theme}
			<option value={theme}>{theme.toUpperCase()}</option>
		{/each}
	</select>
</div>

<style>
	.switcher-wrapper {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
	}

	label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}

	.theme-select {
		appearance: none;
		padding: 0.75rem 1.25rem;
		padding-right: 2.5rem;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background-color: var(--mg);
		color: var(--text);
		font-weight: 500;
		cursor: pointer;
		transition: all var(--time) var(--ease);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.75rem center;
		background-size: 1rem;
	}

	.theme-select:hover {
		border-color: var(--accent);
		background-color: var(--fg);
	}

	.theme-select:focus {
		outline: none;
		box-shadow: 0 0 0 2px var(--highlight);
	}
</style>
