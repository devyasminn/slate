import './ColorPicker.css';
import { useState, useCallback, useEffect } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Popover from '@radix-ui/react-popover';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
    label: string;
    value: string;
    onChange: (color: string) => void;
    showGradientOption?: boolean;
}

function parseGradient(value: string): { isGradient: boolean; color1: string; color2: string; angle: number } {
    const gradientMatch = value.match(/linear-gradient\((\d+)deg,\s*([#\w]+)\s*\d*%?,\s*([#\w]+)\s*\d*%?\)/);
    if (gradientMatch) {
        return {
            isGradient: true,
            angle: parseInt(gradientMatch[1], 10),
            color1: gradientMatch[2],
            color2: gradientMatch[3],
        };
    }
    return { isGradient: false, color1: value || '#3a3a3a', color2: '#1a1a1a', angle: 135 };
}

function buildGradient(color1: string, color2: string, angle: number): string {
    return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}

function HexInput({ color, onChange }: { color: string; onChange: (color: string) => void }) {
    const [input, setInput] = useState(color);

    useEffect(() => {
        setInput(color);
    }, [color]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInput(val);

        // Validate hex (with or without hash)
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            onChange(val);
        } else if (/^[0-9A-Fa-f]{6}$/.test(val)) {
            onChange('#' + val);
        }
    };

    const handleBlur = () => {
        // Reset to last valid color if invalid
        if (!/^#?[0-9A-Fa-f]{6}$/.test(input)) {
            setInput(color);
        } else if (!input.startsWith('#')) {
            setInput('#' + input);
        }
    };

    return (
        <input
            className="color-picker-hex-input"
            value={input}
            onChange={handleChange}
            onBlur={handleBlur}
            spellCheck={false}
        />
    );
}

export function ColorPicker({ label, value, onChange, showGradientOption = false }: ColorPickerProps) {
    // Initialize state from props only once per mount
    const [initialParsed] = useState(() => parseGradient(value));

    const [isGradient, setIsGradient] = useState(initialParsed.isGradient);
    const [color1, setColor1] = useState(initialParsed.color1);
    const [color2, setColor2] = useState(initialParsed.color2);
    const [angle, setAngle] = useState(initialParsed.angle);
    const [openColor1, setOpenColor1] = useState(false);
    const [openColor2, setOpenColor2] = useState(false);

    // Sync internal state when prop value changes (e.g. from Reset button)
    useEffect(() => {
        const parsed = parseGradient(value);
        setIsGradient(parsed.isGradient);
        setColor1(parsed.color1);
        setColor2(parsed.color2);
        setAngle(parsed.angle);
    }, [value]);

    const handleColor1Change = useCallback((newColor: string) => {
        setColor1(newColor);
        if (isGradient) {
            onChange(buildGradient(newColor, color2, angle));
        } else {
            onChange(newColor);
        }
    }, [isGradient, color2, angle, onChange]);

    const handleColor2Change = useCallback((newColor: string) => {
        setColor2(newColor);
        onChange(buildGradient(color1, newColor, angle));
    }, [color1, angle, onChange]);

    const handleAngleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newAngle = parseInt(e.target.value, 10);
        setAngle(newAngle);
        onChange(buildGradient(color1, color2, newAngle));
    }, [color1, color2, onChange]);

    const toggleGradient = useCallback((useGradient: boolean) => {
        setIsGradient(useGradient);
        if (useGradient) {
            onChange(buildGradient(color1, color2, angle));
        } else {
            onChange(color1);
        }
    }, [color1, color2, angle, onChange]);

    return (
        <div className="flex flex-col gap-2">
            {label && (
                <label className="form-label">
                    {label}
                </label>
            )}

            {showGradientOption && (
                <div className="color-picker-toggle-group">
                    <button
                        className={`color-picker-toggle-btn ${!isGradient ? 'color-picker-toggle-btn-active' : ''}`}
                        onClick={() => toggleGradient(false)}
                    >
                        Solid
                    </button>
                    <button
                        className={`color-picker-toggle-btn ${isGradient ? 'color-picker-toggle-btn-active' : ''}`}
                        onClick={() => toggleGradient(true)}
                    >
                        Gradient
                    </button>
                </div>
            )}

            <div className="flex gap-2">
                <Popover.Root open={openColor1} onOpenChange={setOpenColor1}>
                    <Tooltip.Root>
                        <Tooltip.Trigger asChild>
                            <Popover.Trigger asChild>
                                <button
                                    className={`color-swatch ${openColor1 ? 'color-swatch-active' : ''}`}
                                    style={{ background: color1 }}
                                />
                            </Popover.Trigger>
                        </Tooltip.Trigger>
                        <Tooltip.Portal>
                            <Tooltip.Content className="radix-tooltip-content" sideOffset={5}>
                                Primary color
                                <Tooltip.Arrow className="radix-tooltip-arrow" />
                            </Tooltip.Content>
                        </Tooltip.Portal>
                    </Tooltip.Root>
                    <Popover.Portal>
                        <Popover.Content className="radix-popover-content" sideOffset={8} align="start">
                            <HexColorPicker
                                color={color1}
                                onChange={handleColor1Change}
                                style={{ width: 200, height: 150 }}
                            />
                            <HexInput color={color1} onChange={handleColor1Change} />
                        </Popover.Content>
                    </Popover.Portal>
                </Popover.Root>
                {isGradient && (
                    <Popover.Root open={openColor2} onOpenChange={setOpenColor2}>
                        <Tooltip.Root>
                            <Tooltip.Trigger asChild>
                                <Popover.Trigger asChild>
                                    <button
                                        className={`color-swatch ${openColor2 ? 'color-swatch-active' : ''}`}
                                        style={{ background: color2 }}
                                    />
                                </Popover.Trigger>
                            </Tooltip.Trigger>
                            <Tooltip.Portal>
                                <Tooltip.Content className="radix-tooltip-content" sideOffset={5}>
                                    Secondary color
                                    <Tooltip.Arrow className="radix-tooltip-arrow" />
                                </Tooltip.Content>
                            </Tooltip.Portal>
                        </Tooltip.Root>
                        <Popover.Portal>
                            <Popover.Content className="radix-popover-content" sideOffset={8} align="start">
                                <HexColorPicker
                                    color={color2}
                                    onChange={handleColor2Change}
                                    style={{ width: 200, height: 150 }}
                                />
                                <HexInput color={color2} onChange={handleColor2Change} />
                            </Popover.Content>
                        </Popover.Portal>
                    </Popover.Root>
                )}
            </div>

            {isGradient && (
                <div className="flex flex-col gap-1">
                    <label className="color-picker-angle-label">
                        Angle: {angle}°
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="360"
                        value={angle}
                        onChange={handleAngleChange}
                        className="color-picker-slider"
                    />
                </div>
            )}


        </div>
    );
}
