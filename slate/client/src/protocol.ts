/**
 * WebSocket Protocol Definition
 * 
 * Message directions:
 *   Client -> Server:  HELLO, BUTTON_PRESSED, GET_BUTTONS, PONG
 *   Server -> Client:  WELCOME, ACTION_RESULT, BUTTONS_LIST, ERROR, PING
 */

export const PROTOCOL_VERSION = "1.0";

export type MessageType =
    | 'HELLO'
    | 'WELCOME'
    | 'AUTH_REQUIRED'
    | 'AUTH_RESULT'
    | 'BUTTON_PRESSED'
    | 'GET_BUTTONS'
    | 'ACTION_RESULT'
    | 'BUTTONS_LIST'
    | 'ERROR'
    | 'PING'
    | 'PONG'
    | 'SYSTEM_STATS'
    | 'GET_PROFILES'
    | 'PROFILES_LIST'
    | 'SWITCH_PROFILE'
    | 'PROFILE_SWITCHED';

export interface Message<T = unknown> {
    type: MessageType;
    payload: T;
}

export function createMessage<T>(type: MessageType, payload: T): Message<T> {
    return { type, payload };
}

export function isValidMessage(data: unknown): data is Message {
    return (
        typeof data === 'object' &&
        data !== null &&
        'type' in data
    );
}
