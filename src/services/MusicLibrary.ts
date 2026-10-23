export interface SyncedLyricLine {
  time: number;
  text: string;
}

export interface Track {
  id: string;
  path: string;
  src?: string;
  filename: string;
  name: string;
  artist: string;
  album: string;
  albumArt?: string;
  metadataVersion?: number;
  duration: number;
  trackNumber?: number;
  year?: number;
  genre?: string;
  composer?: string;
  lyrics?: string;
  syncedLyrics?: SyncedLyricLine[];
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

export class MusicLibraryService {
  private library: MusicLibrary = {
    tracks: [],
    albums: [],
    artists: [],
    folders: [],
  };

  private scanCancel = false;

  replaceLibrary(folders: string[], tracks: Track[]): void {
    this.library.folders = [...new Set(folders)];
    this.library.tracks = [...tracks];
    this.organizeLibrary();
  }

  addFolders(folders: string[]): void {
    this.library.folders = [...new Set([...this.library.folders, ...folders])];
  }

  removeFolder(folder: string): void {
    this.library.folders = this.library.folders.filter((savedFolder) => savedFolder !== folder);
  }

  getFolders(): string[] {
    return [...this.library.folders];
  }

  async scanAll(): Promise<Track[]> {
    if (!window.electronAPI) {
      throw new Error('Music library scanning is only available in the desktop app.');
    }

    this.scanCancel = false;
    const library = await window.electronAPI.rescanMusicLibrary();
    if (this.scanCancel) return this.getTracks();

    this.replaceLibrary(library.folders, library.tracks);
    if (library.errors.length > 0) {
      throw new Error(`${library.errors.length} music folder item(s) could not be read.`);
    }
    return this.getTracks();
  }

  cancelScan(): void {
    this.scanCancel = true;
  }

  getTracks(): Track[] {
    return [...this.library.tracks];
  }

  getAlbums(): Album[] {
    return [...this.library.albums];
  }

  getArtists(): Artist[] {
    return [...this.library.artists];
  }

  search(query: string): Track[] {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return this.getTracks();
    return this.library.tracks.filter((track) => (
      track.name.toLocaleLowerCase().includes(normalizedQuery)
      || track.artist.toLocaleLowerCase().includes(normalizedQuery)
      || track.album.toLocaleLowerCase().includes(normalizedQuery)
      || track.genre?.toLocaleLowerCase().includes(normalizedQuery)
      || track.composer?.toLocaleLowerCase().includes(normalizedQuery)
    ));
  }

  getRecent(count = 20): Track[] {
    return [...this.library.tracks]
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, count);
  }

  getRecentlyPlayed(count = 20): Track[] {
    return this.getRecent(count);
  }

  getFavorites(): Track[] {
    return [];
  }

  getPlaylists(): { id: string; name: string; tracks: Track[] }[] {
    return [];
  }

  private generateId(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index);
      hash |= 0;
    }
    return `library_${Math.abs(hash).toString(16)}`;
  }

  private organizeLibrary(): void {
    const albumsById = new Map<string, Album>();
    const artistsByName = new Map<string, Artist>();

    for (const track of this.library.tracks) {
      const albumId = `${track.album.toLocaleLowerCase()}::${track.artist.toLocaleLowerCase()}`;
      let album = albumsById.get(albumId);
      if (!album) {
        album = {
          id: this.generateId(albumId),
          name: track.album,
          artist: track.artist,
          year: track.year,
          tracks: [],
        };
        albumsById.set(albumId, album);
      }
      album.tracks.push(track);

      const artistId = track.artist.toLocaleLowerCase();
      let artist = artistsByName.get(artistId);
      if (!artist) {
        artist = {
          id: this.generateId(artistId),
          name: track.artist,
          albums: [],
          tracks: [],
        };
        artistsByName.set(artistId, artist);
      }
      if (!artist.albums.some((artistAlbum) => artistAlbum.id === album?.id)) {
        artist.albums.push(album);
      }
      artist.tracks.push(track);
    }

    this.library.albums = [...albumsById.values()];
    this.library.artists = [...artistsByName.values()];
  }
}

export const musicLibrary = new MusicLibraryService();
