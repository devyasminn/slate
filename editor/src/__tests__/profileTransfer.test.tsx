import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as api from '../services/api';
import * as profileFiles from '../services/profileFiles';

vi.mock('../services/api', () => ({
    fetchProfiles: vi.fn(), fetchButtons: vi.fn(), createProfile: vi.fn(),
    exportProfile: vi.fn(), previewProfileImport: vi.fn(), importProfile: vi.fn(),
}));
vi.mock('../services/profileFiles', () => ({ openProfileFile: vi.fn(), saveProfileFile: vi.fn() }));
vi.mock('../components/ConnectionDialog/ConnectionDialog', () => ({ ConnectionDialog: () => null }));
vi.mock('../components/WindowControls/WindowControls', () => ({ WindowControls: () => null }));

const current = { id: 'current', name: 'Current' };
const restored = { id: 'restored', name: 'Studio (Imported)' };
const contents = '{"format":"slate-profile","version":1,"profile":{"name":"Studio"},"buttons":[]}';

describe('profile management', () => {
    let container: HTMLDivElement;
    let root: Root;

    function button(label: string, scope: ParentNode = document) {
        return [...scope.querySelectorAll('button')].find(element =>
            element.getAttribute('aria-label') === label || element.textContent === label)!;
    }

    function click(element: HTMLElement) {
        return act(async () => element.click());
    }

    function cell(position: number) {
        return container.querySelector<HTMLElement>(`[data-position="${position}"]`)!;
    }

    function dialog() {
        return document.querySelector<HTMLElement>('[role="dialog"]')!;
    }

    async function chooseAction(label: string) {
        await click(button('Profile actions'));
        await click(button(label));
    }

    async function submitCreate(name: string) {
        await chooseAction('Create Profile');
        const input = dialog().querySelector('input')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, name);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await click(button('Create', dialog()));
    }

    beforeEach(async () => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        vi.mocked(api.fetchProfiles).mockResolvedValue([current]);
        vi.mocked(api.fetchButtons).mockImplementation(async id => id === restored.id
            ? [{ id: 'restored-button', gridPosition: 29, label: 'Restored', actionType: 'MEDIA_NEXT' }]
            : []);
        vi.mocked(api.previewProfileImport).mockResolvedValue({ name: 'Studio', buttonCount: 1 });
        vi.mocked(api.importProfile).mockResolvedValue({ profile: restored, profiles: [current, restored] });
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => root.render(<App />));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.resetAllMocks();
        vi.unstubAllGlobals();
    });

    it('keeps the draft when the native picker or import preview is canceled', async () => {
        await click(cell(7).querySelector('button')!);
        vi.mocked(profileFiles.openProfileFile).mockResolvedValueOnce(null).mockResolvedValueOnce(contents);
        await chooseAction('Import Profile');
        expect(api.previewProfileImport).not.toHaveBeenCalled();
        expect(dialog()).toBeNull();

        await chooseAction('Import Profile');
        expect(api.previewProfileImport).toHaveBeenCalledWith(contents);
        expect(dialog().textContent).toContain('“Studio” contains 1 button. Importing creates a new profile.');
        await click(button('Cancel', dialog()));
        expect(api.importProfile).not.toHaveBeenCalled();
        expect(cell(7).textContent).toContain('New Button');
    });

    it('asks before importing over a draft, refreshes the list, and switches to the restored grid', async () => {
        await click(cell(7).querySelector('button')!);
        vi.mocked(profileFiles.openProfileFile).mockResolvedValue(contents);
        await chooseAction('Import Profile');
        await click(button('Import Profile', dialog()));
        expect(dialog().textContent).toContain('Discard changes?');
        expect(api.importProfile).not.toHaveBeenCalled();
        await click(button('Keep Editing', dialog()));
        expect(cell(7).textContent).toContain('New Button');

        await chooseAction('Import Profile');
        await click(button('Import Profile', dialog()));
        await click(button('Discard Changes', dialog()));
        expect(api.importProfile).toHaveBeenCalledExactlyOnceWith(contents);
        expect(api.fetchButtons).toHaveBeenLastCalledWith(restored.id, expect.any(AbortSignal));
        expect(container.querySelector('[role="combobox"]')?.textContent).toBe(restored.name);
        expect(cell(29).textContent).toContain('Restored');
        expect(cell(7).querySelector('.empty')).toBeTruthy();
    });

    it('defers creating and switching until the user confirms discarding their draft', async () => {
        vi.mocked(api.createProfile).mockResolvedValue({ id: 'new', name: 'New profile' });
        await click(cell(7).querySelector('button')!);
        await submitCreate('New profile');
        expect(dialog().textContent).toContain('Discard changes?');
        await click(button('Keep Editing', dialog()));
        expect(api.createProfile).not.toHaveBeenCalled();
        expect(cell(7).textContent).toContain('New Button');

        await submitCreate('New profile');
        await click(button('Discard Changes', dialog()));
        expect(api.createProfile).toHaveBeenCalledExactlyOnceWith('New profile');
        expect(container.querySelector('[role="combobox"]')?.textContent).toBe('New profile');
    });

    it('reports invalid files and failed mutations while preserving the current profile and draft', async () => {
        await click(cell(7).querySelector('button')!);
        vi.mocked(profileFiles.openProfileFile).mockResolvedValue(contents);
        vi.mocked(api.previewProfileImport).mockRejectedValueOnce(new Error('Unsupported Slate profile version.'));
        await chooseAction('Import Profile');
        expect(dialog()).toBeNull();
        expect(container.querySelector('[role="alert"]')?.textContent).toBe('Unsupported Slate profile version.');

        vi.mocked(api.importProfile).mockRejectedValueOnce(new Error('Failed to save the imported profile.'));
        await chooseAction('Import Profile');
        await click(button('Import Profile', dialog()));
        await click(button('Discard Changes', dialog()));
        expect(container.querySelector('[role="alert"]')?.textContent).toBe('Failed to save the imported profile.');
        expect(cell(7).textContent).toContain('New Button');

        vi.mocked(api.createProfile).mockRejectedValueOnce(new Error('Failed to create profile.'));
        await submitCreate('New profile');
        await click(button('Discard Changes', dialog()));
        expect(container.querySelector('[role="alert"]')?.textContent).toBe('Failed to create profile.');
        expect(container.querySelector('[role="combobox"]')?.textContent).toBe(current.name);
        expect(cell(7).textContent).toContain('New Button');
    });

    it('warns about unsaved edits and passes the saved export to the native dialog', async () => {
        await click(cell(7).querySelector('button')!);
        vi.mocked(api.exportProfile).mockResolvedValue(contents);
        vi.mocked(profileFiles.saveProfileFile).mockResolvedValue(false);
        await chooseAction('Export Profile');
        expect(dialog().textContent).toContain('last saved configuration');
        expect(api.exportProfile).not.toHaveBeenCalled();
        await click(button('Export Profile', dialog()));
        expect(api.exportProfile).toHaveBeenCalledExactlyOnceWith(current.id);
        expect(profileFiles.saveProfileFile).toHaveBeenCalledExactlyOnceWith(current.name, contents);
        expect(cell(7).textContent).toContain('New Button');
    });
});
