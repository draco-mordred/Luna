import { useState, useEffect, useCallback } from 'react';
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

// Electron API type declaration
declare global {
  interface Window {
    electronAPI?: {
      selectFolders: () => Promise<string[]>;
      scanFolders: (folders: string[]) => Promise<Track[]>;
    };
  }
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
    setLibraryState({
      tracks: musicLibrary.getTracks(),
      albums: musicLibrary.getAlbums(),
      artists: musicLibrary.getArtists(),
      folders: musicLibrary.getFolders(),
      isScanning: false,
      error: null,
    });
  }, []);

  // Select folders for desktop (Electron)
  const selectFolders = useCallback(async () => {
    try {
      // Check if we're in Electron
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Use Electron's native dialog
        const folders = await window.electronAPI.selectFolders();
        if (folders && folders.length > 0) {
          musicLibrary.addFolders(folders);
          setLibraryState(prev => ({
            ...prev,
            folders: musicLibrary.getFolders(),
          }));
          return folders;
        }
      } else {
        // For development/testing, use a mock folder selector
        // In production, this would be handled by Electron
        console.log('Folder selection requires Electron. Using mock data for development.');
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
      
      const tracks = await musicLibrary.scanAll();
      
      setLibraryState({
        tracks,
        albums: musicLibrary.getAlbums(),
        artists: musicLibrary.getArtists(),
        folders: musicLibrary.getFolders(),
        isScanning: false,
        error: null,
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
  const removeFolder = useCallback((folder: string) => {
    musicLibrary.removeFolder(folder);
    setLibraryState(prev => ({
      ...prev,
      folders: musicLibrary.getFolders(),
    }));
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
