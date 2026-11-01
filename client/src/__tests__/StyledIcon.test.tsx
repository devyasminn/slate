import { render, screen } from '@testing-library/react';
import { faCoffee } from '@fortawesome/free-solid-svg-icons';
import { describe, expect, it } from 'vitest';
import { StyledIcon } from '../components/StyledIcon/StyledIcon';

describe('StyledIcon gradient rendering', () => {
    it('preserves SVG sizing and viewBox with unique gradient references and every path', () => {
        const multiPathIcon = { ...faCoffee, icon: [512, 400, [], '', ['M0 0h10', 'M20 20h10']] as typeof faCoffee.icon };
        render(<><StyledIcon icon={multiPathIcon} paint="linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" /><StyledIcon icon={multiPathIcon} paint="linear-gradient(90deg, #ff0000 0%, #0000ff 100%)" /></>);
        const svgs = Array.from(document.querySelectorAll('svg'));
        expect(svgs).toHaveLength(2);
        const ids = svgs.map(svg => svg.querySelector('linearGradient')?.id);
        expect(ids[0]).not.toBe(ids[1]);
        for (const svg of svgs) {
            expect(svg).toHaveAttribute('width', '1em');
            expect(svg).toHaveAttribute('height', '1em');
            expect(svg).toHaveAttribute('viewBox', '0 0 512 400');
            expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
            expect(svg.querySelectorAll('path')).toHaveLength(2);
            expect(svg.querySelector('path')).toHaveAttribute('fill', `url(#${svg.querySelector('linearGradient')?.id})`);
        }
    });
});
