// Fonte única de verdade para system action types
export const SYSTEM_ACTION_TYPES = ['SYSTEM_CPU', 'SYSTEM_RAM', 'SYSTEM_GPU'] as const;

// Derivar SystemActionType a partir da constante
export type SystemActionType = typeof SYSTEM_ACTION_TYPES[number];

// Todos os outros action types
export type NonSystemActionType =
    | 'OPEN_URL'
    | 'APP_LAUNCH'
    | 'HOTKEY'
    | 'OPEN_FOLDER'
    | 'MEDIA_PLAY_PAUSE'
    | 'MEDIA_NEXT'
    | 'MEDIA_PREV'
    | 'VOLUME_UP'
    | 'VOLUME_DOWN'
    | 'VOLUME_MUTE';

// Helper runtime para type narrowing
export function isSystemActionType(actionType: string): actionType is SystemActionType {
    return SYSTEM_ACTION_TYPES.includes(actionType as SystemActionType);
}

// Base comum para ambos os tipos
interface BaseButtonData {
    id: string;
    label: string;
    actionType: SystemActionType | NonSystemActionType;
    actionPayload?: Record<string, unknown> | null;
    background?: string;
}

// Botão de sistema: não possui icon nem iconColor
export interface SystemButtonData extends BaseButtonData {
    actionType: SystemActionType;
    // icon e iconColor não existem aqui
}

// Botão não-system: possui icon e iconColor opcionais
export interface NonSystemButtonData extends BaseButtonData {
    actionType: NonSystemActionType;
    icon?: string;
    iconColor?: string;
}

// Union type discriminada
export type ButtonData = SystemButtonData | NonSystemButtonData;

export interface ButtonsResponse {
    buttons: ButtonData[];
}
