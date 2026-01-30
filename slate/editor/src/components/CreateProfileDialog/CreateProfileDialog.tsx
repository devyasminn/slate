import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';

interface CreateProfileDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreate: (name: string) => Promise<void>;
}

export function CreateProfileDialog({
    open,
    onOpenChange,
    onCreate
}: CreateProfileDialogProps) {
    const [name, setName] = useState('');

    const handleCreate = async () => {
        if (!name.trim()) return;
        await onCreate(name.trim());
        setName('');
        onOpenChange(false);
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="radix-dialog-overlay" />
                <Dialog.Content className="radix-dialog-content">
                    <Dialog.Title className="radix-dialog-title">
                        Create Profile
                    </Dialog.Title>
                    <Dialog.Description className="radix-dialog-description">
                        Enter a name for the new profile.
                    </Dialog.Description>
                    <div className="radix-dialog-form">
                        <input
                            type="text"
                            className="input"
                            placeholder="Profile name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleCreate();
                                }
                            }}
                            autoFocus
                        />
                    </div>
                    <div className="radix-dialog-actions">
                        <button
                            className="btn"
                            onClick={() => {
                                onOpenChange(false);
                                setName('');
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleCreate}
                            disabled={!name.trim()}
                        >
                            Create
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
