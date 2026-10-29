import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Track } from './MusicLibrary';

interface AndroidMusicLibraryResult {
  tracks: Track[];
  folders: string[];
  errors: string[];
}

interface AndroidMusicLibraryPlugin {
  scan: () => Promise<AndroidMusicLibraryResult>;
  getAppearance: () => Promise<AndroidAppearance>;
  getDeviceInfo: () => Promise<AndroidDeviceInfo>;
  getAlbumArtwork: (options: { albumId: string }) => Promise<{ dataUrl: string | null }>;
  updateNowPlaying: (options: {
    enabled: boolean;
    lockScreen: boolean;
    title: string;
    artist: string;
    album: string;
    isPlaying: boolean;
    position: number;
    duration: number;
  }) => Promise<void>;
  clearNowPlaying: () => Promise<void>;
  addListener: (
    eventName: 'mediaControl',
    listenerFunc: (event: AndroidMediaControlEvent) => void
  ) => Promise<{ remove: () => Promise<void> }>;
}

export interface AndroidMediaControlEvent {
  control: 'play' | 'pause' | 'next' | 'previous' | 'seek';
  position?: number;
}

const LIBRARY_DATABASE_NAME = 'luna-android-library';
const LIBRARY_DATABASE_VERSION = 1;
const LIBRARY_STORE_NAME = 'library';
const LIBRARY_CACHE_KEY = 'current';

let libraryDatabasePromise: Promise<IDBDatabase> | null = null;
const albumArtworkCache = new Map<string, string | null>();
const pendingArtworkRequests = new Map<string, Promise<string | null>>();

const isCachedTrack = (value: unknown): value is Track =>
  typeof value === 'object' &&
  value !== null &&
  'path' in value &&
  typeof value.path === 'string' &&
  'id' in value &&
  typeof value.id === 'string' &&
  'name' in value &&
  typeof value.name === 'string' &&
  'artist' in value &&
  typeof value.artist === 'string' &&
  'album' in value &&
  typeof value.album === 'string' &&
  'duration' in value &&
  typeof value.duration === 'number';

export interface AndroidDeviceInfo {
  manufacturer: string;
  model: string;
  androidVersion: string;
  apiLevel: number;
}

export interface AndroidAppearance {
  apiLevel: number;
  supportsMaterialYou: boolean;
  colors?: {
    primary?: string;
    onPrimary?: string;
    primaryContainer?: string;
    onPrimaryContainer?: string;
    secondary?: string;
    tertiary?: string;
    surface?: string;
    onSurface?: string;
    surfaceVariant?: string;
    onSurfaceVariant?: string;
    outline?: string;
    outlineVariant?: string;
  };
}

const androidMusicLibrary = registerPlugin<AndroidMusicLibraryPlugin>('AndroidMusicLibrary');

export const isAndroidApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const scanAndroidMusicLibrary = async (): Promise<AndroidMusicLibraryResult> => {
  const result = await androidMusicLibrary.scan();
  return {
    ...result,
    tracks: result.tracks.map((track) => ({
      ...track,
      src: Capacitor.convertFileSrc(track.path),
    })),
  };
};

const getLibraryDatabase = (): Promise<IDBDatabase> => {
  if (libraryDatabasePromise) return libraryDatabasePromise;

  libraryDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LIBRARY_DATABASE_NAME, LIBRARY_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LIBRARY_STORE_NAME)) {
        request.result.createObjectStore(LIBRARY_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error('Could not open the Android library cache.'));
    request.onblocked = () =>
      reject(new Error('The Android library cache is blocked by another database connection.'));
  }).catch((error: unknown) => {
    libraryDatabasePromise = null;
    throw error;
  });

  return libraryDatabasePromise;
};

export const loadAndroidMusicLibraryCache = async (): Promise<AndroidMusicLibraryResult | null> => {
  const database = await getLibraryDatabase();
  const transaction = database.transaction(LIBRARY_STORE_NAME, 'readonly');
  const request = transaction.objectStore(LIBRARY_STORE_NAME).get(LIBRARY_CACHE_KEY);
  const cached = await new Promise<AndroidMusicLibraryResult | null>((resolve, reject) => {
    request.onsuccess = () => {
      const value: unknown = request.result;
      if (value === undefined) {
        resolve(null);
        return;
      }
      if (
        typeof value !== 'object' ||
        value === null ||
        !('tracks' in value) ||
        !Array.isArray(value.tracks) ||
        !('folders' in value) ||
        !Array.isArray(value.folders) ||
        !value.folders.every((folder) => typeof folder === 'string') ||
        !value.tracks.every(isCachedTrack)
      ) {
        reject(new Error('The saved Android music library cache is invalid.'));
        return;
      }
      resolve({
        tracks: value.tracks,
        folders: value.folders,
        errors: [],
      });
    };
    request.onerror = () =>
      reject(request.error ?? new Error('Could not read the Android library cache.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Reading the Android library cache was interrupted.'));
  });

  if (!cached) return null;
  return {
    ...cached,
    tracks: cached.tracks.map((track) => ({
      ...track,
      src: Capacitor.convertFileSrc(track.path),
      albumArt: undefined,
    })),
  };
};

export const saveAndroidMusicLibraryCache = async (
  library: Pick<AndroidMusicLibraryResult, 'tracks' | 'folders'>
): Promise<void> => {
  const database = await getLibraryDatabase();
  const tracks = library.tracks.map(({ albumArt: _albumArt, src: _src, ...track }) => track);
  const transaction = database.transaction(LIBRARY_STORE_NAME, 'readwrite');
  transaction
    .objectStore(LIBRARY_STORE_NAME)
    .put({ tracks, folders: library.folders }, LIBRARY_CACHE_KEY);
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Could not save the Android library cache.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Saving the Android library cache was interrupted.'));
  });
};

export const getAndroidAlbumArtwork = (albumId: string): Promise<string | null> => {
  const cachedArtwork = albumArtworkCache.get(albumId);
  if (cachedArtwork !== undefined) {
    albumArtworkCache.delete(albumId);
    albumArtworkCache.set(albumId, cachedArtwork);
    return Promise.resolve(cachedArtwork);
  }
  const pendingRequest = pendingArtworkRequests.get(albumId);
  if (pendingRequest) return pendingRequest;

  const request = androidMusicLibrary
    .getAlbumArtwork({ albumId })
    .then(({ dataUrl }) => {
      albumArtworkCache.set(albumId, dataUrl);
      if (albumArtworkCache.size > 48) {
        const oldestAlbumId = albumArtworkCache.keys().next().value;
        if (oldestAlbumId) albumArtworkCache.delete(oldestAlbumId);
      }
      return dataUrl;
    })
    .finally(() => pendingArtworkRequests.delete(albumId));
  pendingArtworkRequests.set(albumId, request);
  return request;
};

export const getAndroidAppearance = (): Promise<AndroidAppearance> =>
  androidMusicLibrary.getAppearance();

export const getAndroidDeviceInfo = (): Promise<AndroidDeviceInfo> =>
  androidMusicLibrary.getDeviceInfo();

export const updateAndroidNowPlaying = (
  track: Track,
  isPlaying: boolean,
  position: number,
  enabled: boolean,
  lockScreen: boolean
): Promise<void> =>
  androidMusicLibrary.updateNowPlaying({
    enabled,
    lockScreen,
    title: track.name,
    artist: track.artist,
    album: track.album,
    isPlaying,
    position,
    duration: track.duration,
  });

export const clearAndroidNowPlaying = (): Promise<void> => androidMusicLibrary.clearNowPlaying();

export const listenForAndroidMediaControls = (
  listener: (event: AndroidMediaControlEvent) => void
) => androidMusicLibrary.addListener('mediaControl', listener);
