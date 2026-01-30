import { useState, useEffect, useCallback } from 'react';
import type { ProfileData } from '../types/profile';
import * as api from '../services/api';

export function useProfiles() {
    const [profiles, setProfiles] = useState<ProfileData[]>([]);
    const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadProfiles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await api.fetchProfiles();
            setProfiles(data);
            
            setActiveProfileId(prev => {
                if (prev === null && data.length > 0) {
                    return data[0].id;
                }
                return prev;
            });
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    const createProfile = useCallback(async (name: string) => {
        try {
            const newProfile = await api.createProfile(name);
            setProfiles(prev => [...prev, newProfile]);
            return newProfile;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create profile');
            throw e;
        }
    }, []);

    const updateProfile = useCallback(async (id: string, name: string) => {
        try {
            const updated = await api.updateProfile(id, name);
            setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
            return updated;
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to update profile');
            throw e;
        }
    }, []);

    const deleteProfile = useCallback(async (id: string) => {
        try {
            await api.deleteProfile(id);
            setProfiles(prev => prev.filter(p => p.id !== id));
            
            if (activeProfileId === id && profiles.length > 1) {
                const remaining = profiles.filter(p => p.id !== id);
                if (remaining.length > 0) {
                    setActiveProfileId(remaining[0].id);
                } else {
                    setActiveProfileId(null);
                }
            } else if (activeProfileId === id) {
                setActiveProfileId(null);
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to delete profile');
            throw e;
        }
    }, [activeProfileId, profiles]);

    const switchProfile = useCallback(async (profileId: string) => {
        try {
            await api.switchProfile(profileId);
            setActiveProfileId(profileId);
        } catch (e) {
            console.error('Failed to switch profile:', e);
            throw e;
        }
    }, []);

    return {
        profiles,
        activeProfileId,
        loading,
        error,
        loadProfiles,
        createProfile,
        updateProfile,
        deleteProfile,
        switchProfile,
    };
}

