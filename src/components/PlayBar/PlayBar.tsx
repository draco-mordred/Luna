import { memo, useState, useRef, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import AudioVisualizer from './AudioVisualizer';
import AlphaNumericIndex, { buildAlphaNumericIndex } from '../AlphaNumericIndex';
import { useArtistImage } from '../../services/artistImages';
import { splitArtistCredits } from '../../utils/artistCredits';
import { useAndroidAlbumArtwork } from '../../hooks/useAndroidAlbumArtwork';
import { isAndroidApp } from '../../services/androidMusicLibrary';
import './PlayBar.css';
import type { PlayerWindowMode, VisualizerStyle } from '../../types/electron';
import type { Playlist, Track } from '../../services/MusicLibrary';

const COLLAPSED_HEIGHT = 126.4;
const getExpandedHeight = () => Math.max(COLLAPSED_HEIGHT, window.innerHeight);
const getExpandProgress = (currentHeight: number) =>
  Math.max(
    0,
    Math.min(
      1,
      (currentHeight - COLLAPSED_HEIGHT) / Math.max(1, getExpandedHeight() - COLLAPSED_HEIGHT)
    )
  );

interface PlayBarProps {
  track?: Track | null;
  activeAudio: HTMLAudioElement | null;
  isPlaying: boolean;
  isLoved?: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onDeleteTrackFromLibrary?: (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => void;
  onAddTrackToPlaylist?: (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null,
    playlistId?: string
  ) => void;
  playlists?: Playlist[];
  onShowAlbum?: (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => void;
  onShowArtist?: (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => void;
  onToggleLove?: (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => void;
  onSuggestTrackLess?: (
    track: { id: string; name: string; artist: string; album: string; path?: string } | null
  ) => void;
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
  showSyncedLyricsOnPlayBar: boolean;
  syncLyricsDisplay: boolean;
  playQueue: Track[];
  playQueueIndex: number;
  onQueueSelect: (index: number) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  isDesktopApp: boolean;
  playerWindowMode: PlayerWindowMode;
  lyricOffsetSteps: number;
  onLyricOffsetStepsChange: (steps: number) => void;
  onEnterMiniPlayer: () => void;
  onEnterFullscreenPlayer: () => void;
  onExitPlayerMode: () => void;
}

const DEFAULT_ALBUM_ART = (
  <span className='material-symbols-outlined' aria-hidden='true'>
    album
  </span>
);

const TrackImageCrossfade: React.FC<{ src: string | null; alt: string; className?: string }> = ({
  src,
  alt,
  className = '',
}) => {
  const [images, setImages] = useState<{ current: string | null; previous: string | null }>({
    current: src,
    previous: null,
  });

  if (images.current !== src) {
    setImages({ current: src, previous: images.current });
  }

  useEffect(() => {
    if (!images.previous) return undefined;
    const previousSrc = images.previous;
    const timeout = window.setTimeout(() => {
      setImages((current) =>
        current.current === src && current.previous === previousSrc
          ? { ...current, previous: null }
          : current
      );
    }, 560);
    return () => window.clearTimeout(timeout);
  }, [images.previous, src]);

  return (
    <div className={`track-image-crossfade ${className}`}>
      {images.previous && <img className='track-image-previous' src={images.previous} alt='' />}
      {images.current && (
        <img className='track-image-current' src={images.current} alt={alt} key={images.current} />
      )}
    </div>
  );
};

const TransportIcon: React.FC<{
  name: 'shuffle' | 'previous' | 'next' | 'repeat' | 'repeat_one';
}> = ({ name }) => (
  <svg className='transport-icon' viewBox='0 0 24 24' aria-hidden='true'>
    {name === 'previous' && (
      <>
        <path
          className='standard-transport-glyph'
          d='M5 5h2v14H5zM20 6.5v11a1 1 0 0 1-1.55.83l-8-5.5a1 1 0 0 1 0-1.66l8-5.5A1 1 0 0 1 20 6.5Z'
        />
        <path
          className='apple-transport-glyph'
          d='M11.2 5.5v13a1 1 0 0 1-1.6.8L2.2 13a1.2 1.2 0 0 1 0-2l7.4-6.3a1 1 0 0 1 1.6.8Zm10.6 0v13a1 1 0 0 1-1.6.8L12.8 13a1.2 1.2 0 0 1 0-2l7.4-6.3a1 1 0 0 1 1.6.8Z'
        />
      </>
    )}
    {name === 'next' && (
      <>
        <path
          className='standard-transport-glyph'
          d='M17 5h2v14h-2zM4 6.5v11a1 1 0 0 0 1.55.83l8-5.5a1 1 0 0 0 0-1.66l-8-5.5A1 1 0 0 0 4 6.5Z'
        />
        <path
          className='apple-transport-glyph'
          d='M2.8 5.5a1 1 0 0 1 1.6-.8l7.4 6.3a1.2 1.2 0 0 1 0 2l-7.4 6.3a1 1 0 0 1-1.6-.8v-13Zm10.6 0a1 1 0 0 1 1.6-.8l7.4 6.3a1.2 1.2 0 0 1 0 2l-7.4 6.3a1 1 0 0 1-1.6-.8v-13Z'
        />
      </>
    )}
    {name === 'shuffle' && (
      <>
        <path
          className='standard-transport-glyph'
          d='M14 4h6v6h-2V7.41l-4.29 4.3-1.42-1.42L16.59 6H14V4ZM4 5h3.5l6.3 6.3-1.42 1.42L6.67 7H4V5Zm12.59 7.59L18 14v-2h2v6h-6v-2h2.59l-4.3-4.29 1.42-1.42L16.59 12.59ZM4 17h2.67l3.71-3.71 1.42 1.42L7.5 19H4v-2Z'
        />
        <g className='apple-transport-glyph'>
          <path d='M3 7h2.5c4.6 0 6.8 10 11.5 10H21m-4-4 4 4-4 4' />
          <path d='M3 17h2.5c2.2 0 3.8-2.8 5.2-5m2.6-4c1-.7 2-1 3.7-1H21m-4-4 4 4-4 4' />
        </g>
      </>
    )}
    {(name === 'repeat' || name === 'repeat_one') && (
      <>
        <path
          className='standard-transport-glyph'
          d='M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h13v-6h-2v4Z'
        />
        {name === 'repeat_one' && (
          <text
            className='standard-transport-glyph'
            x='12'
            y='15'
            fill='currentColor'
            fontSize='7'
            fontWeight='700'
            textAnchor='middle'
          >
            1
          </text>
        )}
        <g className='apple-transport-glyph'>
          <path d='M4 10V8a3 3 0 0 1 3-3h13m-3-3 3 3-3 3M20 14v2a3 3 0 0 1-3 3H4m3-3-3 3 3 3' />
          {name === 'repeat_one' && (
            <>
              <circle className='apple-repeat-one-badge' cx='7' cy='7' r='4.5' />
              <text className='apple-repeat-one-label' x='7' y='9.5' textAnchor='middle'>
                1
              </text>
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

const SyncedLyricCaption = memo<SyncedLyricCaptionProps>(
  ({ lineKey, text, lines, currentIndex, onSeek, isVisible }) => {
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
      const nextScrollTop =
        viewport.scrollTop +
        activeBounds.top -
        viewportBounds.top -
        (viewport.clientHeight - activeBounds.height) / 2;
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
        aria-label='Current synchronized lyric'
        aria-hidden={!isVisible}
      >
        <span
          className={`synced-lyric-caption-line synced-lyric-caption-current ${displayedLine.phase}`}
          dir='auto'
          aria-live='off'
        >
          {displayedLine.text}
        </span>
        <div
          className='synced-lyric-viewport'
          ref={viewportRef}
          role='region'
          aria-label='Synchronized lyrics. Select a line to seek to its timestamp.'
        >
          <div className='synced-lyric-stack'>
            {lyricGroups.map((group, groupIndex) => {
              const isActive = groupIndex === currentGroupIndex;
              const positionClass = isActive
                ? 'active'
                : groupIndex < currentGroupIndex
                  ? 'past'
                  : 'upcoming';

              return (
                <button
                  type='button'
                  className={`synced-lyric-group ${positionClass}`}
                  key={group.key}
                  dir='auto'
                  aria-current={isActive ? 'true' : undefined}
                  tabIndex={isVisible ? 0 : -1}
                  ref={isActive ? activeGroupRef : null}
                  onClick={() => onSeek(group.time)}
                >
                  {group.lines.map((lyricLine, lyricIndex) => (
                    <span className='synced-lyric-group-line' key={`${group.key}-${lyricIndex}`}>
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
  }
);

const MiniSyncedLyrics = memo<{ text: string }>(({ text }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lyricLines = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    [text]
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let frame = 0;
    const fitText = () => {
      frame = 0;
      const availableWidth = container.clientWidth;
      const availableHeight = container.clientHeight;
      if (!availableWidth || !availableHeight) return;

      let minimumSize = 6;
      let maximumSize = 32;
      let fittedSize = minimumSize;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = (minimumSize + maximumSize) / 2;
        container.style.setProperty('--mini-lyric-font-size', `${candidate}px`);
        if (
          container.scrollWidth <= availableWidth + 1 &&
          container.scrollHeight <= availableHeight + 1
        ) {
          fittedSize = candidate;
          minimumSize = candidate;
        } else {
          maximumSize = candidate;
        }
      }
      container.style.setProperty('--mini-lyric-font-size', `${fittedSize}px`);
    };

    const scheduleFitText = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(fitText);
    };

    scheduleFitText();
    const observer = new ResizeObserver(scheduleFitText);
    observer.observe(container);
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text]);

  return (
    <div
      className='mini-synced-lyrics'
      ref={containerRef}
      role='status'
      aria-label='Current synchronized lyrics'
      aria-live='polite'
      aria-atomic='true'
    >
      <div className='mini-synced-lyrics-lines' key={text}>
        {lyricLines.map((line, index) => (
          <span dir='auto' key={`${index}:${line}`}>
            {line}
          </span>
        ))}
      </div>
    </div>
  );
});

const PlayerModeMarquee: React.FC<{ text: string; className: string }> = ({ text, className }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const isOverflowingRef = useRef(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return undefined;
    let updateFrame = 0;
    const updateOverflow = () => {
      updateFrame = 0;
      const textContent = element.firstElementChild;
      if (!(textContent instanceof HTMLElement)) return;
      const nextIsOverflowing = textContent.getBoundingClientRect().width > element.clientWidth + 1;
      if (nextIsOverflowing === isOverflowingRef.current) return;
      isOverflowingRef.current = nextIsOverflowing;
      setIsOverflowing(nextIsOverflowing);
    };
    const scheduleOverflowUpdate = () => {
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(updateOverflow);
    };
    scheduleOverflowUpdate();
    const observer = new ResizeObserver(scheduleOverflowUpdate);
    observer.observe(element);
    return () => {
      window.cancelAnimationFrame(updateFrame);
      observer.disconnect();
    };
  }, [text]);

  return (
    <div
      ref={elementRef}
      className={`player-mode-marquee ${className} ${isOverflowing ? 'is-overflowing' : ''}`}
      title={text}
    >
      <span>{text}</span>
      {isOverflowing && <span aria-hidden='true'>{text}</span>}
    </div>
  );
};

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
  playlists = [],
  onShowAlbum,
  onShowArtist,
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
  showSyncedLyricsOnPlayBar,
  syncLyricsDisplay,
  playQueue,
  playQueueIndex,
  onQueueSelect,
  onQueueTracks,
  isDesktopApp,
  playerWindowMode,
  lyricOffsetSteps,
  onLyricOffsetStepsChange,
  onEnterMiniPlayer,
  onEnterFullscreenPlayer,
  onExitPlayerMode,
}) => {
  const primaryArtist = splitArtistCredits(track?.artist ?? '')[0] ?? '';
  const { imageUrl: trackArtworkUrl } = useAndroidAlbumArtwork(track, true);
  const androidApp = isAndroidApp();
  const { imageUrl: artistBackgroundImage } = useArtistImage(primaryArtist, {
    enabled: showArtistImageBackground || playerWindowMode !== 'normal',
    allowDownload: showArtistImageBackground,
  });
  const [state, setState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [height, setHeight] = useState(COLLAPSED_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [miniLyricsVisibility, setMiniLyricsVisibility] = useState<{
    trackId: string | null;
    visible: boolean;
  }>({ trackId: null, visible: false });
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showTrackMenu, setShowTrackMenu] = useState(false);
  const [isTrackMenuMounted, setIsTrackMenuMounted] = useState(false);
  const [showPlaylistSubmenu, setShowPlaylistSubmenu] = useState(false);
  const [confirmTrackDeletion, setConfirmTrackDeletion] = useState<Track | null>(null);
  const [trackMenuPosition, setTrackMenuPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const [playlistSubmenuSide, setPlaylistSubmenuSide] = useState<'left' | 'right'>('right');
  const [lyricsVisibility, setLyricsVisibility] = useState<{
    trackId: string | null;
    visible: boolean;
  }>({ trackId: null, visible: false });
  const [showPlayQueue, setShowPlayQueue] = useState(false);
  const [isMiniDockVisible, setIsMiniDockVisible] = useState(true);
  const [celebratingFavoriteTrackId, setCelebratingFavoriteTrackId] = useState<string | null>(null);
  const [playBarWidth, setPlayBarWidth] = useState(0);
  const [plainLyricsFontStep, setPlainLyricsFontStep] = useState(0);
  const [lyricsHintTrackId, setLyricsHintTrackId] = useState<string | null>(null);
  const [syncedLyricsMode, setSyncedLyricsMode] = useState<{
    trackId: string | null;
    visible: boolean;
  }>({ trackId: null, visible: true });
  const [playbackPosition, setPlaybackPosition] = useState({ currentTime: 0, duration: 0 });
  const seekbarFillRefs = useRef<Array<HTMLDivElement | null>>([]);
  const seekbarInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const miniPlayerRef = useRef<HTMLDivElement>(null);
  const trackMenuRef = useRef<HTMLDivElement>(null);
  const trackMenuToggleRef = useRef<HTMLButtonElement>(null);
  const trackMenuPopoverRef = useRef<HTMLDivElement>(null);
  const trackMenuCloseTimeoutRef = useRef<number | null>(null);
  const favoriteCelebrationTimeoutRef = useRef<number | null>(null);
  const trackDeletionBackdropRef = useRef<HTMLDivElement>(null);
  const deleteConfirmationCancelRef = useRef<HTMLButtonElement>(null);
  const currentTime = playbackPosition.currentTime;
  const duration = playbackPosition.duration || track?.duration || 0;
  const lyricsPlaybackTime = Math.max(0, currentTime - lyricOffsetSteps * 0.1);
  const playBarRef = useRef<HTMLDivElement>(null);
  const dragStartYRef = useRef<number | null>(null);
  const dragStartHeightRef = useRef(COLLAPSED_HEIGHT);
  const currentHeightRef = useRef(COLLAPSED_HEIGHT);
  const dragFrameRef = useRef<number | null>(null);
  const didDragRef = useRef(false);
  const visualizerLocationRef = useRef<string | null>(null);
  const visualizerRelocationFrameRef = useRef<number | null>(null);
  const [isVisualizerRelocating, setIsVisualizerRelocating] = useState(false);

  useEffect(
    () => () => {
      if (favoriteCelebrationTimeoutRef.current !== null) {
        window.clearTimeout(favoriteCelebrationTimeoutRef.current);
      }
    },
    []
  );

  const hasSyncedLyrics = Boolean(track?.syncedLyrics?.length);
  const showLyrics = Boolean(
    lyricsEnabled &&
    track?.lyrics?.trim() &&
    lyricsVisibility.trackId === track.id &&
    lyricsVisibility.visible
  );
  const showLyricsHint = Boolean(track?.id && lyricsHintTrackId === track.id);
  const showSyncedLyrics =
    syncedLyricsMode.trackId === track?.id ? syncedLyricsMode.visible : hasSyncedLyrics;
  const showMiniSyncedLyrics = syncLyricsDisplay
    ? showLyrics
    : miniLyricsVisibility.trackId === track?.id && miniLyricsVisibility.visible;
  const queueIndexEntries = useMemo(
    () =>
      buildAlphaNumericIndex(
        playQueue,
        (queuedTrack) => queuedTrack.name,
        (_queuedTrack, index) => `play-queue-row-${index}`
      ),
    [playQueue]
  );
  const showSyncedLyricCaption = Boolean(
    lyricsEnabled && showLyrics && showSyncedLyrics && hasSyncedLyrics
  );
  const showPlainLyricsPanel = Boolean(
    lyricsEnabled && showLyrics && track?.lyrics?.trim() && (!hasSyncedLyrics || !showSyncedLyrics)
  );
  const isPlainLyricsVisible = showPlainLyricsPanel && !showPlayQueue;
  const isMiniSyncedLyricsVisible = Boolean(
    lyricsEnabled && showSyncedLyricsOnPlayBar && hasSyncedLyrics && showMiniSyncedLyrics
  );
  const plainLyricsFontSize = `${0.95 + plainLyricsFontStep * 0.15}rem`;
  const visualizerLocation =
    showSyncedLyricCaption || showPlainLyricsPanel
      ? 'below-art'
      : hasSyncedLyrics
        ? 'default'
        : 'lyrics-slot';
  const updateLyricsVisibility = (visible: boolean) => {
    setLyricsVisibility({ trackId: track?.id ?? null, visible });
  };

  const setShowLyricsHint = (visible: boolean) => {
    setLyricsHintTrackId(visible ? (track?.id ?? null) : null);
  };

  const setShowSyncedLyrics = (visible: boolean) => {
    setSyncedLyricsMode({ trackId: track?.id ?? null, visible });
  };

  const closeTrackMenu = useCallback(() => {
    setShowTrackMenu(false);
    setShowPlaylistSubmenu(false);
    if (trackMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(trackMenuCloseTimeoutRef.current);
    }
    trackMenuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsTrackMenuMounted(false);
      trackMenuCloseTimeoutRef.current = null;
    }, 240);
  }, []);

  const toggleTrackMenu = useCallback(() => {
    if (showTrackMenu) {
      closeTrackMenu();
      return;
    }
    if (trackMenuCloseTimeoutRef.current !== null) {
      window.clearTimeout(trackMenuCloseTimeoutRef.current);
      trackMenuCloseTimeoutRef.current = null;
    }
    setIsTrackMenuMounted(true);
    setShowTrackMenu(true);
  }, [closeTrackMenu, showTrackMenu]);

  const openPlaylistSubmenu = () => {
    const menuRect = trackMenuPopoverRef.current?.getBoundingClientRect();
    if (menuRect) {
      const availableRight = window.innerWidth - menuRect.right;
      const availableLeft = menuRect.left;
      setPlaylistSubmenuSide(
        availableRight >= 300 || availableRight >= availableLeft ? 'right' : 'left'
      );
    }
    setShowPlaylistSubmenu(true);
  };

  useEffect(() => {
    if (!showTrackMenu) return undefined;

    const handleMenuClick = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;
      const clickedInsideMenu =
        trackMenuRef.current?.contains(event.target) ||
        trackMenuToggleRef.current?.contains(event.target) ||
        trackMenuPopoverRef.current?.contains(event.target);
      if (!clickedInsideMenu) {
        closeTrackMenu();
      }
    };
    const handleMenuKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeTrackMenu();
    };

    document.addEventListener('click', handleMenuClick);
    document.addEventListener('keydown', handleMenuKeyDown);
    return () => {
      document.removeEventListener('click', handleMenuClick);
      document.removeEventListener('keydown', handleMenuKeyDown);
    };
  }, [closeTrackMenu, showTrackMenu]);

  useEffect(
    () => () => {
      if (trackMenuCloseTimeoutRef.current !== null) {
        window.clearTimeout(trackMenuCloseTimeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!confirmTrackDeletion) return undefined;
    deleteConfirmationCancelRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setConfirmTrackDeletion(null);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmTrackDeletion]);

  useLayoutEffect(() => {
    if (!isTrackMenuMounted || !showTrackMenu) return undefined;

    const updateMenuPosition = () => {
      const wrapper = trackMenuRef.current;
      const toggle = trackMenuToggleRef.current;
      const menu = trackMenuPopoverRef.current;
      if (!wrapper || !toggle || !menu) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const toggleRect = toggle.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = Math.min(menu.offsetHeight, window.innerHeight - 24);
      const spaceBelow = window.innerHeight - toggleRect.bottom;
      const spaceAbove = toggleRect.top;
      const placeAbove = spaceBelow < menuHeight + 16 && spaceAbove > spaceBelow;
      const viewportLeft = Math.min(
        Math.max(12, toggleRect.right - menuWidth),
        Math.max(12, window.innerWidth - menuWidth - 12)
      );
      const viewportTop = placeAbove
        ? Math.max(12, toggleRect.top - menuHeight - 8)
        : Math.min(toggleRect.bottom + 8, window.innerHeight - menuHeight - 12);

      setTrackMenuPosition({
        left: viewportLeft - wrapperRect.left,
        top: viewportTop - wrapperRect.top,
      });
    };

    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isTrackMenuMounted, showTrackMenu, showPlaylistSubmenu]);
  const handleCollapse = () => {
    currentHeightRef.current = getExpandedHeight();
    setState('collapsed');
    setIsDragging(false);
  };

  useEffect(() => {
    const openNowPlaying = () => setState('expanded');
    const toggleLyrics = () => {
      if (!lyricsEnabled || !track?.lyrics?.trim()) return;
      setLyricsVisibility({ trackId: track.id, visible: !showLyrics });
      setLyricsHintTrackId(null);
    };

    window.addEventListener('luna-open-now-playing', openNowPlaying);
    window.addEventListener('luna-toggle-lyrics', toggleLyrics);
    return () => {
      window.removeEventListener('luna-open-now-playing', openNowPlaying);
      window.removeEventListener('luna-toggle-lyrics', toggleLyrics);
    };
  }, [lyricsEnabled, showLyrics, track?.id, track?.lyrics]);

  useEffect(() => {
    if (playerWindowMode !== 'mini' || !isPlaying) return undefined;

    let hideTimeout = 0;
    let revealFrame = 0;
    const revealDock = () => {
      setIsMiniDockVisible(true);
      window.clearTimeout(hideTimeout);
      hideTimeout = window.setTimeout(() => setIsMiniDockVisible(false), 3000);
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      'pointermove',
      'pointerdown',
      'keydown',
      'wheel',
      'touchstart',
    ];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, revealDock));
    document.addEventListener('focusin', revealDock);
    revealFrame = window.requestAnimationFrame(revealDock);

    return () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(hideTimeout);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, revealDock));
      document.removeEventListener('focusin', revealDock);
    };
  }, [isPlaying, playerWindowMode]);

  useEffect(() => {
    const collapseNowPlaying = () => {
      if (state === 'expanded') handleCollapse();
    };
    window.addEventListener('luna-android-collapse-now-playing', collapseNowPlaying);
    window.addEventListener('luna-collapse-now-playing', collapseNowPlaying);
    return () => {
      window.removeEventListener('luna-android-collapse-now-playing', collapseNowPlaying);
      window.removeEventListener('luna-collapse-now-playing', collapseNowPlaying);
    };
  }, [state]);

  useEffect(() => {
    window.addEventListener('luna-track-changed', closeTrackMenu);
    return () => window.removeEventListener('luna-track-changed', closeTrackMenu);
  }, [closeTrackMenu]);

  useEffect(() => {
    const syncPlaybackPosition = () => {
      setPlaybackPosition({
        currentTime: activeAudio?.currentTime ?? 0,
        duration:
          activeAudio && Number.isFinite(activeAudio.duration)
            ? activeAudio.duration
            : (track?.duration ?? 0),
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

  useEffect(() => {
    if (!activeAudio) return undefined;
    let frame = 0;
    const updateProgressFills = () => {
      const actualDuration =
        Number.isFinite(activeAudio.duration) && activeAudio.duration > 0
          ? activeAudio.duration
          : duration;
      const progress =
        actualDuration > 0
          ? `${(Math.min(activeAudio.currentTime, actualDuration) / actualDuration) * 100}%`
          : '0%';
      seekbarFillRefs.current.forEach((fill) => {
        if (fill) fill.style.width = progress;
      });
      const playbackTime = Math.min(activeAudio.currentTime, actualDuration);
      seekbarInputRefs.current.forEach((input) => {
        if (input) input.value = String(playbackTime);
      });
      if (isPlaying && !activeAudio.paused && !activeAudio.ended) {
        frame = window.requestAnimationFrame(updateProgressFills);
      }
    };

    updateProgressFills();
    return () => window.cancelAnimationFrame(frame);
  }, [activeAudio, duration, isPlaying, track?.id]);

  const seekTo = (time: number) => {
    onSeek(time);
    setPlaybackPosition((position) => ({
      ...position,
      currentTime: Math.max(0, Math.min(duration, time)),
    }));
  };

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

  useEffect(
    () => () => {
      if (visualizerRelocationFrameRef.current !== null) {
        window.cancelAnimationFrame(visualizerRelocationFrameRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!track?.lyrics?.trim()) return undefined;

    const timeout = window.setTimeout(() => {
      setLyricsHintTrackId(track.id);
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
      if (lines[middle].time <= lyricsPlaybackTime) {
        currentIndex = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const currentTimestamp = lines[currentIndex].time;
    while (currentIndex > 0 && Math.abs(lines[currentIndex - 1].time - currentTimestamp) < 0.001) {
      currentIndex -= 1;
    }
    return currentIndex;
  }, [lyricsPlaybackTime, track?.syncedLyrics]);

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
        Math.min(getExpandedHeight(), dragStartHeightRef.current + deltaY)
      );
      currentHeightRef.current = nextHeight;
      if (dragFrameRef.current === null) {
        dragFrameRef.current = window.requestAnimationFrame(() => {
          dragFrameRef.current = null;
          if (playBarRef.current) {
            playBarRef.current.style.height = `${currentHeightRef.current}px`;
            playBarRef.current.style.setProperty(
              '--expand-progress',
              String(getExpandProgress(currentHeightRef.current))
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
    if (playerWindowMode !== 'normal') return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        'button, input, select, textarea, a, .album-art-mini, .progress-bar, .lyrics-panel'
      )
    )
      return;
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
      updateLyricsVisibility(!showLyrics);
      setShowLyricsHint(false);
    }
  };

  const handleMiniLyricsToggle = () => {
    const nextVisible = !isMiniSyncedLyricsVisible;
    if (syncLyricsDisplay) updateLyricsVisibility(nextVisible);
    else setMiniLyricsVisibility({ trackId: track?.id ?? null, visible: nextVisible });
    setShowVolumeSlider(false);
    setShowOptionsMenu(false);
  };

  useEffect(() => {
    if (!confirmTrackDeletion) return undefined;
    const handleBackdropPointerDown = (event: PointerEvent) => {
      if (event.target === trackDeletionBackdropRef.current) {
        setConfirmTrackDeletion(null);
      }
    };
    document.addEventListener('pointerdown', handleBackdropPointerDown);
    return () => document.removeEventListener('pointerdown', handleBackdropPointerDown);
  }, [confirmTrackDeletion]);

  useLayoutEffect(() => {
    const miniPlayer = miniPlayerRef.current;
    if (!miniPlayer) return undefined;

    const updatePlayBarWidth = () => {
      const nextWidth = miniPlayer.clientWidth;
      setPlayBarWidth((currentWidth) => (currentWidth === nextWidth ? currentWidth : nextWidth));
    };

    const initialMeasure = window.requestAnimationFrame(updatePlayBarWidth);
    const observer = new ResizeObserver(updatePlayBarWidth);
    observer.observe(miniPlayer);
    return () => {
      window.cancelAnimationFrame(initialMeasure);
      observer.disconnect();
    };
  }, []);

  const handleLyricsToggleFromArtwork = (event?: React.MouseEvent | React.PointerEvent) => {
    if (event) {
      event.stopPropagation();
    }
    handleLyricsToggle();
  };

  const isLongTrackTitle = (track?.name?.length ?? 0) > 28;
  const isCompactPlayBar = playBarWidth <= 768;
  const showInlineMiniPlayerControl = playBarWidth > 720;
  const showInlineFullscreenPlayerControl = playBarWidth > 640;
  const showInlineVolumeControl = playBarWidth > 560;
  const showInlineLyricsControl = playBarWidth > 480;
  const hasOverflowControls =
    isCompactPlayBar ||
    (lyricsEnabled && showSyncedLyricsOnPlayBar && hasSyncedLyrics && !showInlineLyricsControl) ||
    !showInlineVolumeControl ||
    (isDesktopApp && (!showInlineMiniPlayerControl || !showInlineFullscreenPlayerControl));

  const handleTrackMenuAction = (
    action: 'delete' | 'playlist' | 'album' | 'artist' | 'love' | 'less' | 'queue' | 'next'
  ) => {
    if (!track) return;
    switch (action) {
      case 'delete':
        setConfirmTrackDeletion(track);
        closeTrackMenu();
        break;
      case 'playlist':
        onAddTrackToPlaylist?.(track);
        closeTrackMenu();
        break;
      case 'album':
        setState('collapsed');
        onShowAlbum?.(track);
        closeTrackMenu();
        break;
      case 'artist':
        setState('collapsed');
        onShowArtist?.(track);
        closeTrackMenu();
        break;
      case 'love':
        if (isLoved) {
          setCelebratingFavoriteTrackId(null);
          if (favoriteCelebrationTimeoutRef.current !== null) {
            window.clearTimeout(favoriteCelebrationTimeoutRef.current);
            favoriteCelebrationTimeoutRef.current = null;
          }
        } else if (onToggleLove) {
          setCelebratingFavoriteTrackId(track.id);
          if (favoriteCelebrationTimeoutRef.current !== null) {
            window.clearTimeout(favoriteCelebrationTimeoutRef.current);
          }
          favoriteCelebrationTimeoutRef.current = window.setTimeout(() => {
            setCelebratingFavoriteTrackId(null);
            favoriteCelebrationTimeoutRef.current = null;
          }, 3_000);
        }
        onToggleLove?.(track);
        closeTrackMenu();
        break;
      case 'less':
        onSuggestTrackLess?.(track);
        closeTrackMenu();
        break;
      case 'queue':
        onQueueTracks([track], false);
        closeTrackMenu();
        break;
      case 'next':
        onQueueTracks([track], true);
        closeTrackMenu();
        break;
      default:
        break;
    }
  };

  type TrackMenuAction =
    'delete' | 'playlist' | 'album' | 'artist' | 'love' | 'less' | 'queue' | 'next';
  const allTrackMenuItems: Array<{ label: string; icon: string; action: TrackMenuAction }> = [
    { label: 'Delete from library', icon: 'delete_forever', action: 'delete' },
    { label: 'Add to playlist', icon: 'playlist_add', action: 'playlist' },
    { label: 'Add to play queue', icon: 'queue_music', action: 'queue' },
    { label: 'Play next', icon: 'next_plan', action: 'next' },
    { label: primaryArtist || 'Unknown Artist', icon: 'person', action: 'artist' },
    { label: 'Show Album', icon: 'album', action: 'album' },
    {
      label: isLoved ? 'Remove from favorites' : 'Add to favorites',
      icon: isLoved ? 'favorite' : 'favorite_border',
      action: 'love',
    },
    { label: 'Suggest the track less', icon: 'thumb_down', action: 'less' },
  ];
  const trackMenuItems = allTrackMenuItems.filter(
    (item) =>
      !track?.streamingProvider ||
      item.action === 'queue' ||
      item.action === 'next' ||
      (item.action === 'artist' && Boolean(primaryArtist)) ||
      (item.action === 'album' && Boolean(track?.album?.trim()))
  );

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
  const shuffleControl = (
    <button
      aria-label='Shuffle'
      aria-pressed={isShuffled}
      className={`${isCompactPlayBar ? 'more-options-item' : 'control-btn'} shuffle-btn ${isShuffled ? 'active' : ''}`}
      onClick={handleShuffle}
      disabled={!track}
    >
      <TransportIcon name='shuffle' />
    </button>
  );
  const repeatControl = (
    <button
      aria-label={`Repeat ${repeatMode === 'off' ? 'off' : repeatMode === 'one' ? 'one' : 'all'}`}
      aria-pressed={repeatMode !== 'off'}
      className={`${isCompactPlayBar ? 'more-options-item' : 'control-btn'} repeat-btn ${repeatMode !== 'off' ? 'active' : ''}`}
      onClick={handleRepeat}
      disabled={!track}
    >
      <TransportIcon name={getRepeatIcon()} />
    </button>
  );
  const renderVolumeControl = (inOptionsMenu: boolean) => (
    <div className={`volume-control${inOptionsMenu ? ' overflow-volume-control' : ''}`}>
      {showVolumeSlider && (
        <div className='volume-popover'>
          <input
            aria-label='Volume'
            type='range'
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => onVolumeChange(event.currentTarget.valueAsNumber)}
            className='volume-slider'
            style={volumeSliderStyle}
          />
        </div>
      )}
      <button
        aria-label='Volume'
        aria-expanded={showVolumeSlider}
        className={inOptionsMenu ? 'more-options-item volume-menu-button' : 'control-btn mute-btn'}
        onClick={() => {
          setShowVolumeSlider(!showVolumeSlider);
          if (!inOptionsMenu) setShowOptionsMenu(false);
        }}
      >
        <svg className='apple-volume-icon' viewBox='0 0 24 24' aria-hidden='true'>
          <path className='volume-speaker' d='M3 9v6h4l5 4V5L7 9H3Z' />
          {volume === 0 ? (
            <path className='volume-mute-mark' d='m16 9 5 6m0-6-5 6' />
          ) : volume < 0.5 ? (
            <path className='volume-wave' d='M15.5 9.5a4 4 0 0 1 0 5' />
          ) : (
            <>
              <path className='volume-wave' d='M15.5 9.5a4 4 0 0 1 0 5' />
              <path className='volume-wave' d='M18.5 6.5a8 8 0 0 1 0 11' />
            </>
          )}
        </svg>
        <span className='material-symbols-outlined' aria-hidden='true'>
          {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
        </span>
        {inOptionsMenu && <span>Volume</span>}
      </button>
    </div>
  );
  const renderLyricsControl = (inOptionsMenu: boolean) => (
    <button
      type='button'
      className={
        inOptionsMenu
          ? 'more-options-item'
          : `control-btn mini-synced-lyrics-toggle ${isMiniSyncedLyricsVisible ? 'active' : ''}`
      }
      aria-label={
        isMiniSyncedLyricsVisible ? 'Hide synchronized lyrics' : 'Show synchronized lyrics'
      }
      title={isMiniSyncedLyricsVisible ? 'Hide synchronized lyrics' : 'Show synchronized lyrics'}
      aria-pressed={isMiniSyncedLyricsVisible}
      onClick={handleMiniLyricsToggle}
    >
      <span className='material-symbols-outlined' aria-hidden='true'>
        lyrics
      </span>
      {inOptionsMenu && <span>Synchronized lyrics</span>}
    </button>
  );
  const lyricOffsetLabel = `${lyricOffsetSteps > 0 ? '+' : ''}${(lyricOffsetSteps * 0.1).toFixed(1)}s`;

  const displayHeight = isDragging
    ? height
    : state === 'expanded'
      ? getExpandedHeight()
      : COLLAPSED_HEIGHT;
  const expandProgress = isDragging ? getExpandProgress(height) : state === 'expanded' ? 1 : 0;
  const playBarStyle: React.CSSProperties & { '--expand-progress': number } = {
    height: `${displayHeight}px`,
    '--expand-progress': expandProgress,
  };

  return (
    <>
      <div
        ref={playBarRef}
        className={`play-bar ${state} ${isDragging ? 'dragging' : ''} ${
          playerWindowMode === 'mini' && isPlaying && !isMiniDockVisible ? 'mini-dock-hidden' : ''
        }`}
        style={playBarStyle}
      >
        {/* Drag handle */}
        <div className='drag-handle' onPointerDown={handleDragStart}>
          <div className='drag-indicator' />
        </div>

        {/* Expanded View - Now Playing */}
        <div
          className={`now-playing ${state === 'expanded' || isDragging ? 'visible' : 'hidden'} ${showArtistImageBackground ? 'artist-background-enabled' : ''}`}
          onPointerDown={handleDragStart}
        >
          {playerWindowMode !== 'normal' && (
            <div className='player-mode-background' aria-hidden='true'>
              {(artistBackgroundImage || trackArtworkUrl) && (
                <TrackImageCrossfade
                  src={artistBackgroundImage || trackArtworkUrl || null}
                  alt=''
                  className='player-mode-background-image'
                />
              )}
              <div className='player-mode-background-overlay' />
            </div>
          )}
          {artistBackgroundImage && playerWindowMode === 'normal' && (
            <div className='now-playing-artist-background' aria-hidden='true'>
              <TrackImageCrossfade src={artistBackgroundImage} alt='' />
              <div className='now-playing-artist-background-overlay' />
            </div>
          )}
          <div className='now-playing-header'>
            <button
              type='button'
              className='now-playing-close'
              aria-label={playerWindowMode === 'normal' ? 'Close Now Playing' : 'Exit player mode'}
              onClick={playerWindowMode === 'normal' ? handleCollapse : onExitPlayerMode}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                {playerWindowMode === 'normal' ? 'keyboard_arrow_down' : 'close_fullscreen'}
              </span>
            </button>
            <span>Now Playing</span>
            {isDesktopApp && playerWindowMode === 'normal' && (
              <div className='now-playing-mode-actions'>
                <button
                  type='button'
                  className='now-playing-mode-button'
                  aria-label='Enter mini player mode'
                  title='Enter mini player mode'
                  onClick={onEnterMiniPlayer}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    picture_in_picture_alt
                  </span>
                </button>
                <button
                  type='button'
                  className='now-playing-mode-button'
                  aria-label='Enter fullscreen player mode'
                  title='Enter fullscreen player mode'
                  onClick={onEnterFullscreenPlayer}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    fullscreen
                  </span>
                </button>
              </div>
            )}
            <button
              type='button'
              className={`now-playing-queue-toggle ${showPlayQueue ? 'active' : ''}`}
              aria-label={showPlayQueue ? 'Close play queue' : 'Open play queue'}
              aria-expanded={showPlayQueue}
              onClick={() => setShowPlayQueue((visible) => !visible)}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                chevron_left
              </span>
            </button>
          </div>
          <div
            className={[
              'now-playing-container',
              showSyncedLyricCaption ? 'has-synced-lyric' : '',
              isPlainLyricsVisible ? 'has-plain-lyric' : '',
              hasSyncedLyrics ? 'has-synced-lyrics' : '',
              showVisualizer && !hasSyncedLyrics ? 'visualizer-in-lyrics-slot' : '',
              showVisualizer && visualizerLocation === 'below-art' ? 'visualizer-below-art' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            data-playback-state={isPlaying ? 'playing' : 'paused'}
            role='button'
            tabIndex={0}
            aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (
                !track ||
                target.closest(
                  'button, input, select, textarea, a, [role="button"], .lyrics-panel, .synced-lyric-caption, .progress-bar-container, .expanded-controls, .track-menu-popover'
                )
              ) {
                return;
              }
              if (didDragRef.current) {
                didDragRef.current = false;
                return;
              }
              onPlayPause();
            }}
            onKeyDown={(event) => {
              if (
                event.target !== event.currentTarget ||
                (event.key !== 'Enter' && event.key !== ' ')
              ) {
                return;
              }
              event.preventDefault();
              onPlayPause();
            }}
          >
            {/* Album Art */}
            <div
              className='album-art'
              role={playerWindowMode === 'mini' ? 'button' : undefined}
              tabIndex={playerWindowMode === 'mini' ? 0 : undefined}
              aria-label={
                playerWindowMode === 'mini'
                  ? `${isPlaying ? 'Pause' : 'Play'} ${track?.name || 'track'}`
                  : undefined
              }
              onClick={() => {
                if (playerWindowMode === 'mini' && track) onPlayPause();
              }}
              onKeyDown={(event) => {
                if (
                  playerWindowMode === 'mini' &&
                  track &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  onPlayPause();
                }
              }}
              onDoubleClick={(event) => {
                if (playerWindowMode === 'normal' && lyricsEnabled && track?.lyrics?.trim()) {
                  handleLyricsToggleFromArtwork(event);
                }
              }}
              onMouseEnter={() => {
                if (playerWindowMode === 'normal' && lyricsEnabled && track?.lyrics?.trim()) {
                  setShowLyricsHint(true);
                }
              }}
              onMouseLeave={() => {
                if (!showLyrics) {
                  setShowLyricsHint(false);
                }
              }}
            >
              {playerWindowMode === 'normal' &&
                lyricsEnabled &&
                track?.lyrics?.trim() &&
                showLyricsHint &&
                !showLyrics && (
                  <button
                    type='button'
                    className='lyrics-hint'
                    onClick={(event) => {
                      event.stopPropagation();
                      handleLyricsToggle();
                    }}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      lyrics
                    </span>
                    Lyrics available
                  </button>
                )}
              {!trackArtworkUrl && <div className='default-art'>{DEFAULT_ALBUM_ART}</div>}
              <TrackImageCrossfade src={trackArtworkUrl ?? null} alt={track?.album ?? ''} />
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
            <div className='track-info'>
              <div className='track-title-row'>
                <h2
                  className={`track-name ${isLongTrackTitle ? 'marquee-title' : ''}`}
                  key={track?.id ?? 'no-track'}
                  onDoubleClick={() => {
                    if (lyricsEnabled && track?.lyrics?.trim()) {
                      updateLyricsVisibility(!showLyrics);
                    }
                  }}
                >
                  <span>{track?.name || 'No Track Selected'}</span>
                </h2>
                {track && (
                  <div className='track-title-menu-wrap' ref={trackMenuRef}>
                    <button
                      type='button'
                      className={`track-love-toggle${isLoved ? ' is-loved' : ''}${celebratingFavoriteTrackId === track.id ? ' celebrating' : ''}`}
                      aria-label={isLoved ? 'Remove from favorites' : 'Add to favorites'}
                      aria-pressed={isLoved}
                      title={isLoved ? 'Remove from favorites' : 'Add to favorites'}
                      onClick={() => handleTrackMenuAction('love')}
                    >
                      <span className='material-symbols-outlined' aria-hidden='true'>
                        {isLoved || celebratingFavoriteTrackId === track.id
                          ? 'favorite'
                          : 'favorite_border'}
                      </span>
                      {celebratingFavoriteTrackId === track.id && (
                        <span className='favorite-heart-burst' aria-hidden='true'>
                          {[0, 1, 2, 3, 4].map((heart) => (
                            <span
                              key={heart}
                              className={`material-symbols-outlined favorite-heart-${heart + 1}`}
                            >
                              favorite
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                    <button
                      type='button'
                      className='track-title-menu'
                      ref={trackMenuToggleRef}
                      aria-label={`More options for ${track.name}`}
                      aria-expanded={showTrackMenu}
                      onClick={toggleTrackMenu}
                    >
                      <span className='material-symbols-outlined' aria-hidden='true'>
                        {androidApp ? 'more_horiz' : 'more_vert'}
                      </span>
                    </button>
                    {isTrackMenuMounted && (
                      <div
                        ref={trackMenuPopoverRef}
                        className={`track-menu-popover${showTrackMenu ? ' is-open' : ' is-closing'}`}
                        role='menu'
                        tabIndex={-1}
                        aria-label='Track options'
                        aria-hidden={!showTrackMenu}
                        style={
                          trackMenuPosition
                            ? {
                                top: `${trackMenuPosition.top}px`,
                                left: `${trackMenuPosition.left}px`,
                                right: 'auto',
                              }
                            : undefined
                        }
                      >
                        {trackMenuItems.map((item) =>
                          item.action === 'playlist' ? (
                            <div
                              className={`track-menu-submenu side-${playlistSubmenuSide}`}
                              key={item.action}
                              onMouseEnter={openPlaylistSubmenu}
                              onMouseLeave={() => setShowPlaylistSubmenu(false)}
                              onFocus={openPlaylistSubmenu}
                            >
                              <button
                                type='button'
                                className='track-menu-item track-menu-submenu-toggle'
                                role='menuitem'
                                aria-expanded={showPlaylistSubmenu}
                                aria-haspopup='menu'
                                onClick={() => {
                                  if (showPlaylistSubmenu) {
                                    setShowPlaylistSubmenu(false);
                                  } else {
                                    openPlaylistSubmenu();
                                  }
                                }}
                              >
                                <span className='material-symbols-outlined' aria-hidden='true'>
                                  {item.icon}
                                </span>
                                <span>{item.label}</span>
                                <span
                                  className='material-symbols-outlined track-menu-submenu-arrow'
                                  aria-hidden='true'
                                >
                                  {showPlaylistSubmenu ? 'expand_less' : 'chevron_right'}
                                </span>
                              </button>
                              <div
                                className={`track-menu-submenu-items${showPlaylistSubmenu ? ' is-open' : ''}`}
                                role='menu'
                                aria-label='Select playlist'
                                aria-hidden={!showPlaylistSubmenu}
                              >
                                {playlists.map((playlist) => (
                                  <button
                                    key={playlist.id}
                                    type='button'
                                    className='track-menu-item track-menu-playlist-item'
                                    role='menuitem'
                                    tabIndex={showPlaylistSubmenu ? 0 : -1}
                                    onClick={() => {
                                      onAddTrackToPlaylist?.(track, playlist.id);
                                      closeTrackMenu();
                                    }}
                                  >
                                    <span className='material-symbols-outlined' aria-hidden='true'>
                                      queue_music
                                    </span>
                                    <span>{playlist.name}</span>
                                  </button>
                                ))}
                                <button
                                  type='button'
                                  className='track-menu-item track-menu-create-playlist'
                                  role='menuitem'
                                  tabIndex={showPlaylistSubmenu ? 0 : -1}
                                  onClick={() => handleTrackMenuAction('playlist')}
                                >
                                  <span className='material-symbols-outlined' aria-hidden='true'>
                                    add
                                  </span>
                                  <span>Create new playlist…</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              key={item.label}
                              type='button'
                              className={`track-menu-item${item.action === 'love' ? ' is-favorite' : ''}${item.action === 'delete' ? ' is-destructive' : ''}`}
                              role='menuitem'
                              aria-pressed={item.action === 'love' ? isLoved : undefined}
                              onClick={() => handleTrackMenuAction(item.action)}
                            >
                              <span className='material-symbols-outlined' aria-hidden='true'>
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className='artist-name' key={`artist-${track?.id ?? 'none'}`}>
                {track?.artist || 'Unknown Artist'}
              </p>
              <p className='album-name' key={`album-${track?.id ?? 'none'}`}>
                {track?.album || 'Unknown Album'}
              </p>
              {lyricsEnabled && track?.lyrics?.trim() && (
                <div className='lyrics-actions'>
                  <button type='button' className='lyrics-toggle' onClick={handleLyricsToggle}>
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      lyrics
                    </span>
                    {showLyrics ? 'Hide lyrics' : 'Show lyrics'}
                  </button>
                  {track.syncedLyrics && track.syncedLyrics.length > 0 && (
                    <button
                      type='button'
                      className='lyrics-mode-toggle'
                      onClick={() => setShowSyncedLyrics(!showSyncedLyrics)}
                    >
                      <span className='material-symbols-outlined' aria-hidden='true'>
                        timelapse
                      </span>
                      {showSyncedLyrics ? 'Synced' : 'Plain'}
                    </button>
                  )}
                  {showSyncedLyrics && Boolean(track.syncedLyrics?.length) && (
                    <div className='lyrics-delay-controls' aria-label='Synchronized lyrics timing'>
                      <button
                        type='button'
                        className='lyrics-delay-button'
                        aria-label='Show synchronized lyrics 0.1 seconds earlier'
                        title='Show lyrics earlier'
                        disabled={lyricOffsetSteps <= -5}
                        onClick={() => onLyricOffsetStepsChange(Math.max(-5, lyricOffsetSteps - 1))}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          fast_rewind
                        </span>
                      </button>
                      <span aria-live='polite' title='Positive values delay lyrics'>
                        {lyricOffsetLabel}
                      </span>
                      <button
                        type='button'
                        className='lyrics-delay-button'
                        aria-label='Delay synchronized lyrics by 0.1 seconds'
                        title='Delay lyrics'
                        disabled={lyricOffsetSteps >= 5}
                        onClick={() => onLyricOffsetStepsChange(Math.min(5, lyricOffsetSteps + 1))}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          fast_forward
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {lyricsEnabled && track?.lyrics?.trim() && (
              <section
                className={`lyrics-panel ${isPlainLyricsVisible ? 'is-visible' : 'is-hidden'}`}
                aria-label={`Lyrics for ${track.name}`}
                aria-hidden={!isPlainLyricsVisible}
              >
                <div className='lyrics-panel-header'>
                  <div>
                    <h2>Lyrics</h2>
                    <p>
                      {track.name} · {track.artist}
                    </p>
                  </div>
                  <div className='lyrics-panel-actions'>
                    <div className='lyrics-font-controls' aria-label='Lyrics font size'>
                      <button
                        type='button'
                        className='lyrics-font-button'
                        aria-label='Decrease lyrics font size'
                        title='Decrease lyrics font size'
                        disabled={plainLyricsFontStep <= -3}
                        tabIndex={isPlainLyricsVisible ? 0 : -1}
                        onClick={() => setPlainLyricsFontStep((step) => Math.max(-3, step - 1))}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          text_decrease
                        </span>
                      </button>
                      <span className='lyrics-font-size' aria-live='polite'>
                        {Math.round((1 + (plainLyricsFontStep * 0.15) / 0.95) * 100)}%
                      </span>
                      <button
                        type='button'
                        className='lyrics-font-button'
                        aria-label='Increase lyrics font size'
                        title='Increase lyrics font size'
                        disabled={plainLyricsFontStep >= 3}
                        tabIndex={isPlainLyricsVisible ? 0 : -1}
                        onClick={() => setPlainLyricsFontStep((step) => Math.min(3, step + 1))}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          text_increase
                        </span>
                      </button>
                    </div>
                    <button
                      type='button'
                      className='lyrics-close'
                      aria-label='Close lyrics'
                      tabIndex={isPlainLyricsVisible ? 0 : -1}
                      onClick={() => updateLyricsVisibility(false)}
                    >
                      <span className='material-symbols-outlined' aria-hidden='true'>
                        close
                      </span>
                    </button>
                  </div>
                </div>
                <p className='lyrics-text' dir='auto' style={{ fontSize: plainLyricsFontSize }}>
                  {track.syncedLyrics && track.syncedLyrics.length > 0 && showSyncedLyrics ? (
                    <span className='synced-lyrics-line' dir='auto'>
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
              aria-label='Play queue'
              aria-hidden={!showPlayQueue}
            >
              <header className='play-queue-header'>
                <div>
                  <h2>Play queue</h2>
                  <p>{playQueue.length} tracks</p>
                </div>
                <button
                  type='button'
                  className='lyrics-close'
                  aria-label='Close play queue'
                  onClick={() => setShowPlayQueue(false)}
                  tabIndex={showPlayQueue ? 0 : -1}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    close
                  </span>
                </button>
              </header>
              {playQueue.length > 0 ? (
                <div className='play-queue-content indexed-list-layout'>
                  <ol className='play-queue-list'>
                    {playQueue.map((queuedTrack, index) => (
                      <li id={`play-queue-row-${index}`} key={`${queuedTrack.id}-${index}`}>
                        <button
                          type='button'
                          className={`play-queue-item ${index === playQueueIndex ? 'current' : ''}`}
                          aria-current={index === playQueueIndex ? 'true' : undefined}
                          tabIndex={showPlayQueue ? 0 : -1}
                          onClick={() => onQueueSelect(index)}
                        >
                          <span className='material-symbols-outlined' aria-hidden='true'>
                            {index === playQueueIndex ? 'equalizer' : 'music_note'}
                          </span>
                          <span className='play-queue-track-copy'>
                            <strong>{queuedTrack.name}</strong>
                            <small>{queuedTrack.artist}</small>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <AlphaNumericIndex
                    entries={queueIndexEntries}
                    ariaLabel='Play queue index'
                    scrollContainerSelector='.play-queue-list'
                  />
                </div>
              ) : (
                <ol className='play-queue-list'>
                  <li className='play-queue-empty'>Play a track to start a queue.</li>
                </ol>
              )}
            </section>

            {/* Progress Bar */}
            {lyricsEnabled && hasSyncedLyrics && track?.syncedLyrics && (
              <SyncedLyricCaption
                lineKey={currentSyncedLyricKey}
                text={currentSyncedLyricText}
                lines={track.syncedLyrics}
                currentIndex={currentSyncedLyricIndex}
                onSeek={seekTo}
                isVisible={showSyncedLyricCaption}
              />
            )}
            <div className='progress-bar-container'>
              <div
                className='progress-bar'
                role='slider'
                tabIndex={track ? 0 : -1}
                aria-label='Track progress'
                aria-disabled={!track}
                aria-valuemin={0}
                aria-valuemax={duration}
                aria-valuenow={currentTime}
                onClick={(e) => {
                  if (!track) return;
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  seekTo(percent * duration);
                }}
                onKeyDown={(event) => {
                  if (!track || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                  event.preventDefault();
                  seekTo(currentTime + (event.key === 'ArrowRight' ? 5 : -5));
                }}
              >
                <div
                  className='progress-fill'
                  ref={(element) => {
                    seekbarFillRefs.current[0] = element;
                  }}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className='time-display'>
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className='controls expanded-controls'>
              <button
                className={`control-btn shuffle-btn ${isShuffled ? 'active' : ''}`}
                onClick={handleShuffle}
                disabled={!track}
              >
                <TransportIcon name='shuffle' />
              </button>

              <button className='control-btn' onClick={onPrevious} disabled={!track}>
                <TransportIcon name='previous' />
              </button>

              <button className='control-btn play-pause' onClick={onPlayPause} disabled={!track}>
                <svg className='play-pause-icon' viewBox='0 0 24 24' aria-hidden='true'>
                  {isPlaying ? (
                    <path className='pause-icon-glyph' d='M8 6.5v11M16 6.5v11' />
                  ) : (
                    <>
                      <path
                        className='play-icon-glyph default-play-icon-glyph'
                        d='M8.4 4.6Q7 3.8 7 5.5v13q0 1.7 1.4.9l10.7-6.2q1.9-1.2 0-2.4Z'
                      />
                      <path className='play-icon-glyph vlc-play-icon-glyph' d='M7 4 20 12 7 20Z' />
                    </>
                  )}
                </svg>
              </button>

              <button className='control-btn' onClick={onNext} disabled={!track}>
                <TransportIcon name='next' />
              </button>

              <button
                className={`control-btn repeat-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                onClick={handleRepeat}
                disabled={!track}
              >
                <TransportIcon name={getRepeatIcon()} />
              </button>
            </div>

            {/* Android: Apple Music-style inline volume row */}
            {androidApp && (
              <div className='np-android-volume'>
                <span className='material-symbols-outlined np-android-volume-icon' aria-hidden='true'>
                  {volume === 0 ? 'volume_off' : volume < 0.5 ? 'volume_down' : 'volume_up'}
                </span>
                <input
                  aria-label='Volume'
                  type='range'
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => onVolumeChange(event.currentTarget.valueAsNumber)}
                  className='np-android-volume-slider'
                  style={volumeSliderStyle}
                />
                <span className='material-symbols-outlined np-android-volume-icon' aria-hidden='true'>
                  volume_up
                </span>
              </div>
            )}

            {/* Android: Apple Music-style bottom lyrics and queue actions */}
            {androidApp && (
              <div className='np-android-bottom-actions'>
                <button
                  type='button'
                  className={`np-android-action${showLyrics ? ' active' : ''}`}
                  aria-pressed={showLyrics}
                  aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
                  disabled={!lyricsEnabled || !track?.lyrics?.trim()}
                  onClick={handleLyricsToggle}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>lyrics</span>
                  <span>Lyrics</span>
                </button>
                <button
                  type='button'
                  className={`np-android-action${showPlayQueue ? ' active' : ''}`}
                  aria-pressed={showPlayQueue}
                  aria-label={showPlayQueue ? 'Close play queue' : 'Open play queue'}
                  onClick={() => setShowPlayQueue((visible) => !visible)}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>queue_music</span>
                  <span>Queue</span>
                </button>
              </div>
            )}
          </div>
          {playerWindowMode !== 'normal' && (
            <div className='player-mode-dock'>
              <div className='player-mode-dock-info'>
                <PlayerModeMarquee
                  className='player-mode-dock-title'
                  text={track?.name || 'No Track Selected'}
                />
                <PlayerModeMarquee
                  className='player-mode-dock-subtitle'
                  text={`${track?.artist || 'Unknown Artist'} · ${track?.album || 'Unknown Album'}`}
                />
              </div>
              <div className='player-mode-dock-controls'>
                {playerWindowMode !== 'mini' && (
                  <button
                    type='button'
                    className={`control-btn shuffle-btn ${isShuffled ? 'active' : ''}`}
                    aria-label='Toggle shuffle'
                    aria-pressed={isShuffled}
                    onClick={handleShuffle}
                    disabled={!track}
                  >
                    <TransportIcon name='shuffle' />
                  </button>
                )}
                <button
                  type='button'
                  className='control-btn'
                  aria-label='Previous track'
                  onClick={onPrevious}
                  disabled={!track}
                >
                  <TransportIcon name='previous' />
                </button>
                <button
                  type='button'
                  className='control-btn play-pause'
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  onClick={onPlayPause}
                  disabled={!track}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {isPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>
                <button
                  type='button'
                  className='control-btn'
                  aria-label='Next track'
                  onClick={onNext}
                  disabled={!track}
                >
                  <TransportIcon name='next' />
                </button>
                {playerWindowMode !== 'mini' && (
                  <button
                    type='button'
                    className={`control-btn repeat-btn ${repeatMode !== 'off' ? 'active' : ''}`}
                    aria-label='Toggle repeat'
                    aria-pressed={repeatMode !== 'off'}
                    onClick={handleRepeat}
                    disabled={!track}
                  >
                    <TransportIcon name={getRepeatIcon()} />
                  </button>
                )}
                {lyricsEnabled && hasSyncedLyrics && (
                  <button
                    type='button'
                    className={`control-btn ${showLyrics ? 'active' : ''}`}
                    aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
                    aria-pressed={showLyrics}
                    onClick={handleLyricsToggle}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      lyrics
                    </span>
                  </button>
                )}
              </div>
              <button type='button' className='player-mode-exit' onClick={onExitPlayerMode}>
                <span className='material-symbols-outlined' aria-hidden='true'>
                  close_fullscreen
                </span>
              </button>
              <div className='player-mode-dock-progress mini-progress-container'>
                <span className='mini-time'>{formatTime(currentTime)}</span>
                <div className='mini-progress-input-wrap'>
                  <div className='mini-progress-track' aria-hidden='true'>
                    <div
                      className='mini-progress-track-fill'
                      ref={(element) => {
                        seekbarFillRefs.current[1] = element;
                      }}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <input
                    aria-label='Track progress'
                    className='mini-progress-bar'
                    ref={(element) => {
                      seekbarInputRefs.current[0] = element;
                    }}
                    type='range'
                    min={0}
                    max={duration || 0}
                    step={0.1}
                    value={Math.min(currentTime, duration)}
                    onChange={(event) => seekTo(event.currentTarget.valueAsNumber)}
                    disabled={!track}
                  />
                </div>
                <span className='mini-time'>{formatTime(duration)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsed View - Mini Player */}
        <div
          ref={miniPlayerRef}
          className={`mini-player ${isMiniSyncedLyricsVisible ? 'showing-mini-lyrics' : ''}`}
          onPointerDown={handleDragStart}
          aria-hidden={state === 'expanded'}
          data-playback-state={isPlaying ? 'playing' : 'paused'}
        >
          <div
            className={`track-info-mini ${isMiniSyncedLyricsVisible ? 'showing-mini-lyrics' : ''}`}
            role='button'
            tabIndex={state === 'expanded' ? -1 : 0}
            aria-label='Expand player'
            onClick={handleAlbumArtClick}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              handleAlbumArtClick();
            }}
          >
            <div className='album-art-mini'>
              {!trackArtworkUrl && <div className='default-art-mini'>{DEFAULT_ALBUM_ART}</div>}
              <TrackImageCrossfade
                src={trackArtworkUrl ?? null}
                alt={track?.album ?? ''}
                className='album-art-mini-crossfade'
              />
            </div>
            <div className='mini-track-info-copy'>
              <div className='text-info'>
                <span className='track-name-mini'>{track?.name || 'No Track'}</span>
                <span className='artist-name-mini'>{track?.artist || 'Unknown'}</span>
              </div>
            </div>
          </div>

          {/* Mini Progress Bar */}
          <div className='mini-progress-container'>
            <span className='mini-time'>{formatTime(currentTime)}</span>
            <div className='mini-progress-input-wrap'>
              <div className='mini-progress-track' aria-hidden='true'>
                <div
                  className='mini-progress-track-fill'
                  ref={(element) => {
                    seekbarFillRefs.current[2] = element;
                  }}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                aria-label='Track progress'
                className='mini-progress-bar'
                ref={(element) => {
                  seekbarInputRefs.current[1] = element;
                }}
                type='range'
                min={0}
                max={duration || 0}
                step={0.1}
                value={Math.min(currentTime, duration)}
                onChange={(e) => seekTo(e.currentTarget.valueAsNumber)}
                disabled={!track}
              />
            </div>
            <span className='mini-time'>{formatTime(duration)}</span>
          </div>

          {/* Controls */}
          <div
            className={`mini-player-control-cluster ${isMiniSyncedLyricsVisible ? 'showing-mini-lyrics' : ''}`}
          >
            {isMiniSyncedLyricsVisible ? (
              <MiniSyncedLyrics text={currentSyncedLyricText} />
            ) : (
              <div className='controls'>
                {!isCompactPlayBar && shuffleControl}
                <button className='control-btn' onClick={onPrevious} disabled={!track}>
                  <TransportIcon name='previous' />
                </button>
                <button className='control-btn play-pause' onClick={onPlayPause} disabled={!track}>
                  <svg className='play-pause-icon' viewBox='0 0 24 24' aria-hidden='true'>
                    {isPlaying ? (
                      <path className='pause-icon-glyph' d='M8 6.5v11M16 6.5v11' />
                    ) : (
                      <>
                        <path
                          className='play-icon-glyph default-play-icon-glyph'
                          d='M8.4 4.6Q7 3.8 7 5.5v13q0 1.7 1.4.9l10.7-6.2q1.9-1.2 0-2.4Z'
                        />
                        <path
                          className='play-icon-glyph vlc-play-icon-glyph'
                          d='M7 4 20 12 7 20Z'
                        />
                      </>
                    )}
                  </svg>
                </button>
                <button className='control-btn' onClick={onNext} disabled={!track}>
                  <TransportIcon name='next' />
                </button>
                {!isCompactPlayBar && repeatControl}
              </div>
            )}
          </div>

          <div className='mini-player-actions'>
            <div className='mini-lyrics-transport' aria-hidden={!isMiniSyncedLyricsVisible}>
              <button
                type='button'
                className='control-btn mini-lyrics-transport-btn'
                aria-label='Previous track'
                onClick={(event) => {
                  event.stopPropagation();
                  onPrevious();
                }}
                disabled={!track || !isMiniSyncedLyricsVisible}
                tabIndex={isMiniSyncedLyricsVisible ? 0 : -1}
              >
                <TransportIcon name='previous' />
              </button>
              <button
                type='button'
                className='control-btn mini-lyrics-transport-btn play-pause'
                aria-label={isPlaying ? 'Pause' : 'Play'}
                onClick={(event) => {
                  event.stopPropagation();
                  onPlayPause();
                }}
                disabled={!track || !isMiniSyncedLyricsVisible}
                tabIndex={isMiniSyncedLyricsVisible ? 0 : -1}
              >
                <svg className='play-pause-icon' viewBox='0 0 24 24' aria-hidden='true'>
                  {isPlaying ? (
                    <path className='pause-icon-glyph' d='M8 6.5v11M16 6.5v11' />
                  ) : (
                    <>
                      <path
                        className='play-icon-glyph default-play-icon-glyph'
                        d='M8.4 4.6Q7 3.8 7 5.5v13q0 1.7 1.4.9l10.7-6.2q1.9-1.2 0-2.4Z'
                      />
                      <path className='play-icon-glyph vlc-play-icon-glyph' d='M7 4 20 12 7 20Z' />
                    </>
                  )}
                </svg>
              </button>
              <button
                type='button'
                className='control-btn mini-lyrics-transport-btn'
                aria-label='Next track'
                onClick={(event) => {
                  event.stopPropagation();
                  onNext();
                }}
                disabled={!track || !isMiniSyncedLyricsVisible}
                tabIndex={isMiniSyncedLyricsVisible ? 0 : -1}
              >
                <TransportIcon name='next' />
              </button>
            </div>
            {lyricsEnabled &&
              showSyncedLyricsOnPlayBar &&
              hasSyncedLyrics &&
              showInlineLyricsControl &&
              renderLyricsControl(false)}
            {showInlineVolumeControl && renderVolumeControl(false)}
            {hasOverflowControls && (
              <div className='more-options'>
                <button
                  aria-label='More options'
                  aria-expanded={showOptionsMenu}
                  className='control-btn more-options-button'
                  onClick={() => {
                    setShowOptionsMenu(!showOptionsMenu);
                    setShowVolumeSlider(false);
                  }}
                >
                  <span className='material-symbols-outlined'>menu</span>
                </button>
                {showOptionsMenu && (
                  <div className='more-options-menu'>
                    {isCompactPlayBar && (
                      <>
                        <button
                          aria-pressed={isShuffled}
                          className='more-options-item'
                          onClick={handleShuffle}
                          disabled={!track}
                        >
                          <TransportIcon name='shuffle' />
                          <span>Shuffle</span>
                        </button>
                        <button
                          aria-pressed={repeatMode !== 'off'}
                          className='more-options-item'
                          onClick={handleRepeat}
                          disabled={!track}
                        >
                          <TransportIcon name={getRepeatIcon()} />
                          <span>
                            Repeat:{' '}
                            {repeatMode === 'off' ? 'Off' : repeatMode === 'one' ? 'One' : 'All'}
                          </span>
                        </button>
                      </>
                    )}
                    {lyricsEnabled &&
                      showSyncedLyricsOnPlayBar &&
                      hasSyncedLyrics &&
                      !showInlineLyricsControl &&
                      renderLyricsControl(true)}
                    {!showInlineVolumeControl && renderVolumeControl(true)}
                    {isDesktopApp && !showInlineMiniPlayerControl && (
                      <button
                        type='button'
                        className='more-options-item'
                        aria-label='Enter mini player mode'
                        onClick={onEnterMiniPlayer}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          picture_in_picture_alt
                        </span>
                        <span>Mini player</span>
                      </button>
                    )}
                    {isDesktopApp && !showInlineFullscreenPlayerControl && (
                      <button
                        type='button'
                        className='more-options-item'
                        aria-label='Enter fullscreen player mode'
                        onClick={onEnterFullscreenPlayer}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>
                          fullscreen
                        </span>
                        <span>Fullscreen player</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {isDesktopApp && (
              <>
                {showInlineMiniPlayerControl && (
                  <button
                    type='button'
                    className='control-btn player-mode-entry'
                    aria-label='Enter mini player mode'
                    title='Enter mini player mode'
                    onClick={onEnterMiniPlayer}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      picture_in_picture_alt
                    </span>
                  </button>
                )}
                {showInlineFullscreenPlayerControl && (
                  <button
                    type='button'
                    className='control-btn player-mode-entry'
                    aria-label='Enter fullscreen player mode'
                    title='Enter fullscreen player mode'
                    onClick={onEnterFullscreenPlayer}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      fullscreen
                    </span>
                  </button>
                )}
              </>
            )}
            <button
              className='control-btn expand-btn'
              onClick={handleAlbumArtClick}
              aria-label='Expand player'
            >
              <span className='material-symbols-outlined'>open_in_full</span>
            </button>
          </div>
        </div>
      </div>
      {confirmTrackDeletion &&
        createPortal(
          <div
            ref={trackDeletionBackdropRef}
            className='track-delete-confirm-backdrop'
            role='presentation'
          >
            <section
              className='track-delete-confirm-dialog'
              role='alertdialog'
              aria-modal='true'
              aria-labelledby='track-delete-confirm-title'
              aria-describedby='track-delete-confirm-description'
            >
              <span
                className='material-symbols-outlined track-delete-confirm-icon'
                aria-hidden='true'
              >
                delete_forever
              </span>
              <h2 id='track-delete-confirm-title'>Remove track from library?</h2>
              <p id='track-delete-confirm-description'>
                Remove <strong>{confirmTrackDeletion.name}</strong> from Luna’s library and active
                queue? The audio file itself will not be deleted.
              </p>
              <div className='track-delete-confirm-actions'>
                <button
                  type='button'
                  className='track-delete-confirm-cancel'
                  ref={deleteConfirmationCancelRef}
                  onClick={() => setConfirmTrackDeletion(null)}
                >
                  Cancel
                </button>
                <button
                  type='button'
                  className='track-delete-confirm-remove'
                  onClick={() => {
                    onDeleteTrackFromLibrary?.(confirmTrackDeletion);
                    setConfirmTrackDeletion(null);
                  }}
                >
                  Remove from library
                </button>
              </div>
            </section>
          </div>,
          document.body
        )}
    </>
  );
};

export default PlayBar;

