import type { Track } from './MusicLibrary';

interface AudiomackSong {
  id: string | number;
  title: string;
  artist?: string;
  album?: string;
  image?: string;
  url?: string;
  url_slug?: string;
  type?: string;
  duration?: number | string;
  uploader?: {
    name?: string;
    url_slug?: string;
  };
}

export interface AudiomackTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  image: string;
  url: string;
  duration: number;
}

const SESSION_STORAGE_KEY = 'luna-audiomack-session';

const requireElectronApi = () => {
  if (!window.electronAPI) {
    throw new Error('Audiomack streaming is available in the Luna desktop app.');
  }
  return window.electronAPI;
};

export const hasAudiomackCredentials = async (): Promise<boolean> =>
  requireElectronApi().audiomackHasCredentials();

export const saveAudiomackCredentials = async (
  consumerKey: string,
  consumerSecret: string
): Promise<void> => requireElectronApi().audiomackSaveCredentials(consumerKey, consumerSecret);

export const clearAudiomackCredentials = async (): Promise<void> =>
  requireElectronApi().audiomackClearCredentials();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const getSongResults = (response: unknown): AudiomackSong[] => {
  if (!isRecord(response)) {
    throw new Error('Audiomack returned an invalid search response.');
  }
  const results = response.results;
  const songs = Array.isArray(results)
    ? results
    : isRecord(results)
      ? Array.isArray(results.songs)
        ? results.songs
        : Array.isArray(results.results)
          ? results.results
          : null
      : null;
  if (!songs) {
    throw new Error('Audiomack did not return a song list.');
  }
  return songs
    .filter(isRecord)
    .filter(
      (song) =>
        (typeof song.id === 'string' || typeof song.id === 'number') &&
        typeof song.title === 'string' &&
        (typeof song.type !== 'string' || song.type === 'song')
    )
    .map((song) => ({
      id: String(song.id),
      title: String(song.title),
      artist: typeof song.artist === 'string' ? song.artist : undefined,
      album: typeof song.album === 'string' ? song.album : undefined,
      image: typeof song.image === 'string' ? song.image : undefined,
      url: typeof song.url === 'string' ? song.url : undefined,
      url_slug: typeof song.url_slug === 'string' ? song.url_slug : undefined,
      type: typeof song.type === 'string' ? song.type : undefined,
      duration:
        typeof song.duration === 'string' || typeof song.duration === 'number'
          ? song.duration
          : undefined,
      uploader: isRecord(song.uploader)
        ? {
            name: typeof song.uploader.name === 'string' ? song.uploader.name : undefined,
            url_slug:
              typeof song.uploader.url_slug === 'string' ? song.uploader.url_slug : undefined,
          }
        : undefined,
    }));
};

const getAudiomackShareUrl = (song: AudiomackSong): string => {
  if (song.url) {
    try {
      const url = new URL(song.url);
      if (
        url.protocol === 'https:' &&
        (url.hostname === 'audiomack.com' || url.hostname.endsWith('.audiomack.com'))
      ) {
        return url.href;
      }
    } catch {
      // Fall back to the documented artist/song URL structure.
    }
  }
  const artistSlug = song.uploader?.url_slug;
  if (!artistSlug || !song.url_slug) return 'https://audiomack.com/';
  return `https://audiomack.com/${encodeURIComponent(artistSlug)}/song/${encodeURIComponent(song.url_slug)}`;
};

const toAudiomackTrack = (song: AudiomackSong): AudiomackTrack | null => {
  if (
    (typeof song.id !== 'string' && typeof song.id !== 'number') ||
    !song.title ||
    typeof song.title !== 'string'
  ) {
    return null;
  }
  const duration = Number(song.duration);
  return {
    id: String(song.id),
    title: song.title,
    artist: song.artist || song.uploader?.name || 'Unknown artist',
    album: song.album || '',
    image: typeof song.image === 'string' ? song.image : '',
    url: getAudiomackShareUrl(song),
    duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
  };
};

export const searchAudiomackTracks = async (query: string): Promise<AudiomackTrack[]> => {
  const response = await requireElectronApi().audiomackSearchTracks(query);
  return getSongResults(response)
    .map(toAudiomackTrack)
    .filter((track): track is AudiomackTrack => track !== null);
};

export const createAudiomackLibraryTrack = (track: AudiomackTrack): Track => ({
  id: `audiomack-${track.id}`,
  path: `audiomack://${track.id}`,
  streamingProvider: 'audiomack',
  streamingId: track.id,
  filename: track.title,
  name: track.title,
  artist: track.artist,
  album: track.album,
  albumArt: track.image || undefined,
  duration: track.duration,
  format: 'mp3',
  size: 0,
  lastModified: 0,
});

export const getAudiomackPlaybackUrl = async (musicId: string): Promise<string> => {
  let session = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (!session) {
    session = window.crypto.randomUUID();
    window.localStorage.setItem(SESSION_STORAGE_KEY, session);
  }
  return requireElectronApi().audiomackPlayTrack(musicId, session);
};
