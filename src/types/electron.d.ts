import type { Track } from '../services/MusicLibrary';

export interface MusicLibraryResponse {
  folders: string[];
  tracks: Track[];
  errors: string[];
  initialScan?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  themeMode: ThemeMode;
  accentColor: string;
  lastPlayedTrackPath: string | null;
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
      loadMusicLibrary: () => Promise<MusicLibraryResponse>;
      loadAppSettings: () => Promise<AppSettings>;
      saveAppSettings: (settings: Partial<Pick<AppSettings, 'themeMode' | 'accentColor' | 'lastPlayedTrackPath'>>) => Promise<AppSettings>;
      selectMusicFolders: () => Promise<MusicLibraryResponse | null>;
      rescanMusicLibrary: () => Promise<MusicLibraryResponse>;
      removeMusicFolder: (folder: string) => Promise<MusicLibraryResponse>;
      onWindowStateChanged: (callback: (isMaximized: boolean) => void) => () => void;
      onSystemThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void;
    };
  }
}

export {};
