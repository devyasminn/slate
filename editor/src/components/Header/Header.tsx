import './Header.css';
import { ProfileMenu } from '../ProfileMenu/ProfileMenu';
import { ConnectionDialog } from '../ConnectionDialog/ConnectionDialog';
import { WindowControls } from '../WindowControls/WindowControls';
import type { ComponentProps } from 'react';

export function Header(profileMenuProps: ComponentProps<typeof ProfileMenu>) {
    return (
        <header
            className="editor-header"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="editor-header-left">
                <div className="editor-header-logo" aria-hidden="true" />
                <div className="editor-header-title-group">
                    <span className="editor-header-title">Slate</span>
                    <span className="editor-header-subtitle">Editor</span>
                </div>
                <div className="editor-header-separator" />
                <ProfileMenu {...profileMenuProps} />
            </div>

            {/* Right - Connection Dialog */}
            <div
                className="editor-header-right"
                style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
                <ConnectionDialog />
                <WindowControls />
            </div>
        </header>
    );
}

