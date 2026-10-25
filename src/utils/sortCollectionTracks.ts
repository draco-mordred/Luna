import type { Track } from '../services/MusicLibrary';

export const sortCollectionTracks = (tracks: Track[]): Track[] => {
  const hasTrackNumbers = tracks.some((track) => Number.isFinite(track.trackNumber) && (track.trackNumber ?? 0) > 0);

  return [...tracks].sort((left, right) => {
    const leftNumber = Number.isFinite(left.trackNumber) && (left.trackNumber ?? 0) > 0 ? left.trackNumber : undefined;
    const rightNumber = Number.isFinite(right.trackNumber) && (right.trackNumber ?? 0) > 0 ? right.trackNumber : undefined;

    if (hasTrackNumbers && leftNumber !== undefined && rightNumber !== undefined && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }
    if (hasTrackNumbers && leftNumber !== rightNumber) {
      return leftNumber === undefined ? 1 : -1;
    }

    if (left.year !== undefined && right.year !== undefined && left.year !== right.year) {
      return left.year - right.year;
    }
    if ((left.year === undefined) !== (right.year === undefined)) {
      return left.year === undefined ? 1 : -1;
    }

    if (left.lastModified !== right.lastModified) {
      return left.lastModified - right.lastModified;
    }
    return left.name.localeCompare(right.name);
  });
};
