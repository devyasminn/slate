import { useState, useEffect, useCallback } from 'react';
import type { ButtonData } from '../types/button';
import * as api from '../services/api';

export function useButtons(profileId?: string | null) {
    const [buttons, setButtons] = useState<ButtonData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadButtons = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.fetchButtons(profileId || undefined);
            setButtons(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [profileId]);

    useEffect(() => {
        loadButtons();
    }, [loadButtons]);

    const updateButton = useCallback(async (button: ButtonData) => {
        try {
            const updated = await api.updateButton(button, profileId || undefined);
            setButtons(prev => prev.map(b => b.id === updated.id ? updated : b));
            return updated;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update');
            throw e;
        }
    }, [profileId]);

    const reorderButtons = useCallback(async (newOrder: ButtonData[]) => {
        const previousButtons = buttons;
        setButtons(newOrder);

        try {
            const buttonIds = newOrder.map(b => b.id);
            await api.reorderButtons(buttonIds, profileId || undefined);
        } catch (e) {
            setButtons(previousButtons);
            setError(e instanceof Error ? e.message : 'Failed to reorder');
            throw e;
        }
    }, [buttons, profileId]);

    const deleteButton = useCallback(async (buttonId: string) => {
        try {
            await api.deleteButton(buttonId, profileId || undefined);
            setButtons(prev => prev.filter(b => b.id !== buttonId));
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete');
            throw e;
        }
    }, [profileId]);

    return {
        buttons,
        loading,
        error,
        loadButtons,
        updateButton,
        reorderButtons,
        deleteButton,
    };
}
