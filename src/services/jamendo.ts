import type { Track } from './MusicLibrary';

export interface JamendoTrack {
  id: string;
  name: string;
  artist_name: string;
  album_name: string;
  album_id: string | null;
  image: string;
  audio: string;
  duration: number;
  shareurl: string;
  license_ccurl: string;
}

interface JamendoResponse {
  headers: {
    status: string;
    code: number;
    error_message?: string;
  };
  results: JamendoTrack[];
}

const API_BASE_URL = 'https://api.jamendo.com/v3.0';
const CLIENT_ID_STORAGE_KEY = 'luna-jamendo-client-id';

export const createJamendoLibraryTrack = (track: JamendoTrack): Track => ({
  id: `jamendo-${track.id}`,
  path: `jamendo://${track.id}`,
  src: track.audio,
  streamingProvider: 'jamendo',
  filename: track.name,
  name: track.name,
  artist: track.artist_name,
  album: track.album_name,
  albumArt: track.image || undefined,
  duration: track.duration,
  format: 'mp3',
  size: 0,
  lastModified: 0,
});

export const getJamendoClientId = (): string =>
  window.localStorage.getItem(CLIENT_ID_STORAGE_KEY)?.trim() ?? '';

export const saveJamendoClientId = (clientId: string): void => {
  const trimmedClientId = clientId.trim();
  if (trimmedClientId) {
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, trimmedClientId);
  } else {
    window.localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
  }
};

export const searchJamendoTracks = async (
  clientId: string,
  query: string,
  signal?: AbortSignal
): Promise<JamendoTrack[]> => {
  const url = new URL(`${API_BASE_URL}/tracks`);
  url.search = new URLSearchParams({
    client_id: clientId,
    format: 'json',
    limit: '30',
    audioformat: 'mp32',
    imagesize: '300',
    include: 'licenses',
    order: query.trim() ? 'relevance' : 'popularity_total',
    ...(query.trim() ? { namesearch: query.trim() } : {}),
  }).toString();

  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Jamendo returned HTTP ${response.status}. Please try again later.`);
  }

  const data: unknown = await response.json();
  if (!data || typeof data !== 'object' || !('headers' in data)) {
    throw new Error('Jamendo returned an invalid API response.');
  }
  const result = data as Partial<JamendoResponse>;
  if (!result.headers || typeof result.headers.code !== 'number') {
    throw new Error('Jamendo returned an invalid API response.');
  }
  if (result.headers.code !== 0) {
    throw new Error(result.headers.error_message || 'Jamendo could not load tracks.');
  }
  if (!Array.isArray(result.results)) {
    throw new Error('Jamendo returned an invalid track list.');
  }

  return result.results.filter((track) => track.id && track.audio && track.shareurl);
};
