import type { ButtonData, SystemActionType, NonSystemActionType } from '../types/button';

export type ActionType = SystemActionType | NonSystemActionType;

export interface ActionTypeConfig {
    value: ButtonData['actionType'];
    label: string;
    payloadField: 'url' | 'path' | 'hotkey' | null;
    placeholder: string;
}

export const ACTION_TYPES: ActionTypeConfig[] = [
    { value: 'OPEN_URL', label: 'Open URL', payloadField: 'url', placeholder: 'https://...' },
    { value: 'APP_LAUNCH', label: 'Launch App', payloadField: 'path', placeholder: 'C:\\path\\to\\app.exe' },
    { value: 'HOTKEY', label: 'Hotkey', payloadField: 'hotkey', placeholder: 'win+n, ctrl+c...' },
    { value: 'OPEN_FOLDER', label: 'Open Folder', payloadField: 'path', placeholder: 'Downloads, or full path' },
    { value: 'MEDIA_PLAY_PAUSE', label: 'Media Play/Pause', payloadField: null, placeholder: '' },
    { value: 'MEDIA_NEXT', label: 'Media Next', payloadField: null, placeholder: '' },
    { value: 'MEDIA_PREV', label: 'Media Previous', payloadField: null, placeholder: '' },
    { value: 'VOLUME_UP', label: 'Volume Up', payloadField: null, placeholder: '' },
    { value: 'VOLUME_DOWN', label: 'Volume Down', payloadField: null, placeholder: '' },
    { value: 'VOLUME_MUTE', label: 'Volume Mute', payloadField: null, placeholder: '' },
    { value: 'SYSTEM_CPU', label: 'System CPU', payloadField: null, placeholder: '' },
    { value: 'SYSTEM_RAM', label: 'System RAM', payloadField: null, placeholder: '' },
    { value: 'SYSTEM_GPU', label: 'System GPU', payloadField: null, placeholder: '' },
];

/**
 * Get configuration for a specific action type.
 */
export function getActionConfig(actionType: ButtonData['actionType']): ActionTypeConfig | undefined {
    return ACTION_TYPES.find(a => a.value === actionType);
}

/**
 * Check if an action type requires a payload field.
 */
export function requiresPayload(actionType: ButtonData['actionType']): boolean {
    const config = getActionConfig(actionType);
    return config?.payloadField !== null && config?.payloadField !== undefined;
}

/**
 * Get the payload field name for an action type.
 */
export function getPayloadField(actionType: ButtonData['actionType']): 'url' | 'path' | 'hotkey' | null {
    const config = getActionConfig(actionType);
    return config?.payloadField ?? null;
}
