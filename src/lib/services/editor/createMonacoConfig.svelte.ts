import type * as Monaco from 'monaco-editor';

async function getMonacoLoader() {
	if (typeof window === 'undefined') {
		throw new Error('Monaco editor cannot be initialized during SSR');
	}

	const module = await import('@monaco-editor/loader');
	return module.default;
}

function toUrlPath(basePath: string, suffix: string) {
	const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
	return `${normalizedBase}${suffix}`.replace(/\/$/, '');
}

function getMonacoVsCandidates() {
	const base = import.meta.env.BASE_URL || '/';
	const candidates = [toUrlPath(base, 'monaco/vs'), '/monaco/vs'];
	return Array.from(new Set(candidates));
}

async function initMonacoWithVsPath(vsPath: string) {
	const loader = await getMonacoLoader();
	loader.config({ paths: { vs: vsPath } });

	return loader.init();
}

export const MONACO_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
	theme: 'vs-dark',
	automaticLayout: true,
	minimap: { enabled: true },
	fontSize: 13,
	lineHeight: 20,
	fontFamily: "'Cascadia Code', 'Fira Code', 'SF Mono', monospace",
	fontLigatures: true,
	padding: { top: 12, bottom: 12 },
	scrollbar: {
		verticalScrollbarSize: 6,
		horizontalScrollbarSize: 6
	},
	renderLineHighlight: 'gutter',
	cursorBlinking: 'smooth',
	cursorSmoothCaretAnimation: 'on',
	smoothScrolling: true,
	roundedSelection: true
};

export async function createMonacoInstance() {
	const errors: string[] = [];
	for (const vsPath of getMonacoVsCandidates()) {
		try {
			return await initMonacoWithVsPath(vsPath);
		} catch (error) {
			errors.push(`${vsPath} :: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	throw new Error(`Monaco failed to initialize from configured asset paths. ${errors.join(' | ')}`);
}
