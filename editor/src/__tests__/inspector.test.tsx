import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as Tooltip from '@radix-ui/react-tooltip';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PropertyPanel } from '../components/PropertyPanel/PropertyPanel';
import type { ButtonData } from '../types/button';

let container: HTMLDivElement;
let root: Root;
const preview = vi.fn();
const update = vi.fn(async () => true);
const pending = vi.fn();
const saved: ButtonData = { id: 'one', gridPosition: 3, label: 'Next', actionType: 'MEDIA_NEXT', background: '', iconColor: '#ffffff' };

async function render(button: ButtonData | null = saved, isNew = false) {
    await act(async () => root.render(<Tooltip.Provider><PropertyPanel button={button} isNew={isNew}
        onPreview={preview} onUpdate={update} onDelete={vi.fn()} onCancel={vi.fn()}
        onPendingChange={pending} copiedStyle={null} onCopyStyle={vi.fn()} /></Tooltip.Provider>));
}
function button(text: string) {
    return [...container.querySelectorAll('button')].find(node => node.textContent === text)!;
}
async function click(node: HTMLElement) { await act(async () => node.click()); }
async function input(node: HTMLInputElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(node, value);
        node.dispatchEvent(new Event('input', { bubbles: true }));
    });
}
beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    vi.clearAllMocks();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });

it('keeps inheritance untouched on mount and preserves the existing gradient editing seed and serialization', async () => {
    await render();
    expect(preview).not.toHaveBeenCalled();
    expect(button('Apply').disabled).toBe(true);
    const background = container.querySelector('[role="group"][aria-labelledby]')!;
    await click([...background.querySelectorAll('button')].find(node => node.textContent === 'Gradient')!);
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ background: 'linear-gradient(135deg, #222224 0%, #1a1a1a 100%)' }));
    expect(container.querySelector('[aria-label="Background color gradient angle"]')?.getAttribute('aria-valuetext')).toBe('135 degrees');
    await click(button('Cancel'));
    expect(preview).toHaveBeenLastCalledWith(null);
    expect(button('Apply').disabled).toBe(true);
});

it('preserves Apply versus Create gating and associates fields and collapsible sections', async () => {
    await render();
    const label = [...container.querySelectorAll('label')].find(node => node.textContent === 'Label')!;
    await input(document.getElementById(label.htmlFor) as HTMLInputElement, '');
    expect(button('Apply').disabled).toBe(false);
    await click(button('Apply'));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ label: '', gridPosition: 3 }));
    await render({ ...saved, id: 'new' }, true);
    await input(document.getElementById(label.htmlFor) as HTMLInputElement, '');
    expect(button('Create').disabled).toBe(true);
    const header = container.querySelector<HTMLButtonElement>('.property-panel-section-header')!;
    expect(document.getElementById(header.getAttribute('aria-controls')!)).toBeTruthy();
    await click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
});

it('shows both gradient editors, then only supported system properties and conditional path fields', async () => {
    const gradient = 'linear-gradient(20deg, #386e44 0%, #6bb75f 100%)';
    await render({ ...saved, background: gradient, iconColor: gradient });
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(2);
    expect(container.querySelectorAll('[aria-label$="choose secondary color"]')).toHaveLength(2);
    await render({ id: 'system', gridPosition: 1, label: 'CPU', actionType: 'SYSTEM_CPU', background: gradient });
    expect(container.querySelectorAll('input[type="range"]')).toHaveLength(1);
    expect(container.querySelector('[aria-label="Icon color mode"]')).toBeNull();
    await render({ ...saved, id: 'path', actionType: 'APP_LAUNCH', actionPayload: { path: 'invalid' } });
    const path = container.querySelector<HTMLInputElement>('input[aria-describedby]')!;
    expect(document.getElementById(path.getAttribute('aria-describedby')!)?.textContent).toContain('Warning');
    expect(container.querySelector('[title="Browse for executable"]')).toBeTruthy();
    await render(null);
    expect(container.textContent).toBe('Select a button to edit');
});

