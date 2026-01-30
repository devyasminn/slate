import { getCurrentWindow } from '@tauri-apps/api/window';
import { useState, useEffect } from 'react';
import './WindowControls.css';

export function WindowControls() {
    const [isMaximized, setIsMaximized] = useState(false);
    const appWindow = getCurrentWindow();

    useEffect(() => {
        const updateMaximizedState = async () => {
            const maximized = await appWindow.isMaximized();
            setIsMaximized(maximized);
        };

        updateMaximizedState();

        const unlisten = appWindow.onResized(() => {
            updateMaximizedState();
        });

        return () => {
            unlisten.then(f => f());
        };
    }, []);

    const minimize = () => appWindow.minimize();
    const toggleMaximize = async () => {
        await appWindow.toggleMaximize();
        setIsMaximized(!isMaximized);
    };
    const close = () => appWindow.close();

    return (
        <div className="window-controls">
            <button className="window-control-btn" onClick={minimize} title="Minimize">
                <svg className="window-control-icon" viewBox="0 0 12 12" style={{ width: '10px' }}>
                    <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
                </svg>
            </button>
            <button className="window-control-btn" onClick={toggleMaximize} title={isMaximized ? "Restore" : "Maximize"}>
                {isMaximized ? (
                    <svg className="window-control-icon" viewBox="0 0 12 12">
                        <path fill="currentColor" d="m 1.5,1.5 h 8 v 8 h -8 z m 1,1 v 6 h 6 v -6 z"></path>
                    </svg>
                ) : (
                    <svg className="window-control-icon" viewBox="0 0 12 12">
                        <rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor" strokeWidth="1"></rect>
                    </svg>
                )}
            </button>
            <button className="window-control-btn close" onClick={close} title="Close">
                <svg className="window-control-icon" viewBox="0 0 12 12">
                    <polygon fill="currentColor" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"></polygon>
                </svg>
            </button>
        </div>
    );
}
