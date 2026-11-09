import './ButtonGrid.css';
import type { ReactNode } from 'react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    rectIntersection,
    useDroppable,
    useSensor,
    useSensors,
    type CollisionDetection,
    type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { getButtonMove, getGridCells, type ButtonMove } from '../../domain/buttonGrid';
import type { ButtonData } from '../../types/button';
import { ButtonSlot, EmptyButtonSlot, PreviewButtonSlot } from '../ButtonSlot/ButtonSlot';

interface ButtonGridProps {
    buttons: ButtonData[];
    selectedId: string | null;
    draftButton?: ButtonData | null;
    onSelect: (id: string) => void;
    onMove: (move: ButtonMove) => void;
    onCreate: (position: number) => void;
}

function GridCell({ position, reserved, children }: { position: number; reserved: boolean; children: ReactNode }) {
    const { setNodeRef, isOver } = useDroppable({ id: position, disabled: reserved });

    return (
        <div ref={setNodeRef} className="editor-grid-cell" data-position={position} data-over={isOver || undefined}>
            {children}
        </div>
    );
}

const detectCell: CollisionDetection = (args) =>
    args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

export function ButtonGrid({ buttons, selectedId, draftButton, onSelect, onMove, onCreate }: ButtonGridProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const cells = getGridCells(buttons);

    function handleDragEnd({ active, over }: DragEndEvent) {
        if (typeof active.id !== 'number' || typeof over?.id !== 'number') return;
        const move = getButtonMove(cells, active.id, over.id);
        if (move) onMove(move);
    }

    return (
        <div className="button-grid-container">
            <DndContext sensors={sensors} collisionDetection={detectCell} onDragEnd={handleDragEnd}>
                <div className="editor-button-grid">
                    {cells.map((button, position) => {
                        const draft = !button && draftButton?.gridPosition === position ? draftButton : null;
                        return (
                            <GridCell key={position} position={position} reserved={!!draft}>
                                {button ? (
                                    <ButtonSlot
                                        key={button.id}
                                        button={button}
                                        isSelected={selectedId === button.id}
                                        onSelect={() => onSelect(button.id)}
                                    />
                                ) : draft ? (
                                    <PreviewButtonSlot button={draft} />
                                ) : (
                                    <EmptyButtonSlot position={position} onClick={() => onCreate(position)} />
                                )}
                            </GridCell>
                        );
                    })}
                </div>
            </DndContext>
        </div>
    );
}
