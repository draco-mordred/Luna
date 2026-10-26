import type { Playlist, Track } from '../services/MusicLibrary';

export interface MusicLibraryResponse {
  folders: string[];
  tracks: Track[];
  errors: string[];
  initialScan?: boolean;
  playlists?: Playlist[];
}

export interface MusicLibraryScanProgress {
  scanId: string;
  phase: 'discovering' | 'reading' | 'complete';
  folders: string[];
  tracks: Track[];
  scanned: number;
  total: number;
  errors?: string[];
}

export interface TrackMetadataUpdate {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  composer: string;
  genre: string;
  comment: string;
  year: number | null;
  trackNumber: number | null;
  discNumber: number | null;
  lyrics: string;
  albumArtBase64?: string | null;
  albumArtMimeType?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export type IconStyle = 'material' | 'windows' | 'apple' | 'vlc' | 'round-filled' | 'round-outline';
export type SeekbarStyle = 'default' | 'windows' | 'vlc' | 'apple' | 'samsung';
export type VisualizerStyle =
  | 'wave-smooth'
  | 'wave-sharp'
  | 'wave-organic'
  | 'bars-thin'
  | 'bars-rounded'
  | 'bars-outline'
  | 'bars-alternating'
  | 'bars-dense'
  | 'bars-pill';

export interface AppSettings {
  themeMode: ThemeMode;
  accentColor: string;
  lastPlayedTrackPath: string | null;
  crossfadeSeconds: number;
  iconStyle: IconStyle;
  seekbarStyle: SeekbarStyle;
  visualizerStyle: VisualizerStyle;
  showVisualizer: boolean;
  autoDownloadArtistImages: boolean;
  showArtistImageBackground: boolean;
  showLyrics: boolean;
  showSyncedLyricsOnPlayBar: boolean;
  syncLyricsDisplay: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'one' | 'all';
  showBrowseSection: boolean;
  showRadioSection: boolean;
  systemTheme: 'light' | 'dark';
  systemAccentColor: string | null;
  platform: string;
}

declare global {
  interface Window {
    electronAPI?: {
      platform: string;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      toggleWindowMaximize: () => Promise<void>;
      getWindowState: () => Promise<boolean>;
      closeWindow: () => Promise<void>;
      isLocalTrackAvailable: (trackPath: string) => Promise<boolean>;
      loadMusicLibrary: () => Promise<MusicLibraryResponse>;
      onMusicLibraryScanProgress: (
        callback: (progress: MusicLibraryScanProgress) => void
      ) => () => void;
      loadAppSettings: () => Promise<AppSettings>;
      audiomackHasCredentials: () => Promise<boolean>;
      audiomackSaveCredentials: (consumerKey: string, consumerSecret: string) => Promise<void>;
      audiomackClearCredentials: () => Promise<void>;
      audiomackSearchTracks: (query: string) => Promise<unknown>;
      audiomackPlayTrack: (musicId: string, session: string) => Promise<string>;
      savePlaylists: (playlists: Playlist[]) => Promise<Playlist[]>;
      saveAppSettings: (
        settings: Partial<
          Pick<
            AppSettings,
            | 'themeMode'
            | 'accentColor'
            | 'lastPlayedTrackPath'
            | 'crossfadeSeconds'
            | 'iconStyle'
            | 'seekbarStyle'
            | 'visualizerStyle'
            | 'showVisualizer'
            | 'autoDownloadArtistImages'
            | 'showArtistImageBackground'
            | 'showLyrics'
            | 'showSyncedLyricsOnPlayBar'
            | 'syncLyricsDisplay'
            | 'isShuffled'
            | 'repeatMode'
            | 'showBrowseSection'
            | 'showRadioSection'
          >
        >
      ) => Promise<AppSettings>;
      selectMusicFolders: () => Promise<MusicLibraryResponse | null>;
      rescanMusicLibrary: () => Promise<MusicLibraryResponse>;
      removeMusicFolder: (folder: string) => Promise<MusicLibraryResponse>;
      saveTrackMetadata: (
        trackPath: string,
        metadata: TrackMetadataUpdate
      ) => Promise<MusicLibraryResponse>;
      onWindowStateChanged: (callback: (isMaximized: boolean) => void) => () => void;
      onSystemThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
      setTaskbarPlaybackState: (isPlaying: boolean) => void;
      onTaskbarPrevious: (callback: () => void) => () => void;
      onTaskbarPlayPause: (callback: () => void) => () => void;
      onTaskbarNext: (callback: () => void) => () => void;
    };
  }
}

export {};
