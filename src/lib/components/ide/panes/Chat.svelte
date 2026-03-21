<script lang="ts">
	import { onMount } from 'svelte';
	import { requireIDEContext } from '$lib/context/ide/ide-context.js';
	import { createChatPane } from '$lib/hooks/runtime/index.js';

	const ide = requireIDEContext();
	const workspaceId = ide.getEntryPath().split('/')[0] ?? 'workspace';

	const chat = createChatPane({
		workspaceId,
		currentUser: 'You'
	});

	onMount(async () => {
		await chat.init();
	});

	function onSubmit(event: SubmitEvent) {
		event.preventDefault();
		void chat.submit();
	}

	function onInput(event: Event) {
		void chat.updateDraft((event.currentTarget as HTMLInputElement).value);
	}

	function formatTime(timestamp: number) {
		return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
</script>

<section class="chat-shell" aria-label="Chat panel">
	<div class="chat-header">Chat</div>

	<div class="chat-list" role="log" aria-live="polite">
		{#if chat.messages.length === 0}
			<p class="chat-empty">No messages yet. Start the thread.</p>
		{:else}
			{#each chat.messages as message (message.id)}
				<article class="chat-message">
					<header>
						<strong>{message.author}</strong>
						<span>{formatTime(message.createdAt)}</span>
					</header>
					<p>{message.text}</p>
				</article>
			{/each}
		{/if}
	</div>

	<form class="chat-compose" onsubmit={onSubmit}>
		<input type="text" placeholder="Message" value={chat.draft} oninput={onInput} />
		<button type="submit" disabled={!chat.canSend}>Send</button>
	</form>
</section>

<style>
	.chat-shell {
		display: grid;
		grid-template-rows: auto 1fr auto;
		height: 100%;
		background: var(--bg);
	}

	.chat-header {
		height: 34px;
		display: flex;
		align-items: center;
		padding: 0 10px;
		border-bottom: 1px solid var(--border);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.chat-list {
		overflow: auto;
		padding: 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.chat-empty {
		font-size: 12px;
		color: var(--muted);
	}

	.chat-message {
		border: 1px solid var(--border);
		background: var(--mg);
		border-radius: 6px;
		padding: 8px;
	}

	.chat-message header {
		display: flex;
		justify-content: space-between;
		font-size: 11px;
		margin-bottom: 4px;
	}

	.chat-message p {
		margin: 0;
		font-size: 12px;
		line-height: 1.4;
	}

	.chat-compose {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px;
		padding: 10px;
		border-top: 1px solid var(--border);
	}

	.chat-compose input {
		height: 30px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--fg);
		color: var(--text);
		padding: 0 8px;
	}

	.chat-compose button {
		height: 30px;
		padding: 0 10px;
		border-radius: 4px;
		border: 1px solid var(--border);
		background: var(--mg);
		color: var(--text);
		cursor: pointer;
	}
</style>
