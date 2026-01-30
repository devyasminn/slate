/** 
 * Get the WebSocket server URL based on environment.
 */
export function getServerUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const hostname = window.location.hostname;

    if (import.meta.env.DEV) {
        return `${protocol}//${hostname}:8000/ws`;
    }

    return `${protocol}//${window.location.host}/ws`;
}

export function getApiUrl(): string {
    const hostname = window.location.hostname;

    if (import.meta.env.DEV) {
        return `http://${hostname}:8000`;
    }
    return window.location.origin;
}
