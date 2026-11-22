import type { Track } from '../services/MusicLibrary';
import { splitArtistCredits } from './artistCredits';

const normalize = (value: string) => value.trim().toLocaleLowerCase();

const getArtists = (track: Track) =>
  new Set(
    [...splitArtistCredits(track.artist), ...splitArtistCredits(track.albumArtist ?? '')]
      .map(normalize)
      .filter(Boolean)
  );

const getGenres = (track: Track) =>
  new Set(
    (track.genre ?? '')
      .split(/[,;/|]/)
      .map(normalize)
      .filter(Boolean)
  );

const getComposers = (track: Track) =>
  new Set(
    splitArtistCredits(track.composer ?? '')
      .map(normalize)
      .filter(Boolean)
  );

const hasOverlap = (first: Set<string>, second: Set<string>) =>
  Array.from(first).some((value) => second.has(value));

const shuffle = <T>(items: T[]) => {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

export const createMusicMix = (
  seedTrack: Track,
  libraryTracks: Track[],
  excludedTrackIds: ReadonlySet<string> = new Set(),
  preferences: {
    lovedTrackIds?: ReadonlySet<string>;
    playCounts?: Readonly<Record<string, number>>;
  } = {},
  limit = 24,
  options: { requireSimilarity?: boolean } = {}
): Track[] => {
  const seedArtists = getArtists(seedTrack);
  const seedGenres = getGenres(seedTrack);
  const seedComposers = getComposers(seedTrack);
  const candidates = Array.from(
    new Map(
      libraryTracks
        .filter(
          (track) =>
            track.id !== seedTrack.id && !track.streamingProvider && !excludedTrackIds.has(track.id)
        )
        .map((track) => [track.id, track])
    ).values()
  );

  const scored = candidates
    .map((track) => {
      const artistMatch = hasOverlap(seedArtists, getArtists(track));
      const genreMatch = hasOverlap(seedGenres, getGenres(track));
      const composerMatch = hasOverlap(seedComposers, getComposers(track));
      const hasSimilarityMatch = artistMatch || genreMatch || composerMatch;
      const sameAlbum = Boolean(
        seedTrack.album && normalize(track.album) === normalize(seedTrack.album) && artistMatch
      );
      const closeReleaseYear = Boolean(
        seedTrack.year && track.year && Math.abs(seedTrack.year - track.year) <= 3
      );
      const playCount = Math.max(0, preferences.playCounts?.[track.id] ?? 0);
      const score =
        (artistMatch ? 6 : 0) +
        (genreMatch ? 4 : 0) +
        (composerMatch ? 5 : 0) +
        (sameAlbum ? 2 : 0) +
        (closeReleaseYear ? 1 : 0) +
        (preferences.lovedTrackIds?.has(track.id) ? 2.5 : 0) +
        Math.min(1.5, Math.log2(playCount + 1) * 0.45);
      return { track, score, hasSimilarityMatch };
    })
    .filter(({ score, hasSimilarityMatch }) =>
      options.requireSimilarity ? score > 0 && hasSimilarityMatch : score > 0
    )
    .sort((first, second) => second.score - first.score);

  if (!scored.length) return options.requireSimilarity ? [] : shuffle(candidates).slice(0, limit);

  const result: Track[] = [];
  for (let index = 0; index < scored.length;) {
    let end = index + 1;
    while (end < scored.length && scored[end].score === scored[index].score) end += 1;
    result.push(...shuffle(scored.slice(index, end).map(({ track }) => track)));
    index = end;
  }
  return result.slice(0, limit);
};
