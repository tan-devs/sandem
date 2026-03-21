export type CommandItem = {
	id: string;
	label: string;
	description?: string;
	shortcut?: string;
	keywords?: string[];
	run: () => void;
};

export type MenuAction = { label: string; hint?: string; run: () => void } | { separator: true };

export type MenuCommand = Exclude<MenuAction, { separator: true }>;
