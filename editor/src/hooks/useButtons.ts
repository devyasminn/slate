import { useState, useEffect, useCallback, useRef } from 'react';
import type { ButtonMove } from '../domain/buttonGrid';
import type { ButtonData } from '../types/button';
import * as api from '../services/api';

export function useButtons(profileId: string) {
    const [buttons, setButtons] = useState<ButtonData[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);

    const loadButtons = useCallback(async (signal?: AbortSignal) => {
        setError(null);
        try {
            const data = await api.fetchButtons(profileId, signal);
            if (!signal?.aborted) setButtons(data);
        } catch (e) {
            if (!signal?.aborted) setError(e instanceof Error ? e.message : 'Failed to load buttons');
        }
    }, [profileId]);

    useEffect(() => {
        const controller = new AbortController();
        void loadButtons(controller.signal);
        return () => controller.abort();
    }, [loadButtons]);

    async function save(operation: (current: ButtonData[]) => Promise<ButtonData[]>): Promise<boolean> {
        if (pending.current || !buttons) return false;

        pending.current = true;
        setSaving(true);
        setMutationError(null);
        try {
            setButtons(await operation(buttons));
            return true;
        } catch (e) {
            // A conflict or a lost response may mean the saved layout changed.
            await loadButtons();
            setMutationError(e instanceof Error ? e.message : 'Failed to save changes');
            return false;
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }

    return {
        buttons,
        error,
        mutationError,
        saving,
        createButton: (button: ButtonData) => save(async current => [...current, await api.createButton(button, profileId)]),
        updateButton: (button: ButtonData) => save(async current => {
            const updated = await api.updateButton(button, profileId);
            if (updated.gridPosition !== button.gridPosition) return api.fetchButtons(profileId);
            return current.map(item => item.id === updated.id ? updated : item);
        }),
        moveButton: (move: ButtonMove) => save(() => api.moveButton(move, profileId)),
        deleteButton: (buttonId: string) => save(async current => {
            await api.deleteButton(buttonId, profileId);
            return current.filter(item => item.id !== buttonId);
        }),
    };
}
