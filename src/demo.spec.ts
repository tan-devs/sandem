import { describe, it, expect, vi } from 'vitest';
import {
	createError,
	toError,
	formatError,
	composeErrorMessage,
	createErrorReporter
} from '$lib/sveltekit/errors';

describe('error utilities', () => {
	it('preserves explicit code and request id', () => {
		const error = createError('Boom', { code: 'BAD_REQUEST', requestId: 'req-123' });

		expect(error).toEqual({
			message: 'Boom',
			code: 'BAD_REQUEST',
			requestId: 'req-123'
		});
	});

	it('normalizes unknown values with fallback message', () => {
		expect(toError(undefined, 'Fallback message')).toEqual({
			message: 'Fallback message',
			code: 'INTERNAL_ERROR',
			requestId: undefined
		});

		expect(toError(new Error('From exception'))).toMatchObject({
			message: 'From exception',
			code: 'INTERNAL_ERROR'
		});
	});

	it('formats nested errors consistently', () => {
		const top = createError('Top level', { code: 'FORBIDDEN', requestId: 'root' });
		const nested = new Error('Low level');

		expect(formatError(top)).toBe('[FORBIDDEN] Top level (request: root)');
		expect(composeErrorMessage(top, nested)).toContain('[INTERNAL_ERROR] Low level');
	});

	it('reports error text through callback and returns app error', () => {
		const setError = vi.fn<(next: string) => void>();
		const report = createErrorReporter(setError, {
			code: 'UNAUTHORIZED',
			requestId: 'base-request'
		});

		const appError = report('Request denied', new Error('Token expired'));

		expect(appError).toEqual({
			message: 'Request denied',
			code: 'UNAUTHORIZED',
			requestId: 'base-request'
		});
		expect(setError).toHaveBeenCalledTimes(1);
		expect(setError.mock.calls[0]?.[0]).toContain('[UNAUTHORIZED] Request denied');
		expect(setError.mock.calls[0]?.[0]).toContain('[INTERNAL_ERROR] Token expired');
	});
});
