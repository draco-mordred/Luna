import type { Track } from './MusicLibrary';

export interface SearchItem {
  id: string;
  type: 'track' | 'album' | 'artist' | 'genre';
  title: string;
  subtitle: string;
  track?: Track;
}

export interface SearchGroup {
  title: string;
  items: SearchItem[];
}

const matchesQuery = (value: string | undefined, query: string) => {
  if (!value) return false;
  return value.toLocaleLowerCase().includes(query);
};

export const buildSearchGroups = (tracks: Track[], query: string): SearchGroup[] => {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return [
      { title: 'Tracks', items: [] },
      { title: 'Albums', items: [] },
      { title: 'Artists', items: [] },
      { title: 'Genres', items: [] },
    ];
  }

  const trackMatches = tracks.filter((track) => (
    matchesQuery(track.name, normalizedQuery)
    || matchesQuery(track.artist, normalizedQuery)
    || matchesQuery(track.album, normalizedQuery)
    || matchesQuery(track.genre, normalizedQuery)
    || matchesQuery(track.composer, normalizedQuery)
  ));

  const albumMap = new Map<string, SearchItem>();
  tracks.forEach((track) => {
    const albumKey = `${track.album || 'Unknown album'}::${track.artist || 'Unknown artist'}`;
    if (!albumMap.has(albumKey) && matchesQuery(track.album, normalizedQuery)) {
      albumMap.set(albumKey, {
        id: albumKey,
        type: 'album',
        title: track.album || 'Unknown album',
        subtitle: track.artist || 'Unknown artist',
        track,
      });
    }
  });

  const artistMap = new Map<string, SearchItem>();
  tracks.forEach((track) => {
    const artistKey = track.artist || 'Unknown artist';
    if (!artistMap.has(artistKey) && matchesQuery(track.artist, normalizedQuery)) {
      artistMap.set(artistKey, {
        id: artistKey,
        type: 'artist',
        title: artistKey,
        subtitle: `${(track.album || 'Unknown album')} · ${track.genre || 'Unspecified genre'}`,
        track,
      });
    }
  });

  const genreMap = new Map<string, SearchItem>();
  tracks.forEach((track) => {
    const genreKey = track.genre || 'Unspecified genre';
    if (!genreMap.has(genreKey) && matchesQuery(track.genre, normalizedQuery)) {
      genreMap.set(genreKey, {
        id: genreKey,
        type: 'genre',
        title: genreKey,
        subtitle: `${track.artist || 'Unknown artist'} · ${track.album || 'Unknown album'}`,
        track,
      });
    }
  });

  return [
    { title: 'Tracks', items: trackMatches.slice(0, 10).map((track) => ({
      id: track.id,
      type: 'track',
      title: track.name,
      subtitle: `${track.artist || 'Unknown artist'} · ${track.album || 'Unknown album'}`,
      track,
    })) },
    { title: 'Albums', items: [...albumMap.values()].slice(0, 10) },
    { title: 'Artists', items: [...artistMap.values()].slice(0, 10) },
    { title: 'Genres', items: [...genreMap.values()].slice(0, 10) },
  ];
};
