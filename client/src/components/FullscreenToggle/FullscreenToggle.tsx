import './FullscreenToggle.css';
import { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { expandIcon, compressIcon } from '../../config/icons';

export function FullscreenToggle() {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
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

    if (!document.fullscreenEnabled) {
        return null;
    }

    return (
        <button
            className="fullscreen-toggle w-7 h-7 flex items-center justify-center bg-transparent border-none rounded-lg cursor-pointer"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen (ESC)' : 'Enter fullscreen'}
        >
            <FontAwesomeIcon
                icon={isFullscreen ? compressIcon : expandIcon}
                className="fullscreen-icon text-sm"
            />
        </button>
    );
}
