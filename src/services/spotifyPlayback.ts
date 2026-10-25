import { getSpotifyAccessToken } from './spotify';

export interface SpotifyPlaybackTrack {
  id: string;
  uri: string;
  name: string;
  duration_ms: number;
  artists: Array<{ name: string }>;
  album: { images?: Array<{ url: string }> | null };
}

export interface SpotifyPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: { current_track: SpotifyPlaybackTrack | null };
}

export interface SpotifyPlaybackDevice {
  device_id: string;
}

export interface SpotifyPlayer {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  activateElement: () => Promise<void>;
  getCurrentState: () => Promise<SpotifyPlaybackState | null>;
  addListener(
    event: 'ready' | 'not_ready',
    callback: (device: SpotifyPlaybackDevice) => void
  ): boolean;
  addListener(
    event: 'player_state_changed',
    callback: (state: SpotifyPlaybackState | null) => void
  ): boolean;
  addListener(
    event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
    callback: (error: { message: string }) => void
  ): boolean;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (position: number) => Promise<void>;
}

interface SpotifySdk {
  Player: new (options: {
    name: string;
    volume: number;
    getOAuthToken: (callback: (token: string) => void) => void;
  }) => SpotifyPlayer;
}

interface SpotifySdkWindow {
  Spotify?: SpotifySdk;
  onSpotifyWebPlaybackSDKReady?: () => void;
}

let sdkPromise: Promise<SpotifySdk> | null = null;

const loadSpotifySdk = (): Promise<SpotifySdk> => {
  const spotifyWindow = window as Window & SpotifySdkWindow;
  if (spotifyWindow.Spotify) return Promise.resolve(spotifyWindow.Spotify);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<SpotifySdk>((resolve, reject) => {
    const timeout = spotifyWindow.setTimeout(() => {
      sdkPromise = null;
      reject(
        new Error(
          'Spotify’s playback component did not load. Check your internet connection or content blocker.'
        )
      );
    }, 20_000);
    const previousReadyHandler = spotifyWindow.onSpotifyWebPlaybackSDKReady;
    spotifyWindow.onSpotifyWebPlaybackSDKReady = () => {
      spotifyWindow.clearTimeout(timeout);
      if (previousReadyHandler) previousReadyHandler();
      if (spotifyWindow.Spotify) resolve(spotifyWindow.Spotify);
      else reject(new Error('Spotify playback loaded but did not initialize.'));
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-luna-spotify-sdk]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.dataset.lunaSpotifySdk = 'true';
      script.onerror = () => {
        spotifyWindow.clearTimeout(timeout);
        sdkPromise = null;
        reject(new Error('Could not load Spotify playback. Check your internet connection.'));
      };
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    sdkPromise = null;
    throw error;
  });
  return sdkPromise;
};

export const createSpotifyPlayer = async () => {
  const sdk = await loadSpotifySdk();
  const player = new sdk.Player({
    name: 'Luna Music',
    volume: 0.75,
    getOAuthToken: (callback) => {
      void getSpotifyAccessToken()
        .then(callback)
        .catch(() => {
          callback('');
        });
    },
  });
  return player;
};
