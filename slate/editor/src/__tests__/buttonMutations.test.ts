import { describe, it, expect } from 'vitest';
import { applyActionTypeChange, applyPayloadChange } from '../domain/buttonMutations';
import type { ButtonData, NonSystemButtonData, SystemButtonData } from '../types/button';

describe('buttonMutations', () => {
    describe('applyActionTypeChange', () => {
        const baseNonSystemButton: NonSystemButtonData = {
            id: 'test-1',
            label: 'Test Button',
            actionType: 'OPEN_URL',
            actionPayload: { url: 'https://example.com' },
            background: '#ff0000',
            icon: 'fa-home',
            iconColor: '#00ff00',
        };

        const baseSystemButton: SystemButtonData = {
            id: 'test-2',
            label: 'CPU Monitor',
            actionType: 'SYSTEM_CPU',
            actionPayload: null,
            background: '#0000ff',
        };

        describe('non-system → system transition', () => {
            it('should remove icon and iconColor when changing to system type', () => {
                const updated = applyActionTypeChange(baseNonSystemButton, 'SYSTEM_CPU');

                expect(updated.actionType).toBe('SYSTEM_CPU');
                expect('icon' in updated).toBe(false);
                expect('iconColor' in updated).toBe(false);
            });

            it('should preserve id, label, and background', () => {
                const updated = applyActionTypeChange(baseNonSystemButton, 'SYSTEM_RAM');

                expect(updated.id).toBe(baseNonSystemButton.id);
                expect(updated.label).toBe(baseNonSystemButton.label);
                expect(updated.background).toBe(baseNonSystemButton.background);
            });

            it('should reset payload to null for system actions', () => {
                const updated = applyActionTypeChange(baseNonSystemButton, 'SYSTEM_GPU');

                expect(updated.actionPayload).toBeNull();
            });
        });

        describe('system → non-system transition', () => {
            it('should allow icon and iconColor fields', () => {
                const updated = applyActionTypeChange(baseSystemButton, 'OPEN_URL') as NonSystemButtonData;

                // Should have these fields (even if undefined)
                expect('icon' in updated).toBe(true);
                expect('iconColor' in updated).toBe(true);
            });

            it('should preserve id, label, and background', () => {
                const updated = applyActionTypeChange(baseSystemButton, 'APP_LAUNCH');

                expect(updated.id).toBe(baseSystemButton.id);
                expect(updated.label).toBe(baseSystemButton.label);
                expect(updated.background).toBe(baseSystemButton.background);
            });

            it('should reset payload to new type format', () => {
                const updated = applyActionTypeChange(baseSystemButton, 'APP_LAUNCH');

                expect(updated.actionPayload).toEqual({ path: '' });
            });
        });

        describe('non-system → non-system transition', () => {
            it('should preserve icon and iconColor', () => {
                const updated = applyActionTypeChange(baseNonSystemButton, 'APP_LAUNCH') as NonSystemButtonData;

                expect(updated.icon).toBe(baseNonSystemButton.icon);
                expect(updated.iconColor).toBe(baseNonSystemButton.iconColor);
            });

            it('should reset payload to new type format', () => {
                const buttonWithUrl = { ...baseNonSystemButton, actionPayload: { url: 'https://old.com' } };
                const updated = applyActionTypeChange(buttonWithUrl, 'APP_LAUNCH');

                expect(updated.actionPayload).toEqual({ path: '' });
            });

            it('should set correct payload field for each type', () => {
                expect(applyActionTypeChange(baseNonSystemButton, 'OPEN_URL').actionPayload).toEqual({ url: '' });
                expect(applyActionTypeChange(baseNonSystemButton, 'APP_LAUNCH').actionPayload).toEqual({ path: '' });
                expect(applyActionTypeChange(baseNonSystemButton, 'HOTKEY').actionPayload).toEqual({ hotkey: '' });
                expect(applyActionTypeChange(baseNonSystemButton, 'OPEN_FOLDER').actionPayload).toEqual({ path: '' });
            });

            it('should set null payload for actions without payload field', () => {
                expect(applyActionTypeChange(baseNonSystemButton, 'MEDIA_PLAY_PAUSE').actionPayload).toBeNull();
                expect(applyActionTypeChange(baseNonSystemButton, 'VOLUME_UP').actionPayload).toBeNull();
            });
        });
    });

    describe('applyPayloadChange', () => {
        const button: NonSystemButtonData = {
            id: 'test-1',
            label: 'Test',
            actionType: 'OPEN_URL',
            actionPayload: { url: 'https://old.com' },
            background: '#000',
        };

        it('should update the specified payload field', () => {
            const updated = applyPayloadChange(button, 'url', 'https://new.com');

            expect(updated.actionPayload?.url).toBe('https://new.com');
        });

        it('should preserve other button fields', () => {
            const updated = applyPayloadChange(button, 'url', 'https://new.com');

            expect(updated.id).toBe(button.id);
            expect(updated.label).toBe(button.label);
            expect(updated.actionType).toBe(button.actionType);
            expect(updated.background).toBe(button.background);
        });

        it('should work with null initial payload', () => {
            const buttonNullPayload: ButtonData = { ...button, actionPayload: null };
            const updated = applyPayloadChange(buttonNullPayload, 'url', 'https://example.com');

            expect(updated.actionPayload?.url).toBe('https://example.com');
        });

        it('should preserve other payload fields', () => {
            const buttonMultiPayload: ButtonData = {
                ...button,
                actionPayload: { url: 'old', extra: 'preserved' }
            };
            const updated = applyPayloadChange(buttonMultiPayload, 'url', 'new');

            expect(updated.actionPayload?.url).toBe('new');
            expect(updated.actionPayload?.extra).toBe('preserved');
        });
    });
});
