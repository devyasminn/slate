/**
 * Pure message handler for WebSocket messages.
 * 
 * This module processes incoming WebSocket messages and returns "effects"
 * that the caller can execute. This pattern makes the logic fully testable
 * without mocking WebSocket or React state.
 * 
 * Extracted from useWebSocket for testability.
 */

import { isValidMessage, type Message } from '../protocol';
import { saveToken, clearToken } from '../auth';
import type {
    Button,
    AuthStatus,
    ActionResultPayload,
    ButtonsListPayload,
    AuthResultPayload,
    SystemStatsPayload,
    Profile,
    ProfilesListPayload,
    ProfileSwitchedPayload
} from '../types';

/**
 * Callbacks for state updates.
 * These map to React state setters in the hook.
 */
export interface MessageCallbacks {
    setAuthStatus: (status: AuthStatus) => void;
    setButtons: (buttons: Button[]) => void;
    setProfiles: (profiles: Profile[]) => void;
    setActiveProfileId: (cb: (prev: string | null) => string | null) => void;
    setLastResult: (result: ActionResultPayload | null) => void;
    setSystemStats: (stats: SystemStatsPayload) => void;
}

/**
 * Side effects that should be executed by the caller.
 * This allows the handler to remain pure while still expressing
 * the need for WebSocket sends or delayed actions.
 */
export type MessageEffect =
    | { type: 'SEND_PONG' }
    | { type: 'SEND_GET_BUTTONS' }
    | { type: 'CLEAR_RESULT'; delayMs: number };

/**
 * Process a WebSocket message and execute state callbacks.
 * Returns an array of effects that the caller should execute.
 * 
 * @param data - Raw parsed JSON from WebSocket message
 * @param callbacks - State update functions
 * @returns Array of effects to execute (empty if no effects needed)
 */
export function handleMessage(
    data: unknown,
    callbacks: MessageCallbacks
): MessageEffect[] {
    // Validate message format
    if (!isValidMessage(data)) {
        console.warn('[WS] Invalid message format');
        return [];
    }

    const message = data as Message;
    const effects: MessageEffect[] = [];

    switch (message.type) {
        case 'PING':
            effects.push({ type: 'SEND_PONG' });
            break;

        case 'WELCOME':
            callbacks.setAuthStatus('authenticated');
            break;

        case 'AUTH_REQUIRED':
            callbacks.setAuthStatus('unauthenticated');
            clearToken();
            break;

        case 'AUTH_RESULT': {
            const payload = message.payload as AuthResultPayload;
            if (payload.success && payload.token) {
                saveToken(payload.token);
            } else {
                console.warn('[WS] Auth failed:', payload.error);
            }
            break;
        }

        case 'BUTTONS_LIST': {
            const payload = message.payload as ButtonsListPayload;
            callbacks.setButtons(payload.buttons);
            break;
        }

        case 'PROFILES_LIST': {
            const payload = message.payload as ProfilesListPayload;
            callbacks.setProfiles(payload.profiles);
            callbacks.setActiveProfileId((prev: string | null) => {
                if (prev === null && payload.profiles.length > 0) {
                    return payload.profiles[0].id;
                }
                return prev;
            });
            break;
        }

        case 'PROFILE_SWITCHED': {
            const payload = message.payload as ProfileSwitchedPayload;
            callbacks.setActiveProfileId(() => payload.profileId);
            effects.push({ type: 'SEND_GET_BUTTONS' });
            break;
        }

        case 'ACTION_RESULT': {
            const payload = message.payload as ActionResultPayload;
            callbacks.setLastResult(payload);
            effects.push({ type: 'CLEAR_RESULT', delayMs: 1500 });
            break;
        }

        case 'ERROR': {
            console.error('[WS] Server error:', message.payload);
            break;
        }

        case 'SYSTEM_STATS': {
            const payload = message.payload as SystemStatsPayload;
            callbacks.setSystemStats(payload);
            break;
        }
    }

    return effects;
}
