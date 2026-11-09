import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { getButtonMove, getGridCells } from '../domain/buttonGrid';
import * as api from '../services/api';
import type { ButtonData } from '../types/button';
import type { ProfileData } from '../types/profile';

vi.mock('../services/api', () => ({
    fetchProfiles: vi.fn(), fetchButtons: vi.fn(), createButton: vi.fn(), moveButton: vi.fn(),
    updateButton: vi.fn(), switchProfile: vi.fn(),
}));
vi.mock('../components/Header/Header', () => ({
    Header: ({ profiles, onSwitchProfile }: { profiles: ProfileData[]; onSwitchProfile: (id: string) => void }) =>
        <header>{profiles.map(profile => (
            <button key={profile.id} onClick={() => onSwitchProfile(profile.id)}>{profile.name}</button>
        ))}</header>,
}));

const savedButton: ButtonData = { id: 'play', gridPosition: 0, label: 'Play', actionType: 'MEDIA_NEXT' };

function measureGrid() {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        const position = this.closest<HTMLElement>('[data-position]')?.dataset.position;
        if (position === undefined) return new DOMRect(0, 0, 900, 500);
        const index = Number(position);
        return new DOMRect(index % 8 * 100, Math.floor(index / 8) * 100, 90, 90);
    });
}

describe('cell movement', () => {
    it('describes moves and swaps and ignores drops outside the grid or on the source', () => {
        const cells = getGridCells([{ ...savedButton, id: 'target', gridPosition: 31 }, savedButton]);
        expect(getButtonMove(cells, 0, 1)).toEqual({
            buttonId: 'play', fromPosition: 0, gridPosition: 1, targetButtonId: null,
        });
        expect(getButtonMove(cells, 0, 31)?.targetButtonId).toBe('target');
        expect(getButtonMove(cells, 0, null)).toBeNull();
        expect(getButtonMove(cells, 0, 0)).toBeNull();
    });
});

describe('editor positions', () => {
    let container: HTMLDivElement;
    let root: Root;

    function cell(position: number) {
        return container.querySelector<HTMLElement>(`[data-position="${position}"]`)!;
    }

    function click(element: HTMLElement) {
        return act(async () => element.click());
    }

    function button(label: string) {
        return [...container.querySelectorAll('button')].find(element => element.textContent === label)!;
    }

    beforeEach(async () => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        vi.mocked(api.fetchProfiles).mockResolvedValue([{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }]);
        vi.mocked(api.fetchButtons).mockImplementation(async profileId =>
            [{ ...savedButton, gridPosition: profileId === 'first' ? 0 : 25 }]);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        await act(async () => root.render(<App />));
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.resetAllMocks();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('creates a draft in the clicked cell and can cancel or save it there', async () => {
        expect(container.querySelectorAll('.editor-grid-cell')).toHaveLength(32);
        await click(cell(19).querySelector('button')!);
        expect(cell(19).textContent).toContain('New Button');
        expect(cell(0).textContent).toContain('Play');
        await click(button('Cancel'));
        expect(cell(19).querySelector('.empty')).toBeTruthy();
        expect(api.createButton).not.toHaveBeenCalled();

        vi.mocked(api.createButton).mockImplementation(async draft => draft);
        await click(cell(31).querySelector('button')!);
        await click(button('Create'));
        expect(api.createButton).toHaveBeenCalledWith(expect.objectContaining({ gridPosition: 31 }), 'first');
        expect(cell(31).querySelector('.draggable.selected')).toBeTruthy();
    });

    it('replaces the layout and draft on profile switch', async () => {
        await click(cell(19).querySelector('button')!);
        await click(button('Second'));
        expect(cell(19).querySelector('.empty')).toBeTruthy();
        expect(cell(0).querySelector('.empty')).toBeTruthy();
        expect(cell(25).textContent).toContain('Play');
        await click(button('First'));
        expect(cell(0).textContent).toContain('Play');
        expect(cell(25).querySelector('.empty')).toBeTruthy();
    });

    it('moves with the keyboard and reloads the saved layout after a conflict', async () => {
        measureGrid();
        vi.mocked(api.moveButton).mockRejectedValue(new Error('The destination has changed.'));
        vi.mocked(api.fetchButtons).mockResolvedValueOnce([{ ...savedButton, gridPosition: 21 }]);

        const source = cell(0).querySelector<HTMLElement>('.draggable')!;
        const press = (target: EventTarget, code: string) => act(async () => {
            target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
        });
        source.focus();
        await press(source, 'Space');
        await new Promise(resolve => setTimeout(resolve, 0));
        await press(source, 'ArrowRight');
        await press(source, 'Space');

        expect(api.moveButton).toHaveBeenCalledWith({
            buttonId: 'play', fromPosition: 0, gridPosition: 1, targetButtonId: null,
        }, 'first');
        expect(cell(1).querySelector('.empty')).toBeTruthy();
        expect(cell(21).textContent).toContain('Play');
        expect(container.querySelector('[role="alert"]')?.textContent).toBe('The destination has changed.');
    });

    it('ignores a pointer drop outside and keeps an edit attached to its button through a move', async () => {
        measureGrid();
        vi.mocked(api.moveButton).mockResolvedValue([{ ...savedButton, gridPosition: 8 }]);
        vi.mocked(api.updateButton).mockImplementation(async draft => draft);
        const source = cell(0).querySelector<HTMLElement>('.draggable')!;
        await click(source);
        const input = container.querySelector<HTMLInputElement>('input[placeholder="Button label"]')!;
        await act(async () => {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Edited');
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });

        async function dragTo(clientX: number, clientY: number) {
            const pointer = (target: EventTarget, type: string, x: number, y: number) => act(async () => {
                target.dispatchEvent(new PointerEvent(type, {
                    bubbles: true, cancelable: true, isPrimary: true, clientX: x, clientY: y,
                }));
            });
            await pointer(source, 'pointerdown', 45, 45);
            await pointer(document, 'pointermove', 55, 45);
            await pointer(document, 'pointermove', clientX, clientY);
            await pointer(document, 'pointerup', clientX, clientY);
        }

        await dragTo(45, 395);
        expect(api.moveButton).not.toHaveBeenCalled();
        expect(cell(0).textContent).toContain('Edited');

        await dragTo(45, 145);
        expect(cell(0).querySelector('.empty')).toBeTruthy();
        expect(cell(8).textContent).toContain('Edited');
        await click(button('Apply'));
        expect(api.updateButton).toHaveBeenCalledWith(expect.objectContaining({ label: 'Edited', gridPosition: 8 }), 'first');
    });
});
