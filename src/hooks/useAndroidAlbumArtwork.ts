import { useEffect, useRef, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
import { getAndroidAlbumArtwork, isAndroidApp } from '../services/androidMusicLibrary';

interface AndroidArtworkState {
  albumId: string;
  imageUrl: string | null;
}

export const useAndroidAlbumArtwork = (
  track: Track | null | undefined,
  loadImmediately = false
) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [artworkState, setArtworkState] = useState<AndroidArtworkState | null>(null);
  const androidApp = isAndroidApp();
  const albumId = track?.androidAlbumId;
  const needsIntersectionObserver =
    Boolean(albumId) && androidApp && !loadImmediately && 'IntersectionObserver' in window;
  const shouldLoadArtwork =
    loadImmediately || !androidApp || !needsIntersectionObserver || isNearViewport;
  const imageUrl =
    artworkState && artworkState.albumId === albumId
      ? (artworkState.imageUrl ?? undefined)
      : track?.albumArt;

  useEffect(() => {
    if (!needsIntersectionObserver) return undefined;
    const element = elementRef.current;
    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px' }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [needsIntersectionObserver]);

  useEffect(() => {
    if (!androidApp || !albumId || !shouldLoadArtwork) return undefined;
    let active = true;
    getAndroidAlbumArtwork(albumId)
      .then((image) => {
        if (active) setArtworkState({ albumId, imageUrl: image });
      })
      .catch((error: unknown) => {
        console.warn(`Could not load Android artwork for album ${albumId}:`, error);
      });
    return () => {
      active = false;
    };
  }, [albumId, androidApp, shouldLoadArtwork]);

  return { elementRef, imageUrl };
};
