<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Accordion, type WithoutChildrenOrChild } from 'bits-ui';
	import type { Variant } from '$types/ui.js';

	type AccordionVariant = Extract<Variant, 'default' | 'outline' | 'ghost' | 'filled'>;

	type Props = WithoutChildrenOrChild<Accordion.ItemProps> & {
		title: string;
		variant?: AccordionVariant;
		children: Snippet;
	};

	let { title, variant = 'default', children, ...rest }: Props = $props();
</script>

<div class="accordion-item-shell">
	<Accordion.Item {...rest} class="accordion-item" data-variant={variant}>
		<Accordion.Header>
			<article class="summary">
				<Accordion.Trigger class="trigger">
					<span>{title}</span>
					<span class="chevron">⌄</span>
				</Accordion.Trigger>
			</article>
		</Accordion.Header>
		<Accordion.Content class="content">
			{@render children()}
		</Accordion.Content>
	</Accordion.Item>
</div>

<style>
	.accordion-item-shell :global(.accordion-item) {
		border-radius: 10px;
		margin-bottom: 0.35rem;
		overflow: clip;
	}

	.summary {
		padding: 0;
		cursor: pointer;
		font-weight: 500;
		color: var(--text);
		list-style: none; /* Hides default arrow in many browsers */
		display: flex;
		justify-content: space-between;
	}

	.accordion-item-shell :global(.trigger) {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.72rem 0.9rem;
		border: 1px solid transparent;
		border-radius: 10px;
		font-size: 0.9rem;
		color: var(--text);
	}

	.accordion-item-shell :global(.accordion-item[data-state='open'] .trigger) {
		color: var(--text);
	}

	.chevron {
		font-size: 0.85rem;
		opacity: 0.8;
		transform: rotate(0deg);
		transition: transform var(--time) var(--ease);
	}

	.accordion-item-shell :global(.accordion-item[data-state='open'] .chevron) {
		transform: rotate(180deg);
	}

	.accordion-item-shell :global(.content) {
		padding: 0.8rem 0.9rem 1rem;
		font-size: 0.88rem;
		color: var(--muted);
	}

	.accordion-item-shell :global(.accordion-item[data-variant='default'] .trigger) {
		background: var(--fg);
		border-color: var(--border);
	}

	.accordion-item-shell :global(.accordion-item[data-variant='outline'] .trigger) {
		background: transparent;
		border-color: var(--border);
	}

	.accordion-item-shell :global(.accordion-item[data-variant='ghost'] .trigger) {
		background: transparent;
		border-color: transparent;
	}

	.accordion-item-shell :global(.accordion-item[data-variant='filled'] .trigger) {
		background: var(--mg);
		border-color: var(--border);
	}

	.accordion-item-shell :global(.accordion-item .trigger:hover) {
		border-color: var(--border);
		background: var(--mg);
	}

	.summary::-webkit-details-marker {
		display: none;
	}
</style>
