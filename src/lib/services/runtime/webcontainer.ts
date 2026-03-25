import { WebContainer } from '@webcontainer/api';
import { buildFileSystemTree } from '$lib/utils/vfs';

let webcontainerInstance: WebContainer | null = null;

export async function getWebContainer() {
	if (!webcontainerInstance) {
		webcontainerInstance = await WebContainer.boot();
	}
	return webcontainerInstance;
}

export async function mountProject(
	nodes: Array<{ path: string; type: 'file' | 'folder'; content?: string }>
) {
	const instance = await getWebContainer();
	const tree = buildFileSystemTree(nodes);
	await instance.mount(tree);

	if (tree['package.json']) {
		const install = await instance.spawn('npm', ['install']);
		await install.exit;
	}

	return instance;
}
