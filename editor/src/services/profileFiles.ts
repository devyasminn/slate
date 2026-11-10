import { invoke, isTauri } from '@tauri-apps/api/core';

function requireDesktop() {
    if (!isTauri()) throw new Error('Open Slate Editor on your desktop to import or export profiles.');
}

export async function openProfileFile(): Promise<string | null> {
    requireDesktop();
    return invoke('open_profile_file');
}

export async function saveProfileFile(name: string, contents: string): Promise<boolean> {
    requireDesktop();
    const safeName = Array.from(name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim()).slice(0, 100).join('');
    return invoke('save_profile_file', { suggestedName: `Slate - ${safeName || 'Profile'}.json`, contents });
}
