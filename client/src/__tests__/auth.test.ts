/**
 * Tests for authentication utilities.
 * 
 * These tests verify token management and QR code exchange functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    TOKEN_KEY,
    getSavedToken,
    saveToken,
    clearToken,
    tryExchangeQRToken,
} from '../auth';

describe('Token Management', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('getSavedToken returns null when no token exists', () => {
        expect(getSavedToken()).toBeNull();
    });

    it('saveToken persists token to localStorage', () => {
        saveToken('test-token-123');

        expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token-123');
    });

    it('getSavedToken returns saved token', () => {
        localStorage.setItem(TOKEN_KEY, 'existing-token');

        expect(getSavedToken()).toBe('existing-token');
    });

    it('clearToken removes token from localStorage', () => {
        localStorage.setItem(TOKEN_KEY, 'token-to-clear');

        clearToken();

        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('clearToken does not throw when no token exists', () => {
        expect(() => clearToken()).not.toThrow();
    });
});

describe('tryExchangeQRToken', () => {
    const originalLocation = window.location;
    const originalHistory = window.history;

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();

        // Mock window.location
        Object.defineProperty(window, 'location', {
            value: {
                search: '',
                pathname: '/app',
            },
            writable: true,
        });

        // Mock window.history.replaceState
        Object.defineProperty(window, 'history', {
            value: {
                replaceState: vi.fn(),
            },
            writable: true,
        });
    });

    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
        Object.defineProperty(window, 'history', { value: originalHistory, writable: true });
    });

    it('returns false when no qrToken in URL', async () => {
        window.location.search = '';

        const result = await tryExchangeQRToken();

        expect(result).toBe(false);
    });

    it('removes qrToken from URL immediately', async () => {
        window.location.search = '?qrToken=test-qr-token';

        // Mock fetch to fail (we're testing URL cleanup, not the exchange)
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        await tryExchangeQRToken();

        expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/app');
    });

    it('preserves other URL params when removing qrToken', async () => {
        window.location.search = '?qrToken=test-qr-token&other=value';

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        await tryExchangeQRToken();

        expect(window.history.replaceState).toHaveBeenCalledWith({}, '', '/app?other=value');
    });

    it('saves token on successful exchange', async () => {
        window.location.search = '?qrToken=valid-qr-token';

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ sessionToken: 'new-session-token' }),
        }));

        const result = await tryExchangeQRToken();

        expect(result).toBe(true);
        expect(localStorage.getItem(TOKEN_KEY)).toBe('new-session-token');
    });

    it('returns false when server returns error status', async () => {
        window.location.search = '?qrToken=expired-qr-token';

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
        }));

        const result = await tryExchangeQRToken();

        expect(result).toBe(false);
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('returns false when response has no sessionToken', async () => {
        window.location.search = '?qrToken=some-token';

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ error: 'invalid' }),
        }));

        const result = await tryExchangeQRToken();

        expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
        window.location.search = '?qrToken=some-token';

        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

        const result = await tryExchangeQRToken();

        expect(result).toBe(false);
    });
});
