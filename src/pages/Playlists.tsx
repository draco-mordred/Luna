import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Playlist, Track } from '../services/MusicLibrary';
import PlaylistArtwork from '../components/PlaylistArtwork';
import PlaylistOptionsMenu from '../components/PlaylistOptionsMenu';
import type { PlaylistAction } from '../components/PlaylistOptionsMenu';
import './Playlists.css';

interface PlaylistsPageProps {
  playlists: Playlist[];
  tracks: Track[];
  onCreatePlaylist: (name: string) => string | null;
  onDeletePlaylist: (playlistId: string) => void;
  onAddTracks: (playlistId: string, tracks: Track[]) => void;
  onRemoveTrack: (playlistId: string, trackId: string) => void;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onShufflePlay: (tracks: Track[]) => void;
  onPlaylistAction: (playlist: Playlist, action: PlaylistAction) => void;
  message: string | null;
}

const PlaylistsPage = ({
  playlists,
  tracks,
  onCreatePlaylist,
  onDeletePlaylist,
  onAddTracks,
  onRemoveTrack,
  onPlayTrack,
  onShufflePlay,
  onPlaylistAction,
  message,
}: PlaylistsPageProps) => {
  const { playlistId } = useParams<{ playlistId?: string }>();
  const navigate = useNavigate();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const selectedPlaylist = playlists.find((playlist) => playlist.id === playlistId) ?? null;
  const selectedTracks = useMemo(() => {
    if (!selectedPlaylist) return [];
    const trackById = new Map(tracks.map((track) => [track.id, track]));
    return selectedPlaylist.trackIds
      .map((id) => trackById.get(id))
      .filter((track): track is Track => Boolean(track));
  }, [selectedPlaylist, tracks]);
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const matchingTracks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return tracks
      .filter((track) => !selectedPlaylist?.trackIds.includes(track.id))
      .filter(
        (track) =>
          !query ||
          `${track.name} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query)
      )
      .slice(0, 80);
  }, [search, selectedPlaylist, tracks]);

  const createPlaylist = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const createdId = onCreatePlaylist(newPlaylistName);
    if (createdId) {
      setNewPlaylistName('');
      setFormError(null);
      navigate(`/playlists/${encodeURIComponent(createdId)}`);
    } else {
      setFormError('A playlist with that name already exists.');
    }
  };

  return (
    <section className='playlists-page'>
      <header className='page-header'>
        <div className={selectedPlaylist ? 'playlist-detail-heading' : undefined}>
          {selectedPlaylist && (
            <PlaylistArtwork
              size='large'
              coverTrackIds={selectedPlaylist.coverTrackIds}
              tracks={selectedTracks}
            />
          )}
          <div>
            <h1>{selectedPlaylist?.name ?? 'Playlists'}</h1>
            <p>
              {selectedPlaylist
                ? `${selectedTracks.length} tracks`
                : 'Create and organize your music.'}
            </p>
            {selectedPlaylist && (
              <div className='playlist-playback-actions'>
                <button
                  type='button'
                  className='playlist-play-button'
                  disabled={selectedTracks.length === 0}
                  onClick={() => onPlayTrack(selectedTracks[0], selectedTracks)}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    play_arrow
                  </span>
                  Play
                </button>
                <button
                  type='button'
                  className='playlist-shuffle-button'
                  disabled={selectedTracks.length === 0}
                  onClick={() => onShufflePlay(selectedTracks)}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    shuffle
                  </span>
                  Shuffle
                </button>
              </div>
            )}
          </div>
        </div>
        {selectedPlaylist && (
          <div className='playlist-header-actions'>
            <button
              type='button'
              className='playlist-back-button'
              onClick={() => navigate('/playlists')}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                arrow_back
              </span>
              Back to Playlists
            </button>
            <PlaylistOptionsMenu
              playlist={selectedPlaylist}
              className='playlist-header-options'
              onAction={onPlaylistAction}
            >
              <span className='visually-hidden'></span>
            </PlaylistOptionsMenu>
          </div>
        )}
      </header>
      {message && (
        <p className='playlist-message' role='status'>
          {message}
        </p>
      )}

      {!selectedPlaylist && (
        <>
          <form className='playlist-create-form' onSubmit={createPlaylist}>
            <label className='visually-hidden' htmlFor='new-playlist-name'>
              New playlist name
            </label>
            <input
              id='new-playlist-name'
              value={newPlaylistName}
              onChange={(event) => {
                setNewPlaylistName(event.target.value);
                setFormError(null);
              }}
              placeholder='Name your playlist'
              maxLength={80}
              required
            />
            <button type='submit' disabled={!newPlaylistName.trim()}>
              Create playlist
            </button>
          </form>
          {formError && (
            <p className='playlist-message playlist-message-error' role='alert'>
              {formError}
            </p>
          )}
          {playlists.length === 0 ? (
            <div className='playlist-empty-state'>
              <span className='material-symbols-outlined' aria-hidden='true'>
                queue_music
              </span>
              <h2>No playlists yet</h2>
              <p>Create a playlist, then add tracks from your library.</p>
            </div>
          ) : (
            <div className='playlist-card-grid'>
              {playlists.map((playlist) => (
                <PlaylistOptionsMenu
                  key={playlist.id}
                  playlist={playlist}
                  className='playlist-card-menu'
                  onAction={onPlaylistAction}
                >
                  <button
                    type='button'
                    className='playlist-card'
                    onClick={() => navigate(`/playlists/${encodeURIComponent(playlist.id)}`)}
                  >
                    <PlaylistArtwork
                      size='large'
                      coverTrackIds={playlist.coverTrackIds}
                      tracks={playlist.trackIds
                        .map((id) => tracksById.get(id))
                        .filter((track): track is Track => Boolean(track))}
                    />
                    <span className='playlist-card-name'>{playlist.name}</span>
                    <span className='playlist-card-count'>{playlist.trackIds.length} tracks</span>
                  </button>
                </PlaylistOptionsMenu>
              ))}
            </div>
          )}
        </>
      )}

      {selectedPlaylist && (
        <div className='playlist-detail-layout'>
          <section className='playlist-track-list' aria-label={`${selectedPlaylist.name} tracks`}>
            {selectedTracks.length === 0 ? (
              <p className='playlist-empty-copy'>
                This playlist is empty. Add tracks from your library.
              </p>
            ) : (
              selectedTracks.map((track, index) => (
                <div className='playlist-track-row' key={`${track.id}-${index}`}>
                  <span className='playlist-track-number'>{index + 1}</span>
                  <button
                    type='button'
                    className='playlist-track-title'
                    onClick={() => onPlayTrack(track, selectedTracks)}
                  >
                    <strong>{track.name}</strong>
                    <span>
                      {track.artist} · {track.album}
                    </span>
                  </button>
                  <button
                    type='button'
                    className='playlist-remove-track'
                    aria-label={`Remove ${track.name} from ${selectedPlaylist.name}`}
                    onClick={() => onRemoveTrack(selectedPlaylist.id, track.id)}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      close
                    </span>
                  </button>
                </div>
              ))
            )}
          </section>
          <aside className='playlist-add-tracks'>
            <h2>Add tracks</h2>
            <input
              type='search'
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='Search your library'
              aria-label='Search tracks to add'
            />
            {matchingTracks.length === 0 ? (
              <p className='playlist-empty-copy'>No matching tracks to add.</p>
            ) : (
              matchingTracks.map((track) => (
                <div className='playlist-add-track-row' key={track.id}>
                  <span title={`${track.name} — ${track.artist}`}>
                    {track.name}
                    <small>{track.artist}</small>
                  </span>
                  <button
                    type='button'
                    aria-label={`Add ${track.name}`}
                    onClick={() => onAddTracks(selectedPlaylist.id, [track])}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      add
                    </span>
                  </button>
                </div>
              ))
            )}
          </aside>
          <button
            type='button'
            className='playlist-delete-button'
            onClick={() => {
              onDeletePlaylist(selectedPlaylist.id);
              navigate('/playlists');
            }}
          >
            Delete playlist
          </button>
        </div>
      )}
    </section>
  );
};

export default PlaylistsPage;
