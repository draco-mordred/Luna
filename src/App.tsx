import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import PlayBar from './components/PlayBar';
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
import WindowTitleBar from './components/WindowTitleBar/WindowTitleBar';
import { Tracks, Albums, Artists, Composer, Settings, Search } from './pages';
import type { Track } from './services/MusicLibrary';
import type { AppSettings, MusicLibraryResponse, ThemeMode } from './types/electron';
import './App.css';

const SectionPlaceholder = ({ title }: { title: string }) => (
  <section className='section-placeholder'>
    <h2>{title}</h2>
    <p>This section is coming soon.</p>
  </section>
);

const getInitialThemeMode = (): ThemeMode => {
  const savedTheme = window.localStorage.getItem('luna-theme');

  return savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system' ? savedTheme : 'system';
};

const getInitialSystemTheme = (): 'light' | 'dark' => (
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
);

const getInitialAccentColor = (): string => {
  const savedAccent = window.localStorage.getItem('luna-accent');
  return savedAccent && /^#[\da-f]{6}$/i.test(savedAccent) ? savedAccent : '#ff4444';
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

const getDominantImageColor = (imageUrl: string, fallback: string): Promise<string> => new Promise((resolve) => {
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
  const [settingsLoaded, setSettingsLoaded] = useState(!window.electronAPI);
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
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
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off');
  const [lovedTrackIds, setLovedTrackIds] = useState<string[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const initialLoadStarted = useRef(false);

  const applyLibraryResponse = useCallback((response: MusicLibraryResponse) => {
    setLibraryTracks(response.tracks);
    setCurrentTrack((current) => current
      ? response.tracks.find((track) => track.path === current.path) ?? current
      : null);
    setMusicFolders(response.folders);
    setLibraryError(response.errors.length > 0
      ? `${response.errors.length} music folder item(s) could not be read. Check that the folders are accessible.`
      : null);
  }, []);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.loadAppSettings()
      .then((settings: AppSettings) => {
        setThemeMode(settings.themeMode);
        setAccentColor(settings.accentColor);
        setLastPlayedTrackPath(settings.lastPlayedTrackPath);
        setSystemTheme(settings.systemTheme);
        setSystemAccentColor(settings.systemAccentColor);
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
    window.electronAPI.loadMusicLibrary()
      .then((response) => {
        applyLibraryResponse(response);
        setInitialLibraryLoaded(true);
        setLibraryReconciled(Boolean(response.initialScan) || response.folders.length === 0);
        if (!response.initialScan && response.folders.length > 0) {
          window.setTimeout(() => {
            window.electronAPI?.rescanMusicLibrary()
              .then((updatedLibrary) => {
                applyLibraryResponse(updatedLibrary);
                setLibraryReconciled(true);
              })
              .catch((error: unknown) => {
                console.error('Could not refresh the saved music library:', error);
                setLibraryError('Could not refresh your saved music library. Try rescanning from Settings.');
                setLibraryReconciled(true);
              });
          }, 0);
        }
      })
      .catch((error: unknown) => {
        console.error('Could not load the local music library:', error);
        setLibraryError('Could not load your local music library. Please try rescanning your folders.');
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
    if (window.electronAPI) {
      window.electronAPI.saveAppSettings({ themeMode, accentColor, lastPlayedTrackPath })
        .catch((error: unknown) => {
          console.error('Could not save app settings:', error);
          setLibraryError('Could not save your app settings.');
        });
    }
  }, [accentColor, lastPlayedTrackPath, settingsLoaded, themeMode]);

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
    if (audioRef.current) audioRef.current.volume = volume;
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

  const playTrack = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio || !track.src) {
      setLibraryError('This track is missing a playable audio file.');
      return;
    }
    setCurrentTrack(track);
    setLastPlayedTrackPath(track.path);
    setCurrentTime(0);
    setDuration(track.duration || 0);
    setLibraryError(null);
    audio.src = track.src;
    try {
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.error(`Could not play "${track.name}":`, error);
      setIsPlaying(false);
      setLibraryError(`Could not play "${track.name}". The file may be unavailable or use an unsupported format.`);
    }
  }, []);

  const playRelativeTrack = (offset: number) => {
    if (libraryTracks.length === 0) return;
    const currentIndex = libraryTracks.findIndex((track) => track.id === currentTrack?.id);
    let nextIndex = currentIndex < 0
      ? 0
      : (currentIndex + offset + libraryTracks.length) % libraryTracks.length;
    if (isShuffled && offset > 0 && libraryTracks.length > 1) {
      const candidates = libraryTracks
        .map((_, index) => index)
        .filter((index) => index !== currentIndex);
      nextIndex = candidates[Math.floor(Math.random() * candidates.length)];
    }
    void playTrack(libraryTracks[nextIndex]);
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack?.src) return;
    if (audio.paused) {
      if (audio.getAttribute('src') !== currentTrack.src) audio.src = currentTrack.src;
      audio.play().then(() => setIsPlaying(true)).catch((error: unknown) => {
        console.error('Could not resume audio playback:', error);
        setIsPlaying(false);
        setLibraryError('Could not resume playback. The audio file may no longer be available.');
      });
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };
  const handlePrevious = () => playRelativeTrack(-1);
  const handleNext = () => playRelativeTrack(1);
  const handleVolumeChange = (newVolume: number) => setVolume(newVolume);
  const handleSeek = (time: number) => {
    if (!Number.isFinite(time)) return;
    const seekTime = Math.max(0, Math.min(duration, time));
    if (audioRef.current) audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };
  const handleToggleShuffle = () => setIsShuffled(!isShuffled);
  const handleToggleRepeat = () => {
    const modes: ('off' | 'one' | 'all')[] = ['off', 'one', 'all'];
    const currentIndex = modes.indexOf(repeatMode);
    setRepeatMode(modes[(currentIndex + 1) % modes.length]);
  };
  const handleDeleteTrackFromLibrary = (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => {
    if (!track || !track.path) return;
    setLibraryTracks((tracks) => tracks.filter((item) => item.path !== track.path));
    if (currentTrack?.path === track.path) {
      setCurrentTrack(null);
      setLastPlayedTrackPath(null);
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    }
  };
  const handleAddTrackToPlaylist = (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => {
    if (!track) return;
    setLibraryError(`Added “${track.name}” to a playlist.`);
  };
  const handleShowAlbum = (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => {
    if (!track) return;
    setLibraryError(`Showing album: ${track.album}`);
  };
  const handleToggleLove = (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => {
    if (!track) return;
    setLovedTrackIds((current) => current.includes(track.id)
      ? current.filter((id) => id !== track.id)
      : [...current, track.id]);
  };
  const handleSuggestTrackLess = (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => {
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
    const [playerRed, playerGreen, playerBlue] = playerRgbString.split(',').map((part) => Number.parseInt(part.trim(), 10));

    root.style.setProperty('--player-accent', `rgb(${playerRed}, ${playerGreen}, ${playerBlue})`);
    root.style.setProperty('--player-accent-rgb', `${playerRed}, ${playerGreen}, ${playerBlue}`);
    root.style.setProperty('--player-accent-soft', `rgba(${playerRed}, ${playerGreen}, ${playerBlue}, 0.16)`);
    root.style.setProperty('--player-accent-strong', `rgba(${playerRed}, ${playerGreen}, ${playerBlue}, 0.38)`);
    root.style.setProperty('--player-accent-muted', `rgba(${playerRed}, ${playerGreen}, ${playerBlue}, 0.12)`);

    const [buttonRed, buttonGreen, buttonBlue] = getPlayButtonAccent(playerAccent, resolvedTheme);
    root.style.setProperty('--play-button-accent', `rgb(${buttonRed}, ${buttonGreen}, ${buttonBlue})`);
    root.style.setProperty('--play-button-accent-rgb', `${buttonRed}, ${buttonGreen}, ${buttonBlue}`);
  }, [accentColor, systemAccentColor, systemTheme, themeMode, trackAccentColor]);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {window.electronAPI?.platform === 'win32' && <WindowTitleBar />}
      <div className="app-container">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        
        {/* Main Content Area */}
        <div className="main-area">
          {/* Top Navigation */}
          <TopNavbar
            tracks={libraryTracks}
            onSelectMusicFolders={handleSelectMusicFolders}
            onRescanMusicLibrary={handleRescanMusicLibrary}
          />
          
          {/* Page Content */}
          <main className="page-content">
            <div key={location.pathname} className="page-transition">
              <Routes>
              <Route
                path="/"
                element={
                  <Tracks
                    tracks={libraryTracks}
                    selectedTrackId={currentTrack?.id ?? null}
                    isLoading={isLibraryLoading}
                    libraryError={libraryError}
                    isDesktopApp={Boolean(window.electronAPI)}
                    onPlayTrack={playTrack}
                    onAddMusicFolder={() => { void handleSelectMusicFolders(); }}
                  />
                }
              />
              <Route
                path="/tracks"
                element={
                  <Tracks
                    tracks={libraryTracks}
                    selectedTrackId={currentTrack?.id ?? null}
                    isLoading={isLibraryLoading}
                    libraryError={libraryError}
                    isDesktopApp={Boolean(window.electronAPI)}
                    onPlayTrack={playTrack}
                    onAddMusicFolder={() => { void handleSelectMusicFolders(); }}
                  />
                }
              />
              <Route path="/albums" element={<Albums tracks={libraryTracks} onPlayTrack={playTrack} />} />
              <Route path="/artists" element={<Artists tracks={libraryTracks} onPlayTrack={playTrack} />} />
              <Route path="/composer" element={<Composer tracks={libraryTracks} onPlayTrack={playTrack} />} />
              <Route path="/browse" element={<SectionPlaceholder title="Browse" />} />
              <Route path="/radio" element={<SectionPlaceholder title="Radio" />} />
              <Route path="/spotify" element={<SectionPlaceholder title="Spotify" />} />
              <Route path="/search" element={<Search tracks={libraryTracks} onPlayTrack={playTrack} />} />
              <Route
                path="/settings"
                element={
                  <Settings
                    themeMode={themeMode}
                    onThemeChange={setThemeMode}
                    accentColor={accentColor}
                    onAccentColorChange={setAccentColor}
                    systemAccentColor={systemAccentColor}
                    musicFolders={musicFolders}
                    trackCount={libraryTracks.length}
                    isDesktopApp={Boolean(window.electronAPI)}
                    onAddMusicFolder={() => { void handleSelectMusicFolders(); }}
                    onRescanMusicLibrary={() => { void handleRescanMusicLibrary(); }}
                    onRemoveMusicFolder={(folder) => { void handleRemoveMusicFolder(folder); }}
                  />
                }
              />
              <Route
                path="/settings/*"
                element={
                  <Settings
                    themeMode={themeMode}
                    onThemeChange={setThemeMode}
                    accentColor={accentColor}
                    onAccentColorChange={setAccentColor}
                    systemAccentColor={systemAccentColor}
                    musicFolders={musicFolders}
                    trackCount={libraryTracks.length}
                    isDesktopApp={Boolean(window.electronAPI)}
                    onAddMusicFolder={() => { void handleSelectMusicFolders(); }}
                    onRescanMusicLibrary={() => { void handleRescanMusicLibrary(); }}
                    onRemoveMusicFolder={(folder) => { void handleRemoveMusicFolder(folder); }}
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
        ref={audioRef}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onEnded={() => {
          if (repeatMode === 'one' && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch((error: unknown) => {
              console.error('Could not repeat the current track:', error);
              setIsPlaying(false);
              setLibraryError('Could not repeat the current track.');
            });
            return;
          }
          if (repeatMode === 'all') {
            handleNext();
          } else {
            setIsPlaying(false);
          }
        }}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        onError={() => {
          if (currentTrack) {
            setIsPlaying(false);
            setLibraryError(`Could not read "${currentTrack.name}". The file may have been moved or deleted.`);
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
      />
    </div>
  );
};

export default App;
