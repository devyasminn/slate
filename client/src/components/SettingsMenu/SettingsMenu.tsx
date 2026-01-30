import { useState, useRef, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faExpand, faCompress, faTag, faSpa, faArrowLeft, faLayerGroup, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { Profile } from '../../types';

interface SettingsMenuProps {
    showLabels: boolean;
    onToggleLabels: (show: boolean) => void;
    zenMode: boolean;
    onToggleZenMode: (enabled: boolean) => void;
    profiles: Profile[];
    activeProfileId: string | null;
    onSwitchProfile: (profileId: string) => void;
    onOpenChange?: (isOpen: boolean) => void;
}

export function SettingsMenu({
    showLabels,
    onToggleLabels,
    zenMode,
    onToggleZenMode,
    profiles,
    activeProfileId,
    onSwitchProfile,
    onOpenChange,
}: SettingsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [showProfilesMenu, setShowProfilesMenu] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    useEffect(() => {
        onOpenChange?.(isOpen);
    }, [isOpen, onOpenChange]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setShowProfilesMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error('Error toggling fullscreen:', err);
        }
    };

    return (
        <div className="relative z-50 ml-3" ref={containerRef}>
            <button
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 
                    ${isOpen ? 'bg-[var(--color-bg-button-active)] text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[rgba(255,255,255,0.05)]'}
                `}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Settings"
            >
                <FontAwesomeIcon icon={faCog} className={`text-lg transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
            </button>

            <div
                className={`absolute right-0 top-full mt-2 w-64 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)] rounded-2xl shadow-xl overflow-hidden transition-all duration-200 origin-top-right
                    ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
                `}
            >
                {!showProfilesMenu ? (
                    <div className="p-2 flex flex-col gap-1">
                        {document.fullscreenEnabled && (
                            <button
                                onClick={toggleFullscreen}
                                className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] text-left text-[var(--color-text-primary)] transition-colors"
                            >
                                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)]">
                                    <FontAwesomeIcon icon={isFullscreen ? faCompress : faExpand} />
                                </div>
                                <span className="flex-1 font-medium text-sm">{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                            </button>
                        )}

                        <div className="h-px bg-[var(--color-border-empty)] mx-2 my-1"></div>

                        <button
                            onClick={() => setShowProfilesMenu(true)}
                            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] text-left text-[var(--color-text-primary)] transition-colors group"
                        >
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
                                <FontAwesomeIcon icon={faLayerGroup} />
                            </div>
                            <span className="flex-1 font-medium text-sm">Profiles</span>
                            <FontAwesomeIcon icon={faChevronRight} className="text-xs" />
                        </button>

                        <button
                            onClick={() => onToggleLabels(!showLabels)}
                            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] text-left text-[var(--color-text-primary)] transition-colors group"
                        >
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
                                <FontAwesomeIcon icon={faTag} />
                            </div>
                            <span className="flex-1 font-medium text-sm">Show Labels</span>
                            <div className={`w-9 h-5 rounded-full transition-colors ${showLabels ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${showLabels ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </div>
                        </button>

                        <button
                            onClick={() => onToggleZenMode(!zenMode)}
                            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] text-left text-[var(--color-text-primary)] transition-colors group"
                        >
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
                                <FontAwesomeIcon icon={faSpa} />
                            </div>
                            <span className="flex-1 font-medium text-sm">Zen Mode</span>
                            <div className={`w-9 h-5 rounded-full transition-colors ${zenMode ? 'bg-[var(--color-accent)]' : 'bg-[rgba(255,255,255,0.1)]'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform mt-0.5 ${zenMode ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="p-2 flex flex-col gap-1">
                        <button
                            onClick={() => setShowProfilesMenu(false)}
                            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] text-left text-[var(--color-text-primary)] transition-colors"
                        >
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--color-text-secondary)]">
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </div>
                            <span className="flex-1 font-medium text-sm">Back</span>
                        </button>

                        <div className="h-px bg-[var(--color-border-empty)] mx-2 my-1"></div>

                        {profiles.length === 0 ? (
                            <div className="p-3 text-center text-[var(--color-text-secondary)] text-sm">
                                No profiles available
                            </div>
                        ) : (
                            profiles.map((profile) => (
                                <button
                                    key={profile.id}
                                    onClick={() => onSwitchProfile(profile.id)}
                                    className={`flex items-center gap-3 w-full p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] text-left text-[var(--color-text-primary)] transition-colors ${activeProfileId === profile.id ? 'bg-[rgba(59,130,246,0.1)]' : ''
                                        }`}
                                >
                                    <span className="flex-1 font-medium text-sm">{profile.name}</span>

                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
