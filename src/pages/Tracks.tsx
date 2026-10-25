import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Playlist, Track } from '../services/MusicLibrary';
import TrackQueueContextMenu from '../components/TrackQueueContextMenu';
import AlphaNumericIndex, { buildAlphaNumericIndex } from '../components/AlphaNumericIndex';
import { splitArtistCredits } from '../utils/artistCredits';
import { getLibraryItemHash } from '../utils/libraryNavigation';
import { compareAlphaNumericFirst } from '../utils/alphaNumericSort';
import './Tracks.css';

type SortField = 'name' | 'artist' | 'album' | 'genre' | 'year' | 'duration';

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface TrackRowProps {
  track: Track;
  index: number;
  isPlaying: boolean;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  queueTracks: Track[];
}

const TrackRow = memo(({ track, index, isPlaying, onPlayTrack, queueTracks }: TrackRowProps) => {
  const navigate = useNavigate();
  return (
    <div
      data-track-id={track.id}
      id={`track-row-${track.id}`}
      className={`track-item ${index % 2 === 0 ? 'track-item-odd' : 'track-item-even'} ${isPlaying ? 'playing' : ''}`}
    >
      <span className='track-number' aria-hidden='true'>
        {index + 1}
      </span>
      <div className='track-title-cell'>
        <div className='track-art-thumb'>
          {track.albumArt ? (
            <img src={track.albumArt} alt='' loading='lazy' decoding='async' />
          ) : (
            <span className='material-symbols-outlined' aria-hidden='true'>
              music_note
            </span>
          )}
          <button
            className='track-art-play'
            type='button'
            aria-label={`Play ${track.name}`}
            onClick={() => onPlayTrack(track, queueTracks)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              play_arrow
            </span>
          </button>
        </div>
        <button
          className='track-name track-play-button'
          type='button'
          title={`Play ${track.name}`}
          onClick={() => onPlayTrack(track, queueTracks)}
        >
          {track.name}
        </button>
      </div>
      <div className='track-artist' title={track.artist}>
        {splitArtistCredits(track.artist).map((artist, artistIndex) => (
          <span className='track-artist-credit' key={`${artist.toLocaleLowerCase()}-${artistIndex}`}>
            {artistIndex > 0 && <span className='track-artist-separator' aria-hidden='true'>, </span>}
            <button
              className='track-library-link'
              type='button'
              title={`View artist ${artist}`}
              onClick={() => navigate(`/artists${getLibraryItemHash('artist', artist)}`)}
            >
              {artist}
            </button>
          </span>
        ))}
      </div>
      <button
        className='track-album track-library-link'
        type='button'
        title={`View album ${track.album}`}
        onClick={() => navigate(`/albums${getLibraryItemHash('album', track.album, track.artist)}`)}
      >
        {track.album}
      </button>
      {track.genre ? (
        <button
          className='track-genre track-library-link'
          type='button'
          title={`View genre ${track.genre}`}
          onClick={() => navigate(`/genres${getLibraryItemHash('genre', track.genre ?? '')}`)}
        >
          {track.genre}
        </button>
      ) : (
        <div className='track-genre' title=''>—</div>
      )}
      <div className='track-year'>{track.year || '—'}</div>
      <div className='track-duration'>{formatDuration(track.duration)}</div>
    </div>
  );
});

interface TracksPageProps {
  tracks: Track[];
  selectedTrackId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  libraryError: string | null;
  isDesktopApp: boolean;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onShufflePlay: (tracks: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  playlists: Playlist[];
  onAddTracksToPlaylist: (playlistId: string, tracks: Track[]) => void;
  onEditTrack?: (track: Track) => void;
  onAddMusicFolder: () => void;
}

const TracksPage = ({
  tracks,
  selectedTrackId,
  isPlaying,
  isLoading,
  libraryError,
  isDesktopApp,
  onPlayTrack,
  onShufflePlay,
  onQueueTracks,
  playlists,
  onAddTracksToPlaylist,
  onEditTrack,
  onAddMusicFolder,
}: TracksPageProps) => {
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedTracks = useMemo(() => [...tracks].sort((a, b) => {
    const aValue = a[sortBy] ?? '';
    const bValue = b[sortBy] ?? '';
    return compareAlphaNumericFirst(aValue, bValue, sortDirection);
  }), [sortBy, sortDirection, tracks]);

  const trackIndexEntries = useMemo(() => {
    return buildAlphaNumericIndex(
      sortedTracks,
      (track) => track[sortBy],
      (track) => `track-row-${track.id}`
    );
  }, [sortBy, sortedTracks]);

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const trackRows = sortedTracks.map((track, index) => (
    <TrackRow
      key={track.id}
      track={track}
      index={index}
      isPlaying={selectedTrackId === track.id && isPlaying}
      onPlayTrack={onPlayTrack}
      queueTracks={sortedTracks}
    />
  ));

  return (
    <div
      className={`tracks-page indexed-page-layout ${trackIndexEntries.length ? 'has-index' : ''}`}
    >
      <div className='indexed-page-content'>
        <header className='page-header'>
          <div>
            <h1>Tracks</h1>
            <p className='track-count'>{tracks.length} tracks</p>
          </div>
          <button
            className='shuffle-play-button'
            type='button'
            disabled={tracks.length === 0 || isLoading}
            onClick={() => onShufflePlay(sortedTracks)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>shuffle</span>
            Shuffle &amp; Play
          </button>
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

            <TrackQueueContextMenu
              tracks={sortedTracks}
              onQueueTracks={onQueueTracks}
              playlists={playlists}
              onAddTracksToPlaylist={onAddTracksToPlaylist}
              onEditTrack={isDesktopApp ? onEditTrack : undefined}
            >
              <div className='track-list'>{trackRows}</div>
            </TrackQueueContextMenu>
          </>
        )}
      </div>
      {trackIndexEntries.length > 0 && (
        <AlphaNumericIndex
          entries={trackIndexEntries}
          ariaLabel='Track list index'
          scrollContainerSelector='.page-content'
        />
      )}
    </div>
  );
};

export default memo(TracksPage);
