import type { Track } from './MusicLibrary';
import { splitArtistCredits } from '../utils/artistCredits';

const STORAGE_KEY = 'luna-recent-media-v1';
export const REMEMBER_RECENT_MEDIA_KEY = 'luna-remember-recent-media';
export const MAX_RECENT_MEDIA_ITEMS = 30;

export interface RecentMediaHistory {
  playedTrackIds: string[];
  viewedAlbumKeys: string[];
  viewedArtistNames: string[];
  playCounts: Record<string, number>;
  queuePaths: string[];
  queueIndex: number;
}

const emptyHistory = (): RecentMediaHistory => ({
  playedTrackIds: [],
  viewedAlbumKeys: [],
  viewedArtistNames: [],
  playCounts: {},
  queuePaths: [],
  queueIndex: 0,
});

export const rememberRecentMediaEnabled = () =>
  window.localStorage.getItem(REMEMBER_RECENT_MEDIA_KEY) !== 'false';

export const loadRecentMediaHistory = (): RecentMediaHistory => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return emptyHistory();
    const parsed = JSON.parse(saved) as Partial<RecentMediaHistory>;
    return {
      playedTrackIds: Array.isArray(parsed.playedTrackIds)
        ? parsed.playedTrackIds.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_MEDIA_ITEMS)
        : [],
      viewedAlbumKeys: Array.isArray(parsed.viewedAlbumKeys)
        ? parsed.viewedAlbumKeys.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_MEDIA_ITEMS)
        : [],
      viewedArtistNames: Array.isArray(parsed.viewedArtistNames)
        ? parsed.viewedArtistNames.filter((value): value is string => typeof value === 'string').slice(0, MAX_RECENT_MEDIA_ITEMS)
        : [],
      playCounts:
        parsed.playCounts && typeof parsed.playCounts === 'object' && !Array.isArray(parsed.playCounts)
          ? parsed.playCounts
          : {},
      queuePaths: Array.isArray(parsed.queuePaths)
        ? parsed.queuePaths.filter((value): value is string => typeof value === 'string').slice(0, 500)
        : [],
      queueIndex:
        typeof parsed.queueIndex === 'number' && Number.isInteger(parsed.queueIndex)
          ? Math.max(0, parsed.queueIndex)
          : 0,
    };
  } catch (error) {
    console.error('Could not read recent media history:', error);
    return emptyHistory();
  }
};

const saveHistory = (history: RecentMediaHistory) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.error('Could not save recent media history:', error);
  }
};

const moveToFront = (values: string[], value: string) =>
  [value, ...values.filter((item) => item !== value)].slice(0, MAX_RECENT_MEDIA_ITEMS);

export const recordPlayedTrack = (track: Track, queue: Track[], queueIndex: number) => {
  const history = loadRecentMediaHistory();
  const albumKey = `${track.album}\u0000${track.artist}`;
  const viewedAlbumKeys = moveToFront(history.viewedAlbumKeys, albumKey);
  const viewedArtistNames = splitArtistCredits(track.artist).reduce(
    (artists, artist) => moveToFront(artists, artist),
    history.viewedArtistNames
  );
  const queuePaths = queue
    .filter((item) => !item.streamingProvider)
    .map((item) => item.path)
    .slice(0, 500);
  const playCounts = { ...history.playCounts, [track.id]: (history.playCounts[track.id] ?? 0) + 1 };
  saveHistory({
    ...history,
    playedTrackIds: moveToFront(history.playedTrackIds, track.id),
    viewedAlbumKeys,
    viewedArtistNames,
    playCounts,
    queuePaths: queuePaths.length ? queuePaths : history.queuePaths,
    queueIndex: queuePaths.length ? queueIndex : history.queueIndex,
  });
};

export const recordViewedAlbum = (album: string, artist: string) => {
  const history = loadRecentMediaHistory();
  saveHistory({
    ...history,
    viewedAlbumKeys: moveToFront(history.viewedAlbumKeys, `${album}\u0000${artist}`),
  });
};

export const recordViewedArtist = (artist: string) => {
  const history = loadRecentMediaHistory();
  saveHistory({
    ...history,
    viewedArtistNames: moveToFront(history.viewedArtistNames, artist),
  });
};

export const saveRecentQueue = (queue: Track[], queueIndex: number) => {
  const history = loadRecentMediaHistory();
  const queuePaths = queue
    .filter((track) => !track.streamingProvider)
    .map((track) => track.path)
    .slice(0, 500);
  if (!queuePaths.length) return;
  saveHistory({
    ...history,
    queuePaths,
    queueIndex: Math.max(0, queueIndex),
  });
};

export const clearRecentQueue = () => {
  const history = loadRecentMediaHistory();
  saveHistory({ ...history, queuePaths: [], queueIndex: 0 });
};
