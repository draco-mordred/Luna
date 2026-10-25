export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  images?: SpotifyImage[] | null;
  external_urls?: { spotify?: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: { name: string; images: SpotifyImage[] | null };
  duration_ms: number;
  external_urls?: { spotify?: string };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[] | null;
  owner: { display_name: string | null };
  tracks: { total: number };
  external_urls?: { spotify?: string };
}

export interface SpotifyUser {
  display_name: string | null;
  images: SpotifyImage[] | null;
  external_urls?: { spotify?: string };
}

export interface SpotifyRecentTrack {
  track: SpotifyTrack;
  played_at: string;
}

interface SpotifyToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
}

interface SpotifyTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
  scope?: string;
}

interface SpotifyApiErrorResponse {
  error?:
    | {
        message?: string;
        reason?: string;
      }
    | string;
}

interface SpotifyPage<T> {
  items: T[];
  next?: string | null;
}

const TOKEN_KEY = 'luna-spotify-token';
const CODE_VERIFIER_KEY = 'luna-spotify-code-verifier';
const OAUTH_STATE_KEY = 'luna-spotify-oauth-state';
const REDIRECT_URI_KEY = 'luna-spotify-redirect-uri';
const CLIENT_ID_KEY = 'luna-spotify-client-id';
const BUILD_CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID?.trim() ?? '';
const REQUIRED_SCOPES = [
  'user-read-private',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-recently-played',
  'user-top-read',
  'streaming',
  'user-modify-playback-state',
  'user-read-playback-state',
];
const SPOTIFY_API_BASE = 'https://api.spotify.com';
let tokenRefreshRequest: Promise<string> | null = null;

const base64UrlEncode = (value: Uint8Array) =>
  btoa(String.fromCharCode(...value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const randomString = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64UrlEncode(bytes);
};

export const getSpotifyClientId = () => {
  const savedClientId = window.localStorage.getItem(CLIENT_ID_KEY)?.trim();
  return savedClientId || BUILD_CLIENT_ID;
};

export const saveSpotifyClientId = (value: string) => {
  const clientId = value.trim();
  if (!/^[A-Za-z0-9]+$/.test(clientId) || clientId.length < 16 || clientId.length > 128) {
    throw new Error(
      'That Client ID does not look right. Copy it from your Spotify app’s settings.'
    );
  }
  window.localStorage.setItem(CLIENT_ID_KEY, clientId);
};

const getStoredToken = (): SpotifyToken | null => {
  const saved = sessionStorage.getItem(TOKEN_KEY);
  if (!saved) return null;
  try {
    const token = JSON.parse(saved) as SpotifyToken;
    return typeof token.access_token === 'string' && typeof token.expires_at === 'number'
      ? token
      : null;
  } catch {
    sessionStorage.removeItem(TOKEN_KEY);
    return null;
  }
};

const saveToken = async (token: SpotifyToken) => {
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  await window.electronAPI?.saveSpotifySession(JSON.stringify(token));
};

const requestToken = async (body: URLSearchParams): Promise<SpotifyTokenResponse> => {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const result = (await response.json()) as SpotifyTokenResponse;
  if (!response.ok || !result.access_token || !result.expires_in) {
    throw new Error(result.error_description ?? result.error ?? 'Spotify sign-in failed.');
  }
  return result;
};

const exchangeAuthorizationCode = async (code: string, redirectUri: string) => {
  const verifier = sessionStorage.getItem(CODE_VERIFIER_KEY);
  const clientId = getSpotifyClientId();
  if (!clientId || !verifier) throw new Error('Spotify sign-in expired. Please connect again.');
  const token = await requestToken(
    new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    })
  );
  await saveToken({
    access_token: token.access_token!,
    refresh_token: token.refresh_token,
    expires_at: Date.now() + token.expires_in! * 1000,
    scope: token.scope,
  });
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(REDIRECT_URI_KEY);
};

export const beginSpotifySignIn = async () => {
  const clientId = getSpotifyClientId();
  if (!clientId) {
    throw new Error(
      'Spotify is not set up yet. Follow the three steps on this page, then paste your Client ID.'
    );
  }

  const verifier = randomString(64);
  const state = randomString(32);
  const challenge = base64UrlEncode(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  );
  sessionStorage.setItem(CODE_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);

  let redirectUri: string;
  const electronApi = window.electronAPI;
  if (electronApi) {
    const response = await electronApi.startSpotifyAuthorization(state);
    redirectUri = response.redirectUri;
  } else {
    redirectUri =
      process.env.REACT_APP_SPOTIFY_REDIRECT_URI?.trim() ||
      `${window.location.origin}/spotify/callback`;
    const callbackOrigin = new URL(redirectUri).origin;
    if (callbackOrigin !== window.location.origin) {
      throw new Error(
        'The Spotify web callback must use this app’s current origin so sign-in can be verified.'
      );
    }
    if (new URL(redirectUri).hostname === 'localhost') {
      throw new Error(
        'Spotify does not allow localhost callbacks. Open Luna at http://127.0.0.1:3000 or use an HTTPS web origin.'
      );
    }
  }

  sessionStorage.setItem(REDIRECT_URI_KEY, redirectUri);
  const authorizationUrl = new URL('https://accounts.spotify.com/authorize');
  authorizationUrl.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: REQUIRED_SCOPES.join(' '),
    state,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true',
  }).toString();

  if (electronApi?.openSpotifyAuthorization) {
    await electronApi.openSpotifyAuthorization(authorizationUrl.toString());
  } else {
    window.location.assign(authorizationUrl.toString());
  }
};

export const completeSpotifySignIn = async (params: URLSearchParams) => {
  const expectedState = sessionStorage.getItem(OAUTH_STATE_KEY);
  const receivedState = params.get('state');
  if (!expectedState || !receivedState || expectedState !== receivedState) {
    throw new Error('Spotify sign-in could not be verified. Please try again.');
  }
  const authorizationError = params.get('error');
  if (authorizationError) {
    sessionStorage.removeItem(CODE_VERIFIER_KEY);
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(REDIRECT_URI_KEY);
    throw new Error(
      authorizationError === 'access_denied'
        ? 'Spotify access was cancelled.'
        : `Spotify authorization failed: ${authorizationError}`
    );
  }
  const code = params.get('code');
  const redirectUri = sessionStorage.getItem(REDIRECT_URI_KEY);
  if (!code || !redirectUri) throw new Error('Spotify did not return an authorization code.');
  await exchangeAuthorizationCode(code, redirectUri);
};

export const hasSpotifySession = () => getStoredToken() !== null;

export const restoreSpotifySession = async () => {
  if (getStoredToken()) return true;
  const saved = await window.electronAPI?.loadSpotifySession();
  if (!saved) return false;
  try {
    const token = JSON.parse(saved) as SpotifyToken;
    if (typeof token.access_token !== 'string' || typeof token.expires_at !== 'number') {
      throw new Error('Saved Spotify session is invalid.');
    }
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(token));
    return true;
  } catch (error) {
    await window.electronAPI?.clearSpotifySession();
    if (error instanceof SyntaxError) return false;
    throw error;
  }
};

export const disconnectSpotify = async () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(CODE_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(REDIRECT_URI_KEY);
  await window.electronAPI?.clearSpotifySession();
};

const getAccessToken = async (): Promise<string> => {
  const token = getStoredToken();
  if (!token) throw new Error('Connect your Spotify account to continue.');
  if (token.expires_at > Date.now() + 60_000) return token.access_token;
  const clientId = getSpotifyClientId();
  if (!token.refresh_token || !clientId) {
    await disconnectSpotify();
    throw new Error('Your Spotify session expired. Please connect your account again.');
  }

  if (!tokenRefreshRequest) {
    tokenRefreshRequest = (async () => {
      const refreshed = await requestToken(
        new URLSearchParams({
          client_id: clientId,
          grant_type: 'refresh_token',
          refresh_token: token.refresh_token!,
        })
      );
      const nextToken: SpotifyToken = {
        access_token: refreshed.access_token!,
        refresh_token: refreshed.refresh_token ?? token.refresh_token,
        expires_at: Date.now() + refreshed.expires_in! * 1000,
        scope: refreshed.scope ?? token.scope,
      };
      await saveToken(nextToken);
      return nextToken.access_token;
    })();
  }

  try {
    return await tokenRefreshRequest;
  } finally {
    tokenRefreshRequest = null;
  }
};

const spotifyApiRequest = async <T>(
  endpoint: string,
  method: 'GET' | 'PUT' | 'POST' = 'GET',
  body?: unknown
): Promise<T> => {
  const accessToken = await getAccessToken();
  const requestUrl = new URL(
    endpoint.startsWith(`${SPOTIFY_API_BASE}/`) ? endpoint : `/v1${endpoint}`,
    SPOTIFY_API_BASE
  );
  if (requestUrl.origin !== SPOTIFY_API_BASE || !requestUrl.pathname.startsWith('/v1/')) {
    throw new Error('Invalid Spotify API request URL.');
  }
  const response = await fetch(requestUrl, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 401) {
    await disconnectSpotify();
    throw new Error('Spotify authorization expired. Please connect your account again.');
  }
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as SpotifyApiErrorResponse;
    const message = typeof error.error === 'object' ? error.error.message : error.error;
    if (response.status === 403) {
      const spotifyDetail =
        typeof error.error === 'object'
          ? [error.error.reason, error.error.message].filter(Boolean).join(': ')
          : error.error;
      const detail = `${spotifyDetail ?? ''} ${message ?? ''}`.toLowerCase();
      if (detail.includes('premium')) {
        throw new Error(
          'Spotify playback requires an active Premium subscription. Upgrade the Spotify account you signed in with, then reconnect.'
        );
      }
      if (detail.includes('scope') || detail.includes('permission')) {
        throw new Error(
          'Luna needs additional Spotify playback permission. Choose “Reconnect Spotify” and approve the updated permissions.'
        );
      }
      throw new Error(
        `Spotify signed you in, but denied this app access. If this is a Development mode app, check that the account is on its Users Management allowlist and that the app owner has Premium. Spotify says: ${spotifyDetail || message || 'Access denied (403).'}`
      );
    }
    throw new Error(message ?? `Spotify request failed (HTTP ${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
};

const getAllSpotifyItems = async <T>(endpoint: string): Promise<T[]> => {
  let next: string | null = `${SPOTIFY_API_BASE}${endpoint}`;
  const items: T[] = [];
  while (next) {
    const page: SpotifyPage<T> = await spotifyApiRequest<SpotifyPage<T>>(next);
    items.push(...page.items);
    next = page.next ?? null;
  }
  return items;
};

export const getSpotifyProfile = () => spotifyApiRequest<SpotifyUser>('/me');

export const getSpotifyPlaylists = () =>
  getAllSpotifyItems<SpotifyPlaylist>('/v1/me/playlists?limit=50');

export const getSpotifyPlaylistTracks = (playlistId: string) =>
  spotifyApiRequest<SpotifyPage<{ track: SpotifyTrack | null }>>(
    `/playlists/${encodeURIComponent(playlistId)}/tracks?limit=30`
  );

export const getSpotifySavedTracks = () =>
  spotifyApiRequest<SpotifyPage<{ track: SpotifyTrack }>>('/me/tracks?limit=20');

export const getSpotifyRecentlyPlayed = () =>
  spotifyApiRequest<SpotifyPage<SpotifyRecentTrack>>('/me/player/recently-played?limit=20');

export const getSpotifyTopItems = () =>
  Promise.all([
    spotifyApiRequest<SpotifyPage<SpotifyArtist>>('/me/top/artists?limit=10'),
    spotifyApiRequest<SpotifyPage<SpotifyTrack>>('/me/top/tracks?limit=10'),
  ]);

export const getSpotifyAccessToken = () => getAccessToken();

export const playSpotifyUri = (uri: string, deviceId: string) => {
  const match = /^spotify:(track|album|playlist):([A-Za-z0-9]+)$/.exec(uri);
  if (!match) {
    throw new Error('This Spotify item cannot be played.');
  }
  const playbackBody =
    match[1] === 'playlist' || match[1] === 'album' ? { context_uri: uri } : { uris: [uri] };
  return spotifyApiRequest<void>(
    `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    'PUT',
    playbackBody
  );
};

export const hasSpotifyPlaybackScopes = () => {
  const token = getStoredToken();
  if (!token?.scope) return false;
  const grantedScopes = new Set(token.scope.split(/\s+/));
  return ['streaming', 'user-modify-playback-state', 'user-read-playback-state'].every((scope) =>
    grantedScopes.has(scope)
  );
};
