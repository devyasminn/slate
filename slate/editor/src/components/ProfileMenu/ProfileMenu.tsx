import './ProfileMenu.css';
import { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faCheck, faCog, faPlus, faPen, faTrash } from '@fortawesome/free-solid-svg-icons';
import type { ProfileData } from '../../types/profile';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';

import { CreateProfileDialog } from '../CreateProfileDialog/CreateProfileDialog';

interface ProfileMenuProps {
    profiles: ProfileData[];
    activeProfileId: string | null;
    onSwitchProfile: (profileId: string) => void;
    onCreateProfile: (name: string) => Promise<ProfileData>;
    onUpdateProfile: (id: string, name: string) => Promise<ProfileData>;
    onDeleteProfile: (id: string) => Promise<void>;
}

export function ProfileMenu({
    profiles,
    activeProfileId,
    onSwitchProfile,
    onCreateProfile,
    onUpdateProfile,
    onDeleteProfile,
}: ProfileMenuProps) {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [newProfileName, setNewProfileName] = useState('');
    const [editingProfile, setEditingProfile] = useState<ProfileData | null>(null);
    const [deletingProfile, setDeletingProfile] = useState<ProfileData | null>(null);

    const activeProfile = profiles.find(p => p.id === activeProfileId);

    const handleCreate = async (name: string) => {
        try {
            const newProfile = await onCreateProfile(name);
            setCreateDialogOpen(false);
            onSwitchProfile(newProfile.id);
        } catch (e) {
            console.error('Failed to create profile:', e);
        }
    };

    const handleEdit = async () => {
        if (!editingProfile || !newProfileName.trim()) return;
        try {
            await onUpdateProfile(editingProfile.id, newProfileName.trim());
            setNewProfileName('');
            setEditingProfile(null);
            setEditDialogOpen(false);
        } catch (e) {
            console.error('Failed to update profile:', e);
        }
    };

    const handleDelete = async () => {
        if (!deletingProfile) return;
        try {
            await onDeleteProfile(deletingProfile.id);
            setDeletingProfile(null);
            setDeleteDialogOpen(false);
        } catch (e) {
            console.error('Failed to delete profile:', e);
        }
    };

    const openEditDialog = (profile: ProfileData) => {
        setEditingProfile(profile);
        setNewProfileName(profile.name);
        setEditDialogOpen(true);
        setPopoverOpen(false);
    };

    const openDeleteDialog = (profile: ProfileData) => {
        setDeletingProfile(profile);
        setDeleteDialogOpen(true);
        setPopoverOpen(false);
    };

    return (
        <>
            <div className="editor-profile-menu" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <Select.Root
                    value={activeProfileId || undefined}
                    onValueChange={(value) => {
                        if (value) {
                            onSwitchProfile(value);
                        }
                    }}
                >
                    <Select.Trigger className="editor-profile-select-trigger">
                        <Select.Value placeholder="No profile" className="editor-profile-select-value" />
                        <Select.Icon className="editor-profile-select-icon">
                            <FontAwesomeIcon icon={faChevronDown} size="xs" />
                        </Select.Icon>
                    </Select.Trigger>

                    <Select.Portal>
                        <Select.Content className="editor-profile-select-content" position="popper" sideOffset={4}>
                            <Select.Viewport className="editor-profile-select-viewport">
                                {profiles.map((profile) => (
                                    <Select.Item
                                        key={profile.id}
                                        value={profile.id}
                                        className="editor-profile-select-item"
                                    >
                                        <Select.ItemText>{profile.name}</Select.ItemText>
                                        <Select.ItemIndicator className="editor-profile-select-indicator">
                                            <FontAwesomeIcon icon={faCheck} />
                                        </Select.ItemIndicator>
                                    </Select.Item>
                                ))}
                            </Select.Viewport>
                        </Select.Content>
                    </Select.Portal>
                </Select.Root>

                <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <Popover.Trigger asChild>
                        <button className="editor-profile-menu-button" aria-label="Profile actions">
                            <FontAwesomeIcon icon={faCog} />
                        </button>
                    </Popover.Trigger>
                    <Popover.Portal>
                        <Popover.Content className="editor-profile-popover-content" sideOffset={5}>
                            <div className="editor-profile-popover-actions">
                                <button
                                    className="editor-profile-popover-action"
                                    onClick={() => {
                                        setCreateDialogOpen(true);
                                        setPopoverOpen(false);
                                    }}
                                >
                                    <FontAwesomeIcon icon={faPlus} />
                                    Create Profile
                                </button>
                                {activeProfile && (
                                    <>
                                        <button
                                            className="editor-profile-popover-action"
                                            onClick={() => openEditDialog(activeProfile)}
                                        >
                                            <FontAwesomeIcon icon={faPen} />
                                            Edit Name
                                        </button>
                                        <button
                                            className="editor-profile-popover-action editor-profile-popover-action-danger"
                                            onClick={() => openDeleteDialog(activeProfile)}
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                            Delete Profile
                                        </button>
                                    </>
                                )}
                            </div>
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
            </div>

            {/* Create Profile Dialog */}
            <CreateProfileDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                onCreate={async (name) => {
                    await handleCreate(name);
                }}
            />

            {/* Edit Profile Dialog */}
            <Dialog.Root open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="radix-dialog-overlay" />
                    <Dialog.Content className="radix-dialog-content">
                        <Dialog.Title className="radix-dialog-title">
                            Edit Profile
                        </Dialog.Title>
                        <Dialog.Description className="radix-dialog-description">
                            Enter a new name for this profile.
                        </Dialog.Description>
                        <div className="radix-dialog-form">
                            <input
                                type="text"
                                className="input"
                                placeholder="Profile name"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleEdit();
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                        <div className="radix-dialog-actions">
                            <button
                                className="btn"
                                onClick={() => {
                                    setEditDialogOpen(false);
                                    setNewProfileName('');
                                    setEditingProfile(null);
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleEdit}
                                disabled={!newProfileName.trim()}
                            >
                                Save
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            {/* Delete Profile Dialog */}
            <ConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                title="Delete Profile"
                description={`Are you sure you want to delete "${deletingProfile?.name}"? This action cannot be undone and all buttons in this profile will be deleted.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={handleDelete}
                variant="danger"
            />
        </>
    );
}

