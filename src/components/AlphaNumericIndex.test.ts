import { buildAlphaNumericIndex, getAlphaNumericIndexAtPosition } from './AlphaNumericIndex';

declare const describe: (description: string, run: () => void) => void;
declare const it: (description: string, run: () => void) => void;
declare const expect: (actual: number | Array<{ label: string; targetId: string }>) => {
  toEqual(expected: Array<{ label: string; targetId: string }>): void;
  toBe(expected: number): void;
};

describe('buildAlphaNumericIndex', () => {
  it('includes each index label only once and preserves sorted-list target positions', () => {
    const tracks = [
      { name: 'Alpha' },
      { name: 'Another song' },
      { name: 'Beta' },
      { name: '1st track' },
      { name: '2nd track' },
      { name: '#hashtag' },
      { name: '★ star' },
      { name: '!exclaim' },
      { name: '?question' },
      { name: '… ellipsis' },
    ];

    expect(
      buildAlphaNumericIndex(
        tracks,
        (track) => track.name,
        (_track, index) => `track-${index}`
      )
    ).toEqual([
      { label: 'A', targetId: 'track-0' },
      { label: 'B', targetId: 'track-2' },
      { label: '1', targetId: 'track-3' },
      { label: '2', targetId: 'track-4' },
      { label: '#', targetId: 'track-5' },
      { label: '…', targetId: 'track-7' },
    ]);
  });
});

describe('getAlphaNumericIndexAtPosition', () => {
  it('maps a pointer using the index scroller offset and entry height', () => {
    expect(getAlphaNumericIndexAtPosition(9, 180, 18, 100)).toBe(10);
  });

  it('clamps pointer positions to the available entries', () => {
    expect(getAlphaNumericIndexAtPosition(-20, 0, 18, 100)).toBe(0);
    expect(getAlphaNumericIndexAtPosition(40, 1800, 18, 100)).toBe(99);
  });
});
