<script lang="ts">
	import { PanelLeft, PanelBottom, PanelRight, Columns2, LayoutGrid } from '@lucide/svelte';

	interface Props {
		panels:
			| {
					leftPane: boolean;
					upPane: boolean;
					downPane: boolean;
					rightPane: boolean;
			  }
			| undefined;
	}

	let { panels }: Props = $props();

	function toggleLeft() {
		if (!panels) return;
		panels.leftPane = !panels.leftPane;
	}

	function toggleBottom() {
		if (!panels) return;
		panels.downPane = !panels.downPane;
	}

	function toggleRight() {
		if (!panels) return;
		panels.rightPane = !panels.rightPane;
	}

	function toggleTop() {
		if (!panels) return;
		panels.upPane = !panels.upPane;
	}

	function splitEditorRight() {
		if (!panels) return;
		panels.rightPane = true;
		panels.upPane = true;
		panels.downPane = true;
	}

	$effect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const mod = event.ctrlKey || event.metaKey;
			if (!mod) return;

			const key = event.key.toLowerCase();
			if (key === 'b') {
				event.preventDefault();
				toggleLeft();
				return;
			}

			if (key === 'j') {
				event.preventDefault();
				toggleBottom();
				return;
			}

			if (event.key === '\\') {
				event.preventDefault();
				splitEditorRight();
			}
		};

		window.addEventListener('keydown', onKeyDown);
		return () => {
			window.removeEventListener('keydown', onKeyDown);
		};
	});
</script>

<div class="panel-controls">
	<!-- Layout actions -->
	<div class="tb-group">
		<button class="tb-btn" title="Split Editor Right (Ctrl+\\)" onclick={splitEditorRight}>
			<Columns2 size={15} strokeWidth={1.5} />
		</button>
	</div>

	<div class="tb-sep"></div>

	<!-- Panel toggles -->
	<div class="tb-group">
		<button
			class="tb-btn"
			class:active={panels?.leftPane}
			onclick={toggleLeft}
			title="Toggle Primary Sidebar (Ctrl+B)"
			aria-pressed={panels?.leftPane}
		>
			<PanelLeft size={15} strokeWidth={1.5} />
		</button>
		<button
			class="tb-btn"
			class:active={panels?.downPane}
			onclick={toggleBottom}
			title="Toggle Panel (Ctrl+J)"
			aria-pressed={panels?.downPane}
		>
			<PanelBottom size={15} strokeWidth={1.5} />
		</button>
		<button
			class="tb-btn"
			class:active={panels?.rightPane}
			onclick={toggleRight}
			title="Toggle Secondary Sidebar"
			aria-pressed={panels?.rightPane}
		>
			<PanelRight size={15} strokeWidth={1.5} />
		</button>
		<button
			class="tb-btn"
			class:active={panels?.upPane}
			onclick={toggleTop}
			title="Customize Layout"
			aria-pressed={panels?.upPane}
		>
			<LayoutGrid size={15} strokeWidth={1.5} />
		</button>
	</div>
</div>

<style>
	.panel-controls {
		display: flex;
		align-items: center;
		gap: 2px;
		-webkit-app-region: no-drag;
	}

	.tb-sep {
		width: 1px;
		height: 14px;
		background: var(--border);
		margin: 0 2px;
		flex-shrink: 0;
	}

	.tb-group {
		display: flex;
		align-items: center;
	}

	.tb-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: transparent;
		border: none;
		color: var(--muted);
		border-radius: 4px;
		cursor: pointer;
		flex-shrink: 0;
		transition:
			color 0.1s,
			background 0.1s;
	}
	.tb-btn:hover {
		background: var(--fg);
		color: var(--text);
	}

	.tb-btn.active {
		color: var(--text);
	}
	.tb-btn.active:hover {
		background: var(--fg);
	}
</style>
