/** Button data from server */
export interface Button {
    id: string;
    label: string;
    icon: string;
    actionType: string;

    actionPayload?: Record<string, unknown>;

    /** Custom button background (CSS gradient or solid color) */
    background?: string;

    /** Custom icon color (CSS color value) */
    iconColor?: string;
}


/** Button pressed payload */
export interface ButtonPressedPayload {
    buttonId: string;
}

/** Action result from server */
export interface ActionResultPayload {
    buttonId: string;
    status: 'success' | 'error';
    message: string;
}

/** Buttons list from server */
export interface ButtonsListPayload {
    buttons: Button[];
}

/** Error payload */
export interface ErrorPayload {
    message: string;
}

/** Authentication result from server */
export interface AuthResultPayload {
    success: boolean;
    token?: string;
    error?: string;
}

/** Authentication state */
export type AuthStatus = 'authenticated' | 'unauthenticated' | 'pending';

/** WebSocket connection status */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/** System stats from server */
export interface SystemStatsPayload {
    cpu: number;
    ram: number;
    gpu: number | null;
}

/** Profile data from server */
export interface Profile {
    id: string;
    name: string;
    createdAt?: string;
    updatedAt?: string;
}

/** Profiles list from server */
export interface ProfilesListPayload {
    profiles: Profile[];
}

/** Profile switched payload */
export interface ProfileSwitchedPayload {
    profileId: string;
}

