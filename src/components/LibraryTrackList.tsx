import type { Track } from '../services/MusicLibrary';
import QueueContextMenu from './QueueContextMenu';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import './LibraryTrackList.css';

interface LibraryTrackListProps {
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  variant?: 'default' | 'album-details';
}

const formatTrackDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
};

const LibraryTrackList = ({
  tracks,
  onPlayTrack,
  onQueueTracks,
  variant = 'default',
}: LibraryTrackListProps) => {
  const orderedTracks = sortCollectionTracks(tracks);
  return (
    <ol
      className={`library-track-list${variant === 'album-details' ? ' album-details-track-list' : ''}`}
    >
      {orderedTracks.map((track, index) => (
        <QueueContextMenu
          key={track.id}
          tracks={[track]}
          onQueueTracks={onQueueTracks}
          asListItem
          showTrigger={variant === 'album-details'}
        >
          {variant === 'album-details' ? (
            <button
              type='button'
              className='library-track-row library-track-row-album-details'
              onClick={() => onPlayTrack(track, orderedTracks)}
              aria-label={`Play ${track.name} by ${track.artist}`}
            >
              <span className='library-track-number'>{track.trackNumber ?? index + 1}</span>
              <span className='library-track-copy'>
                <span className='library-track-title'>{track.name}</span>
                <span className='library-track-artist'>{track.artist}</span>
              </span>
            </button>
          ) : (
            <button
              type='button'
              className='library-track-row'
              onClick={() => onPlayTrack(track, orderedTracks)}
              aria-label={`Play ${track.name} by ${track.artist}`}
            >
              <span className='library-track-number'>{track.trackNumber ?? index + 1}</span>
              <span className='library-track-title'>{track.name}</span>
              <span className='library-track-artist'>{track.artist}</span>
              <span className='library-track-year'>{track.year ?? '—'}</span>
              <span className='library-track-duration'>{formatTrackDuration(track.duration)}</span>
            </button>
          )}
        </QueueContextMenu>
      ))}
    </ol>
  );
};

export default LibraryTrackList;
