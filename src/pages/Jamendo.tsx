import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Track } from '../services/MusicLibrary';
import {
  createJamendoLibraryTrack,
  getJamendoClientId,
  saveJamendoClientId,
  searchJamendoTracks,
  type JamendoTrack,
} from '../services/jamendo';
import './Jamendo.css';

interface JamendoPageProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, sourceTracks: Track[]) => Promise<void>;
  onPlayPause: () => void;
}

const JamendoPage = ({
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPlayPause,
}: JamendoPageProps) => {
  const [clientId, setClientId] = useState(getJamendoClientId);
  const [clientIdDraft, setClientIdDraft] = useState('');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracks = useCallback(async (searchQuery: string, signal?: AbortSignal) => {
    if (!clientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchJamendoTracks(clientId, searchQuery, signal);
      setTracks(results);
      if (!results.length) setError('No tracks found. Try another search.');
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
      setError(loadError instanceof Error ? loadError.message : 'Could not load Jamendo tracks.');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (clientId) void loadTracks('');
  }, [clientId, loadTracks]);

  const playTrack = (track: JamendoTrack) => {
    const libraryTrack = createJamendoLibraryTrack(track);
    if (currentTrack?.id === libraryTrack.id) {
      onPlayPause();
      return;
    }
    void onPlayTrack(libraryTrack, tracks.map(createJamendoLibraryTrack));
  };

  const handleSaveClientId = () => {
    const nextClientId = clientIdDraft.trim();
    if (!nextClientId) return;
    saveJamendoClientId(nextClientId);
    setClientId(nextClientId);
    setClientIdDraft('');
  };

  const handleDisconnect = () => {
    if (currentTrack?.streamingProvider === 'jamendo' && isPlaying) onPlayPause();
    saveJamendoClientId('');
    setClientId('');
    setTracks([]);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadTracks(query);
  };

  return (
    <main className='jamendo-page'>
      <header className='jamendo-header'>
        <div>
          <p className='jamendo-eyebrow'>DISCOVER INDEPENDENT MUSIC</p>
          <h1>Jamendo</h1>
          <p>Search and stream music shared by independent artists.</p>
        </div>
        {clientId && (
          <button type='button' className='jamendo-secondary-button' onClick={handleDisconnect}>
            Change Client ID
          </button>
        )}
      </header>

      {!clientId ? (
        <section className='jamendo-setup-card'>
          <span className='material-symbols-outlined' aria-hidden='true'>music_note</span>
          <h2>Connect to Jamendo</h2>
          <p>
            Create an application in the Jamendo developer portal, then paste its Client ID here.
            Luna stores it on this device. Never enter a password or secret key.
          </p>
          <a href='https://devportal.jamendo.com/' target='_blank' rel='noreferrer'>
            Open Jamendo Developer Portal
            <span className='material-symbols-outlined' aria-hidden='true'>open_in_new</span>
          </a>
          <form
            className='jamendo-client-id-form'
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveClientId();
            }}
          >
            <label className='visually-hidden' htmlFor='jamendo-client-id'>Jamendo Client ID</label>
            <input
              id='jamendo-client-id'
              value={clientIdDraft}
              onChange={(event) => setClientIdDraft(event.currentTarget.value)}
              autoComplete='off'
              spellCheck={false}
              placeholder='Paste your Client ID'
            />
            <button type='submit' disabled={!clientIdDraft.trim()}>Save and continue</button>
          </form>
        </section>
      ) : (
        <>
          <form className='jamendo-search' onSubmit={handleSearch}>
            <span className='material-symbols-outlined' aria-hidden='true'>search</span>
            <input
              aria-label='Search Jamendo tracks'
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder='Search tracks or artists'
            />
            <button type='submit' disabled={isLoading}>
              {isLoading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {error && <p className='jamendo-error' role='alert'>{error}</p>}

          <section className='jamendo-results' aria-label='Jamendo tracks'>
            <div className='jamendo-results-heading'>
              <h2>{query.trim() ? 'Search results' : 'Popular tracks'}</h2>
              <span>{tracks.length} tracks</span>
            </div>
            {isLoading ? (
              <p className='jamendo-empty'>Loading tracks…</p>
            ) : (
              <div className='jamendo-track-list'>
                {tracks.map((track) => {
                  const isCurrent = currentTrack?.id === `jamendo-${track.id}`;
                  return (
                    <article
                      className={`jamendo-track-row ${isCurrent ? 'playing' : ''}`}
                      key={track.id}
                    >
                      <img src={track.image} alt='' loading='lazy' />
                      <div className='jamendo-track-copy'>
                        <a href={track.shareurl} target='_blank' rel='noreferrer' title={track.name}>
                          {track.name}
                        </a>
                        <span title={track.artist_name}>{track.artist_name}</span>
                        <small title={track.album_name}>{track.album_name || 'Single'}</small>
                      </div>
                      <a
                        className='jamendo-license-link'
                        href={track.license_ccurl}
                        target='_blank'
                        rel='noreferrer'
                        title='View this track’s license'
                      >
                        License
                      </a>
                      <button
                        type='button'
                        className='jamendo-play-button'
                        onClick={() => playTrack(track)}
                        aria-label={`${isCurrent && isPlaying ? 'Pause' : 'Play'} ${track.name}`}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          {isCurrent && isPlaying ? 'pause' : 'play_arrow'}
                        </span>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <p className='jamendo-attribution'>
            Music provided by <a href='https://www.jamendo.com/' target='_blank' rel='noreferrer'>Jamendo</a>.
            Track creators and licenses are linked on each result.
          </p>
        </>
      )}
    </main>
  );
};

export default JamendoPage;
