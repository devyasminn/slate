import { describe, it, expect } from 'vitest';
import {
    ACTION_TYPES,
    getActionConfig,
    requiresPayload,
    getPayloadField,
} from '../config/actionTypes';

describe('actionTypes', () => {
    describe('ACTION_TYPES', () => {
        it('should contain all 13 action types', () => {
            expect(ACTION_TYPES).toHaveLength(13);
        });

        it('should have unique values', () => {
            const values = ACTION_TYPES.map(a => a.value);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });
    });

    describe('getActionConfig', () => {
        it('should return config for OPEN_URL', () => {
            const config = getActionConfig('OPEN_URL');
            expect(config).toBeDefined();
            expect(config?.label).toBe('Open URL');
            expect(config?.payloadField).toBe('url');
            expect(config?.placeholder).toBe('https://...');
        });

        it('should return config for APP_LAUNCH', () => {
            const config = getActionConfig('APP_LAUNCH');
            expect(config).toBeDefined();
            expect(config?.payloadField).toBe('path');
        });

        it('should return config for HOTKEY', () => {
            const config = getActionConfig('HOTKEY');
            expect(config).toBeDefined();
            expect(config?.payloadField).toBe('hotkey');
        });

        it('should return config for system action SYSTEM_CPU', () => {
            const config = getActionConfig('SYSTEM_CPU');
            expect(config).toBeDefined();
            expect(config?.label).toBe('System CPU');
            expect(config?.payloadField).toBeNull();
        });

        it('should return undefined for invalid action type', () => {
            // @ts-expect-error Testing invalid input
            const config = getActionConfig('INVALID_TYPE');
            expect(config).toBeUndefined();
        });
    });

    describe('requiresPayload', () => {
        it('should return true for OPEN_URL', () => {
            expect(requiresPayload('OPEN_URL')).toBe(true);
        });

        it('should return true for APP_LAUNCH', () => {
            expect(requiresPayload('APP_LAUNCH')).toBe(true);
        });

        it('should return true for HOTKEY', () => {
            expect(requiresPayload('HOTKEY')).toBe(true);
        });

        it('should return true for OPEN_FOLDER', () => {
            expect(requiresPayload('OPEN_FOLDER')).toBe(true);
        });

        it('should return false for MEDIA_PLAY_PAUSE', () => {
            expect(requiresPayload('MEDIA_PLAY_PAUSE')).toBe(false);
        });

        it('should return false for system actions', () => {
            expect(requiresPayload('SYSTEM_CPU')).toBe(false);
            expect(requiresPayload('SYSTEM_RAM')).toBe(false);
            expect(requiresPayload('SYSTEM_GPU')).toBe(false);
        });
    });

    describe('getPayloadField', () => {
        it('should return "url" for OPEN_URL', () => {
            expect(getPayloadField('OPEN_URL')).toBe('url');
        });

        it('should return "path" for APP_LAUNCH', () => {
            expect(getPayloadField('APP_LAUNCH')).toBe('path');
        });

        it('should return "path" for OPEN_FOLDER', () => {
            expect(getPayloadField('OPEN_FOLDER')).toBe('path');
        });

        it('should return "hotkey" for HOTKEY', () => {
            expect(getPayloadField('HOTKEY')).toBe('hotkey');
        });

        it('should return null for actions without payload', () => {
            expect(getPayloadField('MEDIA_PLAY_PAUSE')).toBeNull();
            expect(getPayloadField('VOLUME_UP')).toBeNull();
            expect(getPayloadField('SYSTEM_CPU')).toBeNull();
        });
    });
});
