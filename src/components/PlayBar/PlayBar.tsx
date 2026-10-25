import { memo, useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import AudioVisualizer from './AudioVisualizer';
import AlphaNumericIndex, { buildAlphaNumericIndex } from '../AlphaNumericIndex';
import { useArtistImage } from '../../services/artistImages';
import { splitArtistCredits } from '../../utils/artistCredits';
import './PlayBar.css';
import type { VisualizerStyle } from '../../types/electron';
import type { Track } from '../../services/MusicLibrary';

const COLLAPSED_HEIGHT = 126.4;
const getExpandedHeight = () => Math.max(COLLAPSED_HEIGHT, window.innerHeight);
const getExpandProgress = (currentHeight: number) => (
  Math.max(0, Math.min(
    1,
    (currentHeight - COLLAPSED_HEIGHT) / Math.max(1, getExpandedHeight() - COLLAPSED_HEIGHT),
  ))
);

interface PlayBarProps {
  track?: Track | null;
  activeAudio: HTMLAudioElement | null;
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
  onSeek: (time: number) => void;
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
  visualizerAnalyser: AnalyserNode | null;
  visualizerStyle: VisualizerStyle;
  showVisualizer: boolean;
  showArtistImageBackground: boolean;
  showLyrics: boolean;
  playQueue: Track[];
  playQueueIndex: number;
  onQueueSelect: (index: number) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const DEFAULT_ALBUM_ART = (
  <span className="material-symbols-outlined" aria-hidden="true">album</span>
);

const TransportIcon: React.FC<{ name: 'shuffle' | 'previous' | 'next' | 'repeat' | 'repeat_one' }> = ({ name }) => (
  <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden="true">
    {name === 'previous' && (
      <>
        <path className="standard-transport-glyph" d="M5 5h2v14H5zM20 6.5v11a1 1 0 0 1-1.55.83l-8-5.5a1 1 0 0 1 0-1.66l8-5.5A1 1 0 0 1 20 6.5Z" />
        <path className="apple-transport-glyph" d="M11.2 5.5v13a1 1 0 0 1-1.6.8L2.2 13a1.2 1.2 0 0 1 0-2l7.4-6.3a1 1 0 0 1 1.6.8Zm10.6 0v13a1 1 0 0 1-1.6.8L12.8 13a1.2 1.2 0 0 1 0-2l7.4-6.3a1 1 0 0 1 1.6.8Z" />
      </>
    )}
    {name === 'next' && (
      <>
        <path className="standard-transport-glyph" d="M17 5h2v14h-2zM4 6.5v11a1 1 0 0 0 1.55.83l8-5.5a1 1 0 0 0 0-1.66l-8-5.5A1 1 0 0 0 4 6.5Z" />
        <path className="apple-transport-glyph" d="M2.8 5.5a1 1 0 0 1 1.6-.8l7.4 6.3a1.2 1.2 0 0 1 0 2l-7.4 6.3a1 1 0 0 1-1.6-.8v-13Zm10.6 0a1 1 0 0 1 1.6-.8l7.4 6.3a1.2 1.2 0 0 1 0 2l-7.4 6.3a1 1 0 0 1-1.6-.8v-13Z" />
      </>
    )}
    {name === 'shuffle' && (
      <>
        <path className="standard-transport-glyph" d="M14 4h6v6h-2V7.41l-4.29 4.3-1.42-1.42L16.59 6H14V4ZM4 5h3.5l6.3 6.3-1.42 1.42L6.67 7H4V5Zm12.59 7.59L18 14v-2h2v6h-6v-2h2.59l-4.3-4.29 1.42-1.42L16.59 12.59ZM4 17h2.67l3.71-3.71 1.42 1.42L7.5 19H4v-2Z" />
        <g className="apple-transport-glyph">
          <path d="M3 7h2.5c4.6 0 6.8 10 11.5 10H21m-4-4 4 4-4 4" />
          <path d="M3 17h2.5c2.2 0 3.8-2.8 5.2-5m2.6-4c1-.7 2-1 3.7-1H21m-4-4 4 4-4 4" />
        </g>
      </>
    )}
    {(name === 'repeat' || name === 'repeat_one') && (
      <>
        <path className="standard-transport-glyph" d="M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h13v-6h-2v4Z" />
        {name === 'repeat_one' && (
          <text className="standard-transport-glyph" x="12" y="15" fill="currentColor" fontSize="7" fontWeight="700" textAnchor="middle">1</text>
        )}
        <g className="apple-transport-glyph">
          <path d="M4 10V8a3 3 0 0 1 3-3h13m-3-3 3 3-3 3M20 14v2a3 3 0 0 1-3 3H4m3-3-3 3 3 3" />
          {name === 'repeat_one' && (
            <>
              <circle className="apple-repeat-one-badge" cx="7" cy="7" r="4.5" />
              <text className="apple-repeat-one-label" x="7" y="9.5" textAnchor="middle">1</text>
            </>
          )}
        </g>
      </>
    )}
  </svg>
);

interface SyncedLyricCaptionProps {
  lineKey: string;
  text: string;
  lines: { time: number; text: string }[];
  currentIndex: number;
  onSeek: (time: number) => void;
  isVisible: boolean;
}

const SyncedLyricCaption = memo<SyncedLyricCaptionProps>(({
  lineKey,
  text,
  lines,
  currentIndex,
  onSeek,
  isVisible,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const activeGroupRef = useRef<HTMLButtonElement>(null);
  const [displayedLine, setDisplayedLine] = useState({
    key: lineKey,
    text,
    phase: 'enter' as 'enter' | 'exit',
  });
  const lyricGroups = useMemo(() => {
    const groups: Array<{ key: string; time: number; lines: string[]; firstIndex: number }> = [];

    lines.forEach((line, index) => {
      const currentGroup = groups[groups.length - 1];
      if (currentGroup && Math.abs(currentGroup.time - line.time) < 0.001) {
        currentGroup.lines.push(line.text);
        return;
      }
      groups.push({
        key: `${line.time}:${line.text}`,
        time: line.time,
        lines: [line.text],
        firstIndex: index,
      });
    });

    return groups;
  }, [lines]);
  let low = 0;
  let high = lyricGroups.length - 1;
  let currentGroupIndex = 0;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (lyricGroups[middle].firstIndex <= currentIndex) {
      currentGroupIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    const activeGroup = activeGroupRef.current;
    if (!viewport || !activeGroup) return;

    const viewportBounds = viewport.getBoundingClientRect();
    const activeBounds = activeGroup.getBoundingClientRect();
    const nextScrollTop = viewport.scrollTop
      + activeBounds.top
      - viewportBounds.top
      - (viewport.clientHeight - activeBounds.height) / 2;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    viewport.scrollTo({
      top: Math.max(0, nextScrollTop),
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  }, [currentGroupIndex, lyricGroups]);

  useEffect(() => {
    if (lineKey === displayedLine.key) return undefined;

    let timeout: number | undefined;
    const frame = window.requestAnimationFrame(() => {
      setDisplayedLine((current) => ({ ...current, phase: 'exit' }));
      timeout = window.setTimeout(() => {
        setDisplayedLine({ key: lineKey, text, phase: 'enter' });
      }, 110);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [displayedLine.key, lineKey, text]);

  if (!text) return null;

  return (
    <div
      className={`synced-lyric-caption ${isVisible ? 'is-visible' : 'is-hidden'}`}
      aria-label="Current synchronized lyric"
      aria-hidden={!isVisible}
    >
      <span className={`synced-lyric-caption-line synced-lyric-caption-current ${displayedLine.phase}`} dir="auto" aria-live="off">
        {displayedLine.text}
      </span>
      <div
        className="synced-lyric-viewport"
        ref={viewportRef}
        role="region"
        aria-label="Synchronized lyrics. Select a line to seek to its timestamp."
      >
        <div className="synced-lyric-stack">
          {lyricGroups.map((group, groupIndex) => {
            const isActive = groupIndex === currentGroupIndex;
            const positionClass = isActive
              ? 'active'
              : groupIndex < currentGroupIndex
                ? 'past'
                : 'upcoming';

            return (
              <button
                type="button"
                className={`synced-lyric-group ${positionClass}`}
                key={group.key}
                dir="auto"
                aria-current={isActive ? 'true' : undefined}
                tabIndex={isVisible ? 0 : -1}
                ref={isActive ? activeGroupRef : null}
                onClick={() => onSeek(group.time)}
              >
                {group.lines.map((lyricLine, lyricIndex) => (
                  <span className="synced-lyric-group-line" key={`${group.key}-${lyricIndex}`}>
                    {lyricLine}
                  </span>
                ))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});

const PlayBar: React.FC<PlayBarProps> = ({
  track,
  activeAudio,
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
  onSeek,
  isShuffled = false,
  onToggleShuffle,
  repeatMode = 'off',
  onToggleRepeat,
  visualizerAnalyser,
  visualizerStyle,
  showVisualizer,
  showArtistImageBackground,
  showLyrics: lyricsEnabled,
  playQueue,
  playQueueIndex,
  onQueueSelect,
  onQueueTracks,
}) => {
  const primaryArtist = splitArtistCredits(track?.artist ?? '')[0] ?? '';
  const { imageUrl: artistBackgroundImage } = useArtistImage(primaryArtist, {
    enabled: showArtistImageBackground,
  });
  const [state, setState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [height, setHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showPlayQueue, setShowPlayQueue] = useState(false);
  const [plainLyricsFontStep, setPlainLyricsFontStep] = useState(0);
  const [showLyricsHint, setShowLyricsHint] = useState(false);
  const [showSyncedLyrics, setShowSyncedLyrics] = useState(true);
  const [playbackPosition, setPlaybackPosition] = useState({ currentTime: 0, duration: 0 });
  const currentTime = playbackPosition.currentTime;
  const duration = playbackPosition.duration || track?.duration || 0;
  const playBarRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef(COLLAPSED_HEIGHT);
  const currentHeightRef = useRef(COLLAPSED_HEIGHT);
  const dragFrameRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const visualizerLocationRef = useRef<string | null>(null);
  const visualizerRelocationFrameRef = useRef<number | null>(null);
  const [isVisualizerRelocating, setIsVisualizerRelocating] = useState(false);
  const hasSyncedLyrics = Boolean(track?.syncedLyrics?.length);
  const queueIndexEntries = useMemo(
    () =>
      buildAlphaNumericIndex(
        playQueue,
        (queuedTrack) => queuedTrack.name,
        (_queuedTrack, index) => `play-queue-row-${index}`
      ),
    [playQueue]
  );
  const showSyncedLyricCaption = Boolean(showLyrics && showSyncedLyrics && hasSyncedLyrics);
  const showPlainLyricsPanel = Boolean(
    showLyrics && track?.lyrics?.trim() && (!hasSyncedLyrics || !showSyncedLyrics),
  );
  const plainLyricsFontSize = `${0.95 + plainLyricsFontStep * 0.15}rem`;
  const visualizerLocation = showSyncedLyricCaption || showPlainLyricsPanel
    ? 'below-art'
    : hasSyncedLyrics ? 'default' : 'lyrics-slot';

  useEffect(() => {
    const syncPlaybackPosition = () => {
      setPlaybackPosition({
        currentTime: activeAudio?.currentTime ?? 0,
        duration: activeAudio && Number.isFinite(activeAudio.duration)
          ? activeAudio.duration
          : track?.duration ?? 0,
      });
    };
    const initialSyncFrame = window.requestAnimationFrame(syncPlaybackPosition);
    if (!activeAudio) {
      return () => window.cancelAnimationFrame(initialSyncFrame);
    }
    activeAudio.addEventListener('timeupdate', syncPlaybackPosition);
    activeAudio.addEventListener('durationchange', syncPlaybackPosition);
    activeAudio.addEventListener('loadedmetadata', syncPlaybackPosition);
    activeAudio.addEventListener('seeking', syncPlaybackPosition);
    activeAudio.addEventListener('seeked', syncPlaybackPosition);
    activeAudio.addEventListener('emptied', syncPlaybackPosition);

    return () => {
      window.cancelAnimationFrame(initialSyncFrame);
      activeAudio.removeEventListener('timeupdate', syncPlaybackPosition);
      activeAudio.removeEventListener('durationchange', syncPlaybackPosition);
      activeAudio.removeEventListener('loadedmetadata', syncPlaybackPosition);
      activeAudio.removeEventListener('seeking', syncPlaybackPosition);
      activeAudio.removeEventListener('seeked', syncPlaybackPosition);
      activeAudio.removeEventListener('emptied', syncPlaybackPosition);
    };
  }, [activeAudio, track?.duration, track?.id]);

  const seekTo = (time: number) => {
    onSeek(time);
    setPlaybackPosition((position) => ({
      ...position,
      currentTime: Math.max(0, Math.min(duration, time)),
    }));
  };

  useEffect(() => {
    if (!lyricsEnabled) {
      setShowLyrics(false);
      setShowLyricsHint(false);
    }
  }, [lyricsEnabled]);

  useLayoutEffect(() => {
    if (visualizerLocationRef.current === null) {
      visualizerLocationRef.current = visualizerLocation;
      return;
    }
    if (visualizerLocationRef.current === visualizerLocation) return;

    visualizerLocationRef.current = visualizerLocation;
    setIsVisualizerRelocating(true);
    if (visualizerRelocationFrameRef.current !== null) {
      window.cancelAnimationFrame(visualizerRelocationFrameRef.current);
    }
    visualizerRelocationFrameRef.current = window.requestAnimationFrame(() => {
      setIsVisualizerRelocating(false);
      visualizerRelocationFrameRef.current = null;
    });
  }, [visualizerLocation]);

  useEffect(() => () => {
    if (visualizerRelocationFrameRef.current !== null) {
      window.cancelAnimationFrame(visualizerRelocationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    setShowLyrics(false);
    setShowLyricsHint(false);
    setShowTrackMenu(false);
    setShowSyncedLyrics(Boolean(track?.syncedLyrics && track.syncedLyrics.length > 0));
  }, [track?.id, track?.syncedLyrics]);

  useEffect(() => {
    if (!track?.lyrics?.trim()) return undefined;

    const timeout = window.setTimeout(() => {
      setShowLyricsHint(true);
    }, 1200);

    return () => window.clearTimeout(timeout);
  }, [track?.id, track?.lyrics]);

  const currentSyncedLyricIndex = useMemo(() => {
    const lines = track?.syncedLyrics;
    if (!lines?.length) return 0;
    let low = 0;
    let high = lines.length - 1;
    let currentIndex = 0;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      if (lines[middle].time <= currentTime) {
        currentIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const currentTimestamp = lines[currentIndex].time;
    while (
      currentIndex > 0
      && Math.abs(lines[currentIndex - 1].time - currentTimestamp) < 0.001
    ) {
      currentIndex -= 1;
    }
    return currentIndex;
  }, [currentTime, track?.syncedLyrics]);

  const currentSyncedLyric = track?.syncedLyrics?.[currentSyncedLyricIndex];
  const currentSyncedLyricText = useMemo(() => {
    const lines = track?.syncedLyrics;
    const currentLine = lines?.[currentSyncedLyricIndex];
    if (!currentLine || !lines) return '';

    const texts: string[] = [];
    for (let index = currentSyncedLyricIndex; index < lines.length; index += 1) {
      const line = lines[index];
      if (Math.abs(line.time - currentLine.time) >= 0.001) break;
      if (line.text) texts.push(line.text);
    }
    return texts.join('\n');
  }, [currentSyncedLyricIndex, track?.syncedLyrics]);
  const currentSyncedLyricKey = `${currentSyncedLyric?.time ?? ''}:${currentSyncedLyricText}`;

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
    if (isDragging) return;
    const nextHeight = state === 'expanded' ? getExpandedHeight() : COLLAPSED_HEIGHT;
    currentHeightRef.current = nextHeight;
    setHeight(nextHeight);
  }, [isDragging, state]);

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
      if (dragFrameRef.current === null) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null;
          if (playBarRef.current) {
            playBarRef.current.style.height = `${currentHeightRef.current}px`;
            playBarRef.current.style.setProperty(
              '--expand-progress',
              String(getExpandProgress(currentHeightRef.current)),
            );
          }
        });
      }
    };

    const handlePointerEnd = () => {
      if (dragStartYRef.current === null) return;
      dragStartYRef.current = null;
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      const shouldExpand = currentHeightRef.current > (COLLAPSED_HEIGHT + getExpandedHeight()) / 2;
      setState(shouldExpand ? 'expanded' : 'collapsed');
      setHeight(currentHeightRef.current);
      setIsDragging(false);
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
    if (target.closest('button, input, select, textarea, a, .album-art-mini, .progress-bar, .lyrics-panel')) return;
    dragStartYRef.current = event.clientY;
    dragStartHeightRef.current = currentHeightRef.current;
    didDragRef.current = false;
    if (state === 'collapsed') setState('expanded');
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
    if (lyricsEnabled && track?.lyrics?.trim()) {
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

  const handleCollapse = () => {
    currentHeightRef.current = getExpandedHeight();
    setState('collapsed');
    setIsDragging(false);
  };

  const isLongTrackTitle = (track?.name?.length ?? 0) > 28;

  const handleTrackMenuAction = (action: 'delete' | 'playlist' | 'album' | 'love' | 'less' | 'queue' | 'next') => {
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
      case 'queue':
        onQueueTracks([track], false);
        break;
      case 'next':
        onQueueTracks([track], true);
        break;
      default:
        break;
    }
  };

  const trackMenuItems = [
    { label: 'Delete from library', icon: 'delete_forever', action: 'delete' },
    { label: 'Add to playlist', icon: 'playlist_add', action: 'playlist' },
    { label: 'Add to play queue', icon: 'queue_music', action: 'queue' },
    { label: 'Play next', icon: 'next_plan', action: 'next' },
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
  const volumeSliderStyle: React.CSSProperties & { '--volume-level': string } = {
    '--volume-level': `${volume * 100}%`,
  };

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

  const expandProgress = isDragging
    ? getExpandProgress(currentHeightRef.current)
    : state === 'expanded' ? 1 : 0;
  const playBarStyle: React.CSSProperties & { '--expand-progress': number } = {
    height: `${height}px`,
    '--expand-progress': expandProgress,
  };

  return (
    <div
      ref={playBarRef}
      className={`play-bar ${state} ${isDragging ? 'dragging' : ''}`}
      style={playBarStyle}
    >
      {/* Drag handle */}
      <div className="drag-handle" onPointerDown={handleDragStart}>
        <div className="drag-indicator" />
      </div>

      {/* Expanded View - Now Playing */}
      <div
        className={`now-playing ${state === 'expanded' || isDragging ? 'visible' : 'hidden'} ${showArtistImageBackground ? 'artist-background-enabled' : ''}`}
        onPointerDown={handleDragStart}
      >
        {artistBackgroundImage && (
          <div className="now-playing-artist-background" aria-hidden="true">
            <img src={artistBackgroundImage} alt="" />
            <div className="now-playing-artist-background-overlay" />
          </div>
        )}
        <div className="now-playing-header">
          <button type="button" className="now-playing-close" aria-label="Close Now Playing" onClick={handleCollapse}>
            <span className="material-symbols-outlined" aria-hidden="true">keyboard_arrow_down</span>
          </button>
          <span>Now Playing</span>
          <button
            type="button"
            className={`now-playing-queue-toggle ${showPlayQueue ? 'active' : ''}`}
            aria-label={showPlayQueue ? 'Close play queue' : 'Open play queue'}
            aria-expanded={showPlayQueue}
            onClick={() => setShowPlayQueue((visible) => !visible)}
          >
            <span className="material-symbols-outlined" aria-hidden="true">chevron_left</span>
          </button>
        </div>
        <div
          className={[
            'now-playing-container',
            showSyncedLyricCaption ? 'has-synced-lyric' : '',
            hasSyncedLyrics ? 'has-synced-lyrics' : '',
            showVisualizer && !hasSyncedLyrics ? 'visualizer-in-lyrics-slot' : '',
            showVisualizer && visualizerLocation === 'below-art' ? 'visualizer-below-art' : '',
          ].filter(Boolean).join(' ')}
          data-playback-state={isPlaying ? 'playing' : 'paused'}
        >
          {/* Album Art */}
          <div
            className="album-art"
            onDoubleClick={(event) => {
              if (lyricsEnabled && track?.lyrics?.trim()) {
                handleLyricsToggleFromArtwork(event);
              }
            }}
            onMouseEnter={() => {
              if (lyricsEnabled && track?.lyrics?.trim()) {
                setShowLyricsHint(true);
              }
            }}
            onMouseLeave={() => {
              if (!showLyrics) {
                setShowLyricsHint(false);
              }
            }}
          >
            {lyricsEnabled && track?.lyrics?.trim() && showLyricsHint && !showLyrics && (
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
          
          {showVisualizer && (
            <AudioVisualizer
              analyser={visualizerAnalyser}
              isPlaying={isPlaying}
              isVisible={state === 'expanded'}
              volume={volume}
              style={visualizerStyle}
              className={isVisualizerRelocating ? 'relocating' : ''}
            />
          )}

          {/* Track Info */}
          <div className="track-info">
            <div className="track-title-row">
              <h2
                className={`track-name ${isLongTrackTitle ? 'marquee-title' : ''}`}
                onDoubleClick={() => {
                  if (lyricsEnabled && track?.lyrics?.trim()) {
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
                          onClick={() => handleTrackMenuAction(item.action as 'delete' | 'playlist' | 'album' | 'love' | 'less' | 'queue' | 'next')}
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
            {lyricsEnabled && track?.lyrics?.trim() && (
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

          {track?.lyrics?.trim() && (
            <section
              className={`lyrics-panel ${showPlainLyricsPanel ? 'is-visible' : 'is-hidden'}`}
              aria-label={`Lyrics for ${track.name}`}
              aria-hidden={!showPlainLyricsPanel}
            >
              <div className="lyrics-panel-header">
                <div>
                  <h2>Lyrics</h2>
                  <p>{track.name} · {track.artist}</p>
                </div>
                <div className="lyrics-panel-actions">
                  <div className="lyrics-font-controls" aria-label="Lyrics font size">
                    <button
                      type="button"
                      className="lyrics-font-button"
                      aria-label="Decrease lyrics font size"
                      title="Decrease lyrics font size"
                      disabled={plainLyricsFontStep <= -3}
                      tabIndex={showPlainLyricsPanel ? 0 : -1}
                      onClick={() => setPlainLyricsFontStep((step) => Math.max(-3, step - 1))}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">text_decrease</span>
                    </button>
                    <span className="lyrics-font-size" aria-live="polite">
                      {Math.round((1 + plainLyricsFontStep * 0.15 / 0.95) * 100)}%
                    </span>
                    <button
                      type="button"
                      className="lyrics-font-button"
                      aria-label="Increase lyrics font size"
                      title="Increase lyrics font size"
                      disabled={plainLyricsFontStep >= 3}
                      tabIndex={showPlainLyricsPanel ? 0 : -1}
                      onClick={() => setPlainLyricsFontStep((step) => Math.min(3, step + 1))}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">text_increase</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    className="lyrics-close"
                    aria-label="Close lyrics"
                    tabIndex={showPlainLyricsPanel ? 0 : -1}
                    onClick={() => setShowLyrics(false)}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">close</span>
                  </button>
                </div>
              </div>
              <p className="lyrics-text" dir="auto" style={{ fontSize: plainLyricsFontSize }}>
                {track.syncedLyrics && track.syncedLyrics.length > 0 && showSyncedLyrics ? (
                  <span className="synced-lyrics-line" dir="auto">
                    {visibleLyrics()}
                  </span>
                ) : (
                  track.lyrics
                )}
              </p>
            </section>
          )}

          <section
            className={`play-queue-panel ${showPlayQueue ? 'is-visible' : 'is-hidden'}`}
            aria-label="Play queue"
            aria-hidden={!showPlayQueue}
          >
            <header className="play-queue-header">
              <div>
                <h2>Play queue</h2>
                <p>{playQueue.length} tracks</p>
              </div>
              <button
                type="button"
                className="lyrics-close"
                aria-label="Close play queue"
                onClick={() => setShowPlayQueue(false)}
                tabIndex={showPlayQueue ? 0 : -1}
              >
                <span className="material-symbols-outlined" aria-hidden="true">close</span>
              </button>
            </header>
            {playQueue.length > 0 ? (
              <div className="play-queue-content indexed-list-layout">
                <ol className="play-queue-list">
                  {playQueue.map((queuedTrack, index) => (
                    <li id={`play-queue-row-${index}`} key={`${queuedTrack.id}-${index}`}>
                      <button
                        type="button"
                        className={`play-queue-item ${index === playQueueIndex ? 'current' : ''}`}
                        aria-current={index === playQueueIndex ? 'true' : undefined}
                        tabIndex={showPlayQueue ? 0 : -1}
                        onClick={() => onQueueSelect(index)}
                      >
                        <span className="material-symbols-outlined" aria-hidden="true">
                          {index === playQueueIndex ? 'equalizer' : 'music_note'}
                        </span>
                        <span className="play-queue-track-copy">
                          <strong>{queuedTrack.name}</strong>
                          <small>{queuedTrack.artist}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
                <AlphaNumericIndex
                  entries={queueIndexEntries}
                  ariaLabel="Play queue index"
                  scrollContainerSelector=".play-queue-list"
                />
              </div>
            ) : (
              <ol className="play-queue-list">
                <li className="play-queue-empty">Play a track to start a queue.</li>
              </ol>
            )}
          </section>
          
          {/* Progress Bar */}
          {hasSyncedLyrics && track?.syncedLyrics && (
            <SyncedLyricCaption
              lineKey={currentSyncedLyricKey}
              text={currentSyncedLyricText}
              lines={track.syncedLyrics}
              currentIndex={currentSyncedLyricIndex}
              onSeek={seekTo}
              isVisible={showSyncedLyricCaption}
            />
          )}
          <div className="progress-bar-container">
            <div className="progress-bar" aria-disabled={!track} onClick={(e) => {
              if (!track) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              seekTo(percent * duration);
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
            <button className={`control-btn shuffle-btn ${isShuffled ? 'active' : ''}`} onClick={handleShuffle} disabled={!track}>
              <TransportIcon name="shuffle" />
            </button>
            
            <button className="control-btn" onClick={onPrevious} disabled={!track}>
              <TransportIcon name="previous" />
            </button>
            
            <button className="control-btn play-pause" onClick={onPlayPause} disabled={!track}>
              <svg className="play-pause-icon" viewBox="0 0 24 24" aria-hidden="true">
                {isPlaying
                  ? <path className="pause-icon-glyph" d="M8 6.5v11M16 6.5v11" />
                  : <>
                    <path className="play-icon-glyph default-play-icon-glyph" d="M8.4 4.6Q7 3.8 7 5.5v13q0 1.7 1.4.9l10.7-6.2q1.9-1.2 0-2.4Z" />
                    <path className="play-icon-glyph vlc-play-icon-glyph" d="M7 4 20 12 7 20Z" />
                  </>}
              </svg>
            </button>
            
            <button className="control-btn" onClick={onNext} disabled={!track}>
              <TransportIcon name="next" />
            </button>
            
            <button className={`control-btn repeat-btn ${repeatMode !== 'off' ? 'active' : ''}`} onClick={handleRepeat} disabled={!track}>
              <TransportIcon name={getRepeatIcon()} />
            </button>
          </div>
        </div>
      </div>

      {/* Collapsed View - Mini Player */}
      <div
        className="mini-player"
        onPointerDown={handleDragStart}
        aria-hidden={state === 'expanded'}
        data-playback-state={isPlaying ? 'playing' : 'paused'}
      >
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
          <div className="mini-progress-input-wrap">
            <div className="mini-progress-track" aria-hidden="true">
              <div className="mini-progress-track-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <input
              aria-label="Track progress"
              className="mini-progress-bar"
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration)}
              onChange={(e) => seekTo(e.currentTarget.valueAsNumber)}
              disabled={!track}
            />
          </div>
          <span className="mini-time">{formatTime(duration)}</span>
        </div>
        
        {/* Controls */}
        <div className="controls">
          <button
            aria-label="Shuffle"
            aria-pressed={isShuffled}
            className={`control-btn shuffle-btn ${isShuffled ? 'active' : ''}`}
            onClick={handleShuffle}
            disabled={!track}
          >
            <TransportIcon name="shuffle" />
          </button>
          <button className="control-btn" onClick={onPrevious} disabled={!track}>
            <TransportIcon name="previous" />
          </button>
          <button className="control-btn play-pause" onClick={onPlayPause} disabled={!track}>
            <svg className="play-pause-icon" viewBox="0 0 24 24" aria-hidden="true">
              {isPlaying
                ? <path className="pause-icon-glyph" d="M8 6.5v11M16 6.5v11" />
                : <>
                  <path className="play-icon-glyph default-play-icon-glyph" d="M8.4 4.6Q7 3.8 7 5.5v13q0 1.7 1.4.9l10.7-6.2q1.9-1.2 0-2.4Z" />
                  <path className="play-icon-glyph vlc-play-icon-glyph" d="M7 4 20 12 7 20Z" />
                </>}
            </svg>
          </button>
          <button className="control-btn" onClick={onNext} disabled={!track}>
            <TransportIcon name="next" />
          </button>
          <button
            aria-label={`Repeat ${repeatMode === 'off' ? 'off' : repeatMode === 'one' ? 'one' : 'all'}`}
            aria-pressed={repeatMode !== 'off'}
            className={`control-btn repeat-btn ${repeatMode !== 'off' ? 'active' : ''}`}
            onClick={handleRepeat}
            disabled={!track}
          >
            <TransportIcon name={getRepeatIcon()} />
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
                  style={volumeSliderStyle}
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
              <svg className="apple-volume-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path className="volume-speaker" d="M3 9v6h4l5 4V5L7 9H3Z" />
                {volume === 0 ? (
                  <path className="volume-mute-mark" d="m16 9 5 6m0-6-5 6" />
                ) : volume < 0.5 ? (
                  <path className="volume-wave" d="M15.5 9.5a4 4 0 0 1 0 5" />
                ) : (
                  <>
                    <path className="volume-wave" d="M15.5 9.5a4 4 0 0 1 0 5" />
                    <path className="volume-wave" d="M18.5 6.5a8 8 0 0 1 0 11" />
                  </>
                )}
              </svg>
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
                  <TransportIcon name="shuffle" />
                  <span>Shuffle</span>
                </button>
                <button
                  aria-pressed={repeatMode !== 'off'}
                  className="more-options-item"
                  onClick={handleRepeat}
                >
                  <TransportIcon name={getRepeatIcon()} />
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
