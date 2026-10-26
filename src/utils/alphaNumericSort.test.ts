import { compareAlphaNumericFirst, sortByTrackTitle } from './alphaNumericSort';

declare const describe: (description: string, run: () => void) => void;
declare const it: (description: string, run: () => void) => void;
declare const expect: (actual: number | string[]) => {
  toEqual(expected: string[]): void;
  toBeLessThan(expected: number): void;
};

describe('compareAlphaNumericFirst', () => {
  it('orders letters before numbers and symbols in ascending order', () => {
    const values = ['#hashtag', '2nd track', 'Alpha', '!exclaim', '1st track', 'Beta'];

    expect(values.sort((left, right) => compareAlphaNumericFirst(left, right, 'asc'))).toEqual([
      'Alpha',
      'Beta',
      '1st track',
      '2nd track',
      '!exclaim',
      '#hashtag',
    ]);
  });

  describe('sortByTrackTitle', () => {
    it('sorts only by the song title, ignoring filename and other fields', () => {
      const tracks = [
        { name: 'Zebra Song', filename: '01-first.mp3' },
        { name: ' Alpha Song ', filename: '99-last.mp3' },
        { name: '5th Song', filename: '00-middle.mp3' },
        { name: '#Hidden Title', filename: '02-second.mp3' },
      ];

      expect(sortByTrackTitle(tracks, 'asc').map((track) => track.name)).toEqual([
        ' Alpha Song ',
        'Zebra Song',
        '5th Song',
        '#Hidden Title',
      ]);
    });
  });

  it('keeps the letters, numbers, symbols group order in descending order', () => {
    const values = ['#hashtag', '2nd track', 'Alpha', '!exclaim', '1st track', 'Beta'];

    expect(values.sort((left, right) => compareAlphaNumericFirst(left, right, 'desc'))).toEqual([
      'Beta',
      'Alpha',
      '2nd track',
      '1st track',
      '#hashtag',
      '!exclaim',
    ]);
  });

  it('compares numeric values numerically within their group', () => {
    expect(compareAlphaNumericFirst(2, 10, 'asc')).toBeLessThan(0);
  });
});
