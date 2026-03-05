<script lang="ts">
	import { DropdownMenu, type WithoutChild } from 'bits-ui';

	type Props = DropdownMenu.RootProps & {
		label: string;
		items: Array<{ label: string; value: string }>;
		onSelect?: (value: string) => void;
		contentProps?: WithoutChild<DropdownMenu.ContentProps>;
	};

	let { open = $bindable(false), label, items, onSelect, contentProps, ...rest }: Props = $props();
</script>

<DropdownMenu.Root bind:open {...rest}>
	<DropdownMenu.Trigger class="dropdown-trigger">
		{label}
	</DropdownMenu.Trigger>
	<DropdownMenu.Portal>
		<DropdownMenu.Content {...contentProps} class="dropdown-content">
			<DropdownMenu.Group>
				{#each items as item}
					<DropdownMenu.Item
						textValue={item.value}
						onSelect={() => {
							onSelect?.(item.value);
							open = false;
						}}
						class="dropdown-item"
					>
						{item.label}
					</DropdownMenu.Item>
				{/each}
			</DropdownMenu.Group>
		</DropdownMenu.Content>
	</DropdownMenu.Portal>
</DropdownMenu.Root>

<style>
	:global(.dropdown-trigger) {
		padding: 0.5rem 1rem;
		background: var(--fg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		cursor: pointer;
		font-size: 0.875rem;
	}

	:global(.dropdown-trigger:hover) {
		background: var(--mg);
	}

	:global(.dropdown-content) {
		background: var(--fg);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		min-width: 160px;
		padding: 0.5rem 0;
	}

	:global(.dropdown-item) {
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	:global(.dropdown-item:hover) {
		background: var(--mg);
	}
</style>
