import { describe, expect, it } from 'vitest';
import { cloneButtonToPosition, snapshotButton } from '../domain/buttonClipboard';
import { getNextAvailablePosition } from '../domain/buttonGrid';
import type { ButtonData } from '../types/button';

describe('button clipboard', () => {
    it('snapshots previews independently and clones full configuration with a new id and position', () => {
        const preview: ButtonData = {
            id: 'source', gridPosition: 4, label: 'Unsaved preview', actionType: 'OPEN_URL',
            actionPayload: { url: 'https://example.test', settings: { open: true } },
            background: 'linear-gradient(red, blue)', icon: 'fa-star', iconColor: '#abc',
        };
        const clipboard = snapshotButton(preview);
        preview.actionPayload!.url = 'changed';

        const copy = cloneButtonToPosition(clipboard, 22);
        expect(copy).toMatchObject({ ...clipboard, id: expect.any(String), gridPosition: 22 });
        expect(copy.id).not.toBe('source');
        expect(copy.actionPayload).toEqual({ url: 'https://example.test', settings: { open: true } });
        expect(clipboard.gridPosition).toBe(4);
    });

    it('preserves system button shape and finds the next free wrapped cell', () => {
        const system: ButtonData = { id: 'cpu', gridPosition: 31, label: 'CPU', actionType: 'SYSTEM_CPU', actionPayload: null, background: '#222' };
        const copy = cloneButtonToPosition(system, 8);
        expect(copy).toEqual({ ...system, id: copy.id, gridPosition: 8 });
        expect('icon' in copy).toBe(false);
        expect(getNextAvailablePosition([{ ...system, gridPosition: 31 }, { ...system, id: 'zero', gridPosition: 0 }], 31)).toBe(1);
        expect(getNextAvailablePosition(Array.from({ length: 32 }, (_, gridPosition) => ({ ...system, id: `${gridPosition}`, gridPosition })), 0)).toBeNull();
    });
});
