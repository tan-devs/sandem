<script lang="ts">
	import { Avatar, type WithoutChildrenOrChild } from 'bits-ui';

	let {
		src,
		alt,
		fallback,
		ref = $bindable(null),
		imageRef = $bindable(null),
		fallbackRef = $bindable(null),
		class: className,
		...restProps
	}: WithoutChildrenOrChild<Avatar.RootProps> & {
		src: string;
		alt: string;
		fallback: string;
		imageRef?: HTMLImageElement | null;
		fallbackRef?: HTMLElement | null;
		class?: string;
	} = $props();
</script>

<Avatar.Root {...restProps} bind:ref class="avatar-root {className}">
	<Avatar.Image {src} {alt} bind:ref={imageRef} class="avatar-image" />
	<Avatar.Fallback bind:ref={fallbackRef} class="avatar-fallback">
		{fallback}
	</Avatar.Fallback>
</Avatar.Root>

<style>
	:global(.avatar-root) {
		--size: 24rem;

		display: inline-flex;
		height: var(--size);
		width: var(--size);
		align-items: center;
		justify-content: center;
		border-radius: var(--radius);
		overflow: hidden;

		background-color: var(--mg);
		border: 2px solid var(--border);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}
	:global(.avatar-root):hover {
		border-top-color: var(--glint);
		box-shadow: none;
	}

	:global(.avatar-image) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	:global(.avatar-fallback) {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-weight: 500;
	}
</style>
