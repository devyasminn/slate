export function parseLinearGradient(value: string): { isGradient: boolean; color1: string; color2: string; angle: number } {
    const match = value.match(/linear-gradient\((\d+)deg,\s*([#\w]+)\s*\d*%?,\s*([#\w]+)\s*\d*%?\)/);
    return match ? { isGradient: true, angle: parseInt(match[1], 10), color1: match[2], color2: match[3] }
        : { isGradient: false, color1: value || '#3a3a3a', color2: '#1a1a1a', angle: 135 };
}
export function buildLinearGradient(color1: string, color2: string, angle: number): string {
    return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
}
export function gradientAngleToVector(angle: number) {
    const radians = (angle - 90) * Math.PI / 180;
    const dx = Math.cos(radians), dy = Math.sin(radians);
    const scale = 0.5 / Math.max(Math.abs(dx), Math.abs(dy));
    return { x1: 0.5 - dx * scale, y1: 0.5 - dy * scale, x2: 0.5 + dx * scale, y2: 0.5 + dy * scale };
}
