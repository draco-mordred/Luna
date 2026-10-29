import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Playlist, Track } from '../services/MusicLibrary';
import TrackQueueContextMenu from '../components/TrackQueueContextMenu';
import AlphaNumericIndex, {
  buildAlphaNumericIndex,
  getAlphaNumericLabel,
  type AlphaNumericIndexEntry,
} from '../components/AlphaNumericIndex';
import { splitArtistCredits } from '../utils/artistCredits';
import { getLibraryItemHash } from '../utils/libraryNavigation';
import { compareAlphaNumericFirst, sortByTrackTitle } from '../utils/alphaNumericSort';
import { useAndroidAlbumArtwork } from '../hooks/useAndroidAlbumArtwork';
import type { MusicLibraryScanProgress } from '../types/electron';
import './Tracks.css';

const TRACK_ROW_HEIGHT = 56;
const TRACK_LIST_OVERSCAN = 12;

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
  style?: CSSProperties;
}

const TrackRow = memo(
  ({ track, index, isPlaying, onPlayTrack, queueTracks, style }: TrackRowProps) => {
    const navigate = useNavigate();
    const { elementRef, imageUrl } = useAndroidAlbumArtwork(track);
    return (
      <div
        data-track-id={track.id}
        id={`track-row-${track.id}`}
        className={`track-item ${index % 2 === 0 ? 'track-item-odd' : 'track-item-even'} ${isPlaying ? 'playing' : ''}`}
        style={style}
      >
        <span className='track-number' aria-hidden='true'>
          {index + 1}
        </span>
        <div className='track-title-cell'>
          <div ref={elementRef} className='track-art-thumb'>
            {imageUrl ? (
              <img src={imageUrl} alt='' loading='lazy' decoding='async' />
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
            <span
              className='track-artist-credit'
              key={`${artist.toLocaleLowerCase()}-${artistIndex}`}
            >
              {artistIndex > 0 && (
                <span className='track-artist-separator' aria-hidden='true'>
                  ,{' '}
                </span>
              )}
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
          onClick={() =>
            navigate(`/albums${getLibraryItemHash('album', track.album, track.artist)}`)
          }
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
          <div className='track-genre' title=''>
            —
          </div>
        )}
        <div className='track-year'>{track.year || '—'}</div>
        <div className='track-duration'>{formatDuration(track.duration)}</div>
      </div>
    );
  }
);

interface VirtualizedTrackRowsProps {
  tracks: Track[];
  selectedTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onVisibleIndexChange: (index: number) => void;
}

const VirtualizedTrackRows = memo(
  ({
    tracks,
    selectedTrackId,
    isPlaying,
    onPlayTrack,
    onVisibleIndexChange,
  }: VirtualizedTrackRowsProps) => {
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 40 });

    useEffect(() => {
      const scrollContainer = document.querySelector<HTMLElement>('.page-content');
      if (!scrollContainer) return undefined;

      let animationFrame = 0;
      const updateVisibleRange = () => {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = window.requestAnimationFrame(() => {
          const list = document.getElementById('virtualized-track-list');
          if (!list) return;
          const listTop =
            scrollContainer.scrollTop +
            list.getBoundingClientRect().top -
            scrollContainer.getBoundingClientRect().top;
          const navbarHeight =
            document.querySelector<HTMLElement>('.top-navbar')?.getBoundingClientRect().height ?? 0;
          const firstVisibleIndex = Math.max(
            0,
            Math.min(
              tracks.length - 1,
              Math.floor((scrollContainer.scrollTop + navbarHeight - listTop) / TRACK_ROW_HEIGHT)
            )
          );
          const visibleCount = Math.ceil(scrollContainer.clientHeight / TRACK_ROW_HEIGHT);
          const start = Math.max(0, firstVisibleIndex - TRACK_LIST_OVERSCAN);
          const end = Math.min(
            tracks.length,
            firstVisibleIndex + visibleCount + TRACK_LIST_OVERSCAN
          );
          setVisibleRange((current) =>
            current.start === start && current.end === end ? current : { start, end }
          );
          onVisibleIndexChange(firstVisibleIndex);
        });
      };

      updateVisibleRange();
      scrollContainer.addEventListener('scroll', updateVisibleRange, { passive: true });
      window.addEventListener('resize', updateVisibleRange);
      return () => {
        window.cancelAnimationFrame(animationFrame);
        scrollContainer.removeEventListener('scroll', updateVisibleRange);
        window.removeEventListener('resize', updateVisibleRange);
      };
    }, [onVisibleIndexChange, tracks.length]);

    return (
      <div
        id='virtualized-track-list'
        className='track-list track-list-virtualized'
        style={{ height: tracks.length * TRACK_ROW_HEIGHT }}
      >
        {tracks.slice(visibleRange.start, visibleRange.end).map((track, offset) => {
          const index = visibleRange.start + offset;
          return (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              isPlaying={selectedTrackId === track.id && isPlaying}
              onPlayTrack={onPlayTrack}
              queueTracks={tracks}
              style={{
                position: 'absolute',
                top: index * TRACK_ROW_HEIGHT,
                left: 0,
                right: 0,
                height: TRACK_ROW_HEIGHT - 4,
              }}
            />
          );
        })}
      </div>
    );
  }
);

interface TracksPageProps {
  tracks: Track[];
  selectedTrackId: string | null;
  isPlaying: boolean;
  isLoading: boolean;
  scanProgress: MusicLibraryScanProgress | null;
  libraryError: string | null;
  isDesktopApp: boolean;
  isAndroidApp: boolean;
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
  scanProgress,
  libraryError,
  isDesktopApp,
  isAndroidApp,
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

  const sortedTracks = useMemo(() => {
    if (sortBy === 'name') return sortByTrackTitle(tracks, sortDirection);
    return [...tracks].sort((a, b) => {
      const aValue = a[sortBy] ?? '';
      const bValue = b[sortBy] ?? '';
      return compareAlphaNumericFirst(aValue, bValue, sortDirection);
    });
  }, [sortBy, sortDirection, tracks]);

  const trackIndexEntries = useMemo(() => {
    return buildAlphaNumericIndex(
      sortedTracks,
      (track) => (sortBy === 'name' ? track.name.trim() : track[sortBy]),
      (track) => `track-row-${track.id}`
    );
  }, [sortBy, sortedTracks]);
  const [activeIndexTargetId, setActiveIndexTargetId] = useState<string | null>(
    trackIndexEntries[0]?.targetId ?? null
  );
  const trackIndexById = useMemo(
    () => new Map(sortedTracks.map((track, index) => [track.id, index])),
    [sortedTracks]
  );

  const updateActiveIndex = useCallback(
    (visibleIndex: number) => {
      const visibleTrack = sortedTracks[visibleIndex];
      if (!visibleTrack) return;
      const label = getAlphaNumericLabel(
        sortBy === 'name' ? visibleTrack.name.trim() : visibleTrack[sortBy]
      );
      const targetId = trackIndexEntries.find((entry) => entry.label === label)?.targetId ?? null;
      setActiveIndexTargetId((current) => (current === targetId ? current : targetId));
    },
    [sortBy, sortedTracks, trackIndexEntries]
  );

  const jumpToTrackIndex = useCallback(
    (entry: AlphaNumericIndexEntry) => {
      const trackIndex = trackIndexById.get(entry.targetId.slice('track-row-'.length));
      const scrollContainer = document.querySelector<HTMLElement>('.page-content');
      const list = document.getElementById('virtualized-track-list');
      if (trackIndex === undefined || !scrollContainer || !list) return;
      setActiveIndexTargetId(entry.targetId);
      const listTop =
        scrollContainer.scrollTop +
        list.getBoundingClientRect().top -
        scrollContainer.getBoundingClientRect().top -
        scrollContainer.clientTop;
      const navbarHeight =
        document.querySelector<HTMLElement>('.top-navbar')?.getBoundingClientRect().height ?? 0;
      scrollContainer.scrollTo({
        top: listTop + trackIndex * TRACK_ROW_HEIGHT - navbarHeight,
        behavior: 'smooth',
      });
    },
    [trackIndexById]
  );

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

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
            <span className='material-symbols-outlined' aria-hidden='true'>
              shuffle
            </span>
            Shuffle &amp; Play
          </button>
        </header>

        {libraryError && (
          <p className='library-message library-error' role='alert'>
            {libraryError}
          </p>
        )}

        {isLoading && tracks.length > 0 && (
          <p className='library-message' role='status'>
            {scanProgress?.phase === 'discovering' || !scanProgress?.total
              ? 'Finding music files…'
              : `Reading music files: ${scanProgress.scanned.toLocaleString()} of ${scanProgress.total.toLocaleString()}…`}{' '}
            You can start listening while the scan continues.
          </p>
        )}

        {tracks.length === 0 && isLoading ? (
          <p className='library-message' role='status'>
            {scanProgress?.phase === 'reading' && scanProgress.total > 0
              ? `Reading music files: ${scanProgress.scanned.toLocaleString()} of ${scanProgress.total.toLocaleString()}…`
              : 'Finding music files…'}
          </p>
        ) : tracks.length === 0 ? (
          <section className='library-empty-state'>
            <span className='material-symbols-outlined' aria-hidden='true'>
              library_music
            </span>
            <h2>Your music library is empty</h2>
            <p>
              {isDesktopApp
                ? 'Choose a folder containing your music files to add them to Luna.'
                : isAndroidApp
                  ? 'Scan audio files available in your Android media library.'
                  : 'Local music folders can be indexed and played in the Luna desktop app.'}
            </p>
            {(isDesktopApp || isAndroidApp) && (
              <button className='add-music-folder-button' type='button' onClick={onAddMusicFolder}>
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {isAndroidApp ? 'library_music' : 'folder_open'}
                </span>
                {isAndroidApp ? 'Scan Device Library' : 'Add Music Folder'}
              </button>
            )}
          </section>
        ) : (
          <>
            <div className='track-list-header'>
              <span aria-hidden='true' />
              {(
                [
                  ['name', 'Name'],
                  ['artist', 'Artist'],
                  ['album', 'Album'],
                  ['genre', 'Genre'],
                  ['year', 'Year'],
                  ['duration', 'Duration'],
                ] as Array<[SortField, string]>
              ).map(([field, label]) => (
                <button
                  key={field}
                  type='button'
                  className={`sort-button ${sortBy === field ? 'active' : ''}`}
                  aria-label={
                    sortBy === field
                      ? `${label}, sorted ${sortDirection === 'asc' ? 'ascending' : 'descending'}`
                      : label
                  }
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
              <VirtualizedTrackRows
                tracks={sortedTracks}
                selectedTrackId={selectedTrackId}
                isPlaying={isPlaying}
                onPlayTrack={onPlayTrack}
                onVisibleIndexChange={updateActiveIndex}
              />
            </TrackQueueContextMenu>
          </>
        )}
      </div>
      {trackIndexEntries.length > 0 && (
        <AlphaNumericIndex
          entries={trackIndexEntries}
          ariaLabel='Track list index'
          scrollContainerSelector='.page-content'
          activeTargetId={activeIndexTargetId}
          onJumpToEntry={jumpToTrackIndex}
        />
      )}
    </div>
  );
};

export default memo(TracksPage);
