import type { ButtonData } from '../types/button';

/**
 * Validate path format for UX feedback.
 * Returns a warning string if the format looks incorrect, null otherwise.
 * Note: This is UX-only - backend is the source of truth for actual validation.
 */
export function validatePathFormat(
    path: string,
    actionType: ButtonData['actionType']
): string | null {
    if (!path) return null;

    if (actionType === 'APP_LAUNCH') {
        const executableExtensions = ['.exe', '.bat', '.cmd', '.msi', '.lnk'];
        const hasExtension = executableExtensions.some(ext =>
            path.toLowerCase().endsWith(ext.toLowerCase())
        );
        if (!hasExtension) {
            return 'Warning: format may be incorrect. Common extensions: .exe, .bat, .cmd';
        }
    } else if (actionType === 'OPEN_FOLDER') {
        if (path.includes('.')) {
            const lastPart = path.split(/[/\\]/).pop() || '';
            if (lastPart.includes('.') && !lastPart.startsWith('.')) {
                return 'Warning: format may be incorrect. Must be a directory, not a file.';
            }
        }
    }

    return null;
}
