import { describe, it, expect } from 'vitest';
import { validatePathFormat } from '../utils/pathUtils';

describe('validatePathFormat', () => {
    describe('APP_LAUNCH validation', () => {
        it('should return null for valid .exe path', () => {
            expect(validatePathFormat('C:\\Program Files\\app.exe', 'APP_LAUNCH')).toBeNull();
        });

        it('should return null for valid .bat path', () => {
            expect(validatePathFormat('C:\\scripts\\run.bat', 'APP_LAUNCH')).toBeNull();
        });

        it('should return null for valid .cmd path', () => {
            expect(validatePathFormat('C:\\scripts\\setup.cmd', 'APP_LAUNCH')).toBeNull();
        });

        it('should return null for valid .msi path', () => {
            expect(validatePathFormat('C:\\installers\\app.msi', 'APP_LAUNCH')).toBeNull();
        });

        it('should return null for valid .lnk path', () => {
            expect(validatePathFormat('C:\\shortcuts\\app.lnk', 'APP_LAUNCH')).toBeNull();
        });

        it('should return warning for path without executable extension', () => {
            const warning = validatePathFormat('C:\\folder\\document.txt', 'APP_LAUNCH');
            expect(warning).not.toBeNull();
            expect(warning).toContain('Warning');
            expect(warning).toContain('.exe');
        });

        it('should return warning for path without extension', () => {
            const warning = validatePathFormat('C:\\folder\\myapp', 'APP_LAUNCH');
            expect(warning).not.toBeNull();
        });

        it('should return null for empty path', () => {
            expect(validatePathFormat('', 'APP_LAUNCH')).toBeNull();
        });

        it('should be case-insensitive for extensions', () => {
            expect(validatePathFormat('App.EXE', 'APP_LAUNCH')).toBeNull();
            expect(validatePathFormat('Script.BAT', 'APP_LAUNCH')).toBeNull();
        });
    });

    describe('OPEN_FOLDER validation', () => {
        it('should return null for folder path without extension', () => {
            expect(validatePathFormat('C:\\Users\\Documents', 'OPEN_FOLDER')).toBeNull();
        });

        it('should return null for special folder name', () => {
            expect(validatePathFormat('Downloads', 'OPEN_FOLDER')).toBeNull();
        });

        it('should return warning for path that looks like a file', () => {
            const warning = validatePathFormat('C:\\folder\\file.pdf', 'OPEN_FOLDER');
            expect(warning).not.toBeNull();
            expect(warning).toContain('Warning');
            expect(warning).toContain('directory');
        });

        it('should return null for dotfiles (hidden folders)', () => {
            // Paths like .git, .config should be valid folders
            expect(validatePathFormat('C:\\project\\.git', 'OPEN_FOLDER')).toBeNull();
        });

        it('should return null for empty path', () => {
            expect(validatePathFormat('', 'OPEN_FOLDER')).toBeNull();
        });
    });

    describe('other action types', () => {
        it('should not validate OPEN_URL paths', () => {
            // OPEN_URL has url field, not path - validation doesn't apply
            expect(validatePathFormat('any-value', 'OPEN_URL')).toBeNull();
        });

        it('should not validate HOTKEY', () => {
            expect(validatePathFormat('ctrl+c', 'HOTKEY')).toBeNull();
        });

        it('should not validate media actions', () => {
            expect(validatePathFormat('anything', 'MEDIA_PLAY_PAUSE')).toBeNull();
            expect(validatePathFormat('anything', 'VOLUME_UP')).toBeNull();
        });

        it('should not validate system actions', () => {
            expect(validatePathFormat('anything', 'SYSTEM_CPU')).toBeNull();
            expect(validatePathFormat('anything', 'SYSTEM_RAM')).toBeNull();
        });
    });
});
