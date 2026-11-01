import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { parseLinearGradient, gradientAngleToVector } from '../../utils/gradient';

interface StyledIconProps {
    icon: IconDefinition;
    paint?: string;
    className?: string;
}

export function StyledIcon({ icon, paint, className }: StyledIconProps) {
    const id = useId().replace(/:/g, '');
    const parsed = parseLinearGradient(paint || '');
    if (!parsed.isGradient) return <FontAwesomeIcon icon={icon} className={className} style={paint ? { color: paint } : undefined} />;
    const paths = Array.isArray(icon.icon[4]) ? icon.icon[4] : [icon.icon[4]];
    const vector = gradientAngleToVector(parsed.angle);
    return (
        <svg
            className={className}
            width="1em"
            height="1em"
            viewBox={`0 0 ${icon.icon[0]} ${icon.icon[1]}`}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
        >
            <defs>
                <linearGradient id={id} {...vector}>
                    <stop offset="0%" stopColor={parsed.color1} />
                    <stop offset="100%" stopColor={parsed.color2} />
                </linearGradient>
            </defs>
            {paths.map((d, i) => (
                <path key={i} fill={`url(#${id})`} d={d} />
            ))}
        </svg>
    );
}
