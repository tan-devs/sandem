// src/lib/context/ide/ide-context.ts
import { setContext, getContext } from 'svelte';
import type { WebContainer } from '@webcontainer/api';
import type { IDEProject } from '$types/projects.js';

const IDE_CONTEXT_KEY = Symbol('IDE');

interface IDEContext {
	getWebcontainer: () => WebContainer;
	// path is the full WC path e.g. "my-project/src/App.jsx".
	// When omitted (e.g. before any tab is open) returns the default/first project.
	getProject: (path?: string) => IDEProject;
	// Returns the full WC path of the file that should be opened on first load,
	// e.g. "demo/App.jsx" or "my-project/src/App.jsx".
	getEntryPath: () => string;
}

export function setIDEContext(context: IDEContext) {
	setContext(IDE_CONTEXT_KEY, context);
}

export function getIDEContext(): IDEContext | null {
	const ctx = getContext<IDEContext | undefined>(IDE_CONTEXT_KEY);
	return ctx ?? null;
}

export function requireIDEContext(): IDEContext {
	const context = getIDEContext();
	if (!context) {
		throw new Error('IDE context required but not found');
	}
	return context;
}
