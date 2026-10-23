import { useMemo, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
import './Tracks.css';

type SortField = 'name' | 'artist' | 'album' | 'genre' | 'year' | 'duration';

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface TracksPageProps {
  tracks: Track[];
  selectedTrackId: string | null;
  isLoading: boolean;
  libraryError: string | null;
  isDesktopApp: boolean;
  onPlayTrack: (track: Track) => void;
  onAddMusicFolder: () => void;
}

const TracksPage = ({
  tracks,
  selectedTrackId,
  isLoading,
  libraryError,
  isDesktopApp,
  onPlayTrack,
  onAddMusicFolder,
}: TracksPageProps) => {
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedTracks = useMemo(() => [...tracks].sort((a, b) => {
    const aValue = a[sortBy] ?? '';
    const bValue = b[sortBy] ?? '';
    const comparison = typeof aValue === 'number' && typeof bValue === 'number'
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));

    return sortDirection === 'asc' ? comparison : -comparison;
  }), [sortBy, sortDirection, tracks]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const trackRows = useMemo(() => sortedTracks.map((track, index) => (
    <div
      key={track.id}
      className={`track-item ${selectedTrackId === track.id ? 'selected' : ''}`}
    >
      <span className='track-number' aria-hidden='true'>{index + 1}</span>
      <div className='track-title-cell'>
        <div className='track-art-thumb' aria-hidden='true'>
          {track.albumArt ? (
            <img src={track.albumArt} alt='' loading='lazy' decoding='async' />
          ) : (
            <span className='material-symbols-outlined'>music_note</span>
          )}
        </div>
        <button
          className='track-name track-play-button'
          type='button'
          title={`Play ${track.name}`}
          onClick={() => onPlayTrack(track)}
        >
          {track.name}
        </button>
      </div>
      <div className='track-artist' title={track.artist}>{track.artist}</div>
      <div className='track-album' title={track.album}>{track.album}</div>
      <div className='track-genre' title={track.genre || ''}>{track.genre || '—'}</div>
      <div className='track-year'>{track.year || '—'}</div>
      <div className='track-duration'>{formatDuration(track.duration)}</div>
      <button className='track-menu' type='button' aria-label={`More options for ${track.name}`}>
        <span className='material-symbols-outlined'>more_vert</span>
      </button>
    </div>
  )), [onPlayTrack, selectedTrackId, sortedTracks]);

  return (
    <div className='tracks-page'>
      <header className='page-header'>
        <h1>Tracks</h1>
        <p className='track-count'>{tracks.length} tracks</p>
      </header>

      {libraryError && <p className='library-message library-error' role='alert'>{libraryError}</p>}

      {isLoading ? (
        <p className='library-message'>Scanning your music folders…</p>
      ) : tracks.length === 0 ? (
        <section className='library-empty-state'>
          <span className='material-symbols-outlined' aria-hidden='true'>library_music</span>
          <h2>Your music library is empty</h2>
          <p>
            {isDesktopApp
              ? 'Choose a folder containing your music files to add them to Luna.'
              : 'Local music folders can be indexed and played in the Luna desktop app.'}
          </p>
          {isDesktopApp && (
            <button className='add-music-folder-button' type='button' onClick={onAddMusicFolder}>
              <span className='material-symbols-outlined' aria-hidden='true'>folder_open</span>
              Add Music Folder
            </button>
          )}
        </section>
      ) : (
        <>
          <div className='track-list-header'>
            <span aria-hidden='true' />
            {([
              ['name', 'Name'],
              ['artist', 'Artist'],
              ['album', 'Album'],
              ['genre', 'Genre'],
              ['year', 'Year'],
              ['duration', 'Duration'],
            ] as Array<[SortField, string]>).map(([field, label]) => (
              <button
                key={field}
                type='button'
                className={`sort-button ${sortBy === field ? 'active' : ''}`}
                aria-label={sortBy === field
                  ? `${label}, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}`
                  : label}
                onClick={() => handleSort(field)}
              >
                <span>{label}</span>
                {sortBy === field && (
                  <span className='material-symbols-outlined sort-icon' aria-hidden='true'>
                    {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                  </span>
                )}
              </button>
            ))}
            <span aria-hidden='true' />
          </div>

          <div className='track-list'>
            {trackRows}
          </div>
        </>
      )}
    </div>
  );
};

export default TracksPage;
