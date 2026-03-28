export type ChatMessage = {
	id: string;
	author: string;
	text: string;
	createdAt: number;
};

type CreateChatPaneDeps = {
	workspaceId: string;
	currentUser: string;
	loadMessages?: (workspaceId: string) => Promise<ChatMessage[]>;
	sendMessage?: (workspaceId: string, text: string) => Promise<ChatMessage>;
	setTyping?: (workspaceId: string, isTyping: boolean) => void | Promise<void>;
};

export function createChatPane(deps: CreateChatPaneDeps) {
	let messages = $state<ChatMessage[]>([]);
	let draft = $state('');
	let isSending = $state(false);
	let isTyping = $state(false);

	const canSend = $derived(draft.trim().length > 0 && !isSending);

	async function init() {
		if (!deps.loadMessages) return;
		messages = await deps.loadMessages(deps.workspaceId);
	}

	async function updateDraft(next: string) {
		draft = next;
		const nextTyping = next.trim().length > 0;
		if (nextTyping === isTyping) return;
		isTyping = nextTyping;
		await deps.setTyping?.(deps.workspaceId, isTyping);
	}

	async function submit() {
		const text = draft.trim();
		if (!text || isSending) return;

		isSending = true;
		try {
			if (deps.sendMessage) {
				const created = await deps.sendMessage(deps.workspaceId, text);
				messages = [...messages, created];
			} else {
				messages = [
					...messages,
					{
						id: crypto.randomUUID(),
						author: deps.currentUser,
						text,
						createdAt: Date.now()
					}
				];
			}

			draft = '';
			if (isTyping) {
				isTyping = false;
				await deps.setTyping?.(deps.workspaceId, false);
			}
		} finally {
			isSending = false;
		}
	}

	return {
		get messages() {
			return messages;
		},
		get draft() {
			return draft;
		},
		get canSend() {
			return canSend;
		},
		get isSending() {
			return isSending;
		},
		init,
		updateDraft,
		submit
	};
}
