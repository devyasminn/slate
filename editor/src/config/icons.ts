import { library, findIconDefinition, type IconDefinition, type IconName } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { fab } from '@fortawesome/free-brands-svg-icons';

library.add(fas, fab);

/**
 * Resolve icon name to FontAwesome definition.
 * Tries solid icons first, then brands.
 */
export function resolveIcon(iconName: string): IconDefinition {
    const name = iconName as IconName;

    return findIconDefinition({ prefix: 'fas', iconName: name })
        || findIconDefinition({ prefix: 'fab', iconName: name })
        || fallbackIcon;
}

export const fallbackIcon = findIconDefinition({ prefix: 'fas', iconName: 'circle-question' })!;
