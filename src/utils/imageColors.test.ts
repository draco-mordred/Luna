import {
  createArtworkPaletteFromPixels,
  getArtworkPaletteButtonColors,
  getContrastingTextColor,
} from './imageColors';

declare const describe: (description: string, run: () => void) => void;
declare const it: (description: string, run: () => void) => void;
declare const expect: (actual: string) => {
  toBe(expected: string): void;
};

describe('getContrastingTextColor', () => {
  it('uses dark text for light artwork colors', () => {
    expect(getContrastingTextColor('240, 240, 240')).toBe('#0b0b0b');
  });

  it('uses light text for dark artwork colors', () => {
    expect(getContrastingTextColor('12, 12, 12')).toBe('#fff');
  });

  it('falls back to light text for invalid color values', () => {
    expect(getContrastingTextColor('not-an-rgb-color')).toBe('#fff');
  });
});

describe('artwork palette extraction', () => {
  it('returns the three darkest and brightest sampled colors', () => {
    const palette = createArtworkPaletteFromPixels(
      new Uint8ClampedArray([
        0, 0, 0, 255, 40, 40, 40, 255, 80, 80, 80, 255, 175, 175, 175, 255, 215, 215, 215, 255, 255,
        255, 255, 255,
      ])
    );

    expect(palette?.darkest[0] ?? '').toBe('rgb(0, 0, 0)');
    expect(palette?.darkest[2] ?? '').toBe('rgb(80, 80, 80)');
    expect(palette?.brightest[0] ?? '').toBe('rgb(175, 175, 175)');
    expect(palette?.brightest[2] ?? '').toBe('rgb(255, 255, 255)');
  });

  it('uses the dark or light palette side based on the theme', () => {
    const palette = createArtworkPaletteFromPixels(new Uint8ClampedArray([40, 40, 40, 255]));
    if (!palette) throw new Error('Expected a palette for an opaque artwork pixel.');

    const colorsOnDarkTheme = getArtworkPaletteButtonColors(palette, true);
    const colorsOnLightTheme = getArtworkPaletteButtonColors(palette, false);

    expect(colorsOnDarkTheme.background).toBe('rgb(0, 0, 0)');
    expect(colorsOnDarkTheme.foreground).toBe('rgb(255, 255, 255)');
    expect(colorsOnDarkTheme.iconColor).toBe('rgb(191, 191, 191)');
    expect(colorsOnLightTheme.background).toBe('rgb(255, 255, 255)');
    expect(colorsOnLightTheme.foreground).toBe('rgb(0, 0, 0)');
    expect(colorsOnLightTheme.iconColor).toBe('rgb(64, 64, 64)');
  });
});
