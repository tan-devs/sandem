import type { Terminal } from '@battlefieldduck/xterm-svelte';

/**
 * Pure utility — reads CSS variables from the document root and applies them
 * to the given xterm Terminal instance.
 *
 * No runes, no state, no side-effects beyond the terminal options assignment.
 * Safe to call on every MutationObserver tick.
 *
 * File: createTerminalTheme.ts → function: applyTerminalTheme
 */
export function applyTerminalTheme(terminal: Terminal | undefined): void {
	if (!terminal || typeof document === 'undefined') return;

	const style = getComputedStyle(document.documentElement);
	const mono = style.getPropertyValue('--fonts-mono').trim();

	terminal.options.fontFamily = mono || "'Cascadia Mono', 'Consolas', 'SF Mono', monospace";
	terminal.options.theme = {
		background: style.getPropertyValue('--bg').trim(),
		foreground: style.getPropertyValue('--text').trim(),
		cursor: style.getPropertyValue('--text').trim(),
		selectionBackground: style.getPropertyValue('--border').trim()
	};
}
