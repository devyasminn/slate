import './PropertyPanel.css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Select from '@radix-ui/react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faRotateLeft, faTrash, faChevronDown, faChevronUp, faFolderOpen, faPalette, faBolt, faCheck } from '@fortawesome/free-solid-svg-icons';
import { open } from '@tauri-apps/plugin-dialog';
import type { ButtonData, NonSystemButtonData } from '../../types/button';
import { isSystemActionType } from '../../types/button';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { IconPicker } from '../IconPicker/IconPicker';
import { ACTION_TYPES, getActionConfig } from '../../config/actionTypes';
import { validatePathFormat } from '../../utils/pathUtils';
import { applyActionTypeChange } from '../../domain/buttonMutations';

interface PropertyPanelProps {
    button: ButtonData | null;
    isNew?: boolean;
    onPreview: (button: ButtonData) => void;
    onUpdate: (button: ButtonData) => void;
    onDelete: (buttonId: string) => void;
    onCancel?: () => void;
}

export function PropertyPanel({ button, isNew = false, onPreview, onUpdate, onDelete, onCancel }: PropertyPanelProps) {
    const [localButton, setLocalButton] = useState<ButtonData | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [isAppearanceCollapsed, setIsAppearanceCollapsed] = useState(false);
    const [isActionCollapsed, setIsActionCollapsed] = useState(false);
    const [pathWarning, setPathWarning] = useState<string | null>(null);

    useEffect(() => {
        setLocalButton(button);
        setHasChanges(false);
    }, [button]);

    const commit = useCallback((updated: ButtonData) => {
        setLocalButton(updated);
        setHasChanges(true);
        onPreview(updated);
    }, [onPreview]);

    const handleChange = useCallback((
        field: 'id' | 'label' | 'actionType' | 'actionPayload' | 'background',
        value: string | Record<string, unknown> | null
    ): void => {
        if (!localButton) return;
        commit({ ...localButton, [field]: value });
    }, [localButton, commit]);

    const handleNonSystemChange = useCallback((
        field: 'icon' | 'iconColor',
        value: string
    ): void => {
        if (!localButton || isSystemActionType(localButton.actionType)) return;
        commit({ ...localButton, [field]: value });
    }, [localButton, commit]);

    const handleActionTypeChange = useCallback((newType: ButtonData['actionType']) => {
        if (!localButton) return;
        const updated = applyActionTypeChange(localButton, newType);
        commit(updated);
    }, [localButton, commit]);

    const handlePayloadChange = useCallback((field: string, value: string) => {
        if (!localButton) return;
        commit({
            ...localButton,
            actionPayload: { ...localButton.actionPayload, [field]: value }
        });
    }, [localButton, commit]);

    const handleApply = useCallback(() => {
        if (localButton) {
            onUpdate(localButton);
            setHasChanges(false);
        }
    }, [localButton, onUpdate]);

    const handleCancel = useCallback(() => {
        if (isNew && onCancel) {
            onCancel();
        } else if (button) {
            setLocalButton(button);
            setHasChanges(false);
            onPreview(button);
        }
    }, [button, onPreview, isNew, onCancel]);

    const handleResetBackground = useCallback(() => {
        handleChange('background', '');
    }, [handleChange]);

    const handleResetIconColor = useCallback(() => {
        handleNonSystemChange('iconColor', '#ffffff');
    }, [handleNonSystemChange]);

    const handleDelete = useCallback(() => {
        setShowDeleteDialog(true);
    }, []);

    const handleConfirmDelete = useCallback(() => {
        if (localButton) {
            onDelete(localButton.id);
        }
    }, [localButton, onDelete]);

    const handleBrowsePath = useCallback(async () => {
        if (!localButton) return;

        try {
            let selected: string | string[] | null = null;

            if (localButton.actionType === 'APP_LAUNCH') {
                selected = await open({
                    multiple: false,
                    directory: false,
                    filters: [{
                        name: 'Executables',
                        extensions: ['exe', 'bat', 'cmd', 'msi', 'lnk']
                    }]
                });
            } else if (localButton.actionType === 'OPEN_FOLDER') {
                selected = await open({
                    multiple: false,
                    directory: true
                });
            }

            if (selected) {
                const path = Array.isArray(selected) ? selected[0] : selected;
                handlePayloadChange('path', path);
                const warning = validatePathFormat(path, localButton.actionType);
                setPathWarning(warning);
            }
        } catch (error) {
            console.error('Failed to open dialog:', error);
        }
    }, [localButton, handlePayloadChange]);

    useEffect(() => {
        if (!localButton) {
            setPathWarning(null);
            return;
        }

        const actionConfig = getActionConfig(localButton.actionType);
        if (!actionConfig?.payloadField || actionConfig.payloadField !== 'path') {
            setPathWarning(null);
            return;
        }

        const path = (localButton.actionPayload?.['path'] as string) || '';
        const warning = validatePathFormat(path, localButton.actionType);
        setPathWarning(warning);
    }, [localButton?.actionPayload, localButton?.actionType]);

    const canSubmit = useMemo(() => {
        if (!localButton) return false;
        if (!localButton.label.trim()) return false;
        const config = getActionConfig(localButton.actionType);
        if (config?.payloadField) {
            const value = localButton.actionPayload?.[config.payloadField];
            if (!value || !(value as string).trim()) return false;
        }
        return true;
    }, [localButton]);

    if (!localButton) {
        return (
            <div className="property-panel-empty">
                <p className="property-panel-empty-text">
                    Select a button to edit
                </p>
            </div>
        );
    }

    const currentActionConfig = ACTION_TYPES.find(a => a.value === localButton.actionType);

    return (
        <div className="property-panel" onClick={(e) => e.stopPropagation()}>
            {isNew && (
                <div className="property-panel-header">
                    <h2 className="property-panel-header-title">New Button</h2>
                </div>
            )}

            <div className="property-panel-content">
                <div className="property-panel-section">
                    <button
                        className="property-panel-section-header group"
                        onClick={() => setIsAppearanceCollapsed(!isAppearanceCollapsed)}
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                                <FontAwesomeIcon icon={faPalette} />
                            </div>
                            <h3 className="section-header">Appearance</h3>
                        </div>
                        <FontAwesomeIcon
                            icon={isAppearanceCollapsed ? faChevronDown : faChevronUp}
                            size="xs"
                            className="section-chevron"
                        />
                    </button>
                    {!isAppearanceCollapsed && (
                        <div className="space-y-4 property-panel-section-content">
                            <div className="space-y-1.5">
                                <label className="form-label">Label</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={localButton.label}
                                    onChange={(e) => handleChange('label', e.target.value)}
                                    placeholder="Button label"
                                />
                            </div>

                            {!isSystemActionType(localButton.actionType) && (
                                <div className="space-y-1.5">
                                    <label className="form-label">Icon</label>
                                    <IconPicker
                                        value={(localButton as NonSystemButtonData).icon || ''}
                                        onChange={(iconName) => handleNonSystemChange('icon', iconName)}
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="form-label">Background Color</label>
                                    {localButton.background && (
                                        <Tooltip.Root>
                                            <Tooltip.Trigger asChild>
                                                <button
                                                    onClick={handleResetBackground}
                                                    className="property-panel-reset-btn"
                                                >
                                                    <FontAwesomeIcon icon={faRotateLeft} size="xs" />
                                                    Reset
                                                </button>
                                            </Tooltip.Trigger>
                                            <Tooltip.Portal>
                                                <Tooltip.Content className="radix-tooltip-content" sideOffset={5}>
                                                    Reset to default
                                                    <Tooltip.Arrow className="radix-tooltip-arrow" />
                                                </Tooltip.Content>
                                            </Tooltip.Portal>
                                        </Tooltip.Root>
                                    )}
                                </div>
                                <ColorPicker
                                    key={`bg-${localButton.id}`}
                                    label=""
                                    value={localButton.background || '#222224'}
                                    onChange={(color) => handleChange('background', color)}
                                    showGradientOption={true}
                                />
                            </div>

                            {!isSystemActionType(localButton.actionType) && (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="form-label">Icon Color</label>
                                        {(localButton as NonSystemButtonData).iconColor &&
                                            (localButton as NonSystemButtonData).iconColor !== '#ffffff' && (
                                                <Tooltip.Root>
                                                    <Tooltip.Trigger asChild>
                                                        <button
                                                            onClick={handleResetIconColor}
                                                            className="property-panel-reset-btn"
                                                        >
                                                            <FontAwesomeIcon icon={faRotateLeft} size="xs" />
                                                            Reset
                                                        </button>
                                                    </Tooltip.Trigger>
                                                    <Tooltip.Portal>
                                                        <Tooltip.Content className="radix-tooltip-content" sideOffset={5}>
                                                            Reset to default
                                                            <Tooltip.Arrow className="radix-tooltip-arrow" />
                                                        </Tooltip.Content>
                                                    </Tooltip.Portal>
                                                </Tooltip.Root>
                                            )}
                                    </div>
                                    <ColorPicker
                                        key={`icon-${localButton.id}`}
                                        label=""
                                        value={(localButton as NonSystemButtonData).iconColor || '#ffffff'}
                                        onChange={(color) => handleNonSystemChange('iconColor', color)}
                                        showGradientOption={false}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="property-panel-divider" />

                <div className="property-panel-section">
                    <button
                        className="property-panel-section-header group"
                        onClick={() => setIsActionCollapsed(!isActionCollapsed)}
                    >
                        <div className="flex items-center gap-3 flex-1">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">
                                <FontAwesomeIcon icon={faBolt} />
                            </div>
                            <h3 className="section-header">Action</h3>
                        </div>
                        <FontAwesomeIcon
                            icon={isActionCollapsed ? faChevronDown : faChevronUp}
                            size="xs"
                            className="section-chevron"
                        />
                    </button>
                    {!isActionCollapsed && (
                        <div className="space-y-4 property-panel-section-content">
                            <div className="space-y-1.5">
                                <label className="form-label">Type</label>
                                <Select.Root value={localButton.actionType} onValueChange={handleActionTypeChange}>
                                    <Select.Trigger className="radix-select-trigger">
                                        <Select.Value />
                                        <Select.Icon className="radix-select-icon">
                                            <FontAwesomeIcon icon={faChevronDown} size="xs" />
                                        </Select.Icon>
                                    </Select.Trigger>
                                    <Select.Portal>
                                        <Select.Content className="radix-select-content" position="popper" sideOffset={4}>
                                            <Select.Viewport className="radix-select-viewport">
                                                {ACTION_TYPES.map(action => (
                                                    <Select.Item
                                                        key={action.value}
                                                        value={action.value}
                                                        className="radix-select-item"
                                                    >
                                                        <Select.ItemText>{action.label}</Select.ItemText>
                                                        <Select.ItemIndicator className="radix-select-item-indicator">
                                                            <FontAwesomeIcon icon={faCheck} />
                                                        </Select.ItemIndicator>
                                                    </Select.Item>
                                                ))}
                                            </Select.Viewport>
                                        </Select.Content>
                                    </Select.Portal>
                                </Select.Root>
                            </div>

                            {currentActionConfig?.payloadField && (
                                <div className="space-y-1.5">
                                    <label className="form-label capitalize">
                                        {currentActionConfig.payloadField}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className="form-input"
                                            style={{
                                                paddingLeft: (localButton.actionType === 'APP_LAUNCH' || localButton.actionType === 'OPEN_FOLDER')
                                                    ? '36px'
                                                    : undefined
                                            }}
                                            value={(localButton.actionPayload?.[currentActionConfig.payloadField] as string) || ''}
                                            onChange={(e) => {
                                                handlePayloadChange(currentActionConfig.payloadField!, e.target.value);
                                                const warning = validatePathFormat(e.target.value, localButton.actionType);
                                                setPathWarning(warning);
                                            }}
                                            placeholder={currentActionConfig.placeholder}
                                        />
                                        {(localButton.actionType === 'APP_LAUNCH' || localButton.actionType === 'OPEN_FOLDER') && (
                                            <button
                                                type="button"
                                                className="property-panel-browse-btn"
                                                onClick={handleBrowsePath}
                                                title={localButton.actionType === 'APP_LAUNCH' ? 'Browse for executable' : 'Browse for folder'}
                                            >
                                                <FontAwesomeIcon
                                                    icon={faFolderOpen}
                                                    size="xs"
                                                />
                                            </button>
                                        )}
                                    </div>
                                    {pathWarning && (
                                        <p className="property-panel-warning">{pathWarning}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="property-panel-footer">
                <div className="flex gap-2">
                    <button
                        className="btn flex-1"
                        onClick={handleCancel}
                        disabled={!hasChanges && !isNew}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary flex-1"
                        onClick={handleApply}
                        disabled={isNew ? !canSubmit : !hasChanges}
                    >
                        {isNew ? 'Create' : 'Apply'}
                    </button>
                </div>
                {!isNew && (
                    <button
                        className="property-panel-delete-btn"
                        onClick={handleDelete}
                    >
                        <FontAwesomeIcon icon={faTrash} size="xs" />
                        Delete Button
                    </button>
                )}
            </div>

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Button"
                description={`Are you sure you want to delete "${localButton.label}"? This action cannot be undone.`}
                confirmLabel="Delete"
                cancelLabel="Cancel"
                onConfirm={handleConfirmDelete}
                variant="danger"
            />
        </div>
    );
}
