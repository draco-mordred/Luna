import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  beginSpotifySignIn,
  completeSpotifySignIn,
  disconnectSpotify,
  getSpotifyClientId,
  getSpotifyPlaylists,
  getSpotifyPlaylistTracks,
  getSpotifyProfile,
  getSpotifyRecentlyPlayed,
  getSpotifySavedTracks,
  getSpotifyTopItems,
  hasSpotifyPlaybackScopes,
  hasSpotifySession,
  playSpotifyUri,
  restoreSpotifySession,
  saveSpotifyClientId,
  type SpotifyArtist,
  type SpotifyPlaylist,
  type SpotifyRecentTrack,
  type SpotifyTrack,
  type SpotifyUser,
} from '../services/spotify';
import {
  createSpotifyPlayer,
  type SpotifyPlaybackState,
  type SpotifyPlayer,
} from '../services/spotifyPlayback';
import './Spotify.css';

type SpotifyTab = 'overview' | 'playlists' | 'library' | 'recent' | 'top';

const getArtistNames = (track: SpotifyTrack) =>
  track.artists.map((artist) => artist.name).join(', ') || 'Unknown artist';

const formatPlaybackTime = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const SpotifyTrackList = ({
  tracks,
  onPlay,
  currentTrackId,
  isPlaybackReady,
}: {
  tracks: SpotifyTrack[];
  onPlay: (track: SpotifyTrack) => void;
  currentTrackId?: string;
  isPlaybackReady: boolean;
}) => (
  <div className='spotify-track-list'>
    {tracks.map((track, index) => (
      <article
        className={`spotify-track-row ${currentTrackId === track.id ? 'playing' : ''}`}
        key={`${track.id}-${index}`}
      >
        <span className='spotify-track-number'>{index + 1}</span>
        <div className='spotify-track-art'>
          {track.album.images?.[0]?.url ? (
            <img src={track.album.images[0].url} alt='' loading='lazy' />
          ) : (
            <span className='material-symbols-outlined' aria-hidden='true'>
              music_note
            </span>
          )}
        </div>
        <div className='spotify-track-copy'>
          <strong title={track.name}>{track.name}</strong>
          <span title={getArtistNames(track)}>{getArtistNames(track)}</span>
        </div>
        <span className='spotify-track-album' title={track.album.name}>
          {track.album.name}
        </span>
        <button
          className='spotify-track-play'
          type='button'
          aria-label={`Play ${track.name}`}
          title={isPlaybackReady ? `Play ${track.name}` : 'Spotify player is connecting'}
          disabled={!isPlaybackReady}
          onClick={() => onPlay(track)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            {currentTrackId === track.id ? 'play_arrow' : 'play_arrow'}
          </span>
        </button>
      </article>
    ))}
  </div>
);

const SpotifyPlaylistCard = ({
  playlist,
  selected,
  onClick,
  onPlay,
  isPlaybackReady,
}: {
  playlist: SpotifyPlaylist;
  selected: boolean;
  onClick: () => void;
  onPlay: () => void;
  isPlaybackReady: boolean;
}) => (
  <div className='spotify-playlist-card-wrap'>
    <button
      className={`spotify-playlist-card ${selected ? 'selected' : ''}`}
      type='button'
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className='spotify-playlist-art'>
        {playlist.images?.[0]?.url ? (
          <img src={playlist.images[0].url} alt='' loading='lazy' />
        ) : (
          <span className='material-symbols-outlined' aria-hidden='true'>
            queue_music
          </span>
        )}
      </span>
      <span className='spotify-playlist-copy'>
        <strong title={playlist.name}>{playlist.name}</strong>
        <small>{playlist.tracks.total} tracks</small>
      </span>
    </button>
    <button
      className='spotify-playlist-play'
      type='button'
      aria-label={`Play ${playlist.name}`}
      title={isPlaybackReady ? `Play ${playlist.name}` : 'Spotify player is connecting'}
      disabled={!isPlaybackReady}
      onClick={onPlay}
    >
      <span className='material-symbols-outlined' aria-hidden='true'>
        play_arrow
      </span>
    </button>
  </div>
);

const SpotifyArtistCard = ({ artist }: { artist: SpotifyArtist }) => (
  <article className='spotify-artist-card'>
    <div className='spotify-artist-art'>
      {artist.images?.[0]?.url ? (
        <img src={artist.images[0].url} alt='' loading='lazy' />
      ) : (
        <span className='material-symbols-outlined' aria-hidden='true'>
          person
        </span>
      )}
    </div>
    <strong title={artist.name}>{artist.name}</strong>
    <small>Artist</small>
  </article>
);

const SpotifyPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(hasSpotifySession);
  const [profile, setProfile] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [savedTracks, setSavedTracks] = useState<SpotifyTrack[]>([]);
  const [recentTracks, setRecentTracks] = useState<SpotifyRecentTrack[]>([]);
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [playlistTracks, setPlaylistTracks] = useState<SpotifyTrack[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [tab, setTab] = useState<SpotifyTab>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotifyPlayer, setSpotifyPlayer] = useState<SpotifyPlayer | null>(null);
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [playbackState, setPlaybackState] = useState<SpotifyPlaybackState | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [clientId, setClientId] = useState(getSpotifyClientId);
  const [clientIdDraft, setClientIdDraft] = useState('');
  const [redirectCopied, setRedirectCopied] = useState(false);
  const spotifyDesktopRedirectUri = 'http://127.0.0.1:43821/callback';
  const playbackAuthorized = hasSpotifyPlaybackScopes();
  const isPlayerConnecting = connected && playbackAuthorized && !spotifyDeviceId && !playbackError;

  useEffect(() => {
    if (!connected || !playbackAuthorized) return undefined;
    let isActive = true;
    let player: SpotifyPlayer | null = null;
    void Promise.resolve()
      .then(() => {
        if (!isActive) return null;
        setPlaybackError(null);
        return createSpotifyPlayer();
      })
      .then(async (createdPlayer) => {
        if (!createdPlayer) return;
        if (!isActive) {
          createdPlayer.disconnect();
          return;
        }
        player = createdPlayer;
        createdPlayer.addListener('ready', ({ device_id }) => {
          if (!isActive) return;
          setSpotifyDeviceId(device_id);
          setPlaybackError(null);
        });
        createdPlayer.addListener('not_ready', () => {
          if (!isActive) return;
          setSpotifyDeviceId(null);
          setPlaybackError(null);
        });
        createdPlayer.addListener('player_state_changed', (state) => {
          if (isActive) setPlaybackState(state);
        });
        createdPlayer.addListener('initialization_error', ({ message }) => {
          if (isActive) {
            setPlaybackError(message);
          }
        });
        createdPlayer.addListener('authentication_error', ({ message }) => {
          if (isActive) {
            setPlaybackError(`Spotify could not authorize playback: ${message}`);
          }
        });
        createdPlayer.addListener('account_error', ({ message }) => {
          if (isActive) {
            setPlaybackError(`Spotify Web Playback requires an active Premium account. ${message}`);
          }
        });
        createdPlayer.addListener('playback_error', ({ message }) => {
          if (isActive) setPlaybackError(message);
        });
        const connectedToDevice = await createdPlayer.connect();
        if (!connectedToDevice && isActive) {
          setPlaybackError('Could not connect the Spotify playback device. Please try again.');
        } else if (isActive) {
          setSpotifyPlayer(createdPlayer);
        }
      })
      .catch((playerError: unknown) => {
        if (!isActive) return;
        setPlaybackError(
          playerError instanceof Error ? playerError.message : 'Could not load Spotify playback.'
        );
      });

    return () => {
      isActive = false;
      player?.disconnect();
      setSpotifyPlayer(null);
      setSpotifyDeviceId(null);
      setPlaybackState(null);
    };
  }, [connected, playbackAuthorized]);

  useEffect(() => {
    if (!spotifyPlayer || playbackState?.paused) return undefined;
    const updatePlaybackPosition = () => {
      void spotifyPlayer.getCurrentState().then((state) => {
        if (state) setPlaybackState(state);
      });
    };
    const timer = window.setInterval(updatePlaybackPosition, 1000);
    return () => window.clearInterval(timer);
  }, [playbackState?.paused, spotifyPlayer]);

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const results = await Promise.allSettled([
      getSpotifyProfile(),
      getSpotifyPlaylists(),
      getSpotifySavedTracks(),
      getSpotifyRecentlyPlayed(),
      getSpotifyTopItems(),
    ] as const);

    const errors: string[] = [];
    const [profileResult, playlistsResult, savedResult, recentResult, topResult] = results;
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    else
      errors.push(
        profileResult.reason instanceof Error
          ? profileResult.reason.message
          : 'Profile could not be loaded.'
      );
    if (playlistsResult.status === 'fulfilled') setPlaylists(playlistsResult.value);
    else
      errors.push(
        playlistsResult.reason instanceof Error
          ? playlistsResult.reason.message
          : 'Playlists could not be loaded.'
      );
    if (savedResult.status === 'fulfilled')
      setSavedTracks(savedResult.value.items.map((item) => item.track));
    else
      errors.push(
        savedResult.reason instanceof Error
          ? savedResult.reason.message
          : 'Saved tracks could not be loaded.'
      );
    if (recentResult.status === 'fulfilled') setRecentTracks(recentResult.value.items);
    else
      errors.push(
        recentResult.reason instanceof Error
          ? recentResult.reason.message
          : 'Listening history could not be loaded.'
      );
    if (topResult.status === 'fulfilled') {
      setTopArtists(topResult.value[0].items);
      setTopTracks(topResult.value[1].items);
    } else
      errors.push(
        topResult.reason instanceof Error
          ? topResult.reason.message
          : 'Top items could not be loaded.'
      );

    if (errors.length > 0) setError([...new Set(errors)].join(' '));
    if (!hasSpotifySession()) setConnected(false);
    setIsLoading(false);
  }, []);

  const acceptAuthorization = useCallback(
    async (params: URLSearchParams) => {
      try {
        await completeSpotifySignIn(params);
        setConnected(true);
        setIsConnecting(false);
        setError(null);
        void loadAccount();
        navigate('/spotify', { replace: true });
      } catch (authorizationError) {
        setIsConnecting(false);
        setError(
          authorizationError instanceof Error
            ? authorizationError.message
            : 'Spotify sign-in could not be completed.'
        );
        navigate('/spotify', { replace: true });
      }
    },
    [loadAccount, navigate]
  );

  useEffect(() => {
    if (location.pathname !== '/spotify/callback') return undefined;
    const timeout = window.setTimeout(
      () => void acceptAuthorization(new URLSearchParams(window.location.search)),
      0
    );
    return () => window.clearTimeout(timeout);
  }, [acceptAuthorization, location.pathname]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onSpotifyAuthorizationResult((result) => {
      const params = new URLSearchParams();
      if (result.code) params.set('code', result.code);
      if (result.state) params.set('state', result.state);
      if (result.error) params.set('error', result.error);
      void acceptAuthorization(params);
    });
    return unsubscribe;
  }, [acceptAuthorization]);

  useEffect(() => {
    void restoreSpotifySession()
      .then((hasSession) => {
        if (hasSession) {
          setConnected(true);
          void loadAccount();
        }
      })
      .catch((restoreError: unknown) => {
        setError(
          restoreError instanceof Error
            ? restoreError.message
            : 'Could not restore your Spotify session.'
        );
      });
  }, [loadAccount]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await beginSpotifySignIn();
      if (!window.electronAPI) return;
    } catch (connectError) {
      setIsConnecting(false);
      setError(
        connectError instanceof Error ? connectError.message : 'Could not start Spotify sign-in.'
      );
    }
  };

  const handlePlayTrack = async (track: SpotifyTrack) => {
    if (!spotifyPlayer || !spotifyDeviceId) {
      setPlaybackError('Spotify’s player is still connecting. Try again in a moment.');
      return;
    }
    setPlaybackError(null);
    try {
      await spotifyPlayer.activateElement();
      await playSpotifyUri(`spotify:track:${track.id}`, spotifyDeviceId);
    } catch (playError) {
      setPlaybackError(
        playError instanceof Error ? playError.message : 'Spotify could not play this track.'
      );
    }
  };

  const handlePlayPlaylist = async (playlist: SpotifyPlaylist) => {
    if (!spotifyPlayer || !spotifyDeviceId) {
      setPlaybackError('Spotify’s player is still connecting. Try again in a moment.');
      return;
    }
    setPlaybackError(null);
    try {
      await spotifyPlayer.activateElement();
      await playSpotifyUri(`spotify:playlist:${playlist.id}`, spotifyDeviceId);
    } catch (playError) {
      setPlaybackError(
        playError instanceof Error ? playError.message : 'Spotify could not play this playlist.'
      );
    }
  };

  const handleTogglePlayback = async () => {
    try {
      await spotifyPlayer?.activateElement();
      await spotifyPlayer?.togglePlay();
    } catch (playError) {
      setPlaybackError(
        playError instanceof Error ? playError.message : 'Spotify playback control failed.'
      );
    }
  };

  const handlePlaybackSkip = async (direction: 'previous' | 'next') => {
    try {
      if (direction === 'previous') await spotifyPlayer?.previousTrack();
      else await spotifyPlayer?.nextTrack();
    } catch (playError) {
      setPlaybackError(
        playError instanceof Error ? playError.message : 'Spotify playback control failed.'
      );
    }
  };

  const handlePlaybackSeek = async (position: number) => {
    try {
      await spotifyPlayer?.seek(position);
    } catch (playError) {
      setPlaybackError(
        playError instanceof Error ? playError.message : 'Could not seek in this track.'
      );
    }
  };

  const handleSaveClientId = () => {
    try {
      saveSpotifyClientId(clientIdDraft);
      setClientId(getSpotifyClientId());
      setClientIdDraft('');
      setError(null);
    } catch (clientIdError) {
      setError(
        clientIdError instanceof Error ? clientIdError.message : 'Could not save that Client ID.'
      );
    }
  };

  const handleOpenSpotifyDashboard = async () => {
    try {
      if (window.electronAPI?.openSpotifyDashboard) {
        await window.electronAPI.openSpotifyDashboard();
      } else {
        window.open('https://developer.spotify.com/dashboard', '_blank', 'noopener,noreferrer');
      }
    } catch (dashboardError) {
      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : 'Could not open the Spotify app setup page.'
      );
    }
  };

  const handleCopyRedirectUri = async () => {
    try {
      await navigator.clipboard.writeText(spotifyDesktopRedirectUri);
      setRedirectCopied(true);
      window.setTimeout(() => setRedirectCopied(false), 2500);
    } catch {
      setError('Could not copy the address. You can select and copy it instead.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectSpotify();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : 'Could not securely remove the saved Spotify session.'
      );
      return;
    }
    setConnected(false);
    setProfile(null);
    setPlaylists([]);
    setSavedTracks([]);
    setRecentTracks([]);
    setTopArtists([]);
    setTopTracks([]);
    setPlaylistTracks([]);
    setSelectedPlaylist(null);
    setError(null);
  };

  const handleSelectPlaylist = async (playlist: SpotifyPlaylist) => {
    if (selectedPlaylist === playlist.id) {
      setSelectedPlaylist(null);
      setPlaylistTracks([]);
      return;
    }
    setSelectedPlaylist(playlist.id);
    setPlaylistTracks([]);
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSpotifyPlaylistTracks(playlist.id);
      setPlaylistTracks(response.items.flatMap((item) => (item.track ? [item.track] : [])));
    } catch (playlistError) {
      setError(
        playlistError instanceof Error ? playlistError.message : 'Could not load this playlist.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const recentItems = useMemo(() => {
    const ids = new Set<string>();
    return recentTracks.filter(({ track }) => {
      if (ids.has(track.id)) return false;
      ids.add(track.id);
      return true;
    });
  }, [recentTracks]);

  const tabs: Array<{ id: SpotifyTab; label: string; icon: string }> = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'playlists', label: 'Playlists', icon: 'queue_music' },
    { id: 'library', label: 'Your Library', icon: 'library_music' },
    { id: 'recent', label: 'Recently Played', icon: 'history' },
    { id: 'top', label: 'Top Items', icon: 'equalizer' },
  ];

  return (
    <div className='spotify-page'>
      <header className='spotify-header'>
        <div className='spotify-heading'>
          <div className='spotify-mark' aria-hidden='true'>
            <svg viewBox='0 0 24 24'>
              <path d='M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.59 14.42a.75.75 0 0 1-1.03.25c-2.82-1.72-6.37-2.1-10.55-1.15a.75.75 0 1 1-.33-1.46c4.58-1.04 8.5-.59 11.66 1.3.36.22.47.69.25 1.06Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.99-8.16-2.57-11.99-1.41a.94.94 0 1 1-.55-1.8c4.37-1.33 9.8-.69 13.52 1.6.44.27.58.85.31 1.3Zm.13-3.4c-3.87-2.3-10.25-2.52-13.95-1.39a1.13 1.13 0 1 1-.66-2.16c4.25-1.29 11.31-1.04 15.77 1.61a1.13 1.13 0 0 1-1.16 1.94Z' />
            </svg>
          </div>
          <div>
            <p className='spotify-eyebrow'>YOUR MUSIC, CONNECTED</p>
            <h1>Spotify</h1>
          </div>
        </div>
        {connected ? (
          <div className='spotify-account-actions'>
            <span className='spotify-account-name'>
              {profile?.display_name ?? 'Spotify account'}
            </span>
            <button
              type='button'
              className='spotify-secondary-button'
              onClick={() => void loadAccount()}
              disabled={isLoading}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                refresh
              </span>
              Refresh
            </button>
            <button type='button' className='spotify-secondary-button' onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        ) : null}
      </header>

      {!connected && (
        <section className='spotify-setup-card'>
          <div className='spotify-setup-heading'>
            <div>
              <p className='spotify-eyebrow'>ONE-TIME SETUP</p>
              <h2>{clientId ? 'Luna is ready to connect' : 'Connect your Spotify account'}</h2>
              <p className='spotify-setup-intro'>
                {clientId
                  ? 'Your Spotify connection is set up. Sign in below whenever you’re ready.'
                  : 'Just follow these three steps. You’ll sign in on Spotify’s own website, and Luna never sees your password.'}
              </p>
            </div>
            <span className={`spotify-setup-status ${clientId ? 'ready' : ''}`}>
              <span className='material-symbols-outlined' aria-hidden='true'>
                {clientId ? 'check_circle' : 'schedule'}
              </span>
              {clientId ? 'Ready' : 'About 2 minutes'}
            </span>
          </div>

          {!clientId && (
            <ol className='spotify-setup-steps'>
              <li>
                <span className='spotify-step-number'>1</span>
                <div>
                  <h3>Open Spotify’s app setup</h3>
                  <p>
                    We’ll create a small connection so Luna can safely read your Spotify library.
                  </p>
                  <button
                    type='button'
                    className='spotify-setup-action'
                    onClick={() => void handleOpenSpotifyDashboard()}
                  >
                    Open Spotify Developer Dashboard
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      open_in_new
                    </span>
                  </button>
                </div>
              </li>
              <li>
                <span className='spotify-step-number'>2</span>
                <div>
                  <h3>Create your app and add Luna’s return address</h3>
                  <p>
                    Choose <strong>Create app</strong>, give it any name (for example, “Luna
                    Music”), then open its settings. Under <strong>Redirect URIs</strong>, add this
                    address and save. This address is for the Luna desktop app:
                  </p>
                  <div className='spotify-redirect-copy'>
                    <code>{spotifyDesktopRedirectUri}</code>
                    <button type='button' onClick={() => void handleCopyRedirectUri()}>
                      <span className='material-symbols-outlined' aria-hidden='true'>
                        {redirectCopied ? 'check' : 'content_copy'}
                      </span>
                      {redirectCopied ? 'Copied' : 'Copy address'}
                    </button>
                  </div>
                  <p className='spotify-step-note'>
                    If the app is in Development mode, add the Spotify account you’ll sign in with
                    under <strong>Settings → Users Management</strong>. Spotify also requires the
                    app owner to have Premium. You do not need to create or share a Client Secret.
                  </p>
                </div>
              </li>
              <li>
                <span className='spotify-step-number'>3</span>
                <div>
                  <h3>Copy your Client ID into Luna</h3>
                  <p>
                    In your Spotify app’s settings, copy <strong>Client ID</strong> (not Client
                    Secret), paste it here, then save.
                  </p>
                  <div className='spotify-client-id-form'>
                    <label className='visually-hidden' htmlFor='spotify-client-id'>
                      Spotify Client ID
                    </label>
                    <input
                      id='spotify-client-id'
                      type='text'
                      autoComplete='off'
                      spellCheck={false}
                      value={clientIdDraft}
                      onChange={(event) => setClientIdDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleSaveClientId();
                      }}
                      placeholder='Paste Client ID here'
                    />
                    <button
                      type='button'
                      className='spotify-setup-action primary'
                      onClick={handleSaveClientId}
                      disabled={!clientIdDraft.trim()}
                    >
                      Save and continue
                    </button>
                  </div>
                </div>
              </li>
            </ol>
          )}
        </section>
      )}

      {error ? (
        <p className='spotify-error' role='alert'>
          {error}
        </p>
      ) : null}
      {connected && playbackError ? (
        <p className='spotify-error' role='alert'>
          {playbackError}
        </p>
      ) : null}

      {!connected ? (
        <section className='spotify-connect-card'>
          <div className='spotify-connect-art' aria-hidden='true'>
            <span className='material-symbols-outlined'>headphones</span>
          </div>
          <div className='spotify-connect-copy'>
            <p className='spotify-eyebrow'>A BETTER WAY TO BROWSE</p>
            <h2>Your Spotify, at a glance.</h2>
            <p>Connect to see your playlists, saved music, listening history, and top artists.</p>
            <button
              type='button'
              className='spotify-connect-button'
              onClick={() => void handleConnect()}
              disabled={!clientId || isConnecting}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                login
              </span>
              {isConnecting ? 'Waiting for Spotify…' : 'Connect with Spotify'}
            </button>
            <small>
              Sign-in happens securely on Spotify. If available, choose Google on Spotify’s sign-in
              page.
            </small>
          </div>
        </section>
      ) : (
        <>
          {!playbackAuthorized ? (
            <section className='spotify-playback-setup'>
              <span className='material-symbols-outlined' aria-hidden='true'>
                headphones
              </span>
              <div>
                <strong>Enable in-app playback</strong>
                <p>
                  Spotify playback needs extra permission and a Premium account. Reconnect to
                  approve playback access.
                </p>
              </div>
              <button
                type='button'
                className='spotify-setup-action primary'
                onClick={() => void handleConnect()}
                disabled={isConnecting}
              >
                {isConnecting ? 'Waiting for Spotify…' : 'Reconnect Spotify'}
              </button>
            </section>
          ) : (
            <section className='spotify-player-bar' aria-label='Spotify playback controls'>
              <div className='spotify-player-track'>
                <div className='spotify-track-art'>
                  {playbackState?.track_window.current_track?.album.images?.[0]?.url ? (
                    <img
                      src={playbackState.track_window.current_track.album.images[0].url}
                      alt=''
                    />
                  ) : (
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      music_note
                    </span>
                  )}
                </div>
                <div className='spotify-track-copy'>
                  <strong>
                    {playbackState?.track_window.current_track?.name ?? 'Spotify player'}
                  </strong>
                  <span>
                    {playbackState?.track_window.current_track
                      ? playbackState.track_window.current_track.artists
                          .map((artist) => artist.name)
                          .join(', ')
                      : isPlayerConnecting
                        ? 'Connecting playback…'
                        : 'Choose a track to start listening'}
                  </span>
                </div>
              </div>
              <div className='spotify-player-center'>
                <div className='spotify-player-buttons'>
                  <button
                    type='button'
                    aria-label='Previous track'
                    title='Previous track'
                    disabled={!spotifyDeviceId}
                    onClick={() => void handlePlaybackSkip('previous')}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      skip_previous
                    </span>
                  </button>
                  <button
                    type='button'
                    className='spotify-player-toggle'
                    aria-label={playbackState?.paused === false ? 'Pause' : 'Play'}
                    title={playbackState?.paused === false ? 'Pause' : 'Play'}
                    disabled={!spotifyDeviceId}
                    onClick={() => void handleTogglePlayback()}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      {playbackState?.paused === false ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                  <button
                    type='button'
                    aria-label='Next track'
                    title='Next track'
                    disabled={!spotifyDeviceId}
                    onClick={() => void handlePlaybackSkip('next')}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      skip_next
                    </span>
                  </button>
                </div>
                <div className='spotify-player-progress'>
                  <span>{formatPlaybackTime(playbackState?.position ?? 0)}</span>
                  <input
                    aria-label='Seek through Spotify track'
                    type='range'
                    min='0'
                    max={playbackState?.duration ?? 0}
                    value={Math.min(playbackState?.position ?? 0, playbackState?.duration ?? 0)}
                    disabled={!spotifyDeviceId || !playbackState?.duration}
                    onChange={(event) => void handlePlaybackSeek(Number(event.currentTarget.value))}
                  />
                  <span>{formatPlaybackTime(playbackState?.duration ?? 0)}</span>
                </div>
              </div>
              <span className={`spotify-device-status ${spotifyDeviceId ? 'ready' : ''}`}>
                {spotifyDeviceId ? 'Luna player' : isPlayerConnecting ? 'Connecting…' : 'Offline'}
              </span>
            </section>
          )}
          <nav className='spotify-tabs' aria-label='Spotify library'>
            {tabs.map((item) => (
              <button
                key={item.id}
                type='button'
                className={`spotify-tab ${tab === item.id ? 'active' : ''}`}
                aria-current={tab === item.id ? 'page' : undefined}
                onClick={() => setTab(item.id)}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>

          {isLoading && !profile && (
            <p className='spotify-loading' role='status'>
              Loading your Spotify library…
            </p>
          )}

          {tab === 'overview' && (
            <div className='spotify-sections'>
              <section className='spotify-section'>
                <div className='spotify-section-heading'>
                  <div>
                    <p className='spotify-eyebrow'>MADE BY YOU</p>
                    <h2>Your playlists</h2>
                  </div>
                  <button
                    type='button'
                    className='spotify-text-button'
                    onClick={() => setTab('playlists')}
                  >
                    See all
                  </button>
                </div>
                {playlists.length ? (
                  <div className='spotify-playlist-grid'>
                    {playlists.slice(0, 6).map((playlist) => (
                      <SpotifyPlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        selected={false}
                        onClick={() => {
                          setTab('playlists');
                          void handleSelectPlaylist(playlist);
                        }}
                        onPlay={() => void handlePlayPlaylist(playlist)}
                        isPlaybackReady={Boolean(spotifyDeviceId)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className='spotify-empty'>No playlists were returned for this account.</p>
                )}
              </section>
              <section className='spotify-section'>
                <div className='spotify-section-heading'>
                  <div>
                    <p className='spotify-eyebrow'>ON REPEAT</p>
                    <h2>Your top artists</h2>
                  </div>
                  <button
                    type='button'
                    className='spotify-text-button'
                    onClick={() => setTab('top')}
                  >
                    See all
                  </button>
                </div>
                {topArtists.length ? (
                  <div className='spotify-artist-grid'>
                    {topArtists.slice(0, 5).map((artist) => (
                      <SpotifyArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                ) : (
                  <p className='spotify-empty'>
                    Your top artists will appear here when Spotify has listening history.
                  </p>
                )}
              </section>
              <section className='spotify-section'>
                <div className='spotify-section-heading'>
                  <div>
                    <p className='spotify-eyebrow'>PICK UP WHERE YOU LEFT OFF</p>
                    <h2>Recently played</h2>
                  </div>
                  <button
                    type='button'
                    className='spotify-text-button'
                    onClick={() => setTab('recent')}
                  >
                    See all
                  </button>
                </div>
                {recentItems.length ? (
                  <SpotifyTrackList
                    tracks={recentItems.slice(0, 5).map((item) => item.track)}
                    onPlay={handlePlayTrack}
                    currentTrackId={playbackState?.track_window.current_track?.id}
                    isPlaybackReady={Boolean(spotifyDeviceId)}
                  />
                ) : (
                  <p className='spotify-empty'>No recent listening activity was found.</p>
                )}
              </section>
            </div>
          )}

          {tab === 'playlists' && (
            <section className='spotify-section'>
              <div className='spotify-section-heading'>
                <div>
                  <p className='spotify-eyebrow'>MADE BY YOU</p>
                  <h2>Your playlists</h2>
                </div>
              </div>
              {playlists.length ? (
                <>
                  <div className='spotify-playlist-grid'>
                    {playlists.map((playlist) => (
                      <SpotifyPlaylistCard
                        key={playlist.id}
                        playlist={playlist}
                        selected={selectedPlaylist === playlist.id}
                        onClick={() => void handleSelectPlaylist(playlist)}
                        onPlay={() => void handlePlayPlaylist(playlist)}
                        isPlaybackReady={Boolean(spotifyDeviceId)}
                      />
                    ))}
                  </div>
                  {selectedPlaylist && (
                    <div className='spotify-playlist-details'>
                      <h3>
                        {playlists.find((playlist) => playlist.id === selectedPlaylist)?.name}
                      </h3>
                      {playlistTracks.length ? (
                        <SpotifyTrackList
                          tracks={playlistTracks}
                          onPlay={handlePlayTrack}
                          currentTrackId={playbackState?.track_window.current_track?.id}
                          isPlaybackReady={Boolean(spotifyDeviceId)}
                        />
                      ) : isLoading ? (
                        <p className='spotify-loading'>Loading playlist…</p>
                      ) : (
                        <p className='spotify-empty'>This playlist has no playable tracks.</p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className='spotify-empty'>
                  No playlists found. Refresh to check your account again.
                </p>
              )}
            </section>
          )}

          {tab === 'library' && (
            <section className='spotify-section'>
              <div className='spotify-section-heading'>
                <div>
                  <p className='spotify-eyebrow'>SAVED ON SPOTIFY</p>
                  <h2>Your Library</h2>
                </div>
              </div>
              {savedTracks.length ? (
                <SpotifyTrackList
                  tracks={savedTracks}
                  onPlay={handlePlayTrack}
                  currentTrackId={playbackState?.track_window.current_track?.id}
                  isPlaybackReady={Boolean(spotifyDeviceId)}
                />
              ) : (
                <p className='spotify-empty'>No saved tracks found.</p>
              )}
            </section>
          )}

          {tab === 'recent' && (
            <section className='spotify-section'>
              <div className='spotify-section-heading'>
                <div>
                  <p className='spotify-eyebrow'>LISTENING HISTORY</p>
                  <h2>Recently played</h2>
                </div>
              </div>
              {recentItems.length ? (
                <SpotifyTrackList
                  tracks={recentItems.map((item) => item.track)}
                  onPlay={handlePlayTrack}
                  currentTrackId={playbackState?.track_window.current_track?.id}
                  isPlaybackReady={Boolean(spotifyDeviceId)}
                />
              ) : (
                <p className='spotify-empty'>No recent listening activity was found.</p>
              )}
            </section>
          )}

          {tab === 'top' && (
            <div className='spotify-sections'>
              <section className='spotify-section'>
                <div className='spotify-section-heading'>
                  <div>
                    <p className='spotify-eyebrow'>YOUR LISTENING TASTE</p>
                    <h2>Top artists</h2>
                  </div>
                </div>
                {topArtists.length ? (
                  <div className='spotify-artist-grid'>
                    {topArtists.map((artist) => (
                      <SpotifyArtistCard key={artist.id} artist={artist} />
                    ))}
                  </div>
                ) : (
                  <p className='spotify-empty'>No top artists available yet.</p>
                )}
              </section>
              <section className='spotify-section'>
                <div className='spotify-section-heading'>
                  <div>
                    <p className='spotify-eyebrow'>YOUR MOST PLAYED</p>
                    <h2>Top tracks</h2>
                  </div>
                </div>
                {topTracks.length ? (
                  <SpotifyTrackList
                    tracks={topTracks}
                    onPlay={handlePlayTrack}
                    currentTrackId={playbackState?.track_window.current_track?.id}
                    isPlaybackReady={Boolean(spotifyDeviceId)}
                  />
                ) : (
                  <p className='spotify-empty'>No top tracks available yet.</p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SpotifyPage;
