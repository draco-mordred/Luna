import { useEffect, useRef, useState } from 'react';

const CACHE_PREFIX = 'luna-artist-image:';
const IMAGE_DATABASE_NAME = 'luna-artist-images';
const IMAGE_DATABASE_VERSION = 1;
const IMAGE_STORE_NAME = 'images';
const MAX_ARTIST_IMAGE_SIZE = 12 * 1024 * 1024;
const IMAGE_CACHE_DURATION = 30 * 24 * 60 * 60 * 1000;
const MISS_CACHE_DURATION = 24 * 60 * 60 * 1000;

interface CachedArtistImage {
  imageUrl: string | null;
  biography?: string | null;
  articleUrl?: string | null;
  expiresAt: number;
}

interface WikipediaSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        title?: string;
        thumbnail?: { source?: string };
        extract?: string;
        fullurl?: string;
      }
    >;
  };
}

export interface ArtistWebInfo {
  imageUrl: string | null;
  biography: string | null;
  articleUrl: string | null;
}

const imageCache = new Map<string, CachedArtistImage>();
const pendingRequests = new Map<string, Promise<ArtistWebInfo>>();
const downloadedImageUrls = new Map<string, string>();
const pendingImageDownloads = new Map<string, Promise<string | null>>();
let imageDatabasePromise: Promise<IDBDatabase> | null = null;

const normalizeArtistName = (artist: string) => artist.trim().toLocaleLowerCase();

const requestPersistentImageStorage = () => {
  if (!navigator.storage?.persist) return;
  void navigator.storage
    .persist()
    .then((persisted) => {
      if (!persisted) console.warn('Persistent storage was not granted for the artist image cache.');
    })
    .catch((error: unknown) => {
      console.warn('Could not request persistent storage for the artist image cache:', error);
    });
};

const isWikimediaImageUrl = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'upload.wikimedia.org';
  } catch {
    return false;
  }
};

const readCachedImage = (key: string): CachedArtistImage | null => {
  const memoryEntry = imageCache.get(key);
  if (
    memoryEntry &&
    memoryEntry.expiresAt > Date.now() &&
    memoryEntry.biography !== undefined
  ) {
    return memoryEntry;
  }
  imageCache.delete(key);

  try {
    const storedValue = window.localStorage.getItem(`${CACHE_PREFIX}${encodeURIComponent(key)}`);
    if (!storedValue) return null;
    const entry = JSON.parse(storedValue) as CachedArtistImage;
    if (
      typeof entry.expiresAt !== 'number' ||
      entry.expiresAt <= Date.now() ||
      (entry.imageUrl !== null && !isWikimediaImageUrl(entry.imageUrl)) ||
      (entry.biography !== undefined &&
        entry.biography !== null &&
        typeof entry.biography !== 'string') ||
      (entry.articleUrl !== undefined && entry.articleUrl !== null &&
        (typeof entry.articleUrl !== 'string' ||
          !entry.articleUrl.startsWith('https://en.wikipedia.org/wiki/'))) ||
      entry.biography === undefined
    ) {
      window.localStorage.removeItem(`${CACHE_PREFIX}${encodeURIComponent(key)}`);
      return null;
    }
    imageCache.set(key, entry);
    return entry;
  } catch (error) {
    console.warn('Could not read cached artist artwork:', error);
    return null;
  }
};

const writeCachedImage = (key: string, info: ArtistWebInfo) => {
  const entry = {
    ...info,
    expiresAt: Date.now() + (info.imageUrl || info.biography ? IMAGE_CACHE_DURATION : MISS_CACHE_DURATION),
  };
  imageCache.set(key, entry);
  try {
    window.localStorage.setItem(`${CACHE_PREFIX}${encodeURIComponent(key)}`, JSON.stringify(entry));
  } catch (error) {
    console.warn('Could not cache artist artwork:', error);
  }
};

const lookupArtistInfo = async (artist: string): Promise<ArtistWebInfo> => {
  const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
  searchUrl.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `intitle:${artist}`,
    gsrnamespace: '0',
    gsrlimit: '5',
    exintro: '1',
    explaintext: '1',
    exchars: '1200',
    exsectionformat: 'plain',
    prop: 'pageimages|extracts|info',
    inprop: 'url',
    piprop: 'thumbnail',
    pithumbsize: '800',
    format: 'json',
    origin: '*',
  }).toString();

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(searchUrl, { signal: controller.signal });
    if (!response.ok) {
      console.warn(`Artist artwork lookup failed for "${artist}" (HTTP ${response.status}).`);
      return { imageUrl: null, biography: null, articleUrl: null };
    }

    const data = (await response.json()) as WikipediaSearchResponse;
    const pages = Object.values(data.query?.pages ?? {});
    const exactMatch = pages.find(
      (page) => page.title?.trim().toLocaleLowerCase() === artist.trim().toLocaleLowerCase()
    );
    const page = exactMatch ?? pages[0];
    const imageUrl = page?.thumbnail?.source;
    return {
      imageUrl: isWikimediaImageUrl(imageUrl) ? imageUrl : null,
      biography: page?.extract?.trim() || null,
      articleUrl: page?.fullurl?.startsWith('https://en.wikipedia.org/wiki/')
        ? page.fullurl
        : null,
    };
  } catch (error) {
    console.warn(`Could not fetch artist artwork for "${artist}":`, error);
    return { imageUrl: null, biography: null, articleUrl: null };
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const getArtistInfo = (artist: string): Promise<ArtistWebInfo> => {
  const key = normalizeArtistName(artist);
  if (!key) return Promise.resolve({ imageUrl: null, biography: null, articleUrl: null });

  const cachedImage = readCachedImage(key);
  if (cachedImage) {
    return Promise.resolve({
      imageUrl: cachedImage.imageUrl,
      biography: cachedImage.biography ?? null,
      articleUrl: cachedImage.articleUrl ?? null,
    });
  }

  const pendingRequest = pendingRequests.get(key);
  if (pendingRequest) return pendingRequest;

  const request = lookupArtistInfo(artist)
    .then((info) => {
      writeCachedImage(key, info);
      return info;
    })
    .catch((error: unknown) => {
      console.warn(`Could not resolve web information for "${artist}":`, error);
      const emptyInfo = { imageUrl: null, biography: null, articleUrl: null };
      writeCachedImage(key, emptyInfo);
      return emptyInfo;
    });
  pendingRequests.set(key, request);
  void request.then(() => pendingRequests.delete(key));
  return request;
};

export const getArtistImage = (artist: string, allowDownload = true): Promise<string | null> =>
  getDownloadedArtistImage(artist, allowDownload);

const openArtistImageDatabase = (): Promise<IDBDatabase> => {
  if (imageDatabasePromise) return imageDatabasePromise;
  imageDatabasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(IMAGE_DATABASE_NAME, IMAGE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        database.createObjectStore(IMAGE_STORE_NAME, { keyPath: 'artist' });
      }
    };
    request.onsuccess = () => {
      requestPersistentImageStorage();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open artist image cache.'));
    request.onblocked = () => reject(new Error('Artist image cache upgrade is blocked.'));
  }).catch((error: unknown) => {
    imageDatabasePromise = null;
    throw error;
  });
  return imageDatabasePromise;
};

const getCachedArtistImageBlob = async (
  artist: string,
  sourceUrl?: string
): Promise<Blob | null> => {
  const database = await openArtistImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, 'readonly');
    const request = transaction.objectStore(IMAGE_STORE_NAME).get(artist);
    request.onsuccess = () => {
      const cached = request.result as { sourceUrl?: string; image?: Blob } | undefined;
      resolve(
        cached &&
          (!sourceUrl || cached.sourceUrl === sourceUrl) &&
          cached.image instanceof Blob &&
          cached.image.size <= MAX_ARTIST_IMAGE_SIZE
          ? cached.image
          : null
      );
    };
    request.onerror = () => reject(request.error ?? new Error('Could not read cached artist image.'));
  });
};

const getCachedArtistImageUrl = async (
  artist: string,
  sourceUrl?: string
): Promise<string | null> => {
  try {
    const image = await getCachedArtistImageBlob(artist, sourceUrl);
    if (!image) return null;
    const objectUrl = URL.createObjectURL(image);
    downloadedImageUrls.set(artist, objectUrl);
    return objectUrl;
  } catch (error) {
    console.warn(`Could not read cached artist image for "${artist}":`, error);
    return null;
  }
};

const cacheArtistImageBlob = async (
  artist: string,
  sourceUrl: string,
  image: Blob
): Promise<void> => {
  const database = await openArtistImageDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(IMAGE_STORE_NAME, 'readwrite');
    transaction.objectStore(IMAGE_STORE_NAME).put({ artist, sourceUrl, image, cachedAt: Date.now() });
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('Could not save downloaded artist image.'));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Saving the downloaded artist image was aborted.'));
  });
};

const getDownloadedArtistImage = async (
  artistName: string,
  allowDownload: boolean
): Promise<string | null> => {
  const artist = normalizeArtistName(artistName);
  if (!artist) return null;
  const cachedObjectUrl = downloadedImageUrls.get(artist);
  if (cachedObjectUrl) return cachedObjectUrl;
  const pendingDownload = pendingImageDownloads.get(artist);
  if (pendingDownload) return pendingDownload;

  const download = (async () => {
    const cachedObjectUrl = await getCachedArtistImageUrl(artist);
    if (cachedObjectUrl) return cachedObjectUrl;

    if (!allowDownload) return null;
    if (!navigator.onLine) {
      return null;
    }

    const { imageUrl } = await getArtistInfo(artistName);
    if (!imageUrl) return null;
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Artist image download failed (HTTP ${response.status}).`);
      }
      const declaredSize = Number(response.headers.get('content-length'));
      if (Number.isFinite(declaredSize) && declaredSize > MAX_ARTIST_IMAGE_SIZE) {
        throw new Error('Artist image exceeds the 12 MB cache limit.');
      }
      const image = await response.blob();
      if (!image.type.startsWith('image/') || image.size > MAX_ARTIST_IMAGE_SIZE) {
        throw new Error('Artist image is not a supported image or exceeds the 12 MB cache limit.');
      }
      try {
        await cacheArtistImageBlob(artist, imageUrl, image);
      } catch (error) {
        console.warn(`Could not persist artist image for "${artistName}"; using it for this session:`, error);
      }
      const objectUrl = URL.createObjectURL(image);
      downloadedImageUrls.set(artist, objectUrl);
      return objectUrl;
    } catch (error) {
      console.warn(`Could not download or cache artist image for "${artistName}":`, error);
      const cachedFallback = await getCachedArtistImageUrl(artist);
      if (cachedFallback) return cachedFallback;
      downloadedImageUrls.set(artist, imageUrl);
      return imageUrl;
    }
  })();

  pendingImageDownloads.set(artist, download);
  void download.then(() => pendingImageDownloads.delete(artist));
  return download;
};

interface UseArtistImageOptions {
  enabled?: boolean;
  allowDownload?: boolean;
  loadWhenVisible?: boolean;
}

export const useArtistImage = (
  artist: string,
  { enabled = true, allowDownload = true, loadWhenVisible = false }: UseArtistImageOptions = {}
) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{ artist: string; imageUrl: string | null } | null>(null);
  const normalizedArtist = normalizeArtistName(artist);

  useEffect(() => {
    if (!enabled || !normalizedArtist) return;
    let isMounted = true;
    const load = () => {
      void getArtistImage(artist, allowDownload).then((imageUrl) => {
        if (isMounted) setResult({ artist: normalizedArtist, imageUrl });
      });
    };

    if (!loadWhenVisible || !elementRef.current || !('IntersectionObserver' in window)) {
      load();
      return () => {
        isMounted = false;
      };
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        load();
      },
      { rootMargin: '240px' }
    );
    observer.observe(elementRef.current);

    return () => {
      isMounted = false;
      observer.disconnect();
    };
  }, [allowDownload, artist, enabled, loadWhenVisible, normalizedArtist]);

  return {
    elementRef,
    imageUrl: enabled && result?.artist === normalizedArtist ? result.imageUrl : null,
  };
};
