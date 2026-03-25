import { writable } from 'svelte/store';
import type { WebContainer } from '@webcontainer/api';

export const activeFileId = writable<string | null>(null);
export const activeFilePath = writable<string | null>(null);
export const isBooting = writable(true);
export const webContainer = writable<WebContainer | null>(null);
export const previewUrl = writable<string | null>(null);
