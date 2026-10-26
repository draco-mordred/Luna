import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Track } from './MusicLibrary';

interface AndroidMusicLibraryResult {
  tracks: Track[];
  folders: string[];
  errors: string[];
}

interface AndroidMusicLibraryPlugin {
  scan: () => Promise<AndroidMusicLibraryResult>;
}

const androidMusicLibrary = registerPlugin<AndroidMusicLibraryPlugin>('AndroidMusicLibrary');

export const isAndroidApp = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export const scanAndroidMusicLibrary = async (): Promise<AndroidMusicLibraryResult> => {
  const result = await androidMusicLibrary.scan();
  return {
    ...result,
    tracks: result.tracks.map((track) => ({
      ...track,
      src: Capacitor.convertFileSrc(track.path),
    })),
  };
};
