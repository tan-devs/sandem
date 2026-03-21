<script lang="ts">
	import { onMount } from 'svelte';
	import { untrack } from 'svelte';
	import { PaneGroup, Pane } from 'paneforge';
	import type { PaneAPI } from 'paneforge';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { api } from '$convex/_generated/api.js';
	import { WebContainer, type WebContainerProcess } from '@webcontainer/api';

	import { createSvelteAuthClient, useAuth } from '$lib/svelte/index.js';
	import { authClient } from '$lib/context/auth/auth-client.js';
	import { editorStore } from '$lib/stores/editor/editorStore.svelte.js';
	import type { IDEProject, ProjectId } from '../../types/projects.js';
	import type { RepoLayoutData } from '../../types/routes.js';
	import type { Snippet } from 'svelte';

	import { setIDEContext } from '$lib/context/ide/ide-context.js';

	import { VITE_REACT_TEMPLATE } from '$lib/utils/project/template.js';
	import { projectFilesToTree } from '$lib/utils/project/filesystem.js';

	import Activitybar from '$lib/components/ide/workspace/ActivityBar.svelte';
	import Sidebar from '$lib/components/ide/workspace/Sidebar.svelte';
	import Statusbar from '$lib/components/ide/workspace/Statusbar.svelte';
	import Resizer from '$lib/components/ui/workspace/Resizer.svelte';

	import { createPanelsState, setPanelsContext } from '$lib/stores/panel/panelStore.svelte.js';

	let { children, data }: { children: Snippet; data: RepoLayoutData } = $props();
	const convexClient = useConvexClient();

	createSvelteAuthClient({ authClient, getServerState: () => data.authState });
	const auth = useAuth();

	const currentUserResponse = useQuery(
		api.auth.getCurrentUser,
		() => (auth.isAuthenticated ? {} : 'skip'),
		() => ({ initialData: data.currentUser, keepPreviousData: true })
	);

	const currentUser = $derived(currentUserResponse.data ?? data.currentUser);

	const isGuest = $derived(!currentUser);
	const isDemo = $derived(isGuest);
	const ownerId = $derived(currentUser?._id ?? '');

	const projectsResponse = useQuery(
		api.projects.getProjects,
		() => (ownerId ? { owner: ownerId } : 'skip'),
		() => ({ initialData: data.projects, keepPreviousData: true })
	);

	function uniqueProjects(items: RepoLayoutData['projects']) {
		const seen = new Set<string>();
		const next: RepoLayoutData['projects'] = [];
		for (const project of items) {
			if (seen.has(project._id)) continue;
			seen.add(project._id);
			next.push(project);
		}
		return next;
	}

	let projects = $state<RepoLayoutData['projects']>([]);
	let activeProjectId = $state<string | null>(null);
	let renamingProjectId = $state<string | null>(null);
	let renameDraft = $state('');
	let pendingDeleteProjectId = $state<string | null>(null);
	let creatingProject = $state(false);
	let mutatingProjectId = $state<string | null>(null);

	let webcontainer: WebContainer | null = null;
	let devServerProcess: WebContainerProcess | null = null;

	type RuntimePhase = 'idle' | 'booting' | 'mounting' | 'installing' | 'running' | 'failed';
	let runtimePhase = $state<RuntimePhase>('idle');
	let runtimeError = $state<string | null>(null);
	let ready = $state(false);
	let bootRunId = 0;

	$effect(() => {
		projects = uniqueProjects(data.projects);
		if (!activeProjectId || !projects.some((project) => project._id === activeProjectId)) {
			activeProjectId = projects[0]?._id ?? null;
		}
	});

	$effect(() => {
		if (isDemo) return;
		if (!projectsResponse.data) return;

		projects = uniqueProjects(projectsResponse.data);
		if (!activeProjectId || !projects.some((project) => project._id === activeProjectId)) {
			activeProjectId = projects[0]?._id ?? null;
		}
	});

	function projectFolderName(projectId: string): string {
		const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase() || 'project';
		return `project-${safe}`;
	}

	const demoProject = {
		files: VITE_REACT_TEMPLATE.files,
		room: undefined
	} satisfies IDEProject;

	const folderMap = $derived(
		new Map<string, string>(isDemo ? [] : projects.map((p) => [p._id, projectFolderName(p._id)]))
	);

	const DEMO_FOLDER = 'demo';
	const activeProject = $derived(
		!isDemo ? (projects.find((project) => project._id === activeProjectId) ?? projects[0]) : null
	);

	function getFallbackProject(): IDEProject {
		if (isDemo) return demoProject;
		return activeProject ?? projects[0] ?? demoProject;
	}

	function getProjectForPath(path?: string) {
		if (isDemo) return demoProject;
		if (!path) return getFallbackProject();
		const folder = path.split('/')[0];
		const match = projects.find((p) => folderMap.get(p._id) === folder);
		return match ?? getFallbackProject();
	}

	function getEntryPath(): string {
		if (isDemo) {
			return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;
		}

		const project = activeProject ?? projects[0];
		if (!project) return `${DEMO_FOLDER}/${VITE_REACT_TEMPLATE.entry}`;

		const folder = folderMap.get(project._id) ?? projectFolderName(project._id);
		const entryFile = project.entry ?? project.files[0]?.name ?? VITE_REACT_TEMPLATE.entry;
		return `${folder}/${entryFile}`;
	}

	const panels = createPanelsState({ activeTab: 'explorer' });
	setPanelsContext(panels);

	let sidebar = $state<PaneAPI>();

	$effect(() => {
		const open = panels.leftPane;
		untrack(() => (open ? sidebar?.expand() : sidebar?.collapse()));
	});

	const statusText = $derived(
		runtimePhase === 'failed'
			? '⚠️ Runtime failed · recovery available'
			: ready
				? isGuest
					? '👤 Guest session · changes are temporary'
					: `⚡ Ready · ${activeProject?.title ?? 'Project'}`
				: runtimePhase === 'installing'
					? '📦 Installing project dependencies…'
					: runtimePhase === 'mounting'
						? '🗂️ Mounting project files…'
						: '⏳ Starting sandbox runtime…'
	);

	setIDEContext({
		getWebcontainer() {
			if (!webcontainer) throw new Error('WebContainer not ready');
			return webcontainer;
		},
		getProject: getProjectForPath,
		getEntryPath
	});

	function getErrorMessage(error: unknown) {
		if (error instanceof Error) return error.message;
		return String(error);
	}

	function failRuntime(message: string, error?: unknown) {
		runtimeError = error ? `${message}\n\n${getErrorMessage(error)}` : message;
		runtimePhase = 'failed';
		ready = false;
	}

	async function stopRuntime() {
		devServerProcess?.kill();
		devServerProcess = null;

		const current = webcontainer as (WebContainer & { teardown?: () => Promise<void> }) | null;
		if (current?.teardown) {
			try {
				await current.teardown();
			} catch {
				// ignore teardown failures during recovery
			}
		}

		webcontainer = null;
	}

	async function startRuntime() {
		const runId = ++bootRunId;
		runtimeError = null;
		runtimePhase = 'booting';
		ready = false;

		try {
			await stopRuntime();

			const wc = await WebContainer.boot();
			if (runId !== bootRunId) {
				if (wc.teardown) {
					try {
						await wc.teardown();
					} catch {
						// ignore stale teardown race
					}
				}
				return;
			}

			webcontainer = wc;
			runtimePhase = 'mounting';

			if (isDemo) {
				await wc.mount({
					[DEMO_FOLDER]: { directory: projectFilesToTree(VITE_REACT_TEMPLATE.files) }
				});
			} else {
				for (const project of projects) {
					const folder = folderMap.get(project._id) ?? projectFolderName(project._id);
					await wc.mount({
						[folder]: { directory: projectFilesToTree(project.files) }
					});
				}
			}

			if (!editorStore.activeTabPath) {
				editorStore.openFile(getEntryPath());
			}

			// Mark the workspace ready as soon as files are mounted so editor interactions
			// don't block on package installation/runtime process startup.
			ready = true;

			runtimePhase = 'installing';
			const entryFolder = getEntryPath().split('/').filter(Boolean)[0] ?? '';
			if (entryFolder) {
				const packageJsonPath = `${entryFolder}/package.json`;
				const hasPackageJson = await wc.fs
					.readFile(packageJsonPath, 'utf-8')
					.then(() => true)
					.catch(() => false);

				if (hasPackageJson) {
					const install = await wc.spawn('sh', ['-c', `cd ${entryFolder} && pnpm i`]);
					const installExitCode = await install.exit;
					if (installExitCode === 0) {
						devServerProcess = await wc.spawn('sh', ['-c', `cd ${entryFolder} && pnpm dev`]);
					} else {
						console.warn(`Dependency install failed (exit ${installExitCode}). Continuing.`);
					}
				}
			}
			runtimePhase = 'running';
		} catch (error) {
			failRuntime('Failed to start the IDE runtime.', error);
		}
	}

	function selectProject(projectId: string) {
		activeProjectId = projectId;
		pendingDeleteProjectId = null;
		renamingProjectId = null;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem('sandem.activeProjectId', projectId);
		}
		editorStore.openFile(getEntryPath());
	}

	async function createProjectCard() {
		if (!ownerId || creatingProject) return;
		creatingProject = true;
		try {
			const title = `Untitled Project ${projects.length + 1}`;
			const id = await convexClient.mutation(api.projects.createProject, {
				title,
				files: VITE_REACT_TEMPLATE.files,
				owner: ownerId,
				entry: VITE_REACT_TEMPLATE.entry
			});

			const project = await convexClient.query(api.projects.getProject, {
				id: id as ProjectId
			});

			if (!project) throw new Error('Project creation succeeded but project could not be loaded.');

			projects = uniqueProjects([...projects, project]);
			activeProjectId = project._id;
			window.localStorage.setItem('sandem.activeProjectId', project._id);

			if (webcontainer) {
				const folder = projectFolderName(project._id);
				await webcontainer.mount({
					[folder]: { directory: projectFilesToTree(project.files) }
				});
			}

			editorStore.openFile(getEntryPath());
		} catch (error) {
			failRuntime('Project creation failed.', error);
		} finally {
			creatingProject = false;
		}
	}

	function startRename(projectId: string, title: string) {
		renamingProjectId = projectId;
		renameDraft = title;
		pendingDeleteProjectId = null;
	}

	async function commitRename(projectId: string) {
		const title = renameDraft.trim();
		renamingProjectId = null;
		if (!title) return;

		mutatingProjectId = projectId;
		try {
			await convexClient.mutation(api.projects.updateProject, {
				id: projectId as ProjectId,
				title
			});
			projects = projects.map((project) =>
				project._id === projectId ? { ...project, title } : project
			);
		} catch (error) {
			failRuntime('Project rename failed.', error);
		} finally {
			mutatingProjectId = null;
		}
	}

	function requestDelete(projectId: string) {
		pendingDeleteProjectId = pendingDeleteProjectId === projectId ? null : projectId;
		renamingProjectId = null;
	}

	async function confirmDelete(projectId: string) {
		mutatingProjectId = projectId;
		try {
			await convexClient.mutation(api.projects.deleteProject, {
				id: projectId as ProjectId
			});
			const nextProjects = projects.filter((project) => project._id !== projectId);
			projects = nextProjects;
			pendingDeleteProjectId = null;

			if (activeProjectId === projectId) {
				const nextId = nextProjects[0]?._id ?? null;
				activeProjectId = nextId;
				if (nextId) {
					window.localStorage.setItem('sandem.activeProjectId', nextId);
					editorStore.openFile(getEntryPath());
				}
			}
		} catch (error) {
			failRuntime('Project deletion failed.', error);
		} finally {
			mutatingProjectId = null;
		}
	}

	onMount(() => {
		if (!isDemo && projects.length === 0) {
			projects = uniqueProjects(data.projects.slice());
			activeProjectId = projects[0]?._id ?? null;
		}

		if (!isDemo) {
			const fromStorage = window.localStorage.getItem('sandem.activeProjectId');
			if (fromStorage && projects.some((project) => project._id === fromStorage)) {
				activeProjectId = fromStorage;
			}
		}

		void startRuntime();

		const onUnhandledError = (event: ErrorEvent) => {
			const message = event.error instanceof Error ? event.error.message : event.message;
			if (!message) return;
			if (!/webcontainer|sandbox|terminal|mount/i.test(message)) return;
			failRuntime('A runtime error occurred.', event.error ?? message);
		};

		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			const message = getErrorMessage(event.reason);
			if (!/webcontainer|sandbox|terminal|mount/i.test(message)) return;
			failRuntime('A runtime promise rejection occurred.', event.reason);
		};

		window.addEventListener('error', onUnhandledError);
		window.addEventListener('unhandledrejection', onUnhandledRejection);

		return () => {
			window.removeEventListener('error', onUnhandledError);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
			void stopRuntime();
		};
	});
</script>

<div class="container">
	<main class="repo-layout">
		<Activitybar {panels} />

		<section class="workspace-shell">
			{#if !isDemo}
				<div class="projects-strip" data-testid="project-cards-strip">
					<button
						class="project-card create"
						onclick={() => void createProjectCard()}
						disabled={creatingProject}
						data-testid="create-project-card"
					>
						{creatingProject ? 'Creating…' : '+ New project'}
					</button>

					{#each projects as project (project._id)}
						<div
							class={`project-card ${activeProjectId === project._id ? 'active' : ''}`}
							data-testid={`project-card-${project._id}`}
						>
							{#if renamingProjectId === project._id}
								<input
									class="project-title-input"
									bind:value={renameDraft}
									onblur={() => void commitRename(project._id)}
									onkeydown={(event) => {
										if (event.key === 'Enter') void commitRename(project._id);
										if (event.key === 'Escape') renamingProjectId = null;
									}}
									data-testid={`rename-input-${project._id}`}
								/>
							{:else}
								<button
									class="project-title"
									onclick={() => selectProject(project._id)}
									ondblclick={() => startRename(project._id, project.title)}
									data-testid={`project-title-${project._id}`}
								>
									{project.title}
								</button>
							{/if}

							<div class="project-actions">
								<button
									class="action"
									onclick={() => startRename(project._id, project.title)}
									disabled={mutatingProjectId === project._id}
								>
									Rename
								</button>
								{#if pendingDeleteProjectId === project._id}
									<button
										class="action danger"
										onclick={() => void confirmDelete(project._id)}
										disabled={mutatingProjectId === project._id}
										data-testid={`confirm-delete-${project._id}`}
									>
										Confirm
									</button>
								{:else}
									<button
										class="action danger"
										onclick={() => requestDelete(project._id)}
										disabled={mutatingProjectId === project._id}
									>
										Delete
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<PaneGroup direction="horizontal">
				<Pane bind:this={sidebar} collapsible collapsedSize={0} defaultSize={18}>
					<Sidebar />
				</Pane>

				<Resizer />

				<Pane>
					{#if runtimePhase === 'failed'}
						<section class="runtime-error" data-testid="runtime-recovery-ui">
							<h2>Sandbox failed to start</h2>
							<p>The IDE hit a WebContainer runtime error. You can recover without refreshing.</p>
							<pre>{runtimeError}</pre>
							<div class="runtime-actions">
								<button class="action" onclick={() => void startRuntime()}>Retry runtime</button>
								<button
									class="action"
									onclick={() => {
										panels.leftPane = true;
										panels.downPane = true;
										panels.rightPane = true;
									}}
								>
									Reset pane visibility
								</button>
							</div>
						</section>
					{:else if ready}
						{@render children()}
					{:else}
						<p class="booting-msg">
							{isDemo ? 'Spinning up demo sandbox…' : 'Loading your projects…'}
						</p>
					{/if}
				</Pane>
			</PaneGroup>
		</section>
	</main>

	<Statusbar status={statusText} {isGuest} />
</div>

<style>
	.container {
		display: grid;
		grid-template-rows: 1fr auto;

		height: 100%;
		overflow: hidden;
	}

	.repo-layout {
		display: grid;
		grid-template-columns: auto 1fr;
		height: 100%;
	}

	.workspace-shell {
		display: grid;
		grid-template-rows: auto 1fr;
		min-height: 0;
	}

	.projects-strip {
		display: flex;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--border);
		overflow-x: auto;
		background: var(--mg);
	}

	.project-card {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: center;
		min-width: 15rem;
		padding: 0.45rem 0.55rem;
		border: 1px solid var(--border);
		border-radius: 0.45rem;
		background: var(--bg);
		color: var(--text);
	}

	.project-card.active {
		border-color: color-mix(in srgb, var(--accent) 65%, var(--border));
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.project-card.create {
		display: inline-flex;
		grid-template-columns: none;
		align-items: center;
		justify-content: center;
		min-width: 10rem;
		cursor: pointer;
	}

	.project-title,
	.project-title-input {
		font-size: 0.82rem;
		font-weight: 600;
		padding: 0;
		background: transparent;
		border: none;
		color: var(--text);
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.project-title {
		cursor: pointer;
	}

	.project-title-input {
		padding: 0.25rem 0.35rem;
		border: 1px solid color-mix(in srgb, var(--accent) 55%, var(--border));
		border-radius: 0.35rem;
	}

	.project-actions {
		display: inline-flex;
		gap: 0.35rem;
	}

	.action {
		font-size: 0.72rem;
		padding: 0.2rem 0.4rem;
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		background: transparent;
		color: var(--text);
		cursor: pointer;
	}

	.action:hover:not(:disabled) {
		background: var(--fg);
	}

	.action.danger {
		color: var(--error);
		border-color: color-mix(in srgb, var(--error) 45%, var(--border));
	}

	.runtime-error {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
		max-width: 52rem;
		margin: 1rem;
		border: 1px solid color-mix(in srgb, var(--error) 35%, var(--border));
		border-radius: 0.6rem;
		background: color-mix(in srgb, var(--error) 8%, var(--bg));
	}

	.runtime-error h2,
	.runtime-error p {
		margin: 0;
	}

	.runtime-error pre {
		margin: 0;
		white-space: pre-wrap;
		font-size: 0.78rem;
		line-height: 1.4;
		padding: 0.65rem;
		border: 1px solid var(--border);
		border-radius: 0.45rem;
		background: var(--bg);
		max-height: 14rem;
		overflow: auto;
	}

	.runtime-actions {
		display: inline-flex;
		gap: 0.5rem;
	}

	.booting-msg {
		padding: 1rem;
		color: var(--muted);
	}
</style>
