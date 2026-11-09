import type { ButtonData } from '../types/button';

/** Snapshot a button's complete JSON configuration without retaining live references. */
export function snapshotButton(button: ButtonData): ButtonData {
    return structuredClone(button);
}

/** Clone a snapshot into a destination cell with a fresh identity. */
export function cloneButtonToPosition(button: ButtonData, gridPosition: number): ButtonData {
    return {
        ...structuredClone(button),
        id: globalThis.crypto?.randomUUID?.() ?? `button-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        gridPosition,
    };
}
