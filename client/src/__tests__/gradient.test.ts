import { describe, expect, it } from 'vitest';
import { buildLinearGradient, gradientAngleToVector, parseLinearGradient } from '../utils/gradient';

describe('gradient utilities', () => {
    it('parses and builds the existing Slate serialization', () => {
        const gradient = 'linear-gradient(135deg, #ff0000 0%, #0000ff 100%)';
        expect(parseLinearGradient(gradient)).toEqual({ isGradient: true, angle: 135, color1: '#ff0000', color2: '#0000ff' });
        expect(buildLinearGradient('#ff0000', '#0000ff', 135)).toBe(gradient);
    });

    it.each([[0, [0.5, 1, 0.5, 0]], [90, [0, 0.5, 1, 0.5]], [180, [0.5, 0, 0.5, 1]], [270, [1, 0.5, 0, 0.5]], [135, [0, 0, 1, 1]]])(
        'converts angle %i to normalized vector', (angle, expected) => {
            const vector = gradientAngleToVector(angle);
            expect([vector.x1, vector.y1, vector.x2, vector.y2]).toEqual(expected.map(x => expect.closeTo(x, 8)));
        },
    );

    it('returns non-gradient data for invalid input', () => {
        expect(parseLinearGradient('not a gradient')).toEqual({ isGradient: false, color1: 'not a gradient', color2: '#1a1a1a', angle: 135 });
    });
});
