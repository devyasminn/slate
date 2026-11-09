import type { ButtonData } from '../types/button';

const GRID_SIZE = 32;

export interface ButtonMove {
    buttonId: string;
    fromPosition: number;
    gridPosition: number;
    targetButtonId: string | null;
}

export function getGridCells(buttons: ButtonData[]): (ButtonData | undefined)[] {
    const byPosition = new Map(buttons.map(button => [button.gridPosition, button]));
    return Array.from({ length: GRID_SIZE }, (_, position) => byPosition.get(position));
}

export function getButtonMove(
    cells: (ButtonData | undefined)[], fromPosition: number, gridPosition: number | null,
): ButtonMove | null {
    const source = cells[fromPosition];
    if (!source || gridPosition === null || gridPosition === fromPosition ||
        !Number.isInteger(gridPosition) || gridPosition < 0 || gridPosition >= GRID_SIZE) {
        return null;
    }

    return { buttonId: source.id, fromPosition, gridPosition, targetButtonId: cells[gridPosition]?.id ?? null };
}

export function applyButtonMove(buttons: ButtonData[], move: ButtonMove): ButtonData[] {
    return buttons.map(button => {
        if (button.id === move.buttonId) return { ...button, gridPosition: move.gridPosition };
        if (button.id === move.targetButtonId) return { ...button, gridPosition: move.fromPosition };
        return button;
    });
}
