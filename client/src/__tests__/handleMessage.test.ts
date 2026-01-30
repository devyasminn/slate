/**
 * Tests for WebSocket message handler.
 * 
 * These tests verify the pure message handling logic without mocking WebSocket.
 * The handler returns "effects" instead of executing them directly, making
 * it fully testable as a pure function.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleMessage, type MessageCallbacks } from '../ws/handleMessage';
import { TOKEN_KEY } from '../auth';
import type { Button, Profile } from '../types';

/**
 * Create a fresh set of mock callbacks for each test.
 */
function createMockCallbacks(): MessageCallbacks & { mocks: Record<string, ReturnType<typeof vi.fn>> } {
    const mocks = {
        setAuthStatus: vi.fn(),
        setButtons: vi.fn(),
        setProfiles: vi.fn(),
        setActiveProfileId: vi.fn(),
        setLastResult: vi.fn(),
        setSystemStats: vi.fn(),
    };

    return { ...mocks, mocks };
}

describe('handleMessage - Validation', () => {
    it('returns empty effects array for invalid message format', () => {
        const callbacks = createMockCallbacks();

        const effects = handleMessage({ notAType: 'invalid' }, callbacks);

        expect(effects).toEqual([]);
    });

    it('returns empty effects array for null input', () => {
        const callbacks = createMockCallbacks();

        const effects = handleMessage(null, callbacks);

        expect(effects).toEqual([]);
    });

    it('returns empty effects array for non-object input', () => {
        const callbacks = createMockCallbacks();

        const effects = handleMessage('not an object', callbacks);

        expect(effects).toEqual([]);
    });
});

describe('handleMessage - Authentication Messages', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('WELCOME sets authStatus to authenticated', () => {
        const callbacks = createMockCallbacks();

        handleMessage({ type: 'WELCOME', payload: {} }, callbacks);

        expect(callbacks.mocks.setAuthStatus).toHaveBeenCalledWith('authenticated');
    });

    it('AUTH_REQUIRED sets authStatus to unauthenticated and clears token', () => {
        localStorage.setItem(TOKEN_KEY, 'old-token');
        const callbacks = createMockCallbacks();

        handleMessage({ type: 'AUTH_REQUIRED', payload: {} }, callbacks);

        expect(callbacks.mocks.setAuthStatus).toHaveBeenCalledWith('unauthenticated');
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });

    it('AUTH_RESULT saves token on success', () => {
        const callbacks = createMockCallbacks();

        handleMessage({
            type: 'AUTH_RESULT',
            payload: { success: true, token: 'new-session-token' }
        }, callbacks);

        expect(localStorage.getItem(TOKEN_KEY)).toBe('new-session-token');
    });

    it('AUTH_RESULT does not save token on failure', () => {
        const callbacks = createMockCallbacks();

        handleMessage({
            type: 'AUTH_RESULT',
            payload: { success: false, error: 'Invalid credentials' }
        }, callbacks);

        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    });
});

describe('handleMessage - Profiles', () => {
    it('PROFILES_LIST sets profiles list', () => {
        const callbacks = createMockCallbacks();
        const testProfiles: Profile[] = [
            { id: 'p1', name: 'Default' },
            { id: 'p2', name: 'Gaming' },
        ];

        handleMessage({
            type: 'PROFILES_LIST',
            payload: { profiles: testProfiles }
        }, callbacks);

        expect(callbacks.mocks.setProfiles).toHaveBeenCalledWith(testProfiles);
    });

    it('PROFILES_LIST sets first profile as active when none is set', () => {
        const callbacks = createMockCallbacks();
        const testProfiles: Profile[] = [
            { id: 'first-profile', name: 'Default' },
        ];

        handleMessage({
            type: 'PROFILES_LIST',
            payload: { profiles: testProfiles }
        }, callbacks);

        // setActiveProfileId is called with an updater function
        expect(callbacks.mocks.setActiveProfileId).toHaveBeenCalled();

        // Get the updater function and verify its behavior
        const updaterFn = callbacks.mocks.setActiveProfileId.mock.calls[0][0];

        // When prev is null, it should return the first profile ID
        expect(updaterFn(null)).toBe('first-profile');

        // When prev is already set, it should preserve it
        expect(updaterFn('existing-profile')).toBe('existing-profile');
    });

    it('PROFILES_LIST does not change activeProfileId if profiles array is empty', () => {
        const callbacks = createMockCallbacks();

        handleMessage({
            type: 'PROFILES_LIST',
            payload: { profiles: [] }
        }, callbacks);

        const updaterFn = callbacks.mocks.setActiveProfileId.mock.calls[0][0];

        // When empty, should return prev (null in this case)
        expect(updaterFn(null)).toBeNull();
    });

    it('PROFILE_SWITCHED updates activeProfileId and requests buttons', () => {
        const callbacks = createMockCallbacks();

        const effects = handleMessage({
            type: 'PROFILE_SWITCHED',
            payload: { profileId: 'new-profile-id' }
        }, callbacks);

        // Verify the updater function sets the new ID
        const updaterFn = callbacks.mocks.setActiveProfileId.mock.calls[0][0];
        expect(updaterFn('old-id')).toBe('new-profile-id');

        // Should return effect to fetch buttons for new profile
        expect(effects).toContainEqual({ type: 'SEND_GET_BUTTONS' });
    });
});

describe('handleMessage - Buttons', () => {
    it('BUTTONS_LIST sets buttons array', () => {
        const callbacks = createMockCallbacks();
        const testButtons: Button[] = [
            { id: 'b1', label: 'Button 1', icon: 'play', actionType: 'hotkey' },
            { id: 'b2', label: 'Button 2', icon: 'stop', actionType: 'launch' },
        ];

        handleMessage({
            type: 'BUTTONS_LIST',
            payload: { buttons: testButtons }
        }, callbacks);

        expect(callbacks.mocks.setButtons).toHaveBeenCalledWith(testButtons);
    });

    it('BUTTONS_LIST handles empty buttons array', () => {
        const callbacks = createMockCallbacks();

        handleMessage({
            type: 'BUTTONS_LIST',
            payload: { buttons: [] }
        }, callbacks);

        expect(callbacks.mocks.setButtons).toHaveBeenCalledWith([]);
    });
});

describe('handleMessage - Action Result', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('ACTION_RESULT sets lastResult', () => {
        const callbacks = createMockCallbacks();
        const result = {
            buttonId: 'btn-1',
            status: 'success' as const,
            message: 'Action completed',
        };

        handleMessage({
            type: 'ACTION_RESULT',
            payload: result
        }, callbacks);

        expect(callbacks.mocks.setLastResult).toHaveBeenCalledWith(result);
    });

    it('ACTION_RESULT returns CLEAR_RESULT effect with 1500ms delay', () => {
        const callbacks = createMockCallbacks();

        const effects = handleMessage({
            type: 'ACTION_RESULT',
            payload: { buttonId: 'btn-1', status: 'success', message: 'Done' }
        }, callbacks);

        expect(effects).toContainEqual({ type: 'CLEAR_RESULT', delayMs: 1500 });
    });

    it('ACTION_RESULT handles error status', () => {
        const callbacks = createMockCallbacks();
        const result = {
            buttonId: 'btn-2',
            status: 'error' as const,
            message: 'Failed to execute',
        };

        handleMessage({
            type: 'ACTION_RESULT',
            payload: result
        }, callbacks);

        expect(callbacks.mocks.setLastResult).toHaveBeenCalledWith(result);
    });
});

describe('handleMessage - Heartbeat', () => {
    it('PING returns SEND_PONG effect', () => {
        const callbacks = createMockCallbacks();

        const effects = handleMessage({ type: 'PING', payload: {} }, callbacks);

        expect(effects).toContainEqual({ type: 'SEND_PONG' });
    });
});

describe('handleMessage - System Stats', () => {
    it('SYSTEM_STATS sets system stats', () => {
        const callbacks = createMockCallbacks();
        const stats = { cpu: 45.5, ram: 60.2, gpu: 30.0 };

        handleMessage({
            type: 'SYSTEM_STATS',
            payload: stats
        }, callbacks);

        expect(callbacks.mocks.setSystemStats).toHaveBeenCalledWith(stats);
    });

    it('SYSTEM_STATS handles null GPU', () => {
        const callbacks = createMockCallbacks();
        const stats = { cpu: 50, ram: 70, gpu: null };

        handleMessage({
            type: 'SYSTEM_STATS',
            payload: stats
        }, callbacks);

        expect(callbacks.mocks.setSystemStats).toHaveBeenCalledWith(stats);
    });
});

describe('handleMessage - Error Messages', () => {
    it('ERROR does not throw and returns empty effects', () => {
        const callbacks = createMockCallbacks();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        const effects = handleMessage({
            type: 'ERROR',
            payload: { message: 'Something went wrong' }
        }, callbacks);

        expect(effects).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });
});
