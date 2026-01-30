import './Header.css';
import { ProfileMenu } from '../ProfileMenu/ProfileMenu';
import { ConnectionDialog } from '../ConnectionDialog/ConnectionDialog';
import { WindowControls } from '../WindowControls/WindowControls';
import type { ProfileData } from '../../types/profile';

interface HeaderProps {
    profiles: ProfileData[];
    activeProfileId: string | null;
    onSwitchProfile: (profileId: string) => void;
    onCreateProfile: (name: string) => Promise<ProfileData>;
    onUpdateProfile: (id: string, name: string) => Promise<ProfileData>;
    onDeleteProfile: (id: string) => Promise<void>;
}

export function Header({
    profiles,
    activeProfileId,
    onSwitchProfile,
    onCreateProfile,
    onUpdateProfile,
    onDeleteProfile,
}: HeaderProps) {
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
                <ProfileMenu
                    profiles={profiles}
                    activeProfileId={activeProfileId}
                    onSwitchProfile={onSwitchProfile}
                    onCreateProfile={onCreateProfile}
                    onUpdateProfile={onUpdateProfile}
                    onDeleteProfile={onDeleteProfile}
                />
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

