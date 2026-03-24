<script lang="ts">
	import { PaneResizer as PaneforgeResizer } from 'paneforge';

	interface Props {
		direction?: 'horizontal' | 'vertical';
		class?: string;
	}

	let { direction = 'horizontal', class: className = '' }: Props = $props();
</script>

<PaneforgeResizer class={`ide-pane-resizer ${className}`} data-direction={direction} />

<style>
	:global(.ide-pane-resizer) {
		background: transparent;
	}

	:global(.ide-pane-resizer[data-direction='horizontal']) {
		width: 4px;
		cursor: col-resize;
	}

	:global(.ide-pane-resizer[data-direction='vertical']) {
		height: 4px;
		cursor: row-resize;
	}

	:global(.ide-pane-resizer:hover),
	:global(.ide-pane-resizer[data-resize-handle-active]) {
		background: var(--accent);
		transition: background 0.1s ease-in;
		transition-delay: 0.1s;
	}
</style>
