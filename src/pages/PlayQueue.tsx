import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Playlist, Track } from '../services/MusicLibrary';
import {
  ANDROID_QUEUE_HANDLE_HOLD_MS,
  ANDROID_QUEUE_PRESS_MOVE_THRESHOLD,
  ANDROID_QUEUE_ROW_HOLD_MS,
} from '../utils/queueReorderTiming';
import './PlayQueue.css';

interface PlayQueueProps {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isAndroidApp: boolean;
  playlists: Playlist[];
  onSelectTrack: (index: number) => void;
  onReorderTracks: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  onAddTracksToPlaylist: (playlistId: string, tracks: Track[]) => void;
  onSaveAsNewPlaylist: (name: string, tracks: Track[]) => boolean;
}

const PlayQueue = ({
  queue,
  currentIndex,
  isPlaying,
  isAndroidApp,
  playlists,
  onSelectTrack,
  onReorderTracks,
  onClearQueue,
  onAddTracksToPlaylist,
  onSaveAsNewPlaylist,
}: PlayQueueProps) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [queueDragIndex, setQueueDragIndex] = useState<number | null>(null);
  const [queueDragOverIndex, setQueueDragOverIndex] = useState<number | null>(null);
  const [queueDragTrack, setQueueDragTrack] = useState<Track | null>(null);
  const [queueDragItemHeight, setQueueDragItemHeight] = useState<number | null>(null);
  const [queueDragPosition, setQueueDragPosition] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const queueLongPressRef = useRef<number | null>(null);
  const queueLongPressPointerRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const queueDragRef = useRef<{
    pointerId: number;
    startIndex: number;
    lastIndex: number;
    startY: number;
    itemHeight: number;
    grabOffsetX: number;
    grabOffsetY: number;
    width: number;
    height: number;
  } | null>(null);
  const suppressQueueClickRef = useRef(false);

  const cancelQueueLongPress = () => {
    if (queueLongPressRef.current !== null) {
      window.clearTimeout(queueLongPressRef.current);
      queueLongPressRef.current = null;
    }
    queueLongPressPointerRef.current = null;
  };

  const scheduleQueueLongPress = (
    index: number,
    pointerId: number,
    clientX: number,
    clientY: number,
    row: HTMLElement,
    delay: number
  ) => {
    if (!isAndroidApp) return;
    cancelQueueLongPress();
    queueLongPressPointerRef.current = { pointerId, clientX, clientY };
    queueLongPressRef.current = window.setTimeout(() => {
      queueLongPressRef.current = null;
      queueLongPressPointerRef.current = null;
      const track = queue[index];
      if (!track) return;
      const rect = row.getBoundingClientRect();
      const rowGap = row.parentElement
        ? Number.parseFloat(window.getComputedStyle(row.parentElement).rowGap) || 0
        : 0;
      const itemHeight = rect.height + rowGap || 60;
      queueDragRef.current = {
        pointerId,
        startIndex: index,
        lastIndex: index,
        startY: clientY,
        itemHeight,
        grabOffsetX: clientX - rect.left,
        grabOffsetY: clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
      setQueueDragIndex(index);
      setQueueDragOverIndex(index);
      setQueueDragItemHeight(itemHeight);
      setQueueDragTrack(track);
      setQueueDragPosition({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    }, delay);
  };

  const handleQueuePressMove = (event: ReactPointerEvent<HTMLElement>) => {
    const press = queueLongPressPointerRef.current;
    if (
      press &&
      press.pointerId === event.pointerId &&
      Math.hypot(event.clientX - press.clientX, event.clientY - press.clientY) >
        ANDROID_QUEUE_PRESS_MOVE_THRESHOLD
    ) {
      cancelQueueLongPress();
    }
  };

  useEffect(() => {
    if (queueDragIndex === null) return undefined;
    const resetDrag = () => {
      queueDragRef.current = null;
      setQueueDragIndex(null);
      setQueueDragOverIndex(null);
      setQueueDragItemHeight(null);
      setQueueDragTrack(null);
      setQueueDragPosition(null);
    };
    const handleMove = (event: PointerEvent) => {
      const drag = queueDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (event.cancelable) event.preventDefault();
      const offset = Math.round((event.clientY - drag.startY) / drag.itemHeight);
      const target = Math.max(0, Math.min(queue.length - 1, drag.startIndex + offset));
      drag.lastIndex = target;
      setQueueDragOverIndex(target);
      setQueueDragPosition({
        left: event.clientX - drag.grabOffsetX,
        top: event.clientY - drag.grabOffsetY,
        width: drag.width,
        height: drag.height,
      });
    };
    const handleEnd = (event: PointerEvent) => {
      const drag = queueDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.lastIndex !== drag.startIndex) {
        onReorderTracks(drag.startIndex, drag.lastIndex);
      }
      suppressQueueClickRef.current = true;
      window.setTimeout(() => {
        suppressQueueClickRef.current = false;
      }, 0);
      resetDrag();
    };
    const handleCancel = (event: PointerEvent) => {
      if (queueDragRef.current?.pointerId === event.pointerId) resetDrag();
    };
    const preventActiveTouchScroll = (event: TouchEvent) => {
      if (queueDragRef.current && event.cancelable) event.preventDefault();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleCancel);
    window.addEventListener('touchmove', preventActiveTouchScroll, { passive: false });
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleCancel);
      window.removeEventListener('touchmove', preventActiveTouchScroll);
    };
  }, [onReorderTracks, queue.length, queueDragIndex]);

  useEffect(
    () => () => {
      if (queueLongPressRef.current !== null) {
        window.clearTimeout(queueLongPressRef.current);
      }
      queueLongPressPointerRef.current = null;
    },
    []
  );

  const handleAddToPlaylist = () => {
    if (!selectedPlaylistId || queue.length === 0) return;
    onAddTracksToPlaylist(selectedPlaylistId, queue);
    setFeedback('Queue added to playlist.');
  };

  const handleCreatePlaylist = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = onSaveAsNewPlaylist(newPlaylistName, queue);
    if (created) {
      setNewPlaylistName('');
      setFeedback('Playlist created from the queue.');
    } else {
      setFeedback('Enter a unique playlist name to continue.');
    }
  };

  return (
    <section className='play-queue-page'>
      <header className='page-header play-queue-header'>
        <div>
          <h1>Play queue</h1>
          <p>
            {queue.length} {queue.length === 1 ? 'track' : 'tracks'}
          </p>
        </div>
        <button
          type='button'
          className='play-queue-clear'
          disabled={queue.length === 0}
          onClick={onClearQueue}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            delete_sweep
          </span>
          Clear queue
        </button>
      </header>

      <section className='play-queue-save' aria-label='Save queue to a playlist'>
        <label>
          <span>Add queue to playlist</span>
          <select
            value={selectedPlaylistId}
            onChange={(event) => setSelectedPlaylistId(event.currentTarget.value)}
            disabled={queue.length === 0 || playlists.length === 0}
          >
            <option value=''>Choose a playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type='button'
          disabled={!selectedPlaylistId || queue.length === 0}
          onClick={handleAddToPlaylist}
        >
          Add queue
        </button>
        <form onSubmit={handleCreatePlaylist}>
          <label>
            <span>New playlist</span>
            <input
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.currentTarget.value)}
              placeholder='Playlist name'
              maxLength={100}
              disabled={queue.length === 0}
            />
          </label>
          <button type='submit' disabled={!newPlaylistName.trim() || queue.length === 0}>
            Create from queue
          </button>
        </form>
        {feedback && (
          <p className='play-queue-feedback' role='status'>
            {feedback}
          </p>
        )}
      </section>

      {queue.length === 0 ? (
        <p className='play-queue-empty'>Your play queue is empty.</p>
      ) : (
        <ol className='play-queue-list'>
          {queue.map((track, index) => (
            <li
              className={[
                'play-queue-item',
                index === currentIndex ? 'active' : '',
                isAndroidApp ? 'android-queue-draggable' : '',
                queueDragIndex === index ? 'dragging' : '',
                queueDragOverIndex === index && queueDragIndex !== null && queueDragIndex !== index
                  ? 'drag-over'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={`${track.id}-${index}`}
              onPointerDown={(event) => {
                if (!isAndroidApp || (event.pointerType === 'mouse' && event.button !== 0)) return;
                scheduleQueueLongPress(
                  index,
                  event.pointerId,
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                  ANDROID_QUEUE_ROW_HOLD_MS
                );
              }}
              onPointerMove={handleQueuePressMove}
              onPointerUp={cancelQueueLongPress}
              onPointerCancel={cancelQueueLongPress}
              onContextMenu={isAndroidApp ? (event) => event.preventDefault() : undefined}
              style={{
                transform:
                  queueDragIndex !== null &&
                  queueDragOverIndex !== null &&
                  queueDragIndex < queueDragOverIndex &&
                  index > queueDragIndex &&
                  index <= queueDragOverIndex
                    ? `translateY(-${queueDragItemHeight ?? 60}px)`
                    : queueDragIndex !== null &&
                        queueDragOverIndex !== null &&
                        queueDragIndex > queueDragOverIndex &&
                        index >= queueDragOverIndex &&
                        index < queueDragIndex
                      ? `translateY(${queueDragItemHeight ?? 60}px)`
                      : undefined,
              }}
            >
              <button
                type='button'
                className='play-queue-track'
                aria-current={index === currentIndex ? 'true' : undefined}
                onClick={(event) => {
                  if (suppressQueueClickRef.current) {
                    event.preventDefault();
                    suppressQueueClickRef.current = false;
                    return;
                  }
                  onSelectTrack(index);
                }}
              >
                <span className='play-queue-number'>
                  {index === currentIndex && isPlaying ? (
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      graphic_eq
                    </span>
                  ) : (
                    index + 1
                  )}
                </span>
                {track.albumArt ? (
                  <img src={track.albumArt} alt='' loading='lazy' decoding='async' />
                ) : (
                  <span className='material-symbols-outlined play-queue-art' aria-hidden='true'>
                    music_note
                  </span>
                )}
                <span className='play-queue-track-copy'>
                  <strong>{track.name}</strong>
                  <small>
                    {track.artist} · {track.album}
                  </small>
                </span>
                <span className='play-queue-duration'>
                  {Number.isFinite(track.duration)
                    ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}`
                    : '--:--'}
                </span>
              </button>
              {isAndroidApp && (
                <button
                  type='button'
                  className='play-queue-drag-handle'
                  aria-label={`Reorder ${track.name}`}
                  onPointerDown={(event) => {
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const row = event.currentTarget.closest<HTMLElement>('.play-queue-item');
                    if (row) {
                      scheduleQueueLongPress(
                        index,
                        event.pointerId,
                        event.clientX,
                        event.clientY,
                        row,
                        ANDROID_QUEUE_HANDLE_HOLD_MS
                      );
                    }
                  }}
                  onPointerMove={handleQueuePressMove}
                  onPointerUp={cancelQueueLongPress}
                  onPointerCancel={cancelQueueLongPress}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    drag_indicator
                  </span>
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {queueDragTrack && queueDragPosition && queueDragIndex !== null && (
        <div
          className='play-queue-drag-preview'
          style={{
            left: queueDragPosition.left,
            top: queueDragPosition.top,
            width: queueDragPosition.width,
            height: queueDragPosition.height,
          }}
          aria-hidden='true'
        >
          <span className='play-queue-number'>{queueDragIndex + 1}</span>
          {queueDragTrack.albumArt ? (
            <img className='play-queue-art' src={queueDragTrack.albumArt} alt='' />
          ) : (
            <span className='material-symbols-outlined play-queue-art' aria-hidden='true'>
              music_note
            </span>
          )}
          <span className='play-queue-track-copy'>
            <strong>{queueDragTrack.name}</strong>
            <small>
              {queueDragTrack.artist} · {queueDragTrack.album}
            </small>
          </span>
          <span className='material-symbols-outlined' aria-hidden='true'>
            drag_indicator
          </span>
        </div>
      )}
    </section>
  );
};

export default PlayQueue;
