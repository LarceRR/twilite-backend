import { describe, expect, it } from 'vitest';

import { parseGeneratedTheme } from '../infrastructure/openRouterThemes.service';

const validColors = Object.fromEntries(
  [
    'surface',
    'surfaceRaised',
    'surfaceSunken',
    'surfaceDivider',
    'surfaceOverlay',
    'textPrimary',
    'textSecondary',
    'textTertiary',
    'textInverted',
    'accent',
    'accentSoft',
    'accentPressed',
    'accentOn',
    'secondary',
    'secondarySoft',
    'tertiary',
    'tertiarySoft',
    'positive',
    'negative',
    'warning',
    'glassTint',
    'glassRim',
    'glassRimAndroid',
    'glassFillAndroid',
    'controlActive',
    'controlInactive',
    'controlTrack',
    'scrim',
    'skeleton',
    'focusRing',
  ].map((key) => [key, '#AABBCC']),
);

describe('parseGeneratedTheme', () => {
  it('accepts a valid pack JSON', () => {
    const theme = parseGeneratedTheme(
      JSON.stringify({
        name: 'Закат',
        description: 'Тёплый вечер',
        colors: validColors,
        sceneBackgroundColors: ['#FF7A18', '#F7C98A', '#2A1A12'],
      }),
    );
    expect(theme.name).toBe('Закат');
    expect(theme.sceneBackgroundColors).toHaveLength(3);
  });

  it('rejects missing sky stops', () => {
    expect(() =>
      parseGeneratedTheme(
        JSON.stringify({
          name: 'Bad',
          description: '',
          colors: validColors,
          sceneBackgroundColors: ['#FF0000'],
        }),
      ),
    ).toThrow();
  });

  it('strips markdown fences', () => {
    const theme = parseGeneratedTheme(
      `\`\`\`json\n${JSON.stringify({
        name: 'Fence',
        description: '',
        colors: validColors,
        sceneBackgroundColors: ['#111111', '#222222'],
      })}\n\`\`\``,
    );
    expect(theme.name).toBe('Fence');
  });
});
