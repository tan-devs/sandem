<script lang="ts">
	import { Menubar, type WithoutChildrenOrChild } from 'bits-ui';
	import type { Tone, Variant } from '$types/ui.js';

	type ChromeVariant = Extract<Variant, 'default' | 'outline' | 'ghost'>;

	type Props = WithoutChildrenOrChild<Menubar.MenuProps> & {
		text: string;
		items: { label: string; value: string; onSelect?: () => void }[];
		variant?: ChromeVariant;
		tone?: Tone;
		content?: WithoutChildrenOrChild<Menubar.ContentProps>;
	};

	let { text, items, variant = 'default', tone = 'neutral', content, ...rest }: Props = $props();

	const toneMap: Record<Tone, string> = {
		neutral: 'var(--muted)',
		accent: 'var(--accent)',
		success: 'var(--success)',
		warning: 'var(--warning)',
		info: 'var(--info)',
		danger: 'var(--error)'
	};
</script>

<div class="menubar-shell">
	<Menubar.Menu {...rest}>
		<Menubar.Trigger class="menubar-trigger" data-variant={variant}>
			{text}
		</Menubar.Trigger>
		<Menubar.Content
			class="menubar-content"
			data-variant={variant}
			style={`--menu-tone: ${toneMap[tone]};`}
			{...content}
		>
			<Menubar.Group class="menubar-group" aria-label={text}>
				{#each items as item}
					<Menubar.Item
						class="menubar-item"
						textValue={item.label}
						onSelect={() => {
							item.onSelect?.();
						}}
					>
						{item.label}
					</Menubar.Item>
				{/each}
			</Menubar.Group>
		</Menubar.Content>
	</Menubar.Menu>
</div>

<style>
	.menubar-shell :global(.menubar-trigger) {
		display: inline-flex;
		align-items: center;
		padding: 0.3rem 0.65rem;
		font-family: inherit;
		font-size: 0.82rem;
		font-weight: 500;
		color: var(--muted);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
		user-select: none;
		outline: none;
		transition:
			background-color var(--time) var(--ease),
			border-color var(--time) var(--ease),
			color var(--time) var(--ease);
	}

	.menubar-shell :global(.menubar-trigger[data-variant='default']) {
		background: var(--fg);
		border-color: var(--border);
		color: var(--text);
	}

	.menubar-shell :global(.menubar-trigger[data-variant='outline']) {
		background: transparent;
		border-color: var(--border);
		color: var(--text);
	}

	.menubar-shell :global(.menubar-trigger[data-variant='ghost']) {
		background: transparent;
		border-color: transparent;
		color: var(--muted);
	}

	.menubar-shell :global(.menubar-trigger:hover) {
		color: var(--text);
		background: var(--fg);
	}

	.menubar-shell :global(.menubar-trigger[data-state='open']) {
		color: var(--text);
		background: var(--fg);
		border-color: var(--border);
	}

	.menubar-shell :global(.menubar-trigger[data-highlighted]) {
		color: var(--text);
		background: var(--fg);
	}

	/* ── Dropdown panel ───────────────────────────────── */
	.menubar-shell :global(.menubar-content) {
		min-width: 152px;
		background: var(--fg);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		box-shadow: var(--shadow);
		padding: 0.375rem;
		display: flex;
		flex-direction: column;
		gap: 1px;
		z-index: 200;
		animation: menubar-in var(--time) var(--ease-out) both;
	}

	.menubar-shell :global(.menubar-content[data-variant='default']) {
		border-color: var(--border);
	}

	.menubar-shell :global(.menubar-content[data-state='closed']) {
		animation: menubar-out var(--time) var(--ease) both;
	}

	.menubar-shell :global(.menubar-group) {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	/* ── Items ────────────────────────────────────────── */
	.menubar-shell :global(.menubar-item) {
		display: flex;
		align-items: center;
		padding: 0.45rem 0.6rem;
		border-radius: var(--radius-sm);
		font-size: 0.82rem;
		font-family: inherit;
		color: var(--muted);
		background: transparent;
		border: none;
		cursor: pointer;
		user-select: none;
		outline: none;
		transition:
			background-color var(--time) var(--ease),
			color var(--time) var(--ease);
	}

	.menubar-shell :global(.menubar-item[data-highlighted]) {
		background: color-mix(in srgb, var(--menu-tone) 12%, var(--mg));
		color: color-mix(in srgb, var(--menu-tone) 68%, var(--text));
	}

	.menubar-shell :global(.menubar-item[data-disabled]) {
		opacity: 0.4;
		cursor: not-allowed;
	}

	/* ── Animations ───────────────────────────────────── */
	@keyframes menubar-in {
		from {
			opacity: 0;
			transform: translateY(-4px) scale(0.97);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes menubar-out {
		from {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
		to {
			opacity: 0;
			transform: translateY(-4px) scale(0.97);
		}
	}
</style>
