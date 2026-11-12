import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

const health = (env: string, qaSession = '') => new Response(JSON.stringify({
    status: 'ok', app: 'slate-server', owner: 'tauri', env, qaSession, pid: 123,
}));

describe('QA API environment isolation', () => {
    it('refuses a personal server before sending any API mutation', async () => {
        vi.stubEnv('VITE_SLATE_ENV', 'qa');
        vi.stubEnv('VITE_SLATE_QA_SESSION', 'this-session');
        const fetch = vi.fn().mockResolvedValue(health('prod'));
        vi.stubGlobal('fetch', fetch);
        const api = await import('../services/api');
        await expect(api.createProfile('QA')).rejects.toThrow('Connected to tauri/prod');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('pins its session, tags requests, and checks again after a successful connection', async () => {
        vi.stubEnv('VITE_SLATE_ENV', 'qa');
        vi.stubEnv('VITE_SLATE_QA_SESSION', 'this-session');
        const fetch = vi.fn()
            .mockResolvedValueOnce(health('qa', 'this-session'))
            .mockResolvedValueOnce(new Response(JSON.stringify({ profiles: [] })))
            .mockResolvedValueOnce(health('qa', 'other-session'));
        vi.stubGlobal('fetch', fetch);
        const api = await import('../services/api');
        expect(await api.fetchProfiles()).toEqual([]);
        expect(fetch.mock.calls[1][1].headers.get('x-slate-qa-session')).toBe('this-session');
        await expect(api.deleteProfile('fixture')).rejects.toThrow('Connected to tauri/qa');
        expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('refuses a QA build with a missing session rather than probing normal ports', async () => {
        vi.stubEnv('VITE_SLATE_ENV', 'qa');
        vi.stubEnv('VITE_SLATE_QA_SESSION', '');
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        const api = await import('../services/api');
        await expect(api.fetchProfiles()).rejects.toThrow('missing its session');
        expect(fetch).not.toHaveBeenCalled();
    });
});
