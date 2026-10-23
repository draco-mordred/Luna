// Track and Album types for the music player

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt?: string; // URL to album art image
  duration: number; // in seconds
  src: string; // URL to audio file
}

export interface PlaybackState {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number; // in seconds
  volume: number; // 0 to 1
  isMuted: boolean;
}

export type PlayBarState = 'collapsed' | 'expanded';
