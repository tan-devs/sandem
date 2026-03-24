import type { WebContainer } from '@webcontainer/api';
import * as git from 'isomorphic-git';
import { getRootFolder } from '$lib/utils/project/file-system.js';
import type { GitActivityDeps } from '$types/hooks.js';
import type { ChangeItem } from '$types/editor.js';

const IGNORE = new Set(['.git', 'node_modules', '.svelte-kit', 'dist', '.cache']);

export function createGitActivity(deps: GitActivityDeps) {
	let message = $state('');
	let scanning = $state(false);
	let changes = $state<ChangeItem[]>([]);
	let lastCommitSummary = $state('');
	let stagedPaths = $state<Set<string>>(new Set());
	let hasManualStageSelection = $state(false);

	const stagedCount = $derived(changes.filter((item) => item.staged).length);
	const canCommit = $derived(message.trim().length > 0 && stagedCount > 0);

	function getWebcontainer(): WebContainer {
		return deps.getWebcontainer();
	}

	function getProjectRootPath() {
		return getRootFolder(deps.getActiveTabPath() ?? deps.getEntryPath());
	}

	function getGitFs() {
		return getWebcontainer().fs as unknown as Parameters<typeof git.statusMatrix>[0]['fs'];
	}

	async function ensureRepoInitialized(dir: string) {
		try {
			await getWebcontainer().fs.readFile(`${dir}/.git/HEAD`, 'utf-8');
		} catch {
			await git.init({ fs: getGitFs(), dir, defaultBranch: 'main' });
		}
	}

	function detectChanges(matrix: Awaited<ReturnType<typeof git.statusMatrix>>) {
		const next: ChangeItem[] = [];
		const root = getProjectRootPath();

		for (const [filepath, head, workdir] of matrix) {
			if (IGNORE.has(filepath.split('/')[0] ?? '')) continue;

			if (head === 0 && workdir !== 0) {
				next.push({ path: `${root}/${filepath}`, type: 'new' });
				continue;
			}

			if (workdir === 0) {
				next.push({ path: `${root}/${filepath}`, type: 'deleted' });
				continue;
			}

			if (head !== workdir) {
				next.push({ path: `${root}/${filepath}`, type: 'modified' });
			}
		}

		return next.sort((a, b) => a.path.localeCompare(b.path));
	}

	function applyStaging(nextChanges: ChangeItem[]) {
		if (!hasManualStageSelection) {
			stagedPaths = new Set(nextChanges.map((item) => item.path));
		} else {
			const available = new Set(nextChanges.map((item) => item.path));
			stagedPaths = new Set(Array.from(stagedPaths).filter((path) => available.has(path)));
		}

		changes = nextChanges.map((item) => ({
			...item,
			staged: stagedPaths.has(item.path)
		}));
	}

	async function refreshChanges() {
		scanning = true;
		try {
			const dir = getProjectRootPath();
			await ensureRepoInitialized(dir);
			const matrix = await git.statusMatrix({ fs: getGitFs(), dir });
			applyStaging(detectChanges(matrix));
		} catch (error) {
			console.error('Failed to refresh git changes', error);
			changes = [];
			stagedPaths = new Set();
		} finally {
			scanning = false;
		}
	}

	async function commitAll() {
		if (!canCommit) return;

		const dir = getProjectRootPath();
		await ensureRepoInitialized(dir);

		const matrix = await git.statusMatrix({ fs: getGitFs(), dir });
		let stagedFiles = 0;
		for (const [filepath, , workdir] of matrix) {
			if (IGNORE.has(filepath.split('/')[0] ?? '')) continue;
			const fullPath = `${dir}/${filepath}`;
			if (!stagedPaths.has(fullPath)) continue;

			stagedFiles += 1;
			if (workdir === 0) {
				await git.remove({ fs: getGitFs(), dir, filepath });
				continue;
			}
			await git.add({ fs: getGitFs(), dir, filepath });
		}

		if (stagedFiles === 0) return;

		const subject = message.trim();
		const oid = await git.commit({
			fs: getGitFs(),
			dir,
			message: subject,
			author: {
				name: 'Tandem User',
				email: 'user@tandem.local'
			}
		});

		lastCommitSummary = `${subject} · ${oid.slice(0, 7)}`;
		message = '';
		hasManualStageSelection = false;
		stagedPaths = new Set();
		await refreshChanges();
	}

	function toggleStage(path: string) {
		hasManualStageSelection = true;
		const next = new Set(stagedPaths);
		if (next.has(path)) {
			next.delete(path);
		} else {
			next.add(path);
		}
		stagedPaths = next;
		changes = changes.map((item) => ({ ...item, staged: next.has(item.path) }));
	}

	function stageAll() {
		hasManualStageSelection = true;
		const next = new Set(changes.map((item) => item.path));
		stagedPaths = next;
		changes = changes.map((item) => ({ ...item, staged: true }));
	}

	function unstageAll() {
		hasManualStageSelection = true;
		stagedPaths = new Set();
		changes = changes.map((item) => ({ ...item, staged: false }));
	}

	function openChangedFile(item: ChangeItem) {
		if (item.type === 'deleted') return;
		deps.openFile(item.path);
	}

	async function init() {
		await refreshChanges();
	}

	function setMessage(value: string) {
		message = value;
	}

	return {
		get message() {
			return message;
		},
		get canCommit() {
			return canCommit;
		},
		get stagedCount() {
			return stagedCount;
		},
		get scanning() {
			return scanning;
		},
		get changes() {
			return changes;
		},
		get lastCommitSummary() {
			return lastCommitSummary;
		},
		setMessage,
		toggleStage,
		stageAll,
		unstageAll,
		refreshChanges,
		commitAll,
		openChangedFile,
		init
	};
}
