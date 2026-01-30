import './MonitorButton.css';
import type { Button } from '../../types';

interface MonitorButtonProps {
    button: Button;
    value: number | null;
}

/**
 * Display-only button that shows system stats.
 * Text-only design: label on top, value below.
 */
export function MonitorButton({ button, value }: MonitorButtonProps) {
    const displayValue = value !== null ? `${value}%` : '--';

    const customStyle: Record<string, string> = {};
    if (button.background) {
        customStyle['--button-custom-bg'] = button.background;
    }
    if (button.iconColor) {
        customStyle['--button-icon-color'] = button.iconColor;
    }

    const hasCustomBg = !!button.background;

    return (
        <div
            className={`action-button monitor-button ${hasCustomBg ? 'has-custom-bg' : ''}`}
            style={Object.keys(customStyle).length > 0 ? customStyle : undefined}
        >
            <span className="monitor-label">{button.label}</span>
            <span className="monitor-value">{displayValue}</span>
        </div>
    );
}
