import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Track } from '../services/MusicLibrary';
import {
  clearAudiomackCredentials,
  createAudiomackLibraryTrack,
  hasAudiomackCredentials,
  saveAudiomackCredentials,
  searchAudiomackTracks,
  type AudiomackTrack,
} from '../services/audiomack';
import './Jamendo.css';

interface AudiomackPageProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, sourceTracks: Track[]) => Promise<void>;
  onPlayPause: () => void;
}

const AudiomackPage = ({
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPlayPause,
}: AudiomackPageProps) => {
  const isDesktop = Boolean(window.electronAPI);
  const [isConnected, setIsConnected] = useState(false);
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<AudiomackTrack[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTracks = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await searchAudiomackTracks(searchQuery);
      setTracks(results);
      if (results.length === 0) setError('No songs found. Try another search.');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load Audiomack songs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isDesktop) return undefined;
    let cancelled = false;
    hasAudiomackCredentials()
      .then((connected) => {
        if (!cancelled) setIsConnected(connected);
      })
      .catch((statusError: unknown) => {
        if (!cancelled) {
          setError(statusError instanceof Error ? statusError.message : 'Could not check Audiomack credentials.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isDesktop]);

  useEffect(() => {
    if (isConnected) void loadTracks('');
  }, [isConnected, loadTracks]);

  const handleConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsConnecting(true);
    setError(null);
    try {
      await saveAudiomackCredentials(consumerKey, consumerSecret);
      setConsumerKey('');
      setConsumerSecret('');
      setIsConnected(true);
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : 'Could not save Audiomack credentials.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    try {
      await clearAudiomackCredentials();
      if (currentTrack?.streamingProvider === 'audiomack' && isPlaying) onPlayPause();
      setIsConnected(false);
      setTracks([]);
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Could not remove Audiomack credentials.');
    }
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadTracks(query);
  };

  const handlePlay = (track: AudiomackTrack) => {
    const libraryTrack = createAudiomackLibraryTrack(track);
    if (currentTrack?.id === libraryTrack.id) {
      onPlayPause();
      return;
    }
    void onPlayTrack(
      libraryTrack,
      tracks.map(createAudiomackLibraryTrack)
    );
  };

  return (
    <main className='jamendo-page'>
      <header className='jamendo-header'>
        <div>
          <p className='jamendo-eyebrow'>DISCOVER MUSIC ON AUDIOMACK</p>
          <h1>Audiomack</h1>
          <p>Search Audiomack songs and play them through Luna’s shared player.</p>
        </div>
        {isConnected && (
          <button type='button' className='jamendo-secondary-button' onClick={() => void handleDisconnect()}>
            Disconnect
          </button>
        )}
      </header>

      {!isDesktop ? (
        <section className='jamendo-setup-card'>
          <h2>Desktop app required</h2>
          <p>
            Audiomack credentials are handled by Luna’s Electron main process and are not supported
            in the browser-only version.
          </p>
        </section>
      ) : !isConnected ? (
        <section className='jamendo-setup-card'>
          <span className='material-symbols-outlined' aria-hidden='true'>headphones</span>
          <h2>Connect to Audiomack</h2>
          <p>
            Audiomack’s API uses OAuth 1.0a consumer credentials. Get an authorized consumer key
            and secret from Audiomack, then enter them here. Luna encrypts the credentials using
            your operating system’s secure storage; they are not bundled with the app.
          </p>
          <a href='https://audiomack.com/data-api/docs' target='_blank' rel='noreferrer'>
            Read Audiomack API documentation
            <span className='material-symbols-outlined' aria-hidden='true'>open_in_new</span>
          </a>
          <form className='jamendo-client-id-form' onSubmit={(event) => void handleConnect(event)}>
            <label className='visually-hidden' htmlFor='audiomack-consumer-key'>Consumer key</label>
            <input
              id='audiomack-consumer-key'
              value={consumerKey}
              onChange={(event) => setConsumerKey(event.currentTarget.value)}
              autoComplete='off'
              spellCheck={false}
              placeholder='Audiomack consumer key'
              required
            />
            <label className='visually-hidden' htmlFor='audiomack-consumer-secret'>Consumer secret</label>
            <input
              id='audiomack-consumer-secret'
              type='password'
              value={consumerSecret}
              onChange={(event) => setConsumerSecret(event.currentTarget.value)}
              autoComplete='new-password'
              placeholder='Audiomack consumer secret'
              required
            />
            <button type='submit' disabled={isConnecting}>
              {isConnecting ? 'Connecting…' : 'Save credentials'}
            </button>
          </form>
          <p className='jamendo-attribution'>
            Audiomack API access and use are subject to Audiomack approval and terms. Luna requests
            stream URLs only when playback begins and sends a session identifier for play tracking.
          </p>
        </section>
      ) : (
        <>
          <form className='jamendo-search' onSubmit={handleSearch}>
            <span className='material-symbols-outlined' aria-hidden='true'>search</span>
            <input
              aria-label='Search Audiomack songs'
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder='Search Audiomack songs'
            />
            <button type='submit' disabled={isLoading}>
              {isLoading ? 'Searching…' : 'Search'}
            </button>
          </form>

          {error && <p className='jamendo-error' role='alert'>{error}</p>}

          <section className='jamendo-results' aria-label='Audiomack songs'>
            <div className='jamendo-results-heading'>
              <h2>{query.trim() ? 'Search results' : 'Trending songs'}</h2>
              <span>{tracks.length} songs</span>
            </div>
            {isLoading ? (
              <p className='jamendo-empty'>Loading songs…</p>
            ) : (
              <div className='jamendo-track-list'>
                {tracks.map((track) => {
                  const trackId = `audiomack-${track.id}`;
                  const isCurrent = currentTrack?.id === trackId;
                  return (
                    <article
                      className={`jamendo-track-row ${isCurrent ? 'playing' : ''}`}
                      key={track.id}
                    >
                      <img src={track.image || undefined} alt='' loading='lazy' />
                      <div className='jamendo-track-copy'>
                        <a href={track.url} target='_blank' rel='noreferrer' title={track.title}>
                          {track.title}
                        </a>
                        <span title={track.artist}>{track.artist}</span>
                        <small title={track.album}>{track.album || 'Audiomack'}</small>
                      </div>
                      <a className='jamendo-license-link' href={track.url} target='_blank' rel='noreferrer'>
                        Audiomack
                      </a>
                      <button
                        type='button'
                        className='jamendo-play-button'
                        onClick={() => handlePlay(track)}
                        aria-label={`${isCurrent && isPlaying ? 'Pause' : 'Play'} ${track.title}`}
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
            Playback uses temporary Audiomack stream URLs and is tracked through Audiomack’s API.
            Track links open the original Audiomack page.
          </p>
        </>
      )}

      {error && !isConnected && <p className='jamendo-error' role='alert'>{error}</p>}
    </main>
  );
};

export default AudiomackPage;
