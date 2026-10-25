import { artistCreditIncludes, splitArtistCredits } from './artistCredits';

declare const describe: (description: string, run: () => void) => void;
declare const it: (description: string, run: () => void) => void;
declare const expect: (actual: unknown) => {
  toEqual(expected: unknown): void;
  toBe(expected: unknown): void;
};

describe('splitArtistCredits', () => {
  it('splits common featuring words and separators into individual artists', () => {
    expect(splitArtistCredits('Artist One feat. Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One FT Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One featuring Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One x Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One, Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One & Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One; Artist Two')).toEqual(['Artist One', 'Artist Two']);
    expect(splitArtistCredits('Artist One / Artist Two')).toEqual(['Artist One', 'Artist Two']);
  });

  it('does not split an x that is part of an artist name', () => {
    expect(splitArtistCredits('X Ambassadors')).toEqual(['X Ambassadors']);
  });

  it('removes duplicate artist names without changing their display order', () => {
    expect(splitArtistCredits('Artist One feat. artist one')).toEqual(['Artist One']);
  });
});

describe('artistCreditIncludes', () => {
  it('matches an individual artist in a collaborative credit case-insensitively', () => {
    expect(artistCreditIncludes('Artist One feat. Artist Two', 'artist two')).toBe(true);
  });

  it('does not match a partial artist name', () => {
    expect(artistCreditIncludes('Artist One feat. Artist Two', 'Artist')).toBe(false);
  });
});
