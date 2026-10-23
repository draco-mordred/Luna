import { IAudioMetadata } from 'music-metadata';

// Supported audio file extensions
const AUDIO_EXTENSIONS = [
  '.mp3', '.m4a', '.wav', '.flac', '.ogg', '.oga', '.aac',
  '.mp4', '.m4b', '.m4p', '.mpg', '.mp2', '.mpe', '.mpeg',
  '.wma', '.wmv', '.asf', '.aif', '.aiff', '.aifc',
];

// Common audio MIME types
const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/x-m4a',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/flac',
  'audio/ogg',
  'audio/x-ogg',
  'audio/aac',
  'audio/x-aac',
  'audio/mp4',
  'audio/x-mp4',
  'audio/wma',
  'audio/x-ms-wma',
  'audio/aiff',
  'audio/x-aiff',
];

export interface Track {
  id: string;
  path: string;
  filename: string;
  name: string;
  artist: string;
  album: string;
  albumArt?: string;
  duration: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  lyrics?: string;
  bitrate?: number;
  format: string;
  size: number;
  lastModified: number;
}

export interface Album {
  id: string;
  name: string;
  artist: string;
  albumArt?: string;
  year?: number;
  tracks: Track[];
}

export interface Artist {
  id: string;
  name: string;
  albums: Album[];
  tracks: Track[];
}

export interface MusicLibrary {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  folders: string[];
}

/**
 * Music Library Service
 * Handles scanning for music files and extracting metadata
 */
export class MusicLibraryService {
  private library: MusicLibrary = {
    tracks: [],
    albums: [],
    artists: [],
    folders: [],
  };

  private isScanning = false;
  private scanCancel = false;

  /**
   * Check if a file is an audio file based on extension
   */
  private isAudioFile(filename: string): boolean {
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    return AUDIO_EXTENSIONS.includes(ext);
  }

  /**
   * Check if a file is an audio file based on MIME type
   */
  private isAudioMimeType(mimeType: string): boolean {
    return AUDIO_MIME_TYPES.includes(mimeType.toLowerCase());
  }

  /**
   * Parse metadata from audio file
   */
  private async parseMetadata(filePath: string): Promise<Partial<Track> | null> {
    try {
      // Note: In browser environment, this won't work directly
      // We need to use Node.js fs in Electron or Capacitor APIs in mobile
      // For now, return mock data for development
      return this.getMockMetadata(filePath);
    } catch (error) {
      console.error(`Error parsing metadata for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Generate mock metadata for development (replace with real parsing)
   */
  private getMockMetadata(filePath: string): Partial<Track> {
    const filename = filePath.split('/').pop() || '';
    const name = filename.replace(/\.[^.]+$/, ''); // Remove extension
    
    // Generate consistent mock data based on filename
    const mockArtists = ['The Weeknd', 'Drake', 'Taylor Swift', 'Travis Scott', 'Post Malone'];
    const mockAlbums = ['After Hours', 'Starboy', '1989', 'Utopia', 'Hollywood Bleeding'];
    
    const artistIndex = Math.abs(name.charCodeAt(0) || 0) % mockArtists.length;
    const albumIndex = Math.abs(name.charCodeAt(1) || 0) % mockAlbums.length;
    
    return {
      name,
      artist: mockArtists[artistIndex],
      album: mockAlbums[albumIndex],
      duration: Math.floor(Math.random() * 300) + 120, // 2-5 minutes
      trackNumber: 1,
      year: 2015 + Math.floor(Math.random() * 8),
      genre: 'Pop',
      format: filePath.slice(filePath.lastIndexOf('.') + 1),
    };
  }

  /**
   * Scan a directory for music files (Electron/Node.js version)
   */
  async scanDirectoryNode(path: string): Promise<Track[]> {
    const tracks: Track[] = [];
    
    // This is a placeholder for Node.js implementation
    // In production, use fs.readdir and fs.stat
    // For now, return mock data
    const mockTracks = [
      {
        id: '1',
        path: `${path}/Blinding Lights.mp3`,
        filename: 'Blinding Lights.mp3',
        name: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: 200,
        trackNumber: 1,
        year: 2020,
        genre: 'Pop',
        format: 'mp3',
        size: 4500000,
        lastModified: Date.now(),
      },
      {
        id: '2',
        path: `${path}/Save Your Tears.mp3`,
        filename: 'Save Your Tears.mp3',
        name: 'Save Your Tears',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: 235,
        trackNumber: 2,
        year: 2020,
        genre: 'Pop',
        format: 'mp3',
        size: 5200000,
        lastModified: Date.now(),
      },
    ];
    
    return mockTracks;
  }

  /**
   * Scan for music files (Capacitor/mobile version)
   */
  async scanDeviceMobile(): Promise<Track[]> {
    const tracks: Track[] = [];
    
    // This is a placeholder for Capacitor implementation
    // Use Capacitor Filesystem API to scan
    // For now, return mock data
    const mockTracks = [
      {
        id: '1',
        path: '/storage/emulated/0/Music/Blinding Lights.mp3',
        filename: 'Blinding Lights.mp3',
        name: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: 200,
        trackNumber: 1,
        year: 2020,
        genre: 'Pop',
        format: 'mp3',
        size: 4500000,
        lastModified: Date.now(),
      },
    ];
    
    return mockTracks;
  }

  /**
   * Add folders to scan
   */
  addFolders(folders: string[]): void {
    this.library.folders = [...new Set([...this.library.folders, ...folders])];
  }

  /**
   * Remove a folder from scan
   */
  removeFolder(folder: string): void {
    this.library.folders = this.library.folders.filter(f => f !== folder);
  }

  /**
   * Get all folders being watched
   */
  getFolders(): string[] {
    return [...this.library.folders];
  }

  /**
   * Scan all configured folders
   */
  async scanAll(): Promise<Track[]> {
    if (this.isScanning) {
      return this.library.tracks;
    }

    this.isScanning = true;
    this.scanCancel = false;
    
    try {
      const allTracks: Track[] = [];
      
      for (const folder of this.library.folders) {
        if (this.scanCancel) break;
        
        // Use Node.js version if available, otherwise mobile
        if (typeof process !== 'undefined' && process.versions && process.versions.node) {
          // Running in Node.js (Electron)
          const tracks = await this.scanDirectoryNode(folder);
          allTracks.push(...tracks);
        } else {
          // Running in browser/mobile (Capacitor)
          // For now, use mock data
          const tracks = await this.scanDeviceMobile();
          allTracks.push(...tracks);
        }
      }
      
      this.library.tracks = allTracks.map(t => ({
        ...t,
        id: t.id || this.generateId(t.path),
      }));
      
      // Organize into albums and artists
      this.organizeLibrary();
      
      return this.library.tracks;
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Cancel ongoing scan
   */
  cancelScan(): void {
    this.scanCancel = true;
    this.isScanning = false;
  }

  /**
   * Generate a unique ID for a track
   */
  private generateId(path: string): string {
    // Simple hash based on path
    let hash = 0;
    for (let i = 0; i < path.length; i++) {
      hash = (hash << 5) - hash + path.charCodeAt(i);
      hash |= 0;
    }
    return `track_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Organize tracks into albums and artists
   */
  private organizeLibrary(): void {
    const albumsMap = new Map<string, Album>();
    const artistsMap = new Map<string, Artist>();
    
    for (const track of this.library.tracks) {
      // Create or update album
      const albumKey = `${track.album.toLowerCase()}_${track.artist.toLowerCase()}`;
      if (!albumsMap.has(albumKey)) {
        albumsMap.set(albumKey, {
          id: this.generateId(albumKey),
          name: track.album,
          artist: track.artist,
          tracks: [],
        });
      }
      const album = albumsMap.get(albumKey)!;
      album.tracks.push(track);
      
      // Create or update artist
      if (!artistsMap.has(track.artist)) {
        artistsMap.set(track.artist, {
          id: this.generateId(track.artist),
          name: track.artist,
          albums: [],
          tracks: [],
        });
      }
      const artist = artistsMap.get(track.artist)!;
      artist.albums.push(album);
      artist.tracks.push(track);
    }
    
    this.library.albums = Array.from(albumsMap.values());
    this.library.artists = Array.from(artistsMap.values());
  }

  /**
   * Get all tracks
   */
  getTracks(): Track[] {
    return [...this.library.tracks];
  }

  /**
   * Get all albums
   */
  getAlbums(): Album[] {
    return [...this.library.albums];
  }

  /**
   * Get all artists
   */
  getArtists(): Artist[] {
    return [...this.library.artists];
  }

  /**
   * Search tracks by name, artist, or album
   */
  search(query: string): Track[] {
    const lowerQuery = query.toLowerCase();
    return this.library.tracks.filter(track => 
      track.name.toLowerCase().includes(lowerQuery) ||
      track.artist.toLowerCase().includes(lowerQuery) ||
      track.album.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get recently added tracks
   */
  getRecent(count = 20): Track[] {
    return [...this.library.tracks]
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, count);
  }

  /**
   * Get recently played tracks (from localStorage)
   */
  getRecentlyPlayed(count = 20): Track[] {
    // Implement with localStorage
    return this.getRecent(count);
  }

  /**
   * Get favorite tracks (from localStorage)
   */
  getFavorites(): Track[] {
    // Implement with localStorage
    return [];
  }

  /**
   * Get playlists (from localStorage)
   */
  getPlaylists(): { id: string; name: string; tracks: Track[] }[] {
    // Implement with localStorage
    return [];
  }
}

// Singleton instance
export const musicLibrary = new MusicLibraryService();
