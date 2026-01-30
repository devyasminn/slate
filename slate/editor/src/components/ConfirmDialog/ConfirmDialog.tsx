import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    variant?: 'danger' | 'default';
}

export function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    variant = 'default',
}: ConfirmDialogProps) {
    const handleConfirm = () => {
        onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="radix-dialog-overlay" />
                <Dialog.Content className="radix-dialog-content">
                    <Dialog.Title className="radix-dialog-title">
                        {title}
                    </Dialog.Title>
                    <Dialog.Description className="radix-dialog-description">
                        {description}
                    </Dialog.Description>
                    <div className="radix-dialog-actions">
                        <button
                            className="btn"
                            onClick={() => onOpenChange(false)}
                        >
                            {cancelLabel}
                        </button>
                        <button
                            className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                            onClick={handleConfirm}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}











