import { getContrastingTextColor } from './imageColors';

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
