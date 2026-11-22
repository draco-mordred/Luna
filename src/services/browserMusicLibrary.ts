import type { SyncedLyricLine, Track } from './MusicLibrary';
import { Buffer as BrowserBuffer } from 'buffer';
import { parseBuffer } from 'music-metadata/lib/core';
import { combineLyricsValues } from '../utils/lyricsParser';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = BrowserBuffer;
}

export const BROWSER_MUSIC_METADATA_VERSION = 3;

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.wav',
  '.flac',
  '.ogg',
  '.oga',
  '.aac',
  '.mp4',
  '.m4b',
  '.m4p',
  '.mpg',
  '.mp2',
  '.mpe',
  '.mpeg',
  '.wma',
  '.wmv',
  '.asf',
  '.aif',
  '.aiff',
  '.aifc',
]);

export interface BrowserMusicScanResult {
  folders: string[];
  tracks: Track[];
  errors: string[];
}

interface CachedBrowserFile {
  path: string;
  blob: Blob;
  name: string;
  lastModified: number;
  type: string;
}

interface CachedBrowserMusicLibrary {
  folders: string[];
  tracks: Track[];
  files: CachedBrowserFile[];
}

export interface BrowserMusicLibraryCacheResult extends BrowserMusicScanResult {
  files: File[];
}

const LIBRARY_DATABASE_NAME = 'luna-browser-preview-library';
const LIBRARY_DATABASE_VERSION = 1;
const LIBRARY_STORE_NAME = 'library';
const LIBRARY_CACHE_KEY = 'current';

let libraryDatabasePromise: Promise<IDBDatabase> | null = null;
const browserFilePaths = new WeakMap<File, string>();

export const getBrowserMusicFilePath = (file: File): string =>
  browserFilePaths.get(file) || file.webkitRelativePath || file.name;

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
      reject(request.error ?? new Error('Could not open the browser preview library cache.'));
    request.onblocked = () =>
      reject(
        new Error('The browser preview library cache is blocked by another database connection.')
      );
  }).catch((error: unknown) => {
    libraryDatabasePromise = null;
    throw error;
  });

  return libraryDatabasePromise;
};

export const loadBrowserMusicLibraryCache =
  async (): Promise<BrowserMusicLibraryCacheResult | null> => {
    const database = await getLibraryDatabase();
    const transaction = database.transaction(LIBRARY_STORE_NAME, 'readonly');
    const request = transaction.objectStore(LIBRARY_STORE_NAME).get(LIBRARY_CACHE_KEY);
    const cached = await new Promise<CachedBrowserMusicLibrary | null>((resolve, reject) => {
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
          !value.tracks.every(isCachedTrack) ||
          !('folders' in value) ||
          !Array.isArray(value.folders) ||
          !value.folders.every((folder) => typeof folder === 'string') ||
          !('files' in value) ||
          !Array.isArray(value.files) ||
          !value.files.every(
            (file) =>
              typeof file === 'object' &&
              file !== null &&
              'path' in file &&
              typeof file.path === 'string' &&
              'blob' in file &&
              file.blob instanceof Blob &&
              'name' in file &&
              typeof file.name === 'string' &&
              'lastModified' in file &&
              typeof file.lastModified === 'number' &&
              'type' in file &&
              typeof file.type === 'string'
          )
        ) {
          reject(new Error('The saved browser preview music library is invalid.'));
          return;
        }
        resolve(value as CachedBrowserMusicLibrary);
      };
      request.onerror = () =>
        reject(request.error ?? new Error('Could not read the browser preview library cache.'));
      transaction.onabort = () =>
        reject(
          transaction.error ??
            new Error('Reading the browser preview library cache was interrupted.')
        );
    });

    if (!cached) return null;
    const filesByPath = new Map(
      cached.files.map((entry) => {
        const file = new File([entry.blob], entry.name, {
          lastModified: entry.lastModified,
          type: entry.type,
        });
        browserFilePaths.set(file, entry.path);
        return [entry.path, file];
      })
    );
    const missingTrack = cached.tracks.find((track) => !filesByPath.has(track.path));
    if (missingTrack) {
      throw new Error(`The saved browser preview audio file "${missingTrack.path}" is missing.`);
    }
    const tracks = cached.tracks.map((track) => {
      const file = filesByPath.get(track.path);
      if (!file) {
        throw new Error(`The saved browser preview audio file "${track.path}" is missing.`);
      }
      return { ...track, src: URL.createObjectURL(file) };
    });

    return { folders: cached.folders, tracks, files: [...filesByPath.values()], errors: [] };
  };

export const saveBrowserMusicLibraryCache = async (
  library: Pick<BrowserMusicScanResult, 'tracks' | 'folders'>,
  files: File[]
): Promise<void> => {
  const filesByPath = new Map(files.map((file) => [getBrowserMusicFilePath(file), file]));
  const cachedFiles = library.tracks.flatMap((track) => {
    const file = filesByPath.get(track.path);
    return file
      ? [
          {
            path: track.path,
            blob: file,
            name: file.name,
            lastModified: file.lastModified,
            type: file.type,
          },
        ]
      : [];
  });
  if (cachedFiles.length !== library.tracks.length) {
    throw new Error('Some selected audio files could not be saved in the browser preview library.');
  }
  const cachedTracks = library.tracks.map(({ src: _src, ...track }) => track);
  const database = await getLibraryDatabase();
  const transaction = database.transaction(LIBRARY_STORE_NAME, 'readwrite');
  transaction.objectStore(LIBRARY_STORE_NAME).put(
    {
      tracks: cachedTracks,
      folders: library.folders,
      files: cachedFiles,
    } satisfies CachedBrowserMusicLibrary,
    LIBRARY_CACHE_KEY
  );
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Could not save the browser preview library cache.'));
    transaction.onabort = () =>
      reject(
        transaction.error ?? new Error('Saving the browser preview library cache was interrupted.')
      );
  });
};

const getExtension = (fileName: string): string => {
  const extensionIndex = fileName.lastIndexOf('.');
  return extensionIndex < 0 ? '' : fileName.slice(extensionIndex).toLowerCase();
};

const getTrackId = (path: string, lastModified: number, size: number): string => {
  return `browser-${encodeURIComponent(path)}-${lastModified}-${size}`;
};

const getMimeType = (file: File): string | undefined =>
  file.type ||
  (
    {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.m4b': 'audio/mp4',
      '.mp4': 'audio/mp4',
      '.wav': 'audio/wav',
      '.flac': 'audio/flac',
      '.ogg': 'audio/ogg',
      '.oga': 'audio/ogg',
      '.aac': 'audio/aac',
      '.wma': 'audio/x-ms-wma',
      '.wmv': 'video/x-ms-wmv',
      '.asf': 'video/x-ms-asf',
      '.aif': 'audio/aiff',
      '.aiff': 'audio/aiff',
    } as Record<string, string>
  )[getExtension(file.name)];

const pictureToDataUrl = (picture: { format?: string; data: Uint8Array }): string | null => {
  if (!picture.data.length) return null;
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < picture.data.length; offset += chunkSize) {
    binary += String.fromCharCode(...picture.data.subarray(offset, offset + chunkSize));
  }
  return `data:${picture.format || 'image/jpeg'};base64,${btoa(binary)}`;
};

const getEmbeddedLyrics = (
  metadata: Awaited<ReturnType<typeof parseBuffer>>
): { lyrics?: string; syncedLyrics?: SyncedLyricLine[] } => {
  const commonLyrics = metadata.common.lyrics?.filter(Boolean) ?? [];
  const nativeLyrics = Object.values(metadata.native).flatMap((tags) =>
    tags
      .filter((tag) => tag.id === 'USLT' || tag.id === 'ULT')
      .map((tag) => {
        const value = tag.value;
        if (typeof value === 'string') return value;
        if (
          typeof value === 'object' &&
          value !== null &&
          'text' in value &&
          typeof value.text === 'string'
        ) {
          return value.text;
        }
        return '';
      })
  );
  return combineLyricsValues([...commonLyrics, ...nativeLyrics]);
};

const getDuration = (source: string): Promise<number> =>
  new Promise((resolve) => {
    const audio = new Audio();
    let completed = false;
    const timeout = window.setTimeout(() => finish(0), 15_000);

    const finish = (duration: number) => {
      if (completed) return;
      completed = true;
      window.clearTimeout(timeout);
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.removeAttribute('src');
      audio.load();
      resolve(duration);
    };

    audio.preload = 'metadata';
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0);
    audio.onerror = () => finish(0);
    audio.src = source;
    audio.load();
  });

const createTrack = async (file: File, path: string, existingTrack?: Track): Promise<Track> => {
  if (
    existingTrack?.src?.startsWith('blob:') &&
    existingTrack.metadataVersion === BROWSER_MUSIC_METADATA_VERSION &&
    existingTrack.size === file.size &&
    existingTrack.lastModified === file.lastModified
  ) {
    return existingTrack;
  }

  const source = URL.createObjectURL(file);
  const duration = await getDuration(source);
  const segments = path.split('/').filter(Boolean);
  const filename = file.name;
  const extension = getExtension(filename);
  const filenameWithoutExtension = filename.slice(0, filename.length - extension.length);
  const trackNumberMatch = filenameWithoutExtension.match(/^\s*(\d{1,3})[ ._-]+/);
  const numberedTitle = filenameWithoutExtension.replace(/^\s*\d{1,3}[ ._-]+/, '');
  const artistAndTitle = numberedTitle.match(/^(.+?)\s+-\s+(.+)$/);
  const inferredArtist = segments.length > 3 ? segments[segments.length - 3] : '';

  let metadataTitle = '';
  let metadataArtist = '';
  let metadataAlbum = '';
  let metadataAlbumArtist = '';
  let metadataComposer = '';
  let metadataGenre = '';
  let metadataComment = '';
  let metadataLyrics = '';
  let metadataSyncedLyrics: SyncedLyricLine[] | undefined;
  let metadataYear: number | undefined;
  let metadataTrackNumber: number | undefined;
  let metadataDiscNumber: number | undefined;
  let metadataBitrate: number | undefined;
  let metadataFormat = extension.slice(1).toUpperCase();
  let metadataDuration = duration;
  let metadataArtwork: string | undefined;
  let metadataWasParsed = false;

  try {
    const metadata = await parseBuffer(new Uint8Array(await file.arrayBuffer()), {
      mimeType: getMimeType(file),
      size: file.size,
    });
    const pictures = metadata.common.picture ?? [];
    const cover =
      pictures.find((picture) =>
        `${picture.name ?? ''} ${picture.type ?? ''}`.toLowerCase().includes('front')
      ) ??
      pictures.find((picture) =>
        `${picture.name ?? ''} ${picture.type ?? ''}`.toLowerCase().includes('cover')
      ) ??
      pictures[0];
    metadataTitle = metadata.common.title?.trim() ?? '';
    metadataArtist = metadata.common.artist?.trim() ?? metadata.common.albumartist?.trim() ?? '';
    metadataAlbum = metadata.common.album?.trim() ?? '';
    metadataAlbumArtist = metadata.common.albumartist?.trim() ?? '';
    metadataComposer = metadata.common.composer?.join('; ').trim() ?? '';
    metadataGenre = metadata.common.genre?.join('; ').trim() ?? '';
    metadataComment = metadata.common.comment?.join('; ').trim() ?? '';
    const embeddedLyrics = getEmbeddedLyrics(metadata);
    metadataLyrics = embeddedLyrics.lyrics ?? '';
    metadataSyncedLyrics = embeddedLyrics.syncedLyrics;
    metadataYear =
      metadata.common.year ??
      (metadata.common.date ? Number.parseInt(metadata.common.date.slice(0, 4), 10) : undefined);
    metadataTrackNumber = metadata.common.track?.no ?? undefined;
    metadataDiscNumber = metadata.common.disk?.no ?? undefined;
    metadataBitrate = metadata.format.bitrate
      ? Math.round(metadata.format.bitrate / 1000)
      : undefined;
    metadataFormat =
      metadata.format.container?.trim() || metadata.format.codec?.trim() || metadataFormat;
    const parsedDuration = metadata.format.duration;
    metadataDuration =
      typeof parsedDuration === 'number' && Number.isFinite(parsedDuration) && parsedDuration > 0
        ? parsedDuration
        : duration;
    if (cover) metadataArtwork = pictureToDataUrl(cover) ?? undefined;
    metadataWasParsed = true;
  } catch (error: unknown) {
    console.warn(`Could not read embedded metadata from "${file.name}":`, error);
  }

  return {
    id: getTrackId(path, file.lastModified, file.size),
    path,
    src: source,
    filename,
    name: metadataTitle || artistAndTitle?.[2]?.trim() || numberedTitle.trim(),
    artist: metadataArtist || artistAndTitle?.[1]?.trim() || inferredArtist || 'Unknown Artist',
    album: metadataAlbum || (segments.length > 2 ? segments[segments.length - 2] : 'Unknown Album'),
    albumArtist: metadataAlbumArtist || undefined,
    albumArt: metadataArtwork,
    duration: metadataDuration,
    trackNumber:
      metadataTrackNumber ?? (trackNumberMatch ? Number(trackNumberMatch[1]) : undefined),
    discNumber: metadataDiscNumber,
    year: metadataYear && Number.isFinite(metadataYear) ? metadataYear : undefined,
    genre: metadataGenre || undefined,
    composer: metadataComposer || undefined,
    comment: metadataComment || undefined,
    lyrics: metadataLyrics || undefined,
    syncedLyrics: metadataSyncedLyrics,
    bitrate: metadataBitrate,
    format: metadataFormat,
    metadataVersion: metadataWasParsed ? BROWSER_MUSIC_METADATA_VERSION : undefined,
    size: file.size,
    lastModified: file.lastModified,
  };
};

export const scanBrowserMusicFiles = async (
  files: File[],
  existingTracks: Track[],
  onProgress?: (scanned: number, total: number) => void
): Promise<BrowserMusicScanResult> => {
  const audioFiles = files
    .filter((file) => AUDIO_EXTENSIONS.has(getExtension(file.name)))
    .sort((left, right) =>
      getBrowserMusicFilePath(left).localeCompare(getBrowserMusicFilePath(right))
    );
  const existingByPath = new Map(existingTracks.map((track) => [track.path, track]));
  const tracks: Track[] = new Array(audioFiles.length);
  const errors: string[] = [];
  let nextIndex = 0;
  let scanned = 0;

  const scanNextFile = async () => {
    while (nextIndex < audioFiles.length) {
      const index = nextIndex;
      nextIndex += 1;
      const file = audioFiles[index];
      const path = getBrowserMusicFilePath(file);
      try {
        tracks[index] = await createTrack(file, path, existingByPath.get(path));
      } catch (error: unknown) {
        errors.push(
          error instanceof Error
            ? `Could not load "${file.name}": ${error.message}`
            : `Could not load "${file.name}".`
        );
      }
      scanned += 1;
      onProgress?.(scanned, audioFiles.length);
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, audioFiles.length) }, () => scanNextFile()));

  const roots = new Set(
    audioFiles.map((file) => getBrowserMusicFilePath(file).split('/')[0]).filter(Boolean)
  );
  return {
    folders: [...roots].sort((left, right) => left.localeCompare(right)),
    tracks: tracks.filter((track): track is Track => Boolean(track)),
    errors,
  };
};

export const releaseBrowserMusicTracks = (tracks: Track[]): void => {
  const releasedSources = new Set<string>();
  tracks.forEach((track) => {
    const source = track.src;
    if (!source?.startsWith('blob:') || releasedSources.has(source)) return;
    URL.revokeObjectURL(source);
    releasedSources.add(source);
  });
};
