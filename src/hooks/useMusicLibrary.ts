import { useState, useEffect, useCallback, useRef } from 'react';
import { musicLibrary, Track, Album, Artist } from '../services/MusicLibrary';

// Type for the music library state
interface MusicLibraryState {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  folders: string[];
  isScanning: boolean;
  error: string | null;
}

// Capacitor Filesystem API type
declare global {
  interface Window {
    Capacitor?: {
      Plugins?: {
        Filesystem?: {
          readdir: (options: { path: string; directory: string }) => Promise<{ files: any[] }>;
          readFile: (options: { path: string }) => Promise<{ data: string }>;
        };
      };
    };
  }
}

export const useMusicLibrary = () => {
  const initialLoadStarted = useRef(false);
  const [libraryState, setLibraryState] = useState<MusicLibraryState>({
    tracks: [],
    albums: [],
    artists: [],
    folders: musicLibrary.getFolders(),
    isScanning: false,
    error: null,
  });

  // Load initial state
  useEffect(() => {
    if (!window.electronAPI || initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    setLibraryState((prev) => ({ ...prev, isScanning: true, error: null }));
    window.electronAPI.loadMusicLibrary()
      .then((library) => {
        musicLibrary.replaceLibrary(library.folders, library.tracks);
        setLibraryState({
          tracks: musicLibrary.getTracks(),
          albums: musicLibrary.getAlbums(),
          artists: musicLibrary.getArtists(),
          folders: musicLibrary.getFolders(),
          isScanning: false,
          error: library.errors.length > 0 ? 'Some music files could not be read.' : null,
        });
      })
      .catch((error: unknown) => {
        console.error('Error loading local music library:', error);
        setLibraryState((prev) => ({
          ...prev,
          isScanning: false,
          error: 'Failed to load the local music library.',
        }));
      });
  }, []);

  // Select folders for desktop (Electron)
  const selectFolders = useCallback(async () => {
    try {
      // Check if we're in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Use Electron's native dialog
        const library = await window.electronAPI.selectMusicFolders();
        if (library) {
          musicLibrary.replaceLibrary(library.folders, library.tracks);
          setLibraryState(prev => ({
            ...prev,
            tracks: library.tracks,
            albums: musicLibrary.getAlbums(),
            artists: musicLibrary.getArtists(),
            folders: library.folders,
            isScanning: false,
            error: library.errors.length > 0 ? 'Some music files could not be read.' : null,
          }));
          return library.folders;
        }
      } else {
        setLibraryState((prev) => ({
          ...prev,
          error: 'Folder selection is only available in the desktop app.',
        }));
      }
      return [];
    } catch (error) {
      console.error('Error selecting folders:', error);
      setLibraryState(prev => ({ ...prev, error: 'Failed to select folders' }));
      return [];
    }
  }, []);

  // Scan all folders
  const scanLibrary = useCallback(async () => {
    try {
      setLibraryState(prev => ({ ...prev, isScanning: true, error: null }));
      
      if (!window.electronAPI) {
        throw new Error('Music library scanning is only available in the desktop app.');
      }
      const library = await window.electronAPI.rescanMusicLibrary();
      musicLibrary.replaceLibrary(library.folders, library.tracks);
      const tracks = library.tracks;
      
      setLibraryState({
        tracks,
        albums: musicLibrary.getAlbums(),
        artists: musicLibrary.getArtists(),
        folders: library.folders,
        isScanning: false,
        error: library.errors.length > 0 ? 'Some music files could not be read.' : null,
      });
      
      return tracks;
    } catch (error) {
      console.error('Error scanning library:', error);
      setLibraryState(prev => ({
        ...prev,
        isScanning: false,
        error: 'Failed to scan library',
      }));
      return [];
    }
  }, []);

  // Add folders manually
  const addFolders = useCallback((folders: string[]) => {
    musicLibrary.addFolders(folders);
    setLibraryState(prev => ({
      ...prev,
      folders: musicLibrary.getFolders(),
    }));
  }, []);

  // Remove a folder
  const removeFolder = useCallback(async (folder: string) => {
    if (!window.electronAPI) {
      setLibraryState((prev) => ({ ...prev, error: 'Folder management is only available in the desktop app.' }));
      return;
    }
    try {
      setLibraryState((prev) => ({ ...prev, isScanning: true, error: null }));
      const library = await window.electronAPI.removeMusicFolder(folder);
      musicLibrary.replaceLibrary(library.folders, library.tracks);
      setLibraryState({
        tracks: musicLibrary.getTracks(),
        albums: musicLibrary.getAlbums(),
        artists: musicLibrary.getArtists(),
        folders: musicLibrary.getFolders(),
        isScanning: false,
        error: library.errors.length > 0 ? 'Some music files could not be read.' : null,
      });
    } catch (error) {
      console.error(`Error removing music folder "${folder}":`, error);
      setLibraryState((prev) => ({ ...prev, isScanning: false, error: 'Failed to remove the music folder.' }));
    }
  }, []);

  // Cancel scan
  const cancelScan = useCallback(() => {
    musicLibrary.cancelScan();
    setLibraryState(prev => ({ ...prev, isScanning: false }));
  }, []);

  // Search tracks
  const search = useCallback((query: string) => {
    return musicLibrary.search(query);
  }, []);

  // Get recently played
  const getRecentlyPlayed = useCallback((count = 20) => {
    return musicLibrary.getRecentlyPlayed(count);
  }, []);

  // Get favorites
  const getFavorites = useCallback(() => {
    return musicLibrary.getFavorites();
  }, []);

  // Get playlists
  const getPlaylists = useCallback(() => {
    return musicLibrary.getPlaylists();
  }, []);

  return {
    // State
    ...libraryState,
    
    // Actions
    selectFolders,
    scanLibrary,
    addFolders,
    removeFolder,
    cancelScan,
    search,
    getRecentlyPlayed,
    getFavorites,
    getPlaylists,
    
    // Direct access to library
    library: musicLibrary,
  };
};
