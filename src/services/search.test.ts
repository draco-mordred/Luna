import { buildSearchGroups } from './search';
import type { Track } from './MusicLibrary';

declare const describe: (description: string, run: () => void) => void;
declare const it: (description: string, run: () => void) => void;
declare const expect: (actual: unknown) => {
  toEqual(expected: unknown): void;
};

const composerTrack: Track = {
  id: 'track-1',
  path: 'track-1.mp3',
  filename: 'Symphony.mp3',
  name: 'Symphony',
  artist: 'Orchestra',
  album: 'Collected Works',
  duration: 180,
  format: 'mp3',
  size: 1,
  lastModified: 0,
  composer: 'Ada Composer',
};

describe('buildSearchGroups', () => {
  it('includes composer matches only when requested', () => {
    const defaultGroups = buildSearchGroups([composerTrack], 'Ada');
    const androidGroups = buildSearchGroups([composerTrack], 'Ada', true);

    expect(defaultGroups.some((group) => group.title === 'Composers')).toEqual(false);
    expect(
      androidGroups
        .find((group) => group.title === 'Composers')
        ?.items.map(({ type, title }) => ({ type, title }))
    ).toEqual([{ type: 'composer', title: 'Ada Composer' }]);
  });
});
