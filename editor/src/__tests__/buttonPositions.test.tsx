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

const savedButton: ButtonData = { id: 'play', gridPosition: 0, label: 'Play', actionType: 'MEDIA_NEXT', background: '#123456', iconColor: '#abcdef' };
const targetButton: ButtonData = { id: 'next', gridPosition: 1, label: 'Next', actionType: 'MEDIA_NEXT' };

function deferMove() {
    let resolve!: (buttons: ButtonData[]) => void;
    let reject!: (error: Error) => void;
    vi.mocked(api.moveButton).mockReturnValue(new Promise((resolveMove, rejectMove) => {
        resolve = resolveMove;
        reject = rejectMove;
    }));
    return { resolve, reject };
}

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

    async function dropWithKeyboard() {
        const source = cell(0).querySelector<HTMLElement>('.draggable')!;
        const press = (code: string) => act(async () => {
            source.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true }));
        });
        source.focus();
        await press('Space');
        await new Promise(resolve => setTimeout(resolve, 0));
        await press('ArrowRight');
        await press('Space');
    }

    beforeEach(async () => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        vi.mocked(api.fetchProfiles).mockResolvedValue([{ id: 'first', name: 'First' }, { id: 'second', name: 'Second' }]);
        vi.mocked(api.fetchButtons).mockImplementation(async profileId =>
            profileId === 'first' ? [savedButton, targetButton] : [{ ...savedButton, id: 'other', gridPosition: 25, background: '#000000' }]);
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

    it('keeps copied style available after switching profiles', async () => {
        vi.mocked(api.updateButton).mockImplementation(async button => button);
        await click(cell(0).querySelector('.draggable')!);
        await click(button('Copy Style'));

        await click(button('Second'));
        await click(cell(25).querySelector('.draggable')!);
        expect(button('Paste Style').disabled).toBe(false);
        await click(button('Paste Style'));
        await click(button('Apply'));

        expect(api.updateButton).toHaveBeenCalledWith(expect.objectContaining({
            id: 'other', gridPosition: 25, actionType: 'MEDIA_NEXT',
            background: '#123456', iconColor: '#abcdef',
        }), 'second');
    });

    it('copies the displayed button through its context menu and pastes it into another profile', async () => {
        vi.mocked(api.createButton).mockImplementation(async draft => draft);
        const openMenu = (element: Element) => act(async () => {
            element.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 20 }));
        });
        const menuItem = (label: string) => [...document.querySelectorAll('[role="menuitem"]')]
            .find(element => element.textContent === label) as HTMLElement;

        await openMenu(cell(0).querySelector('.draggable')!);
        await act(async () => menuItem('Copy Button').click());
        await click(button('Second'));
        await openMenu(cell(19));
        expect(menuItem('Paste Button').getAttribute('aria-disabled')).not.toBe('true');
        await act(async () => menuItem('Paste Button').click());

        expect(api.createButton).toHaveBeenCalledWith(expect.objectContaining({
            id: expect.not.stringMatching(/^play$/), gridPosition: 19, label: 'Play',
            actionType: 'MEDIA_NEXT', background: '#123456', iconColor: '#abcdef',
        }), 'second');
        expect(cell(19).querySelector('.draggable.selected')?.textContent).toContain('Play');
    });

    it('swaps occupied cells before the save resolves and then uses the server response', async () => {
        measureGrid();
        const move = deferMove();

        await dropWithKeyboard();

        expect(api.moveButton).toHaveBeenCalledWith({
            buttonId: 'play', fromPosition: 0, gridPosition: 1, targetButtonId: 'next',
        }, 'first');
        expect(cell(0).textContent).toBe('Next');
        expect(cell(1).textContent).toBe('Play');

        await act(async () => move.resolve([
            { ...savedButton, gridPosition: 1 },
            { ...targetButton, gridPosition: 0, label: 'Next (saved)' },
        ]));
        expect(cell(0).textContent).toBe('Next (saved)');
        expect(cell(1).textContent).toBe('Play');
    });

    it('reloads the saved layout and reports a conflict after an optimistic swap', async () => {
        measureGrid();
        const move = deferMove();
        vi.mocked(api.fetchButtons).mockResolvedValueOnce([
            { ...savedButton, gridPosition: 21 }, { ...targetButton, gridPosition: 5 },
        ]);

        await dropWithKeyboard();
        expect(cell(0).textContent).toBe('Next');
        expect(cell(1).textContent).toBe('Play');

        await act(async () => move.reject(new Error('The destination has changed.')));

        expect(cell(0).querySelector('.empty')).toBeTruthy();
        expect(cell(1).querySelector('.empty')).toBeTruthy();
        expect(cell(5).textContent).toBe('Next');
        expect(cell(21).textContent).toBe('Play');
        expect(container.querySelector('[role="alert"]')?.textContent).toBe('The destination has changed.');
    });

    it('ignores an outside drop and immediately moves a selected button and its edit to an empty cell', async () => {
        measureGrid();
        const move = deferMove();
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
        expect(api.moveButton).toHaveBeenCalledWith({
            buttonId: 'play', fromPosition: 0, gridPosition: 8, targetButtonId: null,
        }, 'first');
        expect(cell(0).querySelector('.empty')).toBeTruthy();
        expect(cell(8).querySelector('.draggable.selected')?.textContent).toBe('Edited');
        await act(async () => move.resolve([{ ...savedButton, gridPosition: 8 }, targetButton]));
        await click(button('Apply'));
        expect(api.updateButton).toHaveBeenCalledWith(expect.objectContaining({ label: 'Edited', gridPosition: 8 }), 'first');
    });
});
