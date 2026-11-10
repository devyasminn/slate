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
import * as ContextMenu from '@radix-ui/react-context-menu';
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
    canPaste: boolean;
    onCopy: (button: ButtonData) => void;
    onDuplicate: (button: ButtonData) => void;
    canDuplicate: (button: ButtonData) => boolean;
    onPaste: (position: number) => void;
}

function GridCell({ position, reserved, button, canPaste, canDuplicate, onCopy, onDuplicate, onPaste, onCreate, children }: {
    position: number; reserved: boolean; button?: ButtonData; canPaste: boolean; canDuplicate: (button: ButtonData) => boolean;
    onCopy: (button: ButtonData) => void; onDuplicate: (button: ButtonData) => void;
    onPaste: (position: number) => void; onCreate: (position: number) => void; children: ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: position, disabled: reserved });

    return (
        <ContextMenu.Root>
            <ContextMenu.Trigger asChild>
                <div ref={setNodeRef} className="editor-grid-cell" data-position={position} data-over={isOver || undefined}>
                    {children}
                </div>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
                <ContextMenu.Content className="button-context-menu">
                    {button ? <>
                        <ContextMenu.Item className="button-context-menu-item" onSelect={() => onCopy(button)}>Copy Button</ContextMenu.Item>
                        <ContextMenu.Item className="button-context-menu-item" disabled={!canDuplicate(button)} onSelect={() => onDuplicate(button)}>Duplicate</ContextMenu.Item>
                    </> : <>
                        <ContextMenu.Item className="button-context-menu-item" disabled={reserved || !canPaste} onSelect={() => onPaste(position)}>Paste Button</ContextMenu.Item>
                        <ContextMenu.Separator className="button-context-menu-separator" />
                        <ContextMenu.Item className="button-context-menu-item" disabled={reserved} onSelect={() => onCreate(position)}>Create Button</ContextMenu.Item>
                    </>}
                </ContextMenu.Content>
            </ContextMenu.Portal>
        </ContextMenu.Root>
    );
}

const detectCell: CollisionDetection = (args) =>
    args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

export function ButtonGrid({ buttons, selectedId, draftButton, onSelect, onMove, onCreate, canPaste, onCopy, onDuplicate, canDuplicate, onPaste }: ButtonGridProps) {
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
                            <GridCell key={position} position={position} reserved={!!draft} button={button} canPaste={canPaste} canDuplicate={canDuplicate}
                                onCopy={onCopy} onDuplicate={onDuplicate} onPaste={onPaste} onCreate={onCreate}>
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
