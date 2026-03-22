import { describe, expect, it } from 'vitest';
import type { FileNode } from '$types/editor.js';
import type { IDEProject } from '$types/projects.js';
import { validateProjectRelativePath } from './explorerTreeOps.js';
import { normalizeToProjectPath } from '$lib/controllers/explorer/createExplorerActionHandlers.svelte.js';

describe('validateProjectRelativePath', () => {
	it('allows valid project-relative paths and normalizes backslashes', () => {
		expect(validateProjectRelativePath('src/main.ts')).toBe('src/main.ts');
		expect(validateProjectRelativePath('project-alpha/src/lib/index.ts')).toBe(
			'project-alpha/src/lib/index.ts'
		);
		expect(validateProjectRelativePath('  src\\nested\\file.ts  ')).toBe('src/nested/file.ts');
	});

	it('rejects traversal and absolute path attempts', () => {
		const blockedPaths = [
			'../secret.txt',
			'src/../secret.txt',
			'/etc/passwd',
			'\\\\server\\share\\file.txt',
			'C:\\temp\\escape.txt',
			'src/./index.ts',
			'src//index.ts'
		];

		for (const path of blockedPaths) {
			expect(() => validateProjectRelativePath(path)).toThrow();
		}
	});

	it('rejects invalid filename characters', () => {
		expect(() => validateProjectRelativePath('src/na<me.ts')).toThrow();
		expect(() => validateProjectRelativePath('src/name?.ts')).toThrow();
		expect(() => validateProjectRelativePath('src/name. ')).toThrow();
	});
});

describe('normalizeToProjectPath', () => {
	const tree: FileNode[] = [
		{ name: 'project-alpha', path: 'project-alpha', type: 'directory', depth: 0 },
		{ name: 'project-beta', path: 'project-beta', type: 'directory', depth: 0 }
	];

	const activeProject = {
		_id: 'proj_123',
		title: 'Project Alpha'
	} as IDEProject;

	it('keeps known root paths unchanged', () => {
		expect(normalizeToProjectPath('project-beta/src/app.ts', tree, activeProject)).toBe(
			'project-beta/src/app.ts'
		);
	});

	it('prefixes active project root for relative paths', () => {
		expect(normalizeToProjectPath('src/app.ts', tree, activeProject)).toBe(
			'project-alpha/src/app.ts'
		);
	});

	it('rejects unsafe paths before normalization', () => {
		expect(() => normalizeToProjectPath('../escape.ts', tree, activeProject)).toThrow();
		expect(() => normalizeToProjectPath('/absolute.ts', tree, activeProject)).toThrow();
	});
});
