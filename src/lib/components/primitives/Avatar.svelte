<script lang="ts">
	import { Avatar, type WithoutChildrenOrChild } from 'bits-ui';

	let {
		src,
		alt = 'Avatar',
		fallback = '?',
		size = 'default',
		shape = 'rounded',
		ref = $bindable(null),
		imageRef = $bindable(null),
		fallbackRef = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<Avatar.RootProps> & {
		src?: string;
		alt?: string;
		fallback?: string;
		size?: 'sm' | 'default' | 'lg';
		shape?: 'rounded' | 'circle' | 'square';
		imageRef?: HTMLImageElement | null;
		fallbackRef?: HTMLElement | null;
		class?: string;
	} = $props();
</script>

<div class="avatar-shell">
	<Avatar.Root {...restProps} bind:ref class="avatar-root avatar-{size} avatar-{shape} {className}">
		<Avatar.Image {src} {alt} bind:ref={imageRef} class="avatar-image" />
		<Avatar.Fallback bind:ref={fallbackRef} class="avatar-fallback">
			{fallback}
		</Avatar.Fallback>
	</Avatar.Root>
</div>

<style>
	.avatar-shell :global(.avatar-root) {
		--size: 2.5rem;

		display: inline-flex;
		height: var(--size);
		width: var(--size);
		align-items: center;
		justify-content: center;
		border-radius: var(--radius-md);
		overflow: hidden;

		background-color: var(--mg);
		border: 1px solid var(--border);
		box-shadow: 0 1px 2px hsla(0, 0%, 0%, 0.08);
		transition: all var(--time) var(--ease);
	}

	.avatar-shell :global(.avatar-root:hover) {
		border-color: var(--glint);
		box-shadow: 0 2px 4px hsla(0, 0%, 0%, 0.12);
	}

	.avatar-shell :global(.avatar-sm) {
		--size: 1.75rem;
		border-radius: var(--radius-sm);
	}

	.avatar-shell :global(.avatar-default) {
		--size: 2.5rem;
		border-radius: var(--radius-md);
	}

	.avatar-shell :global(.avatar-lg) {
		--size: 3rem;
		border-radius: var(--radius-md);
	}

	.avatar-shell :global(.avatar-circle) {
		border-radius: 999px;
	}

	.avatar-shell :global(.avatar-square) {
		border-radius: var(--radius-sm);
	}

	.avatar-shell :global(.avatar-image) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.avatar-shell :global(.avatar-fallback) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-weight: 500;
		font-size: 0.75rem;
	}
</style>
