import { useState, useRef, useEffect } from 'react';
import './PlayBar.css';

const COLLAPSED_HEIGHT = 126.4;

interface PlayBarProps {
  track?: {
    id: string;
    name: string;
    artist: string;
    album: string;
    path?: string;
    albumArt?: string;
    lyrics?: string;
    syncedLyrics?: { time: number; text: string }[];
  } | null;
  isPlaying: boolean;
  isLoved?: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onDeleteTrackFromLibrary?: (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => void;
  onAddTrackToPlaylist?: (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => void;
  onShowAlbum?: (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => void;
  onToggleLove?: (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => void;
  onSuggestTrackLess?: (track: { id: string; name: string; artist: string; album: string; path?: string } | null) => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
}

// Inline SVG for default album art
const DEFAULT_ALBUM_ART = (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4a4a4a" />
        <stop offset="100%" stopColor="#2a2a2a" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="12" fill="url(#grad)" />
    <path d="M60 60 L140 60 L140 140 L60 140 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
    <path d="M70 70 L130 70 L130 130 L70 130 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
    <path d="M80 80 L120 80 L120 120 L80 120 Z" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
    <circle cx="100" cy="100" r="15" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
    <text x="100" y="170" fontFamily="Arial" fontSize="12" fill="rgba(255,255,255,0.6)" textAnchor="middle">MUSIC</text>
  </svg>
);

const TransportIcon: React.FC<{ name: 'shuffle' | 'previous' | 'next' | 'repeat' | 'repeat_one' }> = ({ name }) => (
  <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === 'previous' && (
      <path d="M5 5h2v14H5zM20 6.5v11a1 1 0 0 1-1.55.83l-8-5.5a1 1 0 0 1 0-1.66l8-5.5A1 1 0 0 1 20 6.5Z" />
    )}
    {name === 'next' && (
      <path d="M17 5h2v14h-2zM4 6.5v11a1 1 0 0 0 1.55.83l8-5.5a1 1 0 0 0 0-1.66l-8-5.5A1 1 0 0 0 4 6.5Z" />
    )}
    {name === 'shuffle' && (
      <path d="M14 4h6v6h-2V7.41l-4.29 4.3-1.42-1.42L16.59 6H14V4ZM4 5h3.5l6.3 6.3-1.42 1.42L6.67 7H4V5Zm12.59 7.59L18 14v-2h2v6h-6v-2h2.59l-4.3-4.29 1.42-1.42L16.59 12.59ZM4 17h2.67l3.71-3.71 1.42 1.42L7.5 19H4v-2Z" />
    )}
    {(name === 'repeat' || name === 'repeat_one') && (
      <>
        <path d="M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h13v-6h-2v4Z" />
        {name === 'repeat_one' && (
          <text x="12" y="15" fill="currentColor" fontSize="7" fontWeight="700" textAnchor="middle">1</text>
        )}
      </>
    )}
  </svg>
);

const PlayBar: React.FC<PlayBarProps> = ({
  track,
  isPlaying,
  isLoved = false,
  onPlayPause,
  onPrevious,
  onNext,
  onDeleteTrackFromLibrary,
  onAddTrackToPlaylist,
  onShowAlbum,
  onToggleLove,
  onSuggestTrackLess,
  volume,
  onVolumeChange,
  currentTime,
  duration,
  onSeek,
  isShuffled = false,
  onToggleShuffle,
  repeatMode = 'off',
  onToggleRepeat,
}) => {
  const [state, setState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [height, setHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showLyricsHint, setShowLyricsHint] = useState(false);
  const [showSyncedLyrics, setShowSyncedLyrics] = useState(true);
  const [currentSyncedLyricIndex, setCurrentSyncedLyricIndex] = useState(0);
  const playBarRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef(COLLAPSED_HEIGHT);
  const currentHeightRef = useRef(COLLAPSED_HEIGHT);
  const didDragRef = useRef(false);

  const getExpandedHeight = () => {
    return Math.max(COLLAPSED_HEIGHT, window.innerHeight);
  };

  useEffect(() => {
    setShowLyrics(false);
    setShowLyricsHint(false);
    setShowTrackMenu(false);
    setCurrentSyncedLyricIndex(0);
    setShowSyncedLyrics(Boolean(track?.syncedLyrics && track.syncedLyrics.length > 0));
  }, [track?.id, track?.syncedLyrics]);

  useEffect(() => {
    if (!track?.lyrics?.trim()) return undefined;

    const timeout = window.setTimeout(() => {
      setShowLyricsHint(true);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [track?.id, track?.lyrics]);

  useEffect(() => {
    if (!track?.syncedLyrics || track.syncedLyrics.length === 0) return;

    let currentIndex = 0;
    for (let index = track.syncedLyrics.length - 1; index >= 0; index -= 1) {
      if (track.syncedLyrics[index].time <= currentTime) {
        currentIndex = index;
        break;
      }
    }

    setCurrentSyncedLyricIndex(currentIndex);
  }, [currentTime, track?.syncedLyrics]);

  const visibleLyrics = () => {
    if (!track) return '';
    if (track.syncedLyrics && track.syncedLyrics.length > 0 && showSyncedLyrics) {
      const lyric = track.syncedLyrics[currentSyncedLyricIndex];
      if (lyric?.text) return lyric.text;
      return track.syncedLyrics[0]?.text || track.lyrics || '';
    }
    return track.lyrics || '';
  };

  useEffect(() => {
    const nextHeight = state === 'expanded' ? getExpandedHeight() : COLLAPSED_HEIGHT;
    currentHeightRef.current = nextHeight;
    setHeight(nextHeight);
  }, [state]);

  useEffect(() => {
    const handleResize = () => {
      if (state !== 'expanded' || isDragging) return;
      const nextHeight = getExpandedHeight();
      currentHeightRef.current = nextHeight;
      setHeight(nextHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDragging, state]);

  useEffect(() => {
    if (!isDragging) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      if (dragStartYRef.current === null) return;
      const deltaY = dragStartYRef.current - event.clientY;
      if (Math.abs(deltaY) > 4) didDragRef.current = true;
      const nextHeight = Math.max(
        COLLAPSED_HEIGHT,
        Math.min(getExpandedHeight(), dragStartHeightRef.current + deltaY),
      );
      currentHeightRef.current = nextHeight;
      setHeight(nextHeight);
    };

    const handlePointerEnd = () => {
      if (dragStartYRef.current === null) return;
      dragStartYRef.current = null;
      setIsDragging(false);
      const shouldExpand = currentHeightRef.current > (COLLAPSED_HEIGHT + getExpandedHeight()) / 2;
      setState(shouldExpand ? 'expanded' : 'collapsed');
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isDragging]);

  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a, .progress-bar, .lyrics-panel')) return;
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current = currentHeightRef.current;
    didDragRef.current = false;
    setIsDragging(true);
  };

  const handleAlbumArtClick = () => {
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    setState('expanded');
  };

  const handleLyricsToggle = () => {
    if (track?.lyrics?.trim()) {
      setShowLyrics((current) => !current);
      setShowLyricsHint(false);
    }
  };

  const handleLyricsToggleFromArtwork = (event?: React.MouseEvent | React.PointerEvent) => {
    if (event) {
      event.stopPropagation();
    }
    handleLyricsToggle();
  };

  const handleCollapse = () => setState('collapsed');

  const isLongTrackTitle = (track?.name?.length ?? 0) > 28;

  const handleTrackMenuAction = (action: 'delete' | 'playlist' | 'album' | 'love' | 'less') => {
    if (!track) return;
    setShowTrackMenu(false);
    switch (action) {
      case 'delete':
        onDeleteTrackFromLibrary?.(track);
        break;
      case 'playlist':
        onAddTrackToPlaylist?.(track);
        break;
      case 'album':
        onShowAlbum?.(track);
        break;
      case 'love':
        onToggleLove?.(track);
        break;
      case 'less':
        onSuggestTrackLess?.(track);
        break;
      default:
        break;
    }
  };

  const trackMenuItems = [
    { label: 'Delete from library', icon: 'delete_forever', action: 'delete' },
    { label: 'Add to playlist', icon: 'playlist_add', action: 'playlist' },
    { label: 'Show Album', icon: 'album', action: 'album' },
    { label: isLoved ? 'Loved' : 'Love', icon: isLoved ? 'favorite' : 'favorite_border', action: 'love' },
    { label: 'Suggest the track less', icon: 'thumb_down', action: 'less' },
  ];

  // Format time display
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Handle shuffle toggle
  const handleShuffle = () => {
    onToggleShuffle?.();
  };

  // Handle repeat toggle
  const handleRepeat = () => {
    onToggleRepeat?.();
  };

  // Get repeat icon based on mode
  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'off':
        return 'repeat';
      case 'one':
        return 'repeat_one';
      case 'all':
        return 'repeat';
      default:
        return 'repeat';
    }
  };

  return (
    <div
      ref={playBarRef}
      className={`play-bar ${state} ${isDragging ? 'dragging' : ''}`}
      style={{ height: `${height}px` }}
    >
      {/* Drag handle */}
      <div className="drag-handle" onPointerDown={handleDragStart}>
        <div className="drag-indicator" />
      </div>

      {/* Expanded View - Now Playing */}
      <div
        className={`now-playing ${state === 'expanded' ? 'visible' : 'hidden'}`}
        onPointerDown={handleDragStart}
      >
        <div className="now-playing-header">
          <button type="button" className="now-playing-close" aria-label="Close Now Playing" onClick={handleCollapse}>
            <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
          </button>
          <span>Now Playing</span>
        </div>
        <div className="now-playing-container">
          {/* Album Art */}
          <div
            className="album-art"
            onDoubleClick={(event) => {
              if (track?.lyrics?.trim()) {
                handleLyricsToggleFromArtwork(event);
              }
            }}
            onMouseEnter={() => {
              if (track?.lyrics?.trim()) {
                setShowLyricsHint(true);
              }
            }}
            onMouseLeave={() => {
              if (!showLyrics) {
                setShowLyricsHint(false);
              }
            }}
          >
            {track?.lyrics?.trim() && showLyricsHint && !showLyrics && (
              <button
                type="button"
                className="lyrics-hint"
                onClick={(event) => {
                  event.stopPropagation();
                  handleLyricsToggle();
                }}
              >
                <span className="material-symbols-outlined" aria-hidden="true">lyrics</span>
                Lyrics available
              </button>
            )}
            {track?.albumArt ? (
              <img src={track.albumArt} alt={track.album} />
            ) : (
              <div className="default-art">{DEFAULT_ALBUM_ART}</div>
            )}
          </div>
          
          {/* Track Info */}
          <div className="track-info">
            <div className="track-title-row">
              <h2
                className={`track-name ${isLongTrackTitle ? 'marquee-title' : ''}`}
                onDoubleClick={() => {
                  if (track?.lyrics?.trim()) {
                    setShowLyrics((current) => !current);
                  }
                }}
              >
                <span>{track?.name || 'No Track Selected'}</span>
              </h2>
              {track && (
                <div className="track-title-menu-wrap">
                  <button
                    type="button"
                    className="track-title-menu"
                    aria-label={`More options for ${track.name}`}
                    onClick={() => setShowTrackMenu((current) => !current)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
                  </button>
                  {showTrackMenu && (
                    <div className="track-menu-popover" role="menu" aria-label="Track options">
                      {trackMenuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          className="track-menu-item"
                          role="menuitem"
                          onClick={() => handleTrackMenuAction(item.action as 'delete' | 'playlist' | 'album' | 'love' | 'less')}
                        >
                          <span className="material-symbols-outlined" aria-hidden="true">{item.icon}</span>
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="artist-name">{track?.artist || 'Unknown Artist'}</p>
            <p className="album-name">{track?.album || 'Unknown Album'}</p>
            {track?.lyrics?.trim() && (
              <div className="lyrics-actions">
                <button
                  type="button"
                  className="lyrics-toggle"
                  onClick={handleLyricsToggle}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">lyrics</span>
                  {showLyrics ? 'Hide lyrics' : 'Show lyrics'}
                </button>
                {track.syncedLyrics && track.syncedLyrics.length > 0 && (
                  <button
                    type="button"
                    className="lyrics-mode-toggle"
                    onClick={() => setShowSyncedLyrics((current) => !current)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">timelapse</span>
                    {showSyncedLyrics ? 'Synced' : 'Plain'}
                  </button>
                )}
              </div>
            )}
          </div>

          {showLyrics && track?.lyrics?.trim() && (
            <section className="lyrics-panel" aria-label={`Lyrics for ${track.name}`}>
              <div className="lyrics-panel-header">
                <div>
                  <h2>Lyrics</h2>
                  <p>{track.name} · {track.artist}</p>
                </div>
                <button
                  type="button"
                  className="lyrics-close"
                  aria-label="Close lyrics"
                  onClick={() => setShowLyrics(false)}
                >
                  <span className="material-symbols-outlined" aria-hidden="true">close</span>
                </button>
              </div>
              <p className="lyrics-text">
                {track.syncedLyrics && track.syncedLyrics.length > 0 && showSyncedLyrics ? (
                  <span className="synced-lyrics-line">
                    {visibleLyrics()}
                  </span>
                ) : (
                  track.lyrics
                )}
              </p>
            </section>
          )}
          
          {/* Progress Bar */}
          <div className="progress-bar-container">
            <div className="progress-bar" aria-disabled={!track} onClick={(e) => {
              if (!track) return;
              const rect = (e.target as HTMLDivElement).getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              onSeek(percent * duration);
            }}>
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="time-display">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
          
          {/* Controls */}
          <div className="controls expanded-controls">
            <button className={`control-btn ${isShuffled ? 'active' : ''}`} onClick={handleShuffle} disabled={!track}>
              <TransportIcon name="shuffle" />
            </button>
            
            <button className="control-btn" onClick={onPrevious} disabled={!track}>
              <TransportIcon name="previous" />
            </button>
            
            <button className="control-btn play-pause" onClick={onPlayPause} disabled={!track}>
              <svg className="play-pause-icon" viewBox="0 0 24 24" aria-hidden="true">
                {isPlaying
                  ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                  : <path d="M7 4.5v15l12-7.5z" />}
              </svg>
            </button>
            
            <button className="control-btn" onClick={onNext} disabled={!track}>
              <TransportIcon name="next" />
            </button>
            
            <button className={`control-btn ${repeatMode !== 'off' ? 'active' : ''}`} onClick={handleRepeat} disabled={!track}>
              <TransportIcon name={getRepeatIcon()} />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsed View - Mini Player */}
      <div className="mini-player" onPointerDown={handleDragStart} aria-hidden={state === 'expanded'}>
        <div className="track-info-mini" onClick={handleAlbumArtClick}>
          <div className="album-art-mini">
            {track?.albumArt ? (
              <img src={track.albumArt} alt={track.album} />
            ) : (
              <div className="default-art-mini">{DEFAULT_ALBUM_ART}</div>
            )}
          </div>
          <div className="text-info">
            <span className="track-name-mini">{track?.name || 'No Track'}</span>
            <span className="artist-name-mini">{track?.artist || 'Unknown'}</span>
          </div>
        </div>
        
        {/* Mini Progress Bar */}
        <div className="mini-progress-container">
          <span className="mini-time">{formatTime(currentTime)}</span>
          <input
            aria-label="Track progress"
            className="mini-progress-bar"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration)}
            onChange={(e) => onSeek(e.currentTarget.valueAsNumber)}
            disabled={!track}
          />
          <span className="mini-time">{formatTime(duration)}</span>
        </div>
        
        {/* Controls */}
        <div className="controls">
          <button className="control-btn" onClick={onPrevious} disabled={!track}>
            <TransportIcon name="previous" />
          </button>
          <button className="control-btn play-pause" onClick={onPlayPause} disabled={!track}>
            <svg className="play-pause-icon" viewBox="0 0 24 24" aria-hidden="true">
              {isPlaying
                ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
                : <path d="M7 4.5v15l12-7.5z" />}
            </svg>
          </button>
          <button className="control-btn" onClick={onNext} disabled={!track}>
            <TransportIcon name="next" />
          </button>
        </div>

        <div className="mini-player-actions">
          <div className="volume-control">
            {showVolumeSlider && (
              <div className="volume-popover">
                <input
                  aria-label="Volume"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => onVolumeChange(e.currentTarget.valueAsNumber)}
                  className="volume-slider"
                />
              </div>
            )}
            <button
              aria-label="Volume"
              aria-expanded={showVolumeSlider}
              className="control-btn mute-btn"
              onClick={() => {
                setShowVolumeSlider(!showVolumeSlider);
                setShowOptionsMenu(false);
              }}
            >
              <span className="material-symbols-outlined">
                {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
              </span>
            </button>
          </div>

          <div className="more-options">
            <button
              aria-label="More options"
              aria-expanded={showOptionsMenu}
              className="control-btn more-options-button"
              onClick={() => {
                setShowOptionsMenu(!showOptionsMenu);
                setShowVolumeSlider(false);
              }}
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            {showOptionsMenu && (
              <div className="more-options-menu">
                <button
                  aria-pressed={isShuffled}
                  className="more-options-item"
                  onClick={handleShuffle}
                >
                  <span className="material-symbols-outlined">shuffle</span>
                  <span>Shuffle</span>
                </button>
                <button
                  aria-pressed={repeatMode !== 'off'}
                  className="more-options-item"
                  onClick={handleRepeat}
                >
                  <span className="material-symbols-outlined">{getRepeatIcon()}</span>
                  <span>Repeat: {repeatMode === 'off' ? 'Off' : repeatMode === 'one' ? 'One' : 'All'}</span>
                </button>
              </div>
            )}
          </div>

          <button className="control-btn expand-btn" onClick={handleAlbumArtClick} aria-label="Expand player">
            <span className="material-symbols-outlined">open_in_full</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayBar;
