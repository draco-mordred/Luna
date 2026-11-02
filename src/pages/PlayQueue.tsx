import { useState } from 'react';
import type { Playlist, Track } from '../services/MusicLibrary';
import './PlayQueue.css';

interface PlayQueueProps {
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  playlists: Playlist[];
  onSelectTrack: (index: number) => void;
  onClearQueue: () => void;
  onAddTracksToPlaylist: (playlistId: string, tracks: Track[]) => void;
  onSaveAsNewPlaylist: (name: string, tracks: Track[]) => boolean;
}

const PlayQueue = ({
  queue,
  currentIndex,
  isPlaying,
  playlists,
  onSelectTrack,
  onClearQueue,
  onAddTracksToPlaylist,
  onSaveAsNewPlaylist,
}: PlayQueueProps) => {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [feedback, setFeedback] = useState('');

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
          <p>{queue.length} {queue.length === 1 ? 'track' : 'tracks'}</p>
        </div>
        <button
          type='button'
          className='play-queue-clear'
          disabled={queue.length === 0}
          onClick={onClearQueue}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>delete_sweep</span>
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
              <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
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
        {feedback && <p className='play-queue-feedback' role='status'>{feedback}</p>}
      </section>

      {queue.length === 0 ? (
        <p className='play-queue-empty'>Your play queue is empty.</p>
      ) : (
        <ol className='play-queue-list'>
          {queue.map((track, index) => (
            <li
              className={`play-queue-item${index === currentIndex ? ' active' : ''}`}
              key={`${track.id}-${index}`}
            >
              <button
                type='button'
                className='play-queue-track'
                aria-current={index === currentIndex ? 'true' : undefined}
                onClick={() => onSelectTrack(index)}
              >
                <span className='play-queue-number'>
                  {index === currentIndex && isPlaying ? (
                    <span className='material-symbols-outlined' aria-hidden='true'>graphic_eq</span>
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
                  <small>{track.artist} · {track.album}</small>
                </span>
                <span className='play-queue-duration'>
                  {Number.isFinite(track.duration)
                    ? `${Math.floor(track.duration / 60)}:${String(Math.floor(track.duration % 60)).padStart(2, '0')}`
                    : '--:--'}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

export default PlayQueue;
