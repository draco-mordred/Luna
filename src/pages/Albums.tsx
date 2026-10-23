import { useMemo, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
import './Albums.css';

interface AlbumsPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}

const AlbumsPage = ({ tracks, onPlayTrack }: AlbumsPageProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'artist' | 'year' | 'tracks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const albums = useMemo(() => {
    const albumsById = new Map<string, { id: string; name: string; artist: string; year?: number; tracks: Track[] }>();
    tracks.forEach((track) => {
      const id = `${track.album.toLocaleLowerCase()}::${track.artist.toLocaleLowerCase()}`;
      const album = albumsById.get(id) ?? {
        id,
        name: track.album,
        artist: track.artist,
        year: track.year,
        tracks: [],
      };
      album.tracks.push(track);
      if (track.year && (!album.year || track.year < album.year)) album.year = track.year;
      albumsById.set(id, album);
    });
    return Array.from(albumsById.values());
  }, [tracks]);

  const sortedAlbums = [...albums].sort((a, b) => {
    const aValue = sortBy === 'tracks' ? a.tracks.length : a[sortBy] ?? '';
    const bValue = sortBy === 'tracks' ? b.tracks.length : b[sortBy] ?? '';
    const comparison = typeof aValue === 'number' && typeof bValue === 'number'
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className='albums-page'>
      <header className='page-header'>
        <div className='header-left'>
          <h1>Albums</h1>
          <p className='album-count'>{albums.length} albums</p>
        </div>
        <div className='header-right'>
          <div className='view-mode-toggle'>
            <button
              type='button'
              aria-label='Grid view'
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <span className='material-symbols-outlined'>grid_view</span>
            </button>
            <button
              type='button'
              aria-label='List view'
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <span className='material-symbols-outlined'>list</span>
            </button>
          </div>
          <div className='sort-selector'>
            <span className='sort-label'>Sort by:</span>
            <select
              className='sort-select'
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
            >
              <option value='name'>Name</option>
              <option value='artist'>Artist</option>
              <option value='year'>Year</option>
              <option value='tracks'>Track Count</option>
            </select>
            <button
              className='sort-direction'
              type='button'
              aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
              onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
            >
              <span className='material-symbols-outlined'>
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {albums.length === 0 ? (
        <p className='library-message'>Albums from your indexed music folders will appear here.</p>
      ) : (
        <div className={`albums-container ${viewMode}`}>
          {viewMode === 'grid' ? (
            <div className='albums-grid'>
              {sortedAlbums.map((album) => (
                <div key={album.id} className='album-card'>
                  <div className={`album-cover ${album.tracks[0]?.albumArt ? '' : 'album-cover-placeholder'}`}>
                    {album.tracks[0]?.albumArt ? (
                      <img src={album.tracks[0].albumArt} alt={`${album.name} cover`} />
                    ) : (
                      <span className='material-symbols-outlined' aria-hidden='true'>album</span>
                    )}
                    <button className='play-button' type='button' aria-label={`Play ${album.name}`} onClick={() => onPlayTrack(album.tracks[0])}>
                      <span className='material-symbols-outlined'>play_arrow</span>
                    </button>
                  </div>
                  <div className='album-info'>
                    <h3 className='album-name'>{album.name}</h3>
                    <p className='album-artist'>{album.artist}</p>
                    <p className='album-meta'>{album.year || 'Year unknown'} • {album.tracks.length} tracks</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='albums-list'>
              {sortedAlbums.map((album, index) => (
                <div key={album.id} className='album-list-item'>
                  <div className='album-list-number'>{index + 1}</div>
                  <div className={`album-list-cover ${album.tracks[0]?.albumArt ? '' : 'album-cover-placeholder'}`}>
                    {album.tracks[0]?.albumArt ? (
                      <img src={album.tracks[0].albumArt} alt={`${album.name} cover`} />
                    ) : (
                      <span className='material-symbols-outlined' aria-hidden='true'>album</span>
                    )}
                  </div>
                  <div className='album-list-info'>
                    <h3 className='album-list-name'>{album.name}</h3>
                    <p className='album-list-artist'>{album.artist}</p>
                  </div>
                  <div className='album-list-year'>{album.year || '—'}</div>
                  <div className='album-list-tracks'>{album.tracks.length} tracks</div>
                  <div className='album-list-duration'>
                    {formatDuration(album.tracks.reduce((total, track) => total + track.duration, 0))}
                  </div>
                  <button className='album-list-menu' type='button' aria-label={`Play ${album.name}`} onClick={() => onPlayTrack(album.tracks[0])}>
                    <span className='material-symbols-outlined'>play_arrow</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AlbumsPage;
