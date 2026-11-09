import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ButtonGrid } from '../components/ButtonGrid/ButtonGrid';
import type { Button } from '../types';

describe('ButtonGrid', () => {
    it('keeps empty cells and renders actions and monitors at their saved positions', () => {
        const buttons: Button[] = [
            { id: 'play', gridPosition: 31, label: 'Play', icon: 'play', actionType: 'MEDIA_PLAY_PAUSE' },
            { id: 'cpu', gridPosition: 4, label: 'CPU', icon: '', actionType: 'SYSTEM_CPU' },
        ];
        const onButtonPress = vi.fn();
        const { container, rerender } = render(
            <ButtonGrid buttons={buttons} lastResult={null} systemStats={null} showLabels onButtonPress={onButtonPress} />,
        );
        const cells = container.querySelector('.button-grid')!.children;
        expect(cells).toHaveLength(32);
        expect(cells[0]).toHaveClass('empty');
        expect(cells[4]).toHaveTextContent('CPU');
        expect(cells[30]).toHaveClass('empty');
        expect(cells[31]).toHaveTextContent('Play');
        fireEvent.pointerUp(cells[31]);
        expect(onButtonPress).toHaveBeenCalledWith('play');

        rerender(<ButtonGrid buttons={[{ ...buttons[0], gridPosition: 12 }]} lastResult={null}
            systemStats={null} showLabels onButtonPress={onButtonPress} />);
        expect(cells[4]).toHaveClass('empty');
        expect(cells[12]).toHaveTextContent('Play');
        expect(cells[31]).toHaveClass('empty');
    });
});
