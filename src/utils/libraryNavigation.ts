import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export const getLibraryItemHash = (type: 'artist' | 'album' | 'genre', name: string, artist?: string) => {
  const normalizedName = name.trim().toLocaleLowerCase();
  const key = type === 'album'
    ? `${normalizedName}::${artist?.trim().toLocaleLowerCase() ?? ''}`
    : normalizedName;
  return `#${type}-${encodeURIComponent(key)}`;
};

export const getLibraryItemPath = (type: 'artist' | 'album' | 'genre', name: string, artist?: string) => {
  const query = new URLSearchParams({ name });
  if (type === 'album' && artist) query.set('artist', artist);
  return `/${type}s/detail?${query.toString()}`;
};

export const useScrollToLibraryItem = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return undefined;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);
};
