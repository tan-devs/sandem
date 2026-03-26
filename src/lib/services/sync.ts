import * as Y from 'yjs';
import { getWebContainer } from '$lib/services/runtime/webcontainer.js';

export function attachVfsSync(yText: Y.Text, filePath: string) {
	yText.observe(async () => {
		const instance = await getWebContainer();
		await instance.fs.writeFile(filePath, yText.toString());
	});
}
