<div class="status-inner">
	<div class="left">
		<div class="item branch">
			<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"
				><path d="M11 5H6V4h5V1.5L14.5 4 11 6.5V5zM5 11h5v1H5v2.5L1.5 12 5 9.5V11z" /></svg
			>
			main*
		</div>
		<div class="item">Convex: Connected</div>
	</div>
	<div class="right">
		<div class="item">Spaces: 2</div>
		<div class="item">UTF-8</div>
		<div class="item">Svelte</div>
	</div>
</div>

<style>
	.status-inner {
		display: flex;
		justify-content: space-between;
		align-items: center;
		height: 100%;
		padding: 0 10px;
		font-size: 11px;
		color: var(--muted);
	}
	.left,
	.right {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 4px;
		cursor: pointer;
	}
	.item:hover {
		color: var(--text);
	}
	.branch {
		color: var(--text);
	}
</style>
