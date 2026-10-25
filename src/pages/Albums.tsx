import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import AlphaNumericIndex, { buildAlphaNumericIndex } from '../components/AlphaNumericIndex';
import QueueContextMenu from '../components/QueueContextMenu';
import { getLibraryItemHash, getLibraryItemPath, useScrollToLibraryItem } from '../utils/libraryNavigation';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import { compareAlphaNumericFirst } from '../utils/alphaNumericSort';
import './Albums.css';

interface AlbumSummary {
  id: string;
  name: string;
  artist: string;
  year?: number;
  firstTrack: Track;
  trackCount: number;
  duration: number;
  tracks: Track[];
}

interface AlbumsPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onShufflePlay: (tracks: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

interface AlbumCardProps {
  album: AlbumSummary;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onOpen: () => void;
}

const AlbumCard = memo(({ album, onPlayTrack, onOpen }: AlbumCardProps) => (
  <section
    id={getLibraryItemHash('album', album.name, album.artist).slice(1)}
    className='album-card'
    role='link'
    tabIndex={0}
    aria-label={`Open ${album.name} by ${album.artist}`}
    onClick={(event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      onOpen();
    }}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      onOpen();
    }}
  >
    <div className={`album-cover ${album.firstTrack.albumArt ? '' : 'album-cover-placeholder'}`}>
      {album.firstTrack.albumArt ? (
        <img
          src={album.firstTrack.albumArt}
          alt={`${album.name} cover`}
          loading='lazy'
          decoding='async'
        />
      ) : (
        <span className='material-symbols-outlined' aria-hidden='true'>
          album
        </span>
      )}
      <button
        className='play-button'
        type='button'
        aria-label={`Play ${album.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onPlayTrack(album.firstTrack, album.tracks);
        }}
      >
        <span className='material-symbols-outlined'>play_arrow</span>
      </button>
    </div>
    <div className='album-info'>
      <button type='button' className='collection-expand-title' onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}>
        <span className='album-name'>{album.name}</span>
      </button>
      <p className='album-artist'>{album.artist}</p>
      <p className='album-meta'>
        {album.year || 'Year unknown'} • {album.trackCount} tracks
      </p>
    </div>
  </section>
));

interface AlbumListItemProps extends AlbumCardProps {
  index: number;
}

const AlbumListItem = memo(({ album, index, onPlayTrack, onOpen }: AlbumListItemProps) => (
  <section
    id={getLibraryItemHash('album', album.name, album.artist).slice(1)}
    className='album-list-entry'
  >
    <div
      className='album-list-item'
      role='link'
      tabIndex={0}
      aria-label={`Open ${album.name} by ${album.artist}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen();
      }}
    >
      <div className='album-list-number'>{index + 1}</div>
      <div
        className={`album-list-cover ${album.firstTrack.albumArt ? '' : 'album-cover-placeholder'}`}
      >
        {album.firstTrack.albumArt ? (
          <img
            src={album.firstTrack.albumArt}
            alt={`${album.name} cover`}
            loading='lazy'
            decoding='async'
          />
        ) : (
          <span className='material-symbols-outlined' aria-hidden='true'>
            album
          </span>
        )}
      </div>
      <div className='album-list-info'>
        <button type='button' className='collection-expand-title' onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}>
          <span className='album-list-name'>{album.name}</span>
        </button>
        <p className='album-list-artist'>{album.artist}</p>
      </div>
      <div className='album-list-year'>{album.year || '—'}</div>
      <div className='album-list-tracks'>{album.trackCount} tracks</div>
      <div className='album-list-duration'>{formatDuration(album.duration)}</div>
      <button
        className='album-list-menu'
        type='button'
        aria-label={`Play ${album.name}`}
        onClick={(event) => {
          event.stopPropagation();
          onPlayTrack(album.firstTrack, album.tracks);
        }}
      >
        <span className='material-symbols-outlined'>play_arrow</span>
      </button>
    </div>
  </section>
));

const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const AlbumsPage = ({ tracks, onPlayTrack, onShufflePlay, onQueueTracks }: AlbumsPageProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'artist' | 'year' | 'tracks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const navigate = useNavigate();
  useScrollToLibraryItem();

  const albums = useMemo(() => {
    const albumsById = new Map<string, AlbumSummary>();
    tracks.forEach((track) => {
      const id = `${track.album.toLocaleLowerCase()}::${track.artist.toLocaleLowerCase()}`;
      const album = albumsById.get(id) ?? {
        id,
        name: track.album,
        artist: track.artist,
        year: track.year,
        firstTrack: track,
        trackCount: 0,
        duration: 0,
        tracks: [],
      };
      album.trackCount += 1;
      album.duration += track.duration;
      album.tracks.push(track);
      if (track.year && (!album.year || track.year < album.year)) album.year = track.year;
      albumsById.set(id, album);
    });
    return Array.from(albumsById.values()).map((album) => {
      const orderedTracks = sortCollectionTracks(album.tracks);
      return {
        ...album,
        tracks: orderedTracks,
        firstTrack: orderedTracks[0],
      };
    });
  }, [tracks]);

  const sortedAlbums = useMemo(
    () =>
      [...albums].sort((a, b) => {
        const aValue = sortBy === 'tracks' ? a.trackCount : (a[sortBy] ?? '');
        const bValue = sortBy === 'tracks' ? b.trackCount : (b[sortBy] ?? '');
        return compareAlphaNumericFirst(aValue, bValue, sortDirection);
      }),
    [albums, sortBy, sortDirection]
  );
  const albumIndexEntries = useMemo(
    () =>
      buildAlphaNumericIndex(
        sortedAlbums,
        (album) => (sortBy === 'tracks' ? album.trackCount : album[sortBy]),
        (album) => getLibraryItemHash('album', album.name, album.artist).slice(1)
      ),
    [sortBy, sortedAlbums]
  );

  return (
    <div className='albums-page'>
      <header className='page-header'>
        <div className='header-left'>
          <h1>Albums</h1>
          <p className='album-count'>{albums.length} albums</p>
        </div>
        <div className='header-right'>
          <button
            className='shuffle-play-button'
            type='button'
            disabled={tracks.length === 0}
            onClick={() => onShufflePlay(tracks)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>shuffle</span>
            Shuffle &amp; Play
          </button>
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
        <div className='indexed-list-layout'>
          <div className={`albums-container ${viewMode}`}>
            {viewMode === 'grid' ? (
              <div className='albums-grid'>
                {sortedAlbums.map((album) => (
                  <QueueContextMenu key={album.id} tracks={album.tracks} onQueueTracks={onQueueTracks}>
                    <AlbumCard
                      album={album}
                      onPlayTrack={onPlayTrack}
                      onOpen={() => navigate(getLibraryItemPath('album', album.name, album.artist))}
                    />
                  </QueueContextMenu>
                ))}
              </div>
            ) : (
              <div className='albums-list'>
                {sortedAlbums.map((album, index) => (
                  <QueueContextMenu key={album.id} tracks={album.tracks} onQueueTracks={onQueueTracks}>
                    <AlbumListItem
                      album={album}
                      index={index}
                      onPlayTrack={onPlayTrack}
                      onOpen={() => navigate(getLibraryItemPath('album', album.name, album.artist))}
                    />
                  </QueueContextMenu>
                ))}
              </div>
            )}
          </div>
          <AlphaNumericIndex
            entries={albumIndexEntries}
            ariaLabel='Album list index'
            scrollContainerSelector='.page-content'
          />
        </div>
      )}
    </div>
  );
};

export default memo(AlbumsPage);
