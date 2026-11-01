import { describe, expect, it } from 'vitest';
import { buildLinearGradient, gradientAngleToVector, parseLinearGradient } from '../utils/gradient';

describe('gradient utilities', () => {
    it('parses Slate gradient strings', () => {
        expect(parseLinearGradient('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)')).toEqual({
            isGradient: true, angle: 135, color1: '#ff0000', color2: '#0000ff',
        });
    });

    it('builds the existing serialized format', () => {
        expect(buildLinearGradient('#ff0000', '#0000ff', 135)).toBe('linear-gradient(135deg, #ff0000 0%, #0000ff 100%)');
    });

    it.each([
        [0, [0.5, 1, 0.5, 0]],
        [90, [0, 0.5, 1, 0.5]],
        [180, [0.5, 0, 0.5, 1]],
        [270, [1, 0.5, 0, 0.5]],
        [135, [0, 0, 1, 1]],
    ])('converts angle %i to normalized vector', (angle, expected) => {
        const vector = gradientAngleToVector(angle);
        expect([vector.x1, vector.y1, vector.x2, vector.y2]).toEqual(expected.map(x => expect.closeTo(x, 8)));
    });

    it('keeps solid input as non-gradient and supplies the default for empty input', () => {
        expect(parseLinearGradient('#abcdef')).toEqual({ isGradient: false, color1: '#abcdef', color2: '#1a1a1a', angle: 135 });
        expect(parseLinearGradient('')).toEqual({ isGradient: false, color1: '#3a3a3a', color2: '#1a1a1a', angle: 135 });
    });
});
