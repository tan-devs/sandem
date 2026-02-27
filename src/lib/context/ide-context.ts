// src/lib/context/ide.ts
import { setContext, getContext } from 'svelte';
import type { WebContainer } from '@webcontainer/api';
import type { Doc } from '$convex/_generated/dataModel.js';

const IDE_CONTEXT_KEY = Symbol('IDE');

interface IDEContext {
	getWebcontainer: () => WebContainer;
	getProject: () => Doc<'projects'>;
}

export function setIDEContext(context: IDEContext) {
	setContext(IDE_CONTEXT_KEY, context);
}

export function getIDEContext(): IDEContext | null {
	try {
		return getContext<IDEContext>(IDE_CONTEXT_KEY);
	} catch {
		return null;  // Safe fallback
	}
}

export function requireIDEContext(): IDEContext {
	const context = getIDEContext();
	if (!context) {
		throw new Error('IDE context required but not found');
	}
	return context;
}