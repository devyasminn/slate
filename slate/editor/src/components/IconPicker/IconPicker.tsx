import './IconPicker.css';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { resolveIcon } from '../../config/icons';
import { ICON_NAMES } from '../../generated/iconNames';

interface IconPickerProps {
    value: string;
    onChange: (iconName: string) => void;
}

const MAX_RESULTS = 15;

export function IconPicker({ value, onChange }: IconPickerProps) {
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    // Sync input value when prop changes
    useEffect(() => {
        setInputValue(value);
    }, [value]);

    // Filter icons based on input (substring match)
    const filteredIcons = useMemo(() => {
        const search = inputValue.toLowerCase().trim();
        if (!search) {
            // Show some popular icons when empty
            return ['play', 'pause', 'star', 'heart', 'check', 'times', 'home', 'user', 'search', 'cog'];
        }
        return ICON_NAMES
            .filter(name => name.includes(search))
            .slice(0, MAX_RESULTS);
    }, [inputValue]);

    // Reset highlight when results change
    useEffect(() => {
        setHighlightedIndex(0);
    }, [filteredIcons]);

    // Scroll highlighted item into view
    useEffect(() => {
        if (listRef.current && open) {
            const highlighted = listRef.current.querySelector('.icon-picker-result-active');
            if (highlighted) {
                highlighted.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [highlightedIndex, open]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value;
        setInputValue(newValue);
        setOpen(true);
    }, []);

    const handleSelect = useCallback((iconName: string) => {
        setInputValue(iconName);
        onChange(iconName);
        setOpen(false);
    }, [onChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!open) {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                setOpen(true);
                e.preventDefault();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setHighlightedIndex(prev =>
                    prev < filteredIcons.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setHighlightedIndex(prev => prev > 0 ? prev - 1 : 0);
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredIcons[highlightedIndex]) {
                    handleSelect(filteredIcons[highlightedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setOpen(false);
                setInputValue(value); // Reset to original value
                break;
        }
    }, [open, filteredIcons, highlightedIndex, handleSelect, value]);

    const handleFocus = useCallback(() => {
        setOpen(true);
    }, []);

    const handleBlur = useCallback(() => {
        // Small delay to allow click events on results to fire
        setTimeout(() => {
            if (inputValue !== value) {
                onChange(inputValue);
            }
        }, 150);
    }, [inputValue, value, onChange]);

    // Resolve current icon for preview
    const currentIcon = useMemo(() => {
        if (!inputValue) return null;
        try {
            return resolveIcon(inputValue);
        } catch {
            return null;
        }
    }, [inputValue]);

    useEffect(() => {
        if (open && inputRef.current) {
            // Force a reflow/measurement to ensure correct width
            if (inputRef.current.parentElement) {

                const wrapperWidth = inputRef.current.parentElement.offsetWidth;
                document.documentElement.style.setProperty('--icon-picker-trigger-width', `${wrapperWidth}px`);
            }
        }
    }, [open]);

    return (
        <div className="icon-picker">
            <Popover.Root open={open} onOpenChange={setOpen}>
                <Popover.Anchor asChild>
                    <div className="icon-picker-input-wrapper">
                        {currentIcon && (
                            <span className="icon-picker-preview">
                                <FontAwesomeIcon icon={currentIcon} />
                            </span>
                        )}
                        <input
                            ref={inputRef}
                            type="text"
                            className="form-input icon-picker-input"
                            value={inputValue}
                            onChange={handleInputChange}
                            onClick={() => setOpen(true)}
                            onKeyDown={handleKeyDown}
                            onFocus={handleFocus}
                            onBlur={handleBlur}
                            placeholder="Search icons..."
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                </Popover.Anchor>
                <Popover.Portal>
                    <Popover.Content
                        className="icon-picker-popover"
                        sideOffset={4}
                        align="start"
                        style={{ width: 'var(--icon-picker-trigger-width)' } as any}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                    >
                        <div className="icon-picker-results" ref={listRef}>
                            {filteredIcons.length === 0 ? (
                                <div className="icon-picker-empty">
                                    No icons found
                                </div>
                            ) : (
                                filteredIcons.map((iconName, index) => {
                                    const iconDef = resolveIcon(iconName);
                                    return (
                                        <button
                                            key={iconName}
                                            type="button"
                                            className={`icon-picker-result ${index === highlightedIndex ? 'icon-picker-result-active' : ''}`}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelect(iconName);
                                            }}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                        >
                                            <span className="icon-picker-result-icon">
                                                <FontAwesomeIcon icon={iconDef} />
                                            </span>
                                            <span className="icon-picker-result-name">
                                                {iconName}
                                            </span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    );
}
