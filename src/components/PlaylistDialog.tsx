import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Playlist, Track } from '../services/MusicLibrary';
import './PlaylistDialog.css';

export type PlaylistDialogState =
  | { type: 'rename'; playlist: Playlist }
  | { type: 'add-track'; track: Track }
  | { type: 'delete'; playlist: Playlist };

interface PlaylistDialogProps {
  dialog: PlaylistDialogState;
  playlists: Playlist[];
  onClose: () => void;
  onRename: (playlist: Playlist, name: string) => string | null;
  onAddTrack: (track: Track, playlistId: string | null, newPlaylistName: string) => string | null;
  onDelete: (playlist: Playlist) => void;
}

const PlaylistDialog = ({
  dialog,
  playlists,
  onClose,
  onRename,
  onAddTrack,
  onDelete,
}: PlaylistDialogProps) => {
  const initialPlaylistId = playlists[0]?.id ?? '__new__';
  const [name, setName] = useState(dialog.type === 'rename' ? dialog.playlist.name : '');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(initialPlaylistId);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    if (dialog.type === 'rename') nameInputRef.current?.select();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [dialog, onClose]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (dialog.type === 'rename') {
      const result = onRename(dialog.playlist, name);
      if (result) {
        setError(result);
        return;
      }
      onClose();
      return;
    }

    if (dialog.type === 'add-track') {
      const result = onAddTrack(
        dialog.track,
        selectedPlaylistId === '__new__' ? null : selectedPlaylistId,
        name,
      );
      if (result) {
        setError(result);
        return;
      }
      onClose();
    }
  };

  const isDelete = dialog.type === 'delete';
  const isRename = dialog.type === 'rename';
  const createNewPlaylist = selectedPlaylistId === '__new__';
  const title = isRename
    ? 'Rename playlist'
    : isDelete
      ? 'Delete playlist?'
      : 'Add track to playlist';

  return (
    <div
      className="playlist-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="playlist-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="playlist-dialog-title"
      >
        <h2 id="playlist-dialog-title">{title}</h2>
        {isDelete ? (
          <>
            <p>“{dialog.playlist.name}” and its saved track list will be deleted.</p>
            <div className="playlist-dialog-actions">
              <button type="button" className="playlist-dialog-secondary" onClick={onClose}>Cancel</button>
              <button
                type="button"
                className="playlist-dialog-danger"
                onClick={() => {
                  onDelete(dialog.playlist);
                  onClose();
                }}
              >
                Delete playlist
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {dialog.type === 'add-track' && (
              <>
                <p>Add “{dialog.track.name}” to:</p>
                <label className="visually-hidden" htmlFor="playlist-dialog-select">Playlist</label>
                <select
                  id="playlist-dialog-select"
                  value={selectedPlaylistId}
                  onChange={(event) => {
                    setSelectedPlaylistId(event.target.value);
                    setError(null);
                  }}
                >
                  {playlists.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>{playlist.name}</option>
                  ))}
                  <option value="__new__">Create a new playlist…</option>
                </select>
              </>
            )}
            {(isRename || createNewPlaylist) && (
              <>
                <label className="visually-hidden" htmlFor="playlist-dialog-name">
                  {isRename ? 'New playlist name' : 'New playlist name'}
                </label>
                <input
                  ref={nameInputRef}
                  id="playlist-dialog-name"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  placeholder="Playlist name"
                  maxLength={80}
                  required
                />
              </>
            )}
            {error && <p className="playlist-dialog-error" role="alert">{error}</p>}
            <div className="playlist-dialog-actions">
              <button type="button" className="playlist-dialog-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="playlist-dialog-primary">
                {isRename ? 'Save changes' : 'Add track'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default PlaylistDialog;
