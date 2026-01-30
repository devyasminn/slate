import './ButtonGrid.css';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { ButtonData } from '../../types/button';
import { ButtonSlot, EmptyButtonSlot, PreviewButtonSlot } from '../ButtonSlot/ButtonSlot';

interface ButtonGridProps {
    buttons: ButtonData[];
    selectedId: string | null;
    previewButtonId?: string | null;
    onSelect: (id: string) => void;
    onReorder: (buttons: ButtonData[]) => void;
    onCreate: () => void;
}

export function ButtonGrid({ buttons, selectedId, previewButtonId, onSelect, onReorder, onCreate }: ButtonGridProps) {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const sortableButtons = buttons.filter(b => b.id !== previewButtonId);
    const previewButton = previewButtonId ? buttons.find(b => b.id === previewButtonId) : null;

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = sortableButtons.findIndex(b => b.id === active.id);
            const newIndex = sortableButtons.findIndex(b => b.id === over.id);
            const newOrder = arrayMove(sortableButtons, oldIndex, newIndex);
            onReorder(newOrder);
        }
    }

    const TOTAL_SLOTS = 32;

    return (
        <div className="button-grid-container">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <div className="editor-button-grid">
                    <SortableContext items={sortableButtons.map(b => b.id)} strategy={rectSortingStrategy}>
                        {sortableButtons.map(button => (
                            <ButtonSlot
                                key={button.id}
                                button={button}
                                isSelected={selectedId === button.id}
                                onSelect={() => onSelect(button.id)}
                            />
                        ))}
                    </SortableContext>

                    {previewButton && (
                        <PreviewButtonSlot key={previewButton.id} button={previewButton} />
                    )}

                    {Array.from({ length: Math.max(0, TOTAL_SLOTS - buttons.length) }).map((_, index) => (
                        <EmptyButtonSlot key={`empty-${buttons.length + index}`} onClick={onCreate} />
                    ))}
                </div>
            </DndContext>
        </div>
    );
}
