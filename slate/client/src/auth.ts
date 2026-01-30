/**
 * Authentication utilities for token management and QR code exchange.
 * 
 * Extracted from useWebSocket for testability.
 */

import { getApiUrl } from './config';

export const TOKEN_KEY = 'slate_auth_token';

export function getSavedToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

/**
 * Check for QR token in URL and exchange it for a session token.
 * 
 * This function:
 * 1. Extracts `qrToken` from URL search params
 * 2. Immediately removes it from the URL (security)
 * 3. Exchanges it with the server for a session token
 * 4. Saves the session token to localStorage
 * 
 * @returns true if a token was successfully exchanged
 */
export async function tryExchangeQRToken(): Promise<boolean> {
    const urlParams = new URLSearchParams(window.location.search);
    const qrToken = urlParams.get('qrToken');

    if (qrToken) {
        console.log('[Auth] Found qrToken in URL:', qrToken);
    } else {
        console.log('[Auth] No qrToken found in URL:', window.location.search);
        return false;
    }

    urlParams.delete('qrToken');
    const newUrl = urlParams.toString()
        ? `${window.location.pathname}?${urlParams.toString()}`
        : window.location.pathname;
    window.history.replaceState({}, '', newUrl);

    try {
        const apiUrl = getApiUrl();
        const response = await fetch(`${apiUrl}/api/auth/exchange?qrToken=${encodeURIComponent(qrToken)}`, {
            method: 'POST',
        });

        if (!response.ok) {
            console.warn('[Auth] QR token exchange failed:', response.status);
            return false;
        }

        const data = await response.json();
        if (data.sessionToken) {
            saveToken(data.sessionToken);
            console.log('[Auth] QR token exchanged successfully');
            return true;
        }
    } catch (err) {
        console.error('[Auth] QR token exchange error:', err);
    }

    return false;
}
