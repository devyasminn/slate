import type {
    ButtonData,
    SystemButtonData,
    NonSystemButtonData,
} from '../types/button';
import { isSystemActionType } from '../types/button';
import { getActionConfig } from '../config/actionTypes';

/**
 * Apply an action type change to a button, handling discriminated union transitions.
 * 
 * Key behaviors:
 * - Changing to a system action removes icon/iconColor fields
 * - Changing to a non-system action preserves/allows icon/iconColor
 * - Payload is reset based on the new action type's requirements
 */
export function applyActionTypeChange(
    button: ButtonData,
    newType: ButtonData['actionType']
): ButtonData {
    const actionConfig = getActionConfig(newType);
    const newPayload = actionConfig?.payloadField
        ? { [actionConfig.payloadField]: '' }
        : null;

    if (isSystemActionType(newType)) {
        const updated: SystemButtonData = {
            id: button.id,
            label: button.label,
            actionType: newType,
            actionPayload: newPayload,
            background: button.background,
        };
        return updated;
    } else {
        const updated: NonSystemButtonData = {
            id: button.id,
            label: button.label,
            actionType: newType,
            actionPayload: newPayload,
            background: button.background,
            icon: 'icon' in button ? button.icon : undefined,
            iconColor: 'iconColor' in button ? button.iconColor : undefined,
        };
        return updated;
    }
}

/**
 * Apply a payload field change to a button.
 */
export function applyPayloadChange(
    button: ButtonData,
    field: string,
    value: string
): ButtonData {
    return {
        ...button,
        actionPayload: { ...button.actionPayload, [field]: value },
    };
}

export interface ButtonStyle {
    background: string | undefined;
    iconColor?: string;
}

/** Extract only the visual properties supported by Slate buttons. */
export function extractButtonStyle(button: ButtonData): ButtonStyle {
    if (isSystemActionType(button.actionType)) return { background: button.background };
    const nonSystemButton = button as NonSystemButtonData;
    return { background: nonSystemButton.background, iconColor: nonSystemButton.iconColor || '#ffffff' };
}

/** Apply a copied visual style without changing any non-style button state. */
export function applyButtonStyle(button: ButtonData, style: ButtonStyle): ButtonData {
    if (isSystemActionType(button.actionType)) {
        return { ...button, background: style.background };
    }
    return {
        ...button,
        background: style.background,
        ...(style.iconColor !== undefined ? { iconColor: style.iconColor } : {}),
    };
}
