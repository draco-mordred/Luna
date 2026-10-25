import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import PlayBar from './components/PlayBar';
import Sidebar from './components/Sidebar';
import type { PlaylistAction } from './components/PlaylistOptionsMenu';
import PlaylistDialog from './components/PlaylistDialog';
import type { PlaylistDialogState } from './components/PlaylistDialog';
import TrackMetadataEditor from './components/TrackMetadataEditor';
import TopNavbar from './components/TopNavbar';
import WindowTitleBar from './components/WindowTitleBar/WindowTitleBar';
import {
  Tracks,
  Albums,
  Artists,
  Composer,
  Genres,
  Settings,
  Search,
  CollectionDetails,
} from './pages';
import PlaylistsPage from './pages/Playlists';
import type { Playlist, Track } from './services/MusicLibrary';
import type {
  AppSettings,
  IconStyle,
  MusicLibraryResponse,
  SeekbarStyle,
  ThemeMode,
  TrackMetadataUpdate,
  VisualizerStyle,
} from './types/electron';
import './App.css';

const SectionPlaceholder = ({ title }: { title: string }) => (
  <section className='section-placeholder'>
    <h2>{title}</h2>
    <p>This section is coming soon.</p>
  </section>
);

const getInitialThemeMode = (): ThemeMode => {
  const savedTheme = window.localStorage.getItem('luna-theme');

  return savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
    ? savedTheme
    : 'system';
};

const getInitialSystemTheme = (): 'light' | 'dark' =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const getInitialAccentColor = (): string => {
  const savedAccent = window.localStorage.getItem('luna-accent');
  return savedAccent && /^#[\da-f]{6}$/i.test(savedAccent) ? savedAccent : '#ff4444';
};

const normalizeCrossfadeSeconds = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10 ? value : 0;

const clampVolume = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

const shuffleTracks = (tracks: Track[]): Track[] => {
  const shuffled = [...tracks];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
};

const getInitialCrossfadeSeconds = (): number => {
  const savedValue = window.localStorage.getItem('luna-crossfade-seconds');
  return normalizeCrossfadeSeconds(savedValue === null ? null : Number(savedValue));
};

const ICON_STYLES: IconStyle[] = [
  'material',
  'windows',
  'apple',
  'vlc',
  'round-filled',
  'round-outline',
];
const SEEKBAR_STYLES: SeekbarStyle[] = ['default', 'windows', 'vlc', 'apple', 'samsung'];
const VISUALIZER_STYLES: VisualizerStyle[] = [
  'wave-smooth',
  'wave-sharp',
  'wave-organic',
  'bars-thin',
  'bars-rounded',
  'bars-outline',
  'bars-alternating',
  'bars-dense',
  'bars-pill',
];

const getInitialIconStyle = (): IconStyle => {
  const savedValue = window.localStorage.getItem('luna-icon-style');
  return ICON_STYLES.find((style) => style === savedValue) ?? 'material';
};

const normalizeIconStyle = (value: unknown): IconStyle =>
  ICON_STYLES.find((style) => style === value) ?? 'material';

const getInitialSeekbarStyle = (): SeekbarStyle => {
  const savedValue = window.localStorage.getItem('luna-seekbar-style');
  return SEEKBAR_STYLES.find((style) => style === savedValue) ?? 'default';
};

const getInitialVisualizerStyle = (): VisualizerStyle => {
  const savedValue = window.localStorage.getItem('luna-visualizer-style');
  return VISUALIZER_STYLES.find((style) => style === savedValue) ?? 'wave-smooth';
};

const hexToRgb = (hex: string): string => {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) return '255, 68, 68';

  const red = Number.parseInt(cleaned.slice(0, 2), 16);
  const green = Number.parseInt(cleaned.slice(2, 4), 16);
  const blue = Number.parseInt(cleaned.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
};

const colorToRgbString = (color: string): string => {
  const trimmed = color.trim();
  if (trimmed.startsWith('#')) {
    return hexToRgb(trimmed);
  }
  if (trimmed.startsWith('rgb(') || trimmed.startsWith('rgba(')) {
    return trimmed.replace(/^rgba?\((.*)\)$/i, '$1');
  }
  return trimmed;
};

const getPlayButtonAccent = (accent: string, theme: 'light' | 'dark'): number[] => {
  const rgb = colorToRgbString(accent)
    .split(',')
    .slice(0, 3)
    .map((channel) => Math.max(0, Math.min(255, Number.parseFloat(channel.trim()))));
  const source = rgb.every(Number.isFinite) ? rgb : [255, 68, 68];
  const background = theme === 'dark' ? [17, 17, 17] : [245, 245, 247];
  const contrastRatio = (color: number[]) => {
    const luminance = (channels: number[]) => {
      const [red, green, blue] = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const first = luminance(color);
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  };

  if (contrastRatio(source) >= 3) return source;
  const mixTarget = theme === 'dark' ? 255 : 17;
  for (let amount = 0.05; amount <= 0.6; amount += 0.05) {
    const mixed = source.map((channel) => Math.round(channel + (mixTarget - channel) * amount));
    if (contrastRatio(mixed) >= 3) return mixed;
  }
  return source.map((channel) => Math.round(channel + (mixTarget - channel) * 0.6));
};

const getDominantImageColor = (imageUrl: string, fallback: string): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const sampleSize = 32;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(fallback);
        return;
      }

      context.drawImage(img, 0, 0, sampleSize, sampleSize);
      const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
      const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();

      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3];
        if (alpha < 80) continue;

        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        const bucketKey = `${Math.round(red / 32) * 32},${Math.round(green / 32) * 32},${Math.round(blue / 32) * 32}`;
        const existing = buckets.get(bucketKey) ?? { r: 0, g: 0, b: 0, count: 0 };
        existing.r += red;
        existing.g += green;
        existing.b += blue;
        existing.count += 1;
        buckets.set(bucketKey, existing);
      }

      if (buckets.size === 0) {
        resolve(fallback);
        return;
      }

      let dominant = { r: 0, g: 0, b: 0, count: 0 };
      for (const value of buckets.values()) {
        if (value.count > dominant.count) {
          dominant = value;
        }
      }

      const averageRed = Math.round(dominant.r / dominant.count);
      const averageGreen = Math.round(dominant.g / dominant.count);
      const averageBlue = Math.round(dominant.b / dominant.count);
      resolve(`${averageRed}, ${averageGreen}, ${averageBlue}`);
    };

    img.onerror = () => resolve(fallback);
    img.src = imageUrl;
  });

const App = () => {
  const location = useLocation();
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode);
  const [accentColor, setAccentColor] = useState(getInitialAccentColor);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getInitialSystemTheme);
  const [systemAccentColor, setSystemAccentColor] = useState<string | null>(null);
  const [crossfadeSeconds, setCrossfadeSeconds] = useState(getInitialCrossfadeSeconds);
  const [iconStyle, setIconStyle] = useState<IconStyle>(getInitialIconStyle);
  const [seekbarStyle, setSeekbarStyle] = useState<SeekbarStyle>(getInitialSeekbarStyle);
  const [visualizerStyle, setVisualizerStyle] =
    useState<VisualizerStyle>(getInitialVisualizerStyle);
  const [showVisualizer, setShowVisualizer] = useState(
    () => window.localStorage.getItem('luna-show-visualizer') === 'true'
  );
  const [showArtistImageBackground, setShowArtistImageBackground] = useState(
    () => window.localStorage.getItem('luna-show-artist-background') === 'true'
  );
  const [showLyrics, setShowLyrics] = useState(
    () => window.localStorage.getItem('luna-show-lyrics') !== 'false'
  );
  const [showBrowseSection, setShowBrowseSection] = useState(
    () => window.localStorage.getItem('luna-show-browse') !== 'false'
  );
  const [showRadioSection, setShowRadioSection] = useState(
    () => window.localStorage.getItem('luna-show-radio') !== 'false'
  );
  const [showSpotifySection, setShowSpotifySection] = useState(
    () => window.localStorage.getItem('luna-show-spotify') !== 'false'
  );
  const [settingsLoaded, setSettingsLoaded] = useState(!window.electronAPI);
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const savedPlaylists = window.localStorage.getItem('luna-playlists');
      return savedPlaylists ? (JSON.parse(savedPlaylists) as Playlist[]) : [];
    } catch (error) {
      console.error('Could not read saved playlists from local storage:', error);
      return [];
    }
  });
  const [playlistDialog, setPlaylistDialog] = useState<PlaylistDialogState | null>(null);
  const [trackMetadataDialog, setTrackMetadataDialog] = useState<Track | null>(null);
  const [musicFolders, setMusicFolders] = useState<string[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(Boolean(window.electronAPI));
  const [initialLibraryLoaded, setInitialLibraryLoaded] = useState(!window.electronAPI);
  const [libraryReconciled, setLibraryReconciled] = useState(!window.electronAPI);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [lastPlayedTrackPath, setLastPlayedTrackPath] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [trackAccentColor, setTrackAccentColor] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const screenWidth = window.screen?.width ?? window.innerWidth;
    return Math.abs(window.innerWidth - screenWidth) > 4;
  });
  const [isShuffled, setIsShuffled] = useState(
    () => window.localStorage.getItem('luna-shuffled') === 'true'
  );
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>(() => {
    const savedMode = window.localStorage.getItem('luna-repeat-mode');
    return savedMode === 'one' || savedMode === 'all' ? savedMode : 'off';
  });
  const [playQueue, setPlayQueue] = useState<Track[]>([]);
  const [playQueueIndex, setPlayQueueIndex] = useState(0);
  const playQueueBaseRef = useRef<Track[]>([]);
  const [visualizerAnalyser, setVisualizerAnalyser] = useState<AnalyserNode | null>(null);
  const [lovedTrackIds, setLovedTrackIds] = useState<string[]>([]);
  const audioARef = useRef<HTMLAudioElement>(null);
  const audioBRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioSourceNodesRef = useRef(new WeakMap<HTMLAudioElement, MediaElementAudioSourceNode>());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeFrameRef = useRef<number | null>(null);
  const crossfadeOutgoingRef = useRef<HTMLAudioElement | null>(null);
  const crossfadeStartedRef = useRef(false);
  const crossfadeRequestIdRef = useRef(0);
  const volumeRef = useRef(volume);
  const initialLoadStarted = useRef(false);
  const closePlaylistDialog = useCallback(() => setPlaylistDialog(null), []);
  const closeTrackMetadataDialog = useCallback(() => setTrackMetadataDialog(null), []);
  const handleOpenTrackMetadata = useCallback((track: Track) => {
    setTrackMetadataDialog(track);
  }, []);

  const prepareVisualizerAudio = useCallback((audio: HTMLAudioElement) => {
    try {
      let audioContext = audioContextRef.current;
      if (!audioContext) {
        audioContext = new window.AudioContext();
        audioContextRef.current = audioContext;
      }

      let analyser = audioAnalyserRef.current;
      if (!analyser) {
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.82;
        analyser.connect(audioContext.destination);
        audioAnalyserRef.current = analyser;
        setVisualizerAnalyser(analyser);
      }

      if (!audioSourceNodesRef.current.has(audio)) {
        const source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        audioSourceNodesRef.current.set(audio, source);
      }

      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch((error: unknown) => {
          console.error('Could not resume the audio visualizer context:', error);
        });
      }
    } catch (error) {
      console.error('Could not initialize audio visualization:', error);
      setLibraryError('Could not initialize the audio visualizer.');
    }
  }, []);

  useEffect(
    () => () => {
      const audioContext = audioContextRef.current;
      if (audioContext && audioContext.state !== 'closed') {
        void audioContext.close().catch((error: unknown) => {
          console.error('Could not close the audio visualizer context:', error);
        });
      }
    },
    []
  );

  const applyLibraryResponse = useCallback((response: MusicLibraryResponse) => {
    setLibraryTracks(response.tracks);
    if (response.playlists) setPlaylists(response.playlists);
    setCurrentTrack((current) =>
      current ? (response.tracks.find((track) => track.path === current.path) ?? current) : null
    );
    setMusicFolders(response.folders);
    setLibraryError(
      response.errors.length > 0
        ? `${response.errors.length} music folder item(s) could not be read. Check that the folders are accessible.`
        : null
    );
  }, []);

  const handleSaveTrackMetadata = useCallback(
    async (track: Track, metadata: TrackMetadataUpdate) => {
      if (!window.electronAPI) {
        throw new Error('Editing audio file metadata is only available in the Luna desktop app.');
      }
      const response = await window.electronAPI.saveTrackMetadata(track.path, metadata);
      const tracksByPath = new Map(response.tracks.map((item) => [item.path, item]));
      const refreshTrack = (item: Track) => tracksByPath.get(item.path) ?? item;
      setLibraryTracks(response.tracks);
      setCurrentTrack((current) => (current ? refreshTrack(current) : null));
      setPlayQueue((queue) => queue.map(refreshTrack));
      playQueueBaseRef.current = playQueueBaseRef.current.map(refreshTrack);
      setMusicFolders(response.folders);
      setLibraryError(
        response.errors.length > 0
          ? `Metadata was saved, but ${response.errors.length} library item(s) could not be refreshed.`
          : `Metadata saved to “${track.filename}”.`
      );
    },
    []
  );

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI
      .loadAppSettings()
      .then((settings: AppSettings) => {
        setThemeMode(settings.themeMode);
        setAccentColor(settings.accentColor);
        setLastPlayedTrackPath(settings.lastPlayedTrackPath);
        setSystemTheme(settings.systemTheme);
        setSystemAccentColor(settings.systemAccentColor);
        setCrossfadeSeconds(
          settings.crossfadeSeconds === undefined
            ? getInitialCrossfadeSeconds()
            : normalizeCrossfadeSeconds(settings.crossfadeSeconds)
        );
        setIconStyle(normalizeIconStyle(settings.iconStyle));
        setSeekbarStyle(settings.seekbarStyle ?? getInitialSeekbarStyle());
        setVisualizerStyle(settings.visualizerStyle ?? getInitialVisualizerStyle());
        setShowVisualizer(
          settings.showVisualizer ?? window.localStorage.getItem('luna-show-visualizer') === 'true'
        );
        setShowArtistImageBackground(
          settings.showArtistImageBackground ??
            window.localStorage.getItem('luna-show-artist-background') === 'true'
        );
        setShowLyrics(
          settings.showLyrics ?? window.localStorage.getItem('luna-show-lyrics') !== 'false'
        );
        setIsShuffled(
          settings.isShuffled ?? window.localStorage.getItem('luna-shuffled') === 'true'
        );
        setRepeatMode(
          settings.repeatMode ??
            (window.localStorage.getItem('luna-repeat-mode') as 'off' | 'one' | 'all' | null) ??
            'off'
        );
        setShowBrowseSection(
          settings.showBrowseSection ?? window.localStorage.getItem('luna-show-browse') !== 'false'
        );
        setShowRadioSection(
          settings.showRadioSection ?? window.localStorage.getItem('luna-show-radio') !== 'false'
        );
        setShowSpotifySection(
          settings.showSpotifySection ??
            window.localStorage.getItem('luna-show-spotify') !== 'false'
        );
      })
      .catch((error: unknown) => {
        console.error('Could not load app settings:', error);
        setLibraryError('Could not load your saved app settings.');
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onSystemThemeChanged(setSystemTheme);
    if (window.electronAPI) return unsubscribe;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemTheme = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', updateSystemTheme);
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  useEffect(() => {
    if (!window.electronAPI || initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    setIsLibraryLoading(true);
    window.electronAPI
      .loadMusicLibrary()
      .then((response) => {
        applyLibraryResponse(response);
        setInitialLibraryLoaded(true);
        setLibraryReconciled(Boolean(response.initialScan) || response.folders.length === 0);
        if (!response.initialScan && response.folders.length > 0) {
          window.setTimeout(() => {
            window.electronAPI
              ?.rescanMusicLibrary()
              .then((updatedLibrary) => {
                applyLibraryResponse(updatedLibrary);
                setLibraryReconciled(true);
              })
              .catch((error: unknown) => {
                console.error('Could not refresh the saved music library:', error);
                setLibraryError(
                  'Could not refresh your saved music library. Try rescanning from Settings.'
                );
                setLibraryReconciled(true);
              });
          }, 0);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load the local music library:', error);
        setLibraryError(
          'Could not load your local music library. Please try rescanning your folders.'
        );
        setInitialLibraryLoaded(true);
        setLibraryReconciled(true);
      })
      .finally(() => setIsLibraryLoading(false));
  }, [applyLibraryResponse]);

  useEffect(() => {
    if (!settingsLoaded || !initialLibraryLoaded || !lastPlayedTrackPath) return;
    const restoredTrack = libraryTracks.find((track) => track.path === lastPlayedTrackPath);
    if (restoredTrack) {
      setCurrentTrack(restoredTrack);
      setCurrentTime(0);
      setDuration(restoredTrack.duration || 0);
      return;
    }
    if (libraryReconciled) {
      setCurrentTrack(null);
      setLastPlayedTrackPath(null);
    }
  }, [initialLibraryLoaded, lastPlayedTrackPath, libraryReconciled, libraryTracks, settingsLoaded]);

  useEffect(() => {
    if (!settingsLoaded) return;
    window.localStorage.setItem('luna-theme', themeMode);
    window.localStorage.setItem('luna-accent', accentColor);
    window.localStorage.setItem(
      'luna-crossfade-seconds',
      String(normalizeCrossfadeSeconds(crossfadeSeconds))
    );
    window.localStorage.setItem('luna-icon-style', iconStyle);
    window.localStorage.setItem('luna-seekbar-style', seekbarStyle);
    window.localStorage.setItem('luna-visualizer-style', visualizerStyle);
    window.localStorage.setItem('luna-show-visualizer', String(showVisualizer));
    window.localStorage.setItem(
      'luna-show-artist-background',
      String(showArtistImageBackground)
    );
    window.localStorage.setItem('luna-show-lyrics', String(showLyrics));
    window.localStorage.setItem('luna-shuffled', String(isShuffled));
    window.localStorage.setItem('luna-repeat-mode', repeatMode);
    window.localStorage.setItem('luna-show-browse', String(showBrowseSection));
    window.localStorage.setItem('luna-show-radio', String(showRadioSection));
    window.localStorage.setItem('luna-show-spotify', String(showSpotifySection));
    if (window.electronAPI) {
      window.electronAPI
        .saveAppSettings({
          themeMode,
          accentColor,
          lastPlayedTrackPath,
          crossfadeSeconds: normalizeCrossfadeSeconds(crossfadeSeconds),
          iconStyle,
          seekbarStyle,
          visualizerStyle,
          showVisualizer,
          showArtistImageBackground,
          showLyrics,
          isShuffled,
          repeatMode,
          showBrowseSection,
          showRadioSection,
          showSpotifySection,
        })
        .catch((error: unknown) => {
          console.error('Could not save app settings:', error);
          setLibraryError('Could not save your app settings.');
        });
    }
  }, [
    accentColor,
    crossfadeSeconds,
    iconStyle,
    isShuffled,
    lastPlayedTrackPath,
    repeatMode,
    seekbarStyle,
    settingsLoaded,
    showBrowseSection,
    showRadioSection,
    showSpotifySection,
    showLyrics,
    showVisualizer,
    showArtistImageBackground,
    themeMode,
    visualizerStyle,
  ]);

  useEffect(() => {
    if (!currentTrack?.albumArt) {
      setTrackAccentColor(null);
      return;
    }

    const fallbackAccent = accentColor || '#ff4444';
    void getDominantImageColor(currentTrack.albumArt, fallbackAccent)
      .then((dominantColor) => {
        setTrackAccentColor(dominantColor);
      })
      .catch(() => setTrackAccentColor(fallbackAccent));
  }, [accentColor, currentTrack?.albumArt]);

  useEffect(() => {
    volumeRef.current = clampVolume(volume);
    if (crossfadeFrameRef.current !== null) return;
    if (activeAudioRef.current) activeAudioRef.current.volume = volume;
    const inactiveAudio =
      activeAudioRef.current === audioARef.current ? audioBRef.current : audioARef.current;
    if (inactiveAudio) inactiveAudio.volume = 0;
  }, [volume]);

  const handleSelectMusicFolders = async () => {
    if (!window.electronAPI) {
      setLibraryError('Folder selection is available in the Luna desktop app.');
      return null;
    }
    try {
      setIsLibraryLoading(true);
      setLibraryError(null);
      const response = await window.electronAPI.selectMusicFolders();
      if (response) {
        applyLibraryResponse(response);
        setLibraryReconciled(true);
      }
      return response;
    } catch (error) {
      console.error('Could not add music folders:', error);
      setLibraryError('Could not add the selected music folders.');
      return null;
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const handleRescanMusicLibrary = async () => {
    if (!window.electronAPI) {
      setLibraryError('Library scanning is available in the Luna desktop app.');
      return { folders: [], tracks: [], errors: [] };
    }
    try {
      setIsLibraryLoading(true);
      setLibraryError(null);
      const response = await window.electronAPI.rescanMusicLibrary();
      applyLibraryResponse(response);
      setLibraryReconciled(true);
      return response;
    } catch (error) {
      console.error('Could not rescan the local music library:', error);
      setLibraryError('Could not rescan your music folders.');
      return { folders: [], tracks: [], errors: ['Could not rescan your music folders.'] };
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const handleRemoveMusicFolder = async (folder: string) => {
    if (!window.electronAPI) return;
    try {
      setIsLibraryLoading(true);
      setLibraryError(null);
      const response = await window.electronAPI.removeMusicFolder(folder);
      applyLibraryResponse(response);
      setLibraryReconciled(true);
    } catch (error) {
      console.error(`Could not remove music folder "${folder}":`, error);
      setLibraryError('Could not remove that music folder.');
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const cancelCrossfade = useCallback(() => {
    crossfadeRequestIdRef.current += 1;
    if (crossfadeFrameRef.current !== null) {
      window.cancelAnimationFrame(crossfadeFrameRef.current);
      crossfadeFrameRef.current = null;
    }
    if (crossfadeOutgoingRef.current) {
      crossfadeOutgoingRef.current.pause();
      crossfadeOutgoingRef.current.removeAttribute('src');
      crossfadeOutgoingRef.current.load();
      crossfadeOutgoingRef.current = null;
    }
    crossfadeStartedRef.current = false;
  }, []);

  const playAudioTrack = useCallback(
    async (track: Track) => {
      const audio = activeAudioRef.current ?? audioARef.current ?? audioBRef.current;
      if (!audio || !track.src) {
        setLibraryError('This track is missing a playable audio file.');
        return;
      }
      cancelCrossfade();
      const otherAudio = audio === audioARef.current ? audioBRef.current : audioARef.current;
      otherAudio?.pause();
      if (otherAudio) {
        otherAudio.removeAttribute('src');
        otherAudio.load();
        otherAudio.volume = 0;
      }
      activeAudioRef.current = audio;
      audio.volume = volumeRef.current;
      setCurrentTrack(track);
      setLastPlayedTrackPath(track.path);
      setCurrentTime(0);
      setDuration(track.duration || 0);
      setLibraryError(null);
      audio.src = track.src;
      prepareVisualizerAudio(audio);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.error(`Could not play "${track.name}":`, error);
        setIsPlaying(false);
        setLibraryError(
          `Could not play "${track.name}". The file may be unavailable or use an unsupported format.`
        );
      }
    },
    [cancelCrossfade, prepareVisualizerAudio]
  );

  const playTrack = useCallback(
    async (track: Track, sourceTracks: Track[] = libraryTracks) => {
      const sourceIndex = sourceTracks.findIndex((item) => item.id === track.id);
      const orderedTracks =
        sourceIndex >= 0 ? sourceTracks.slice(sourceIndex) : [track, ...sourceTracks];
      playQueueBaseRef.current = orderedTracks;
      const nextQueue =
        orderedTracks.length > 1 && isShuffled
          ? [orderedTracks[0], ...shuffleTracks(orderedTracks.slice(1))]
          : orderedTracks;
      setPlayQueue(nextQueue);
      setPlayQueueIndex(0);
      await playAudioTrack(track);
    },
    [isShuffled, libraryTracks, playAudioTrack]
  );

  const shufflePlayTracks = useCallback(
    (tracks: Track[]) => {
      if (tracks.length === 0) return;
      const shuffledTracks = shuffleTracks(tracks);
      playQueueBaseRef.current = shuffledTracks;
      setPlayQueue(shuffledTracks);
      setPlayQueueIndex(0);
      void playAudioTrack(shuffledTracks[0]);
    },
    [playAudioTrack]
  );

  const playQueueAt = useCallback(
    (index: number) => {
      const queuedTrack = playQueue[index];
      if (!queuedTrack) return;
      setPlayQueueIndex(index);
      void playAudioTrack(queuedTrack);
    },
    [playAudioTrack, playQueue]
  );

  const playRelativeTrack = useCallback(
    (offset: number) => {
      if (playQueue.length === 0) return;
      const nextIndex = playQueueIndex + offset;
      if (nextIndex >= 0 && nextIndex < playQueue.length) {
        playQueueAt(nextIndex);
      } else if (offset > 0 && repeatMode === 'all') {
        playQueueAt(0);
      } else if (offset < 0 && repeatMode === 'all') {
        playQueueAt(playQueue.length - 1);
      }
    },
    [playQueue.length, playQueueAt, playQueueIndex, repeatMode]
  );

  const handleQueueTracks = useCallback(
    (tracks: Track[], playNext: boolean) => {
      if (tracks.length === 0) return;
      const insertionIndex = playNext
        ? playQueue.length === 0
          ? 0
          : playQueueIndex + 1
        : playQueue.length;
      const nextBase = [...playQueueBaseRef.current];
      const baseInsertionIndex =
        playNext && playQueue[playQueueIndex]
          ? nextBase.indexOf(playQueue[playQueueIndex]) + 1
          : nextBase.length;
      nextBase.splice(Math.max(0, Math.min(baseInsertionIndex, nextBase.length)), 0, ...tracks);
      playQueueBaseRef.current = nextBase;
      setPlayQueue((currentQueue) => {
        const nextQueue = [...currentQueue];
        nextQueue.splice(Math.min(insertionIndex, nextQueue.length), 0, ...tracks);
        return nextQueue;
      });
    },
    [playQueue, playQueueIndex]
  );

  const handlePlayPause = () => {
    const audio = activeAudioRef.current ?? audioARef.current;
    if (!audio || !currentTrack?.src) return;
    activeAudioRef.current = audio;
    if (audio.paused) {
      if (audio.getAttribute('src') !== currentTrack.src) audio.src = currentTrack.src;
      audio.volume = volumeRef.current;
      prepareVisualizerAudio(audio);
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch((error: unknown) => {
          console.error('Could not resume audio playback:', error);
          setIsPlaying(false);
          setLibraryError('Could not resume playback. The audio file may no longer be available.');
        });
    } else {
      cancelCrossfade();
      audio.volume = volumeRef.current;
      audio.pause();
      const otherAudio = audio === audioARef.current ? audioBRef.current : audioARef.current;
      otherAudio?.pause();
      setIsPlaying(false);
    }
  };
  const handlePrevious = useCallback(() => {
    const audio = activeAudioRef.current;
    const playhead = audio?.currentTime ?? currentTime;
    if (currentTrack && playhead > 6) {
      if (audio) audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }
    playRelativeTrack(-1);
  }, [currentTime, currentTrack, playRelativeTrack]);
  const handleNext = useCallback(() => playRelativeTrack(1), [playRelativeTrack]);
  const handleVolumeChange = (newVolume: number) => setVolume(newVolume);
  const handleSeek = useCallback(
    (time: number) => {
      if (!Number.isFinite(time)) return;
      const seekTime = Math.max(0, Math.min(duration, time));
      if (activeAudioRef.current) activeAudioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    },
    [duration]
  );

  const beginCrossfade = useCallback(
    async (outgoing: HTMLAudioElement, nextTrack: Track) => {
      if (crossfadeStartedRef.current || !nextTrack.src) return;
      const fadeDuration = Math.min(crossfadeSeconds, outgoing.duration / 2);
      const incoming = outgoing === audioARef.current ? audioBRef.current : audioARef.current;
      if (!incoming || !Number.isFinite(fadeDuration) || fadeDuration <= 0) return;

      crossfadeStartedRef.current = true;
      const requestId = crossfadeRequestIdRef.current + 1;
      crossfadeRequestIdRef.current = requestId;
      incoming.src = nextTrack.src;
      incoming.currentTime = 0;
      incoming.volume = 0;
      prepareVisualizerAudio(incoming);
      try {
        await incoming.play();
      } catch (error) {
        if (crossfadeRequestIdRef.current !== requestId) return;
        console.error(`Could not start crossfade to "${nextTrack.name}":`, error);
        incoming.pause();
        incoming.removeAttribute('src');
        incoming.load();
        outgoing.volume = volumeRef.current;
        crossfadeStartedRef.current = false;
        setLibraryError(
          `Could not crossfade to "${nextTrack.name}". Playback will continue with the current track.`
        );
        return;
      }

      if (crossfadeRequestIdRef.current !== requestId) {
        incoming.pause();
        incoming.removeAttribute('src');
        incoming.load();
        return;
      }

      activeAudioRef.current = incoming;
      crossfadeOutgoingRef.current = outgoing;
      setPlayQueueIndex((currentIndex) =>
        playQueue[currentIndex + 1] === nextTrack ? currentIndex + 1 : 0
      );
      setCurrentTrack(nextTrack);
      setLastPlayedTrackPath(nextTrack.path);
      setCurrentTime(0);
      setDuration(Number.isFinite(incoming.duration) ? incoming.duration : nextTrack.duration || 0);
      setLibraryError(null);

      const startedAt = performance.now();
      const fadeDurationMs = fadeDuration * 1000;
      const updateFade = (now: number) => {
        const progress = Math.max(0, Math.min(1, (now - startedAt) / fadeDurationMs));
        const targetVolume = clampVolume(volumeRef.current);
        incoming.volume = clampVolume(targetVolume * progress);
        outgoing.volume = clampVolume(targetVolume * (1 - progress));

        if (progress >= 1) {
          outgoing.pause();
          outgoing.removeAttribute('src');
          outgoing.load();
          outgoing.volume = 0;
          crossfadeOutgoingRef.current = null;
          crossfadeFrameRef.current = null;
          crossfadeStartedRef.current = false;
          return;
        }
        crossfadeFrameRef.current = window.requestAnimationFrame(updateFade);
      };
      crossfadeFrameRef.current = window.requestAnimationFrame(updateFade);
    },
    [crossfadeSeconds, playQueue, prepareVisualizerAudio]
  );

  const handleAudioTimeUpdate = useCallback(
    (audio: HTMLAudioElement) => {
      if (audio !== activeAudioRef.current) return;
      setCurrentTime(audio.currentTime);
      if (repeatMode !== 'all' || crossfadeSeconds <= 0 || !Number.isFinite(audio.duration)) return;
      const nextTrack =
        playQueue[playQueueIndex + 1] ?? (repeatMode === 'all' ? playQueue[0] : null);
      const fadeDuration = Math.min(crossfadeSeconds, audio.duration / 2);
      if (
        nextTrack &&
        !(playQueue.length === 1 && nextTrack.id === currentTrack?.id) &&
        audio.duration - audio.currentTime <= fadeDuration
      ) {
        void beginCrossfade(audio, nextTrack);
      }
    },
    [beginCrossfade, crossfadeSeconds, currentTrack?.id, playQueue, playQueueIndex, repeatMode]
  );

  const handleAudioEnded = useCallback(
    (audio: HTMLAudioElement) => {
      if (audio !== activeAudioRef.current || crossfadeOutgoingRef.current === audio) return;
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch((error: unknown) => {
          console.error('Could not repeat the current track:', error);
          setIsPlaying(false);
          setLibraryError('Could not repeat the current track.');
        });
        return;
      }
      if (playQueueIndex + 1 < playQueue.length) {
        playQueueAt(playQueueIndex + 1);
      } else if (repeatMode === 'all' && playQueue.length > 0) {
        playQueueAt(0);
      } else {
        setIsPlaying(false);
      }
    },
    [playQueue.length, playQueueAt, playQueueIndex, repeatMode]
  );

  const handleToggleShuffle = () => {
    const nextShuffle = !isShuffled;
    setIsShuffled(nextShuffle);
    if (playQueue.length > 1) {
      const currentQueue = playQueue.slice(0, playQueueIndex + 1);
      const upcoming = playQueue.slice(playQueueIndex + 1);
      if (nextShuffle) {
        setPlayQueue([...currentQueue, ...shuffleTracks(upcoming)]);
      } else {
        const currentTrackId = playQueue[playQueueIndex]?.id;
        const sourceIndex = playQueueBaseRef.current.findIndex(
          (track) => track.id === currentTrackId
        );
        const unshuffledUpcoming =
          sourceIndex < 0 ? upcoming : playQueueBaseRef.current.slice(sourceIndex + 1);
        setPlayQueue([...currentQueue, ...unshuffledUpcoming]);
      }
    }
  };
  const handleToggleRepeat = () => {
    const modes: ('off' | 'one' | 'all')[] = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };
  const handleDeleteTrackFromLibrary = (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => {
    if (!track || !track.path) return;
    setLibraryTracks((tracks) => tracks.filter((item) => item.path !== track.path));
    const removedBeforeCurrent = playQueue
      .slice(0, playQueueIndex)
      .filter((item) => item.path === track.path).length;
    if (removedBeforeCurrent > 0) {
      setPlayQueueIndex((index) => Math.max(0, index - removedBeforeCurrent));
    }
    setPlayQueue((queue) => queue.filter((item) => item.path !== track.path));
    playQueueBaseRef.current = playQueueBaseRef.current.filter((item) => item.path !== track.path);
    if (currentTrack?.path === track.path) {
      setCurrentTrack(null);
      setLastPlayedTrackPath(null);
      setIsPlaying(false);
      cancelCrossfade();
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      }
    }
  };
  const persistPlaylists = useCallback((updatedPlaylists: Playlist[]) => {
    setPlaylists(updatedPlaylists);
    if (window.electronAPI) {
      void window.electronAPI.savePlaylists(updatedPlaylists).catch((error: unknown) => {
        console.error('Could not save playlists:', error);
        setLibraryError(
          'Could not save your playlists. Your changes are still visible until the app closes.'
        );
      });
      return;
    }
    try {
      window.localStorage.setItem('luna-playlists', JSON.stringify(updatedPlaylists));
    } catch (error) {
      console.error('Could not save playlists to local storage:', error);
      setLibraryError('Could not save your playlists in this browser.');
    }
  }, []);

  const handleCreatePlaylist = useCallback(
    (name: string): string | null => {
      const normalizedName = name.trim();
      if (!normalizedName) return null;
      if (
        playlists.some(
          (playlist) => playlist.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
        )
      ) {
        setLibraryError(`A playlist named “${normalizedName}” already exists.`);
        return null;
      }
      const id =
        typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `playlist-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const updatedPlaylists = [
        ...playlists,
        { id, name: normalizedName, trackIds: [], createdAt: Date.now() },
      ];
      persistPlaylists(updatedPlaylists);
      return id;
    },
    [persistPlaylists, playlists]
  );

  const handleDeletePlaylist = useCallback(
    (playlistId: string) => {
      persistPlaylists(playlists.filter((playlist) => playlist.id !== playlistId));
    },
    [persistPlaylists, playlists]
  );

  const handlePlaylistAction = useCallback(
    (playlist: Playlist, action: PlaylistAction) => {
      const playlistTracks = playlist.trackIds
        .map((trackId) => libraryTracks.find((track) => track.id === trackId))
        .filter((track): track is Track => Boolean(track));
      switch (action) {
        case 'rename': {
          setPlaylistDialog({ type: 'rename', playlist });
          break;
        }
        case 'mix-cover-art': {
          const coverTrackIds = shuffleTracks(playlistTracks.filter((item) => item.albumArt))
            .filter(
              (item, index, candidates) =>
                candidates.findIndex((candidate) => candidate.albumArt === item.albumArt) === index
            )
            .slice(0, 4)
            .map((item) => item.id);
          persistPlaylists(
            playlists.map((item) => (item.id === playlist.id ? { ...item, coverTrackIds } : item))
          );
          break;
        }
        case 'delete':
          setPlaylistDialog({ type: 'delete', playlist });
          break;
        case 'play-now':
          if (playlistTracks.length > 0) {
            void playTrack(playlistTracks[0], playlistTracks);
          } else {
            setLibraryError(`“${playlist.name}” has no available tracks to play.`);
          }
          break;
        case 'add-to-queue':
          if (playlistTracks.length > 0) {
            handleQueueTracks(playlistTracks, false);
            setLibraryError(
              `Added ${playlistTracks.length} track${playlistTracks.length === 1 ? '' : 's'} from “${playlist.name}” to the play queue.`
            );
          } else {
            setLibraryError(`“${playlist.name}” has no available tracks to queue.`);
          }
          break;
        default:
          break;
      }
    },
    [handleQueueTracks, libraryTracks, persistPlaylists, playTrack, playlists]
  );

  const handleAddTracksToPlaylist = useCallback(
    (playlistId: string, tracks: Track[]) => {
      let addedCount = 0;
      const updatedPlaylists = playlists.map((playlist) =>
        playlist.id !== playlistId
          ? playlist
          : {
              ...playlist,
              trackIds: [
                ...playlist.trackIds,
                ...tracks
                  .map((track) => track.id)
                  .filter((id) => {
                    if (playlist.trackIds.includes(id)) return false;
                    addedCount += 1;
                    return true;
                  }),
              ],
            }
      );
      persistPlaylists(updatedPlaylists);
      const playlistName =
        playlists.find((playlist) => playlist.id === playlistId)?.name ?? 'playlist';
      setLibraryError(
        addedCount
          ? `Added ${addedCount} track${addedCount === 1 ? '' : 's'} to “${playlistName}”.`
          : null
      );
    },
    [persistPlaylists, playlists]
  );

  const handleRemoveTrackFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      persistPlaylists(
        playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...playlist, trackIds: playlist.trackIds.filter((id) => id !== trackId) }
            : playlist
        )
      );
    },
    [persistPlaylists, playlists]
  );

  const handleAddTrackToPlaylist = (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => {
    if (!track) return;
    const fullTrack = libraryTracks.find((libraryTrack) => libraryTrack.id === track.id);
    if (!fullTrack) {
      setLibraryError(`Could not add “${track.name}” because it is not in your library.`);
      return;
    }
    setPlaylistDialog({ type: 'add-track', track: fullTrack });
  };

  const handleRenamePlaylist = useCallback(
    (playlist: Playlist, name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) return 'Enter a playlist name.';
      if (
        playlists.some(
          (item) =>
            item.id !== playlist.id &&
            item.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
        )
      ) {
        return `A playlist named “${normalizedName}” already exists.`;
      }
      if (normalizedName !== playlist.name) {
        persistPlaylists(
          playlists.map((item) =>
            item.id === playlist.id ? { ...item, name: normalizedName } : item
          )
        );
      }
      return null;
    },
    [persistPlaylists, playlists]
  );

  const handleAddTrackFromDialog = useCallback(
    (track: Track, playlistId: string | null, newPlaylistName: string) => {
      if (playlistId) {
        handleAddTracksToPlaylist(playlistId, [track]);
        return null;
      }
      const normalizedName = newPlaylistName.trim();
      if (!normalizedName) return 'Enter a playlist name.';
      const existingPlaylist = playlists.find(
        (playlist) => playlist.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
      );
      if (existingPlaylist) return `A playlist named “${normalizedName}” already exists.`;
      const id =
        typeof window.crypto?.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `playlist-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      persistPlaylists([
        ...playlists,
        { id, name: normalizedName, trackIds: [track.id], createdAt: Date.now() },
      ]);
      setLibraryError(`Created “${normalizedName}” and added “${track.name}”.`);
      return null;
    },
    [handleAddTracksToPlaylist, persistPlaylists, playlists]
  );
  const handleShowAlbum = (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => {
    if (!track) return;
    setLibraryError(`Showing album: ${track.album}`);
  };
  const handleToggleLove = (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => {
    if (!track) return;
    setLovedTrackIds((current) =>
      current.includes(track.id) ? current.filter((id) => id !== track.id) : [...current, track.id]
    );
  };
  const handleSuggestTrackLess = (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => {
    if (!track) return;
    setLibraryError(`“${track.name}” will be suggested less often.`);
  };

  useLayoutEffect(() => {
    const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode;
    const root = document.documentElement;
    const activeAccent = accentColor;
    const rgbString = colorToRgbString(activeAccent);
    const [red, green, blue] = rgbString.split(',').map((part) => Number.parseInt(part.trim(), 10));

    root.setAttribute('data-theme', resolvedTheme);
    root.setAttribute('data-icon-style', iconStyle);
    root.setAttribute('data-seekbar-style', seekbarStyle);
    root.style.setProperty('--accent', activeAccent);
    root.style.setProperty('--accent-rgb', `${red}, ${green}, ${blue}`);
    root.style.setProperty('--accent-muted', `rgba(${red}, ${green}, ${blue}, 0.12)`);
    const systemRgb = colorToRgbString(systemAccentColor ?? activeAccent)
      .split(',')
      .slice(0, 3)
      .map((part) => Number.parseInt(part.trim(), 10));
    root.style.setProperty('--system-accent', systemAccentColor ?? activeAccent);
    root.style.setProperty('--system-accent-rgb', systemRgb.join(', '));

    const playerAccent = trackAccentColor ?? activeAccent;
    const playerRgbString = colorToRgbString(playerAccent);
    const [playerRed, playerGreen, playerBlue] = playerRgbString
      .split(',')
      .map((part) => Number.parseInt(part.trim(), 10));

    root.style.setProperty('--player-accent', `rgb(${playerRed}, ${playerGreen}, ${playerBlue})`);
    root.style.setProperty('--player-accent-rgb', `${playerRed}, ${playerGreen}, ${playerBlue}`);
    root.style.setProperty(
      '--player-accent-soft',
      `rgba(${playerRed}, ${playerGreen}, ${playerBlue}, 0.16)`
    );
    root.style.setProperty(
      '--player-accent-strong',
      `rgba(${playerRed}, ${playerGreen}, ${playerBlue}, 0.38)`
    );
    root.style.setProperty(
      '--player-accent-muted',
      `rgba(${playerRed}, ${playerGreen}, ${playerBlue}, 0.12)`
    );

    const [buttonRed, buttonGreen, buttonBlue] = getPlayButtonAccent(playerAccent, resolvedTheme);
    root.style.setProperty(
      '--play-button-accent',
      `rgb(${buttonRed}, ${buttonGreen}, ${buttonBlue})`
    );
    root.style.setProperty(
      '--play-button-accent-rgb',
      `${buttonRed}, ${buttonGreen}, ${buttonBlue}`
    );
  }, [
    accentColor,
    iconStyle,
    seekbarStyle,
    systemAccentColor,
    systemTheme,
    themeMode,
    trackAccentColor,
  ]);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {window.electronAPI?.platform === 'win32' && <WindowTitleBar />}
      <div className='app-container'>
        {/* Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
          playlists={playlists}
          tracks={libraryTracks}
          showBrowseSection={showBrowseSection}
          showRadioSection={showRadioSection}
          showSpotifySection={showSpotifySection}
        />

        {/* Main Content Area */}
        <div className='main-area'>
          {/* Top Navigation */}
          <TopNavbar
            tracks={libraryTracks}
            onSelectMusicFolders={handleSelectMusicFolders}
            onRescanMusicLibrary={handleRescanMusicLibrary}
          />

          {/* Page Content */}
          <main className='page-content'>
            <div key={location.pathname} className='page-transition'>
              <Routes>
                <Route
                  path='/'
                  element={
                    <Tracks
                      tracks={libraryTracks}
                      selectedTrackId={currentTrack?.id ?? null}
                      isPlaying={isPlaying}
                      isLoading={isLibraryLoading}
                      libraryError={libraryError}
                      isDesktopApp={Boolean(window.electronAPI)}
                      onPlayTrack={playTrack}
                      onShufflePlay={shufflePlayTracks}
                      onQueueTracks={handleQueueTracks}
                      playlists={playlists}
                      onAddTracksToPlaylist={handleAddTracksToPlaylist}
                      onEditTrack={handleOpenTrackMetadata}
                      onAddMusicFolder={() => {
                        void handleSelectMusicFolders();
                      }}
                    />
                  }
                />
                <Route
                  path='/tracks'
                  element={
                    <Tracks
                      tracks={libraryTracks}
                      selectedTrackId={currentTrack?.id ?? null}
                      isPlaying={isPlaying}
                      isLoading={isLibraryLoading}
                      libraryError={libraryError}
                      isDesktopApp={Boolean(window.electronAPI)}
                      onPlayTrack={playTrack}
                      onShufflePlay={shufflePlayTracks}
                      onQueueTracks={handleQueueTracks}
                      playlists={playlists}
                      onAddTracksToPlaylist={handleAddTracksToPlaylist}
                      onEditTrack={handleOpenTrackMetadata}
                      onAddMusicFolder={() => {
                        void handleSelectMusicFolders();
                      }}
                    />
                  }
                />
                <Route
                  path='/albums'
                  element={
                    <Albums
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onShufflePlay={shufflePlayTracks}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/albums/detail'
                  element={
                    <CollectionDetails
                      type='album'
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/artists'
                  element={
                    <Artists
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onShufflePlay={shufflePlayTracks}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/artists/detail'
                  element={
                    <CollectionDetails
                      type='artist'
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/genres'
                  element={
                    <Genres
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/genres/detail'
                  element={
                    <CollectionDetails
                      type='genre'
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/composer'
                  element={
                    <Composer
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/playlists/:playlistId?'
                  element={
                    <PlaylistsPage
                      playlists={playlists}
                      tracks={libraryTracks}
                      onCreatePlaylist={handleCreatePlaylist}
                      onDeletePlaylist={handleDeletePlaylist}
                      onAddTracks={handleAddTracksToPlaylist}
                      onRemoveTrack={handleRemoveTrackFromPlaylist}
                      onPlayTrack={playTrack}
                      onShufflePlay={shufflePlayTracks}
                      onPlaylistAction={handlePlaylistAction}
                      message={libraryError}
                    />
                  }
                />
                <Route path='/browse' element={<SectionPlaceholder title='Browse' />} />
                <Route path='/radio' element={<SectionPlaceholder title='Radio' />} />
                <Route path='/spotify' element={<SectionPlaceholder title='Spotify' />} />
                <Route
                  path='/search'
                  element={
                    <Search
                      tracks={libraryTracks}
                      onPlayTrack={playTrack}
                      onQueueTracks={handleQueueTracks}
                    />
                  }
                />
                <Route
                  path='/settings'
                  element={
                    <Settings
                      themeMode={themeMode}
                      onThemeChange={setThemeMode}
                      accentColor={accentColor}
                      onAccentColorChange={setAccentColor}
                      iconStyle={iconStyle}
                      onIconStyleChange={setIconStyle}
                      seekbarStyle={seekbarStyle}
                      onSeekbarStyleChange={setSeekbarStyle}
                      visualizerStyle={visualizerStyle}
                      onVisualizerStyleChange={setVisualizerStyle}
                      showVisualizer={showVisualizer}
                      onShowVisualizerChange={setShowVisualizer}
                      showArtistImageBackground={showArtistImageBackground}
                      onShowArtistImageBackgroundChange={setShowArtistImageBackground}
                      showLyrics={showLyrics}
                      onShowLyricsChange={setShowLyrics}
                      crossfadeSeconds={crossfadeSeconds}
                      onCrossfadeChange={setCrossfadeSeconds}
                      systemAccentColor={systemAccentColor}
                      musicFolders={musicFolders}
                      trackCount={libraryTracks.length}
                      isDesktopApp={Boolean(window.electronAPI)}
                      onAddMusicFolder={() => {
                        void handleSelectMusicFolders();
                      }}
                      onRescanMusicLibrary={() => {
                        void handleRescanMusicLibrary();
                      }}
                      onRemoveMusicFolder={(folder) => {
                        void handleRemoveMusicFolder(folder);
                      }}
                      showBrowseSection={showBrowseSection}
                      onShowBrowseSectionChange={setShowBrowseSection}
                      showRadioSection={showRadioSection}
                      onShowRadioSectionChange={setShowRadioSection}
                      showSpotifySection={showSpotifySection}
                      onShowSpotifySectionChange={setShowSpotifySection}
                    />
                  }
                />
                <Route
                  path='/settings/*'
                  element={
                    <Settings
                      themeMode={themeMode}
                      onThemeChange={setThemeMode}
                      accentColor={accentColor}
                      onAccentColorChange={setAccentColor}
                      iconStyle={iconStyle}
                      onIconStyleChange={setIconStyle}
                      seekbarStyle={seekbarStyle}
                      onSeekbarStyleChange={setSeekbarStyle}
                      visualizerStyle={visualizerStyle}
                      onVisualizerStyleChange={setVisualizerStyle}
                      showVisualizer={showVisualizer}
                      onShowVisualizerChange={setShowVisualizer}
                      showArtistImageBackground={showArtistImageBackground}
                      onShowArtistImageBackgroundChange={setShowArtistImageBackground}
                      showLyrics={showLyrics}
                      onShowLyricsChange={setShowLyrics}
                      crossfadeSeconds={crossfadeSeconds}
                      onCrossfadeChange={setCrossfadeSeconds}
                      systemAccentColor={systemAccentColor}
                      musicFolders={musicFolders}
                      trackCount={libraryTracks.length}
                      isDesktopApp={Boolean(window.electronAPI)}
                      onAddMusicFolder={() => {
                        void handleSelectMusicFolders();
                      }}
                      onRescanMusicLibrary={() => {
                        void handleRescanMusicLibrary();
                      }}
                      onRemoveMusicFolder={(folder) => {
                        void handleRemoveMusicFolder(folder);
                      }}
                      showBrowseSection={showBrowseSection}
                      onShowBrowseSectionChange={setShowBrowseSection}
                      showRadioSection={showRadioSection}
                      onShowRadioSectionChange={setShowRadioSection}
                      showSpotifySection={showSpotifySection}
                      onShowSpotifySectionChange={setShowSpotifySection}
                    />
                  }
                />
              </Routes>
            </div>
          </main>
        </div>
      </div>

      {/* PlayBar */}
      <audio
        ref={audioARef}
        onTimeUpdate={(event) => handleAudioTimeUpdate(event.currentTarget)}
        onLoadedMetadata={(event) => {
          if (event.currentTarget === activeAudioRef.current)
            setDuration(event.currentTarget.duration);
        }}
        onEnded={(event) => handleAudioEnded(event.currentTarget)}
        onPause={(event) => {
          if (event.currentTarget === activeAudioRef.current) setIsPlaying(false);
        }}
        onPlay={(event) => {
          if (event.currentTarget === activeAudioRef.current) setIsPlaying(true);
        }}
        onError={(event) => {
          if (event.currentTarget === activeAudioRef.current && currentTrack) {
            setIsPlaying(false);
            setLibraryError(
              `Could not read "${currentTrack.name}". The file may have been moved or deleted.`
            );
          }
        }}
        hidden
      />
      <audio
        ref={audioBRef}
        onTimeUpdate={(event) => handleAudioTimeUpdate(event.currentTarget)}
        onLoadedMetadata={(event) => {
          if (event.currentTarget === activeAudioRef.current)
            setDuration(event.currentTarget.duration);
        }}
        onEnded={(event) => handleAudioEnded(event.currentTarget)}
        onPause={(event) => {
          if (event.currentTarget === activeAudioRef.current) setIsPlaying(false);
        }}
        onPlay={(event) => {
          if (event.currentTarget === activeAudioRef.current) setIsPlaying(true);
        }}
        onError={(event) => {
          if (event.currentTarget === activeAudioRef.current && currentTrack) {
            setIsPlaying(false);
            setLibraryError(
              `Could not read "${currentTrack.name}". The file may have been moved or deleted.`
            );
          }
        }}
        hidden
      />
      <PlayBar
        track={currentTrack}
        isPlaying={isPlaying}
        isLoved={currentTrack ? lovedTrackIds.includes(currentTrack.id) : false}
        onPlayPause={handlePlayPause}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onDeleteTrackFromLibrary={handleDeleteTrackFromLibrary}
        onAddTrackToPlaylist={handleAddTrackToPlaylist}
        onShowAlbum={handleShowAlbum}
        onToggleLove={handleToggleLove}
        onSuggestTrackLess={handleSuggestTrackLess}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        isShuffled={isShuffled}
        onToggleShuffle={handleToggleShuffle}
        repeatMode={repeatMode}
        onToggleRepeat={handleToggleRepeat}
        visualizerAnalyser={visualizerAnalyser}
        visualizerStyle={visualizerStyle}
        showVisualizer={showVisualizer}
        showArtistImageBackground={showArtistImageBackground}
        showLyrics={showLyrics}
        playQueue={playQueue}
        playQueueIndex={playQueueIndex}
        onQueueSelect={playQueueAt}
        onQueueTracks={handleQueueTracks}
      />
      {playlistDialog && (
        <PlaylistDialog
          dialog={playlistDialog}
          playlists={playlists}
          onClose={closePlaylistDialog}
          onRename={handleRenamePlaylist}
          onAddTrack={handleAddTrackFromDialog}
          onDelete={(playlist) => handleDeletePlaylist(playlist.id)}
        />
      )}
      {trackMetadataDialog && (
        <TrackMetadataEditor
          key={trackMetadataDialog.path}
          track={trackMetadataDialog}
          onClose={closeTrackMetadataDialog}
          onSave={handleSaveTrackMetadata}
        />
      )}
    </div>
  );
};

export default App;
