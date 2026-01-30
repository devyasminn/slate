import { useEffect, useRef, useState, useCallback } from 'react';
import { getServerUrl } from '../config';
import { PROTOCOL_VERSION } from '../protocol';
import { getSavedToken, tryExchangeQRToken } from '../auth';
import { handleMessage, type MessageEffect } from '../ws/handleMessage';
import type {
    Button,
    ConnectionStatus,
    AuthStatus,
    ActionResultPayload,
    SystemStatsPayload,
    Profile,
} from '../types';

interface UseWebSocketReturn {
    status: ConnectionStatus;
    authStatus: AuthStatus;
    buttons: Button[];
    profiles: Profile[];
    activeProfileId: string | null;
    lastResult: ActionResultPayload | null;
    systemStats: SystemStatsPayload | null;
    sendButtonPress: (buttonId: string) => void;
    switchProfile: (profileId: string) => void;
}

type CloseReason = 'unmount' | 'background' | 'error' | 'server_close';

const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

function getReconnectDelay(attempt: number): number {
    return Math.min(INITIAL_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt), MAX_DELAY_MS);
}

export function useWebSocket(): UseWebSocketReturn {
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [authStatus, setAuthStatus] = useState<AuthStatus>('pending');
    const [buttons, setButtons] = useState<Button[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<ActionResultPayload | null>(null);
    const [systemStats, setSystemStats] = useState<SystemStatsPayload | null>(null);
    const [isBooting, setIsBooting] = useState(true);

    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);
    const reconnectAttemptRef = useRef(0);
    const closeReasonRef = useRef<CloseReason | null>(null);

    const clearReconnectTimeout = useCallback(() => {
        if (reconnectTimeoutRef.current !== null) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
    }, []);

    const closeConnection = useCallback((reason: CloseReason) => {
        closeReasonRef.current = reason;
        clearReconnectTimeout();
        wsRef.current?.close();
    }, [clearReconnectTimeout]);

    const executeEffect = useCallback((effect: MessageEffect, ws: WebSocket) => {
        switch (effect.type) {
            case 'SEND_PONG':
                ws.send(JSON.stringify({ type: 'PONG', payload: {} }));
                break;

            case 'SEND_GET_BUTTONS':
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'GET_BUTTONS', payload: {} }));
                }
                break;

            case 'CLEAR_RESULT':
                setTimeout(() => setLastResult(null), effect.delayMs);
                break;
        }
    }, []);

    const connect = useCallback(function _connect() {
        if (closeReasonRef.current === 'background' || closeReasonRef.current === 'unmount') {
            return;
        }

        if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
            return;
        }

        clearReconnectTimeout();

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setStatus('connecting');
        setAuthStatus('pending');

        const serverUrl = getServerUrl();

        const ws = new WebSocket(serverUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            setStatus('connected');
            reconnectAttemptRef.current = 0;
            closeReasonRef.current = null;

            ws.send(JSON.stringify({
                type: 'HELLO',
                payload: {
                    version: PROTOCOL_VERSION,
                    token: getSavedToken()
                }
            }));
        };

        ws.onclose = () => {
            setStatus('disconnected');
            wsRef.current = null;

            const reason = closeReasonRef.current;
            const shouldReconnect = reason === null || reason === 'error' || reason === 'server_close';

            if (shouldReconnect) {
                const delay = getReconnectDelay(reconnectAttemptRef.current);
                reconnectAttemptRef.current += 1;

                reconnectTimeoutRef.current = window.setTimeout(() => {
                    _connect();
                }, delay);
            }
        };

        ws.onerror = () => {
            console.error('[WS] Connection error');
            closeReasonRef.current = 'error';
            ws.close();
        };

        ws.onmessage = (event) => {
            try {
                const data: unknown = JSON.parse(event.data);

                const effects = handleMessage(data, {
                    setAuthStatus,
                    setButtons,
                    setProfiles,
                    setActiveProfileId,
                    setLastResult,
                    setSystemStats,
                });

                for (const effect of effects) {
                    executeEffect(effect, ws);
                }
            } catch (err) {
                console.error('[WS] Failed to parse message:', err);
            }
        };
    }, [clearReconnectTimeout, executeEffect]);

    useEffect(() => {
        tryExchangeQRToken().then((success) => {
            if (success) {
                console.log('[App] Boot: QR exchange successful');
            }
        }).finally(() => {
            setIsBooting(false);
        });
    }, []);

    useEffect(() => {
        if (isBooting) return;

        connect();

        return () => {
            closeConnection('unmount');
        };
    }, [isBooting, connect, closeConnection]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                closeConnection('background');
            } else {
                closeReasonRef.current = null;
                reconnectAttemptRef.current = 0;
                connect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [connect, closeConnection]);

    const sendButtonPress = useCallback((buttonId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'BUTTON_PRESSED',
                payload: { buttonId },
            }));
        } else {
            console.warn('[WS] Cannot send - not connected');
        }
    }, []);

    const switchProfile = useCallback((profileId: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                type: 'SWITCH_PROFILE',
                payload: { profileId },
            }));
        } else {
            console.warn('[WS] Cannot switch profile - not connected');
        }
    }, []);

    return {
        status,
        authStatus,
        buttons,
        profiles,
        activeProfileId,
        lastResult,
        systemStats,
        sendButtonPress,
        switchProfile,
    };
}
