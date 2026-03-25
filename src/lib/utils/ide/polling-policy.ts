export type PollTickResult = 'stable' | 'changed' | 'error';

type ProjectPollingPolicyOptions = {
	baseMs?: number;
	maxMs?: number;
	minMs?: number;
	tick: () => Promise<PollTickResult>;
};

export function createPollingPolicy(options: ProjectPollingPolicyOptions) {
	const baseMs = options.baseMs ?? 1200;
	const maxMs = options.maxMs ?? 7000;
	const minMs = options.minMs ?? 250;

	let timer: ReturnType<typeof setTimeout> | null = null;
	let running = false;
	let stableCount = 0;

	function nextDelayMs() {
		if (stableCount < 2) return baseMs;
		if (stableCount < 6) return Math.min(baseMs * 2, maxMs);
		if (stableCount < 12) return Math.min(baseMs * 4, maxMs);
		return maxMs;
	}

	function clearTimer() {
		if (!timer) return;
		clearTimeout(timer);
		timer = null;
	}

	async function runTick() {
		const result = await options.tick();
		stableCount = result === 'stable' ? stableCount + 1 : 0;
	}

	function schedule(delayMs: number) {
		if (!running) return;
		clearTimer();

		timer = setTimeout(
			async () => {
				if (!running) return;
				await runTick();
				schedule(nextDelayMs());
			},
			Math.max(minMs, delayMs)
		);
	}

	function start() {
		if (running) return;
		running = true;
		stableCount = 0;
		void runTick();
		schedule(baseMs);
	}

	function stop() {
		running = false;
		clearTimer();
	}

	function reset() {
		stableCount = 0;
	}

	return {
		start,
		stop,
		reset
	};
}
