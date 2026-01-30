import './ButtonSlot.css';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import { resolveIcon } from '../../config/icons';
import type { ButtonData } from '../../types/button';
import { isSystemActionType } from '../../types/button';

interface ButtonSlotProps {
    button: ButtonData;
    isSelected: boolean;
    onSelect: () => void;
}

export function ButtonSlot({ button, isSelected, onSelect }: ButtonSlotProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: button.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        background: button.background || 'var(--bg-elevated)',
    };

    const icon = !isSystemActionType(button.actionType) && 'icon' in button && button.icon
        ? resolveIcon(button.icon)
        : null;
    const iconColor = !isSystemActionType(button.actionType) && 'iconColor' in button && button.iconColor
        ? button.iconColor
        : 'white';

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`button-slot ${isSelected ? 'selected' : ''}`}
            onClick={(e) => {
                e.stopPropagation();
                onSelect();
            }}
        >
            {icon && (
                <FontAwesomeIcon
                    icon={icon}
                    className="slot-icon"
                    style={{ color: iconColor }}
                />
            )}
            <span className="slot-label">
                {button.label}
            </span>
        </div>
    );
}

interface EmptyButtonSlotProps {
    onClick: () => void;
}

export function EmptyButtonSlot({ onClick }: EmptyButtonSlotProps) {
    return (
        <div className="button-slot empty" onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}>
            <FontAwesomeIcon icon={faPlus} className="text-[var(--text-disabled)] opacity-50" />
        </div>
    );
}

interface PreviewButtonSlotProps {
    button: ButtonData;
}

export function PreviewButtonSlot({ button }: PreviewButtonSlotProps) {
    const style = {
        background: button.background || 'var(--bg-elevated)',
    };

    const icon = !isSystemActionType(button.actionType) && 'icon' in button && button.icon
        ? resolveIcon(button.icon)
        : null;
    const iconColor = !isSystemActionType(button.actionType) && 'iconColor' in button && button.iconColor
        ? button.iconColor
        : 'white';

    return (
        <div
            style={style}
            className="button-slot selected"
        >
            {icon && (
                <FontAwesomeIcon
                    icon={icon}
                    className="slot-icon"
                    style={{ color: iconColor }}
                />
            )}
            <span className="slot-label">
                {button.label}
            </span>
        </div>
    );
}
