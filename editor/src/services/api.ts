import type { ButtonData, ButtonsResponse } from '../types/button';
import type { ProfileData, ProfilesResponse } from '../types/profile';
import type { ButtonMove } from '../domain/buttonGrid';

interface HealthResponse {
    status: string;
    app: string;
    owner: string;
    env: string;
    pid: number;
}

const IS_TAURI = ('__TAURI__' in window) || ('__TAURI_INTERNALS__' in window);

let cachedApiBase: string | null = null;

async function getApiBase(): Promise<string> {
    if (cachedApiBase) return cachedApiBase;

    const ports = IS_TAURI ? [8000] : [8000, 5173];

    for (const port of ports) {
        const url = `http://localhost:${port}`;
        try {
            const resp = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2000) });
            if (!resp.ok) continue;

            const health: HealthResponse = await resp.json();

            if (health.app !== 'slate-server') continue;

            if (IS_TAURI) {
                if (health.owner !== 'tauri' || health.env !== 'prod') {
                    throw new Error(
                        `Connected to ${health.owner}/${health.env} server. Close it and restart the editor.`
                    );
                }
            }

            cachedApiBase = url;
            console.log(`[API] Connected to ${health.owner}/${health.env} server at ${url}`);
            return url;
        } catch (e) {
            if (e instanceof Error && e.message.includes('Connected to')) throw e;
        }
    }

    throw new Error('Could not connect to Slate server. Make sure it is running.');
}

export async function fetchButtons(profileId?: string, signal?: AbortSignal): Promise<ButtonData[]> {
    const base = await getApiBase();
    const url = profileId
        ? `${base}/api/buttons?profileId=${encodeURIComponent(profileId)}`
        : `${base}/api/buttons`;
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Failed to fetch buttons');
    const data: ButtonsResponse = await response.json();
    return data.buttons;
}

export async function updateButton(button: ButtonData, profileId?: string): Promise<ButtonData> {
    const base = await getApiBase();
    const url = profileId
        ? `${base}/api/buttons/${button.id}?profileId=${encodeURIComponent(profileId)}`
        : `${base}/api/buttons/${button.id}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(button),
    });
    if (!response.ok) throw new Error('Failed to update button');
    const data = await response.json();
    return data.button;
}

export async function moveButton({ buttonId, ...position }: ButtonMove, profileId: string): Promise<ButtonData[]> {
    const base = await getApiBase();
    const url = `${base}/api/buttons/${encodeURIComponent(buttonId)}/position?profileId=${encodeURIComponent(profileId)}`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(position),
    });
    if (!response.ok) throw await requestError(response, 'Failed to move button');
    const data: ButtonsResponse = await response.json();
    return data.buttons;
}

export async function createButton(button: ButtonData, profileId?: string): Promise<ButtonData> {
    const base = await getApiBase();
    const url = profileId
        ? `${base}/api/buttons?profileId=${encodeURIComponent(profileId)}`
        : `${base}/api/buttons`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(button),
    });
    if (!response.ok) throw await requestError(response, 'Failed to create button');
    const data = await response.json();
    return data.button;
}

async function requestError(response: Response, fallback: string): Promise<Error> {
    const data = await response.json().catch(() => null);
    return new Error(typeof data?.detail === 'string' ? data.detail : fallback);
}

export async function deleteButton(buttonId: string, profileId?: string): Promise<void> {
    const base = await getApiBase();
    const url = profileId
        ? `${base}/api/buttons/${buttonId}?profileId=${encodeURIComponent(profileId)}`
        : `${base}/api/buttons/${buttonId}`;
    const response = await fetch(url, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete button');
}

export async function fetchProfiles(): Promise<ProfileData[]> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles`);
    if (!response.ok) throw new Error('Failed to fetch profiles');
    const data: ProfilesResponse = await response.json();
    return data.profiles;
}

export async function createProfile(name: string): Promise<ProfileData> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles?activate=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) throw await requestError(response, 'Failed to create profile');
    const data = await response.json();
    return data.profile;
}

export interface ProfileImportPreview {
    name: string;
    buttonCount: number;
}

export async function exportProfile(id: string): Promise<string> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles/${encodeURIComponent(id)}/export`);
    if (!response.ok) throw await requestError(response, 'Failed to export profile');
    return response.text();
}

export function previewProfileImport(contents: string): Promise<ProfileImportPreview> {
    return postProfileFile('/preview', contents);
}

export function importProfile(contents: string): Promise<ProfilesResponse & { profile: ProfileData }> {
    return postProfileFile('', contents);
}

async function postProfileFile<T>(suffix: '' | '/preview', contents: string): Promise<T> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles/import${suffix}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: contents,
    });
    if (!response.ok) throw await requestError(response, 'Failed to import profile');
    return response.json();
}

export async function updateProfile(id: string, name: string): Promise<ProfileData> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!response.ok) throw new Error('Failed to update profile');
    const data = await response.json();
    return data.profile;
}

export async function deleteProfile(id: string): Promise<void> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles/${id}`, {
        method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete profile');
}

export async function switchProfile(profileId: string): Promise<void> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/profiles/${profileId}/switch`, {
        method: 'POST',
    });
    if (!response.ok) throw new Error('Failed to switch profile');
}

export function resetApiCache(): void {
    cachedApiBase = null;
}

export interface QRTokenResponse {
    qrToken: string;
    ttlSeconds: number;
}

export async function fetchQRToken(): Promise<QRTokenResponse> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/auth/qr-token`);
    if (!response.ok) throw new Error('Failed to fetch QR token');
    return response.json();
}

export interface ServerInfo {
    ip: string;
    port: number;
    clientPort: number;
}

export async function fetchServerInfo(): Promise<ServerInfo> {
    const base = await getApiBase();
    const response = await fetch(`${base}/api/server-info`);
    if (!response.ok) throw new Error('Failed to fetch server info');
    return response.json();
}

/**
 * Gets the client connection URL (the URL users will scan).
 * Uses the server's detected IP address to ensure reachability from other devices.
 */
export async function getClientConnectionUrl(): Promise<string> {
    const serverInfo = await fetchServerInfo();
    return `http://${serverInfo.ip}:${serverInfo.clientPort}`;
}
