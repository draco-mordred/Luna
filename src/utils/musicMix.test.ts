import type { Track } from '../services/MusicLibrary';
import { createMusicMix } from './musicMix';

declare const describe: (description: string, run: () => void) => void;
declare const it: (description: string, run: () => void) => void;
declare const expect: (actual: unknown) => {
  toEqual(expected: unknown): void;
};

const createTrack = (overrides: Partial<Track> = {}): Track => ({
  id: 'track',
  path: 'track.mp3',
  filename: 'track.mp3',
  name: 'Track',
  artist: 'Artist',
  album: 'Album',
  duration: 180,
  format: 'mp3',
  size: 1,
  lastModified: 0,
  ...overrides,
});

describe('createMusicMix', () => {
  it('ranks tracks with matching artist and genre ahead of unrelated tracks', () => {
    const seed = createTrack({ id: 'seed', genre: 'Electronic' });
    const sameArtist = createTrack({
      id: 'artist-match',
      name: 'Artist match',
      genre: 'Electronic',
    });
    const sameGenre = createTrack({
      id: 'genre-match',
      artist: 'Different Artist',
      genre: 'Electronic',
    });
    const unrelated = createTrack({ id: 'unrelated', artist: 'Another Artist', genre: 'Jazz' });

    expect(createMusicMix(seed, [unrelated, sameGenre, sameArtist])).toEqual([
      sameArtist,
      sameGenre,
    ]);
  });

  it('excludes the seed, streaming tracks, and tracks already queued', () => {
    const seed = createTrack({ id: 'seed' });
    const queued = createTrack({ id: 'queued' });
    const streamed = createTrack({ id: 'streamed', streamingProvider: 'jamendo' });
    const mix = createMusicMix(seed, [seed, queued, streamed], new Set(['queued']));

    expect(mix).toEqual([]);
  });

  it('uses favorites and play history to rank tracks when metadata is sparse', () => {
    const seed = createTrack({ id: 'seed', artist: 'Unknown', genre: undefined });
    const loved = createTrack({ id: 'loved', artist: 'Other', genre: undefined });
    const oftenPlayed = createTrack({ id: 'often-played', artist: 'Different', genre: undefined });
    const rarelyPlayed = createTrack({ id: 'rarely-played', artist: 'Another', genre: undefined });
    const mix = createMusicMix(seed, [rarelyPlayed, oftenPlayed, loved], new Set(), {
      lovedTrackIds: new Set(['loved']),
      playCounts: { 'often-played': 12 },
    });

    expect(mix).toEqual([loved, oftenPlayed]);
  });

  it('uses matching composers as a similarity signal', () => {
    const seed = createTrack({ id: 'seed', composer: 'Composer One' });
    const composerMatch = createTrack({
      id: 'composer-match',
      artist: 'Different Artist',
      genre: 'Jazz',
      composer: 'Composer One',
    });
    const unrelated = createTrack({
      id: 'unrelated',
      artist: 'Another Artist',
      genre: 'Pop',
      composer: 'Composer Two',
    });

    expect(
      createMusicMix(seed, [unrelated, composerMatch], new Set(), {}, 24, {
        requireSimilarity: true,
      })
    ).toEqual([composerMatch]);
  });

  it('does not use unrelated tracks when similarity is required', () => {
    const seed = createTrack({ id: 'seed', genre: undefined });
    const unrelated = createTrack({
      id: 'unrelated',
      artist: 'Another Artist',
      genre: 'Pop',
      composer: 'Composer Two',
    });

    expect(
      createMusicMix(seed, [unrelated], new Set(), {}, 24, { requireSimilarity: true })
    ).toEqual([]);
  });

  it('limits the generated mix', () => {
    const seed = createTrack({ id: 'seed', genre: 'Pop' });
    const candidates = Array.from({ length: 5 }, (_, index) =>
      createTrack({ id: `candidate-${index}`, genre: 'Pop' })
    );

    expect(createMusicMix(seed, candidates, new Set(), {}, 2).length).toEqual(2);
  });
});
