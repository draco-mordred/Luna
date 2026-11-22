import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Playlist, SyncedLyricLine, Track } from '../../services/MusicLibrary';
import AudioOutputSelector from './AudioOutputSelector';
import { PlayPauseIcon, TransportIcon } from './PlaybackControlIcons';
import './AndroidNowPlaying.css';

export type AndroidTrackMenuAction =
  | 'delete'
  | 'playlist'
  | 'album'
  | 'artist'
  | 'love'
  | 'less'
  | 'queue'
  | 'next'
  | 'share'
  | 'artistPlaylist';

export interface AndroidTrackMenuItem {
  label: string;
  icon: string;
  action: AndroidTrackMenuAction;
}

const ANDROID_NOW_PLAYING_INLINE_QUEUE_QUERY =
  '(max-width: 600px) and (orientation: portrait), (orientation: landscape) and (max-width: 1200px) and (max-height: 600px), (min-width: 600px)';
const ANDROID_NOW_PLAYING_LANDSCAPE_QUEUE_QUERY =
  '(orientation: landscape) and (max-width: 1200px) and (max-height: 600px)';
const ANDROID_NOW_PLAYING_PORTRAIT_QUERY = '(orientation: portrait)';
const ANDROID_NOW_PLAYING_QUEUE_TRANSITION_MS = 730;
const ANDROID_NOW_PLAYING_QUEUE_ROW_TRANSITION_MS = 320;
const ANDROID_NOW_PLAYING_MENU_TRANSITION_MS = 180;

const AndroidNowPlayingMarquee = ({ text }: { text: string }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLSpanElement>(null);
  const [overflowDistance, setOverflowDistance] = useState(0);
  const [marqueeDuration, setMarqueeDuration] = useState(8);

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return undefined;

    let frame = 0;
    const measureOverflow = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const textWidth = content.firstElementChild?.getBoundingClientRect().width ?? 0;
        const distance = Math.max(0, textWidth - container.clientWidth);
        setOverflowDistance(distance);
        setMarqueeDuration(Math.max(8, textWidth / 24));
      });
    };

    const observer = new ResizeObserver(measureOverflow);
    observer.observe(container);
    observer.observe(content);
    measureOverflow();
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [text]);

  const marqueeStyle: CSSProperties & { '--anp-marquee-duration': string } = {
    '--anp-marquee-duration': `${marqueeDuration}s`,
  };

  return (
    <span
      ref={containerRef}
      className={`android-now-playing-marquee${overflowDistance > 0 ? ' is-overflowing' : ''}`}
      title={text}
    >
      <span ref={contentRef} className='android-now-playing-marquee-track' style={marqueeStyle}>
        <span>{text}</span>
        {overflowDistance > 0 && <span aria-hidden='true'>{text}</span>}
      </span>
    </span>
  );
};

interface AndroidNowPlayingProps {
  track?: Track | null;
  artwork: ReactNode;
  isPlaying: boolean;
  isLoved: boolean;
  canToggleLove: boolean;
  onToggleLove: () => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  currentTime: number;
  duration: number;
  progressPercent: number;
  formatTime: (seconds: number) => string;
  durationTimeLabel: string;
  durationTimeAction: string;
  onSeek: (time: number) => void;
  onToggleDuration: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
  isAutoplayEnabled: boolean;
  onToggleAutoplay: () => void;
  lyricsAvailable: boolean;
  showLyrics: boolean;
  lyricsText: string;
  plainLyricsText: string;
  syncedLyrics: SyncedLyricLine[];
  currentSyncedLyricIndex: number;
  showSyncedLyrics: boolean;
  onToggleLyrics: () => void;
  onToggleSyncedLyrics: () => void;
  onCloseLyrics: () => void;
  showPlayQueue: boolean;
  playQueue: Track[];
  onTogglePlayQueue: () => void;
  onClosePlayQueue: () => void;
  renderQueueItem: (track: Track, index: number) => ReactNode;
  playQueueIndex: number;
  onClearQueue: () => void;
  onAddSongsToQueue: () => void;
  trackMenuItems: AndroidTrackMenuItem[];
  onTrackMenuAction: (action: AndroidTrackMenuAction) => void;
  playlists: Playlist[];
  onAddTrackToPlaylist: (playlistId?: string) => void;
  audioOutputDeviceId: string;
  onAudioOutputDeviceChange: (deviceId: string) => Promise<void>;
}

const AndroidNowPlaying = ({
  track,
  artwork,
  isPlaying,
  isLoved,
  canToggleLove,
  onToggleLove,
  onPlayPause,
  onPrevious,
  onNext,
  currentTime,
  duration,
  progressPercent,
  formatTime,
  durationTimeLabel,
  durationTimeAction,
  onSeek,
  onToggleDuration,
  volume,
  onVolumeChange,
  onMuteToggle,
  isShuffled,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  isAutoplayEnabled,
  onToggleAutoplay,
  lyricsAvailable,
  showLyrics,
  lyricsText,
  plainLyricsText,
  syncedLyrics,
  currentSyncedLyricIndex,
  showSyncedLyrics,
  onToggleLyrics,
  onToggleSyncedLyrics,
  onCloseLyrics,
  showPlayQueue,
  playQueue,
  onTogglePlayQueue,
  onClosePlayQueue,
  renderQueueItem,
  playQueueIndex,
  onClearQueue,
  onAddSongsToQueue,
  trackMenuItems,
  onTrackMenuAction,
  playlists,
  onAddTrackToPlaylist,
  audioOutputDeviceId,
  onAudioOutputDeviceChange,
}: AndroidNowPlayingProps) => {
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [isMoreMenuMounted, setIsMoreMenuMounted] = useState(false);
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [isInlineQueue, setIsInlineQueue] = useState(
    () => window.matchMedia(ANDROID_NOW_PLAYING_INLINE_QUEUE_QUERY).matches
  );
  const [isLandscapeQueue, setIsLandscapeQueue] = useState(
    () => window.matchMedia(ANDROID_NOW_PLAYING_LANDSCAPE_QUEUE_QUERY).matches
  );
  const [isPortraitLayout, setIsPortraitLayout] = useState(
    () => window.matchMedia(ANDROID_NOW_PLAYING_PORTRAIT_QUERY).matches
  );
  const [isPortraitQueueClosing, setIsPortraitQueueClosing] = useState(false);
  const isQueueLayoutOpen = showPlayQueue || (isPortraitLayout && isPortraitQueueClosing);
  const isQueueClosing = isPortraitLayout && isPortraitQueueClosing && !showPlayQueue;
  const isPortraitLyricsOpen =
    showLyrics && lyricsAvailable && isPortraitLayout && !isQueueLayoutOpen;
  const hasPlainLyrics = Boolean(plainLyricsText.trim());
  const canSwitchLyricsMode = syncedLyrics.length > 0 && hasPlainLyrics;
  const lyricsToggleLabel = !showLyrics
    ? 'Show lyrics'
    : canSwitchLyricsMode && showSyncedLyrics
      ? 'Switch to plain lyrics'
      : 'Hide lyrics';
  const currentSyncedLyricTime = syncedLyrics[currentSyncedLyricIndex]?.time;
  const isMoreMenuClosing = isMoreMenuMounted && !moreMenuOpen;
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuElementRef = useRef<HTMLDivElement>(null);
  const queueScrollRef = useRef<HTMLDivElement>(null);
  const lyricsScrollRef = useRef<HTMLDivElement>(null);
  const activeSyncedLyricRef = useRef<HTMLParagraphElement>(null);
  const previousQueueRowPositionsRef = useRef(new Map<number, number>());
  const previousPlayQueueIndexRef = useRef(playQueueIndex);
  const previousQueueLayoutOpenRef = useRef(false);
  const volumeStyle: CSSProperties & { '--anp-volume-level': string } = {
    '--anp-volume-level': `${volume * 100}%`,
  };
  const autoplayButton = (
    <button
      type='button'
      className={`android-now-playing-autoplay android-now-playing-queue-mode-autoplay${isAutoplayEnabled ? ' is-active' : ''}`}
      aria-label={isAutoplayEnabled ? 'Turn AutoPlay off' : 'Turn AutoPlay on'}
      aria-pressed={isAutoplayEnabled}
      title={isAutoplayEnabled ? 'Turn AutoPlay off' : 'Turn AutoPlay on'}
      onClick={onToggleAutoplay}
    >
      <span className='material-symbols-outlined' aria-hidden='true'>
        all_inclusive
      </span>
    </button>
  );
  const renderQueueFooterActions = () => (
    <div className='android-now-playing-queue-footer-actions'>
      <button
        type='button'
        className={`android-now-playing-bottom-action${showLyrics ? ' is-active' : ''}`}
        aria-label={lyricsToggleLabel}
        aria-pressed={showLyrics}
        disabled={!lyricsAvailable}
        onClick={onToggleLyrics}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          lyrics
        </span>
      </button>
      <button
        type='button'
        className={`android-now-playing-bottom-action${showPlayQueue ? ' is-active' : ''}`}
        aria-label={showPlayQueue ? 'Close play queue' : 'Open play queue'}
        aria-pressed={showPlayQueue}
        onClick={togglePlayQueue}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          queue_music
        </span>
        {repeatMode !== 'off' && (
          <span className='android-now-playing-repeat-badge' aria-hidden='true'>
            <span className='material-symbols-outlined'>
              {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
            </span>
          </span>
        )}
      </button>
    </div>
  );

  useEffect(() => {
    if (moreMenuOpen || !isMoreMenuMounted) return undefined;

    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : ANDROID_NOW_PLAYING_MENU_TRANSITION_MS;
    const timeout = window.setTimeout(() => setIsMoreMenuMounted(false), duration);
    return () => window.clearTimeout(timeout);
  }, [isMoreMenuMounted, moreMenuOpen]);

  useEffect(() => {
    if (!moreMenuOpen) return undefined;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !moreMenuRef.current?.contains(event.target) &&
        !moreMenuElementRef.current?.contains(event.target)
      ) {
        setMoreMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [moreMenuOpen]);

  useLayoutEffect(() => {
    if (!moreMenuOpen) return undefined;

    const menu = moreMenuElementRef.current;
    const trigger = moreMenuRef.current?.querySelector<HTMLButtonElement>(
      '.android-now-playing-icon-button'
    );
    const screen = moreMenuRef.current?.closest<HTMLElement>('.android-now-playing-screen');
    const content = screen?.querySelector<HTMLElement>('.android-now-playing-content');
    const controlPanel = screen?.querySelector<HTMLElement>('.android-now-playing-control-panel');
    if (!menu || !trigger || !screen || !content || !controlPanel) return undefined;

    const updateMenuPosition = () => {
      const screenBounds = screen.getBoundingClientRect();
      const contentBounds = content.getBoundingClientRect();
      const panelBounds = controlPanel.getBoundingClientRect();
      const triggerBounds = trigger.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
      const viewportHeight = window.innerHeight;
      const edgeInset = Math.min(12, Math.max(4, contentBounds.width * 0.02));
      const triggerGap = 8;
      const topBoundary = Math.max(
        edgeInset,
        screenBounds.top + edgeInset,
        contentBounds.top + edgeInset
      );
      const bottomBoundary = Math.min(
        viewportHeight - edgeInset,
        screenBounds.bottom - edgeInset,
        contentBounds.bottom - edgeInset
      );
      const leftBoundary = Math.max(
        edgeInset,
        screenBounds.left + edgeInset,
        contentBounds.left + edgeInset,
        panelBounds.left + 4
      );
      const rightBoundary = Math.min(
        viewportWidth - edgeInset,
        screenBounds.right - edgeInset,
        contentBounds.right - edgeInset,
        panelBounds.right - 4
      );
      const availableWidth = rightBoundary - leftBoundary;
      const maxMenuHeight = Math.min(360, contentBounds.height * 0.4);
      const maxHeight = Math.min(maxMenuHeight, bottomBoundary - topBoundary);
      if (availableWidth <= 0 || maxHeight <= 0) return;

      const menuWidth = Math.min(256, contentBounds.width * 0.4, availableWidth);
      if (menuWidth <= 0) return;
      const menuScale = Math.min(1, menuWidth / 256, maxHeight / 360);
      menu.style.setProperty('--anp-menu-scale', `${menuScale}`);
      menu.style.width = `${menuWidth}px`;
      menu.style.maxHeight = `${maxHeight}px`;

      const spaceAbove = Math.max(0, triggerBounds.top - topBoundary - triggerGap);
      const spaceBelow = Math.max(0, bottomBoundary - triggerBounds.bottom - triggerGap);
      const desiredHeight = Math.min(menu.scrollHeight, maxHeight);
      const openBelow = spaceBelow >= desiredHeight || spaceBelow >= spaceAbove;
      const availableHeight = openBelow ? spaceBelow : spaceAbove;
      menu.style.maxHeight = `${Math.min(maxHeight, availableHeight)}px`;

      const menuHeight = Math.min(menu.offsetHeight, availableHeight);
      menu.dataset.placement = openBelow ? 'below' : 'above';
      const top = openBelow
        ? triggerBounds.bottom + triggerGap
        : triggerBounds.top - triggerGap - menuHeight;
      const left = Math.min(
        Math.max(triggerBounds.right - menuWidth, leftBoundary),
        rightBoundary - menuWidth
      );
      menu.style.left = `${left}px`;
      menu.style.top = `${Math.min(Math.max(top, topBoundary), bottomBoundary - menuHeight)}px`;
    };

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    window.visualViewport?.addEventListener('resize', updateMenuPosition);
    window.visualViewport?.addEventListener('scroll', updateMenuPosition);
    const resizeObserver = new ResizeObserver(updateMenuPosition);
    resizeObserver.observe(screen);
    resizeObserver.observe(content);
    resizeObserver.observe(controlPanel);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
      window.visualViewport?.removeEventListener('resize', updateMenuPosition);
      window.visualViewport?.removeEventListener('scroll', updateMenuPosition);
      resizeObserver.disconnect();
    };
  }, [isMoreMenuMounted, moreMenuOpen, playlistMenuOpen, playlists.length, trackMenuItems.length]);

  useEffect(() => {
    const mediaQuery = window.matchMedia(ANDROID_NOW_PLAYING_INLINE_QUEUE_QUERY);
    const updateQueueLayout = (event: MediaQueryListEvent) => setIsInlineQueue(event.matches);
    mediaQuery.addEventListener('change', updateQueueLayout);
    return () => mediaQuery.removeEventListener('change', updateQueueLayout);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(ANDROID_NOW_PLAYING_LANDSCAPE_QUEUE_QUERY);
    const updateQueueLayout = (event: MediaQueryListEvent) => setIsLandscapeQueue(event.matches);
    mediaQuery.addEventListener('change', updateQueueLayout);
    return () => mediaQuery.removeEventListener('change', updateQueueLayout);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(ANDROID_NOW_PLAYING_PORTRAIT_QUERY);
    const updateQueueLayout = (event: MediaQueryListEvent) => setIsPortraitLayout(event.matches);
    mediaQuery.addEventListener('change', updateQueueLayout);
    return () => mediaQuery.removeEventListener('change', updateQueueLayout);
  }, []);

  useEffect(() => {
    if (!isPortraitLyricsOpen || !showSyncedLyrics) return;

    const container = lyricsScrollRef.current;
    const activeLine = activeSyncedLyricRef.current;
    if (!container || !activeLine) return;

    const containerBounds = container.getBoundingClientRect();
    const activeLineBounds = activeLine.getBoundingClientRect();
    const activeLineTop = container.scrollTop + activeLineBounds.top - containerBounds.top;
    const scrollTop = Math.max(0, activeLineTop - container.clientHeight * 0.24);
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'auto'
      : 'smooth';
    container.scrollTo({ top: scrollTop, behavior });
  }, [currentSyncedLyricIndex, isPortraitLyricsOpen, showSyncedLyrics, track?.id]);

  useEffect(() => {
    if (!isPortraitQueueClosing) return undefined;
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 1
      : ANDROID_NOW_PLAYING_QUEUE_TRANSITION_MS;
    const timeout = window.setTimeout(() => setIsPortraitQueueClosing(false), duration);
    return () => window.clearTimeout(timeout);
  }, [isPortraitQueueClosing]);

  const togglePlayQueue = () => {
    setIsPortraitQueueClosing(isPortraitLayout && showPlayQueue);
    onTogglePlayQueue();
  };
  const closePlayQueue = () => {
    setIsPortraitQueueClosing(isPortraitLayout && showPlayQueue);
    onClosePlayQueue();
  };

  const captureQueueRowPositions = () => {
    const scrollContainer = queueScrollRef.current;
    if (!scrollContainer) return;
    previousQueueRowPositionsRef.current = new Map(
      Array.from(scrollContainer.querySelectorAll<HTMLElement>('[data-queue-index]')).map((row) => [
        Number(row.dataset.queueIndex),
        row.getBoundingClientRect().top,
      ])
    );
  };

  useLayoutEffect(() => {
    const scrollContainer = queueScrollRef.current;
    const wasOpen = previousQueueLayoutOpenRef.current;
    const previousIndex = previousPlayQueueIndexRef.current;
    const indexChanged = previousIndex !== playQueueIndex;

    if (!scrollContainer || !isQueueLayoutOpen) {
      previousQueueRowPositionsRef.current.clear();
    } else {
      const historyLastRow = scrollContainer
        .querySelector<HTMLElement>('.android-now-playing-queue-history')
        ?.querySelector<HTMLElement>('.anp-queue-item:last-child');
      if (!wasOpen || indexChanged) {
        if (historyLastRow) {
          scrollContainer.scrollTop = Math.max(
            0,
            scrollContainer.scrollTop +
              historyLastRow.getBoundingClientRect().top -
              scrollContainer.getBoundingClientRect().top
          );
        } else {
          scrollContainer.scrollTop = 0;
        }
      }

      const queueRows = Array.from(
        scrollContainer.querySelectorAll<HTMLElement>('[data-queue-index]')
      );
      const currentPositions = new Map(
        queueRows.map((row) => [Number(row.dataset.queueIndex), row.getBoundingClientRect().top])
      );
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (wasOpen && indexChanged && !reducedMotion) {
        queueRows.forEach((row) => {
          const index = Number(row.dataset.queueIndex);
          const previousTop = previousQueueRowPositionsRef.current.get(index);
          const currentTop = currentPositions.get(index);

          if (previousTop !== undefined && currentTop !== undefined) {
            const offset = previousTop - currentTop;
            if (Math.abs(offset) > 1) {
              row.animate(
                [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
                {
                  duration: ANDROID_NOW_PLAYING_QUEUE_ROW_TRANSITION_MS,
                  easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
                }
              );
            }
          } else if (
            playQueueIndex > previousIndex &&
            index >= previousIndex &&
            index < playQueueIndex &&
            row.closest('.android-now-playing-queue-history')
          ) {
            row.animate(
              [
                { opacity: 0, transform: 'translateY(-14px)' },
                { opacity: 1, transform: 'translateY(0)' },
              ],
              {
                duration: ANDROID_NOW_PLAYING_QUEUE_ROW_TRANSITION_MS,
                easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
              }
            );
          }
        });
      }

      previousQueueRowPositionsRef.current = currentPositions;
    }

    previousPlayQueueIndexRef.current = playQueueIndex;
    previousQueueLayoutOpenRef.current = isQueueLayoutOpen;
  }, [isQueueLayoutOpen, playQueue, playQueueIndex]);

  const renderQueueHistory = () =>
    playQueueIndex > 0 ? (
      <section className='anp-queue-section android-now-playing-queue-history'>
        <h3>History</h3>
        <ol className='anp-queue-list'>
          {playQueue
            .slice(0, playQueueIndex)
            .map((queuedTrack, index) => renderQueueItem(queuedTrack, index))}
        </ol>
      </section>
    ) : null;

  const renderUpcomingQueue = () =>
    playQueueIndex + 1 < playQueue.length ? (
      <ol className='anp-queue-list'>
        {playQueue
          .slice(playQueueIndex + 1)
          .map((queuedTrack, offset) => renderQueueItem(queuedTrack, playQueueIndex + offset + 1))}
      </ol>
    ) : (
      <p className='android-now-playing-empty-queue'>No upcoming tracks.</p>
    );

  const lyricsSection = isPortraitLyricsOpen ? (
    <section className='android-now-playing-lyrics-content' aria-label='Lyrics'>
      {showSyncedLyrics && syncedLyrics.length > 0 ? (
        <div
          ref={lyricsScrollRef}
          className='android-now-playing-lyrics-scroll is-synced'
          dir='auto'
        >
          {syncedLyrics.map((line, index) => {
            const isActive =
              currentSyncedLyricTime !== undefined &&
              Math.abs(line.time - currentSyncedLyricTime) < 0.001;
            const isPast =
              currentSyncedLyricTime !== undefined && line.time < currentSyncedLyricTime;

            return (
              <p
                key={`${line.time}-${index}`}
                ref={index === currentSyncedLyricIndex ? activeSyncedLyricRef : null}
                className={`android-now-playing-synced-line${isActive ? ' is-active' : ''}${isPast ? ' is-past' : ' is-upcoming'}`}
                aria-current={isActive ? 'true' : undefined}
              >
                {line.text || ' '}
              </p>
            );
          })}
        </div>
      ) : (
        <div
          ref={lyricsScrollRef}
          className='android-now-playing-lyrics-scroll is-plain'
          dir='auto'
        >
          <p className='android-now-playing-plain-lyrics'>
            {plainLyricsText || lyricsText || 'Lyrics are not available for this track.'}
          </p>
        </div>
      )}
    </section>
  ) : null;

  const progressSection = (
    <div className='android-now-playing-progress' aria-hidden={isPortraitLyricsOpen}>
      <div className='mini-progress-input-wrap android-now-playing-progress-input-wrap'>
        <div className='mini-progress-track' aria-hidden='true'>
          <div
            className='mini-progress-track-fill'
            style={{
              width: `${Math.max(0, Math.min(100, progressPercent))}%`,
            }}
          />
        </div>
        <input
          type='range'
          className='mini-progress-bar'
          aria-label='Track progress'
          min={0}
          max={Math.max(duration, 1)}
          step={0.1}
          value={duration > 0 ? Math.min(currentTime, duration) : 0}
          disabled={!track || duration <= 0}
          onChange={(event) => onSeek(event.currentTarget.valueAsNumber)}
        />
      </div>
      <div className='android-now-playing-time-row'>
        <span>{formatTime(currentTime)}</span>
        <button
          type='button'
          aria-label={durationTimeAction}
          aria-pressed={durationTimeLabel.startsWith('-')}
          disabled={!track || duration <= 0}
          onClick={onToggleDuration}
        >
          {durationTimeLabel}
        </button>
      </div>
    </div>
  );

  const selectTrackMenuAction = (action: AndroidTrackMenuAction) => {
    setMoreMenuOpen(false);
    setPlaylistMenuOpen(false);
    onTrackMenuAction(action);
  };

  return (
    <div
      className={`android-now-playing-screen${isQueueLayoutOpen ? ' is-queue-open' : ''}${isQueueClosing ? ' is-queue-closing' : ''}${isPortraitLyricsOpen ? ' is-lyrics-open' : ''}${isPortraitLyricsOpen && showSyncedLyrics && syncedLyrics.length > 0 ? ' is-synced-lyrics' : ''}`}
      data-playback-state={isPlaying ? 'playing' : 'paused'}
      aria-label='Now Playing'
    >
      <div className='android-now-playing-backdrop' aria-hidden='true'>
        {artwork || (
          <div className='android-now-playing-default-art'>
            <span className='material-symbols-outlined'>album</span>
          </div>
        )}
        <div className='android-now-playing-backdrop-tint' />
        <div className='android-now-playing-backdrop-blur' />
      </div>
      <div className='android-now-playing-landscape-art' aria-hidden='true'>
        {artwork || (
          <div className='android-now-playing-default-art'>
            <span className='material-symbols-outlined'>album</span>
          </div>
        )}
      </div>

      <main className='android-now-playing-content'>
        <div className='android-now-playing-control-panel'>
          <div className='android-now-playing-track-row'>
            {((isQueueLayoutOpen && isInlineQueue) || isPortraitLyricsOpen) && (
              <div className='android-now-playing-queue-current-art' aria-hidden='true'>
                {artwork || (
                  <div className='android-now-playing-default-art'>
                    <span className='material-symbols-outlined'>album</span>
                  </div>
                )}
              </div>
            )}
            <div className='android-now-playing-track-copy'>
              <h1>
                <AndroidNowPlayingMarquee text={track?.name || 'No Track Selected'} />
              </h1>
              <p>
                <AndroidNowPlayingMarquee text={track?.artist || 'Unknown Artist'} />
              </p>
            </div>
            <div className='android-now-playing-track-actions'>
              <button
                type='button'
                className={`android-now-playing-icon-button${isLoved ? ' is-active' : ''}`}
                aria-label={isLoved ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={isLoved}
                disabled={!track || !canToggleLove}
                onClick={onToggleLove}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {isLoved ? 'star' : 'star_outline'}
                </span>
              </button>
              <div className='android-now-playing-more' ref={moreMenuRef}>
                <button
                  type='button'
                  className='android-now-playing-icon-button'
                  aria-label={`More options for ${track?.name || 'track'}`}
                  aria-haspopup='menu'
                  aria-expanded={moreMenuOpen}
                  disabled={!track}
                  onClick={() => {
                    if (!moreMenuOpen) setIsMoreMenuMounted(true);
                    setMoreMenuOpen((open) => !open);
                  }}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    more_horiz
                  </span>
                </button>
                {isMoreMenuMounted &&
                  createPortal(
                    <div
                      ref={moreMenuElementRef}
                      className={`android-now-playing-more-menu ${
                        isMoreMenuClosing ? 'is-closing' : 'is-open'
                      }`}
                      role='menu'
                      aria-label='Track options'
                      aria-hidden={!moreMenuOpen}
                    >
                      {lyricsAvailable && syncedLyrics.length > 0 && plainLyricsText.trim() && (
                        <button
                          type='button'
                          role='menuitemcheckbox'
                          aria-checked={showSyncedLyrics}
                          onClick={() => {
                            setMoreMenuOpen(false);
                            onToggleSyncedLyrics();
                          }}
                        >
                          <span className='material-symbols-outlined' aria-hidden='true'>
                            timelapse
                          </span>
                          <span>
                            {showSyncedLyrics
                              ? 'Switch to plain lyrics'
                              : 'Switch to synced lyrics'}
                          </span>
                        </button>
                      )}
                      {trackMenuItems.map((item) =>
                        item.action === 'playlist' ? (
                          <div key={item.action}>
                            <button
                              type='button'
                              role='menuitem'
                              aria-expanded={playlistMenuOpen}
                              onClick={() => setPlaylistMenuOpen((open) => !open)}
                            >
                              <span className='material-symbols-outlined' aria-hidden='true'>
                                {item.icon}
                              </span>
                              <span>{item.label}</span>
                              <span className='material-symbols-outlined' aria-hidden='true'>
                                {playlistMenuOpen ? 'expand_less' : 'chevron_right'}
                              </span>
                            </button>
                            {playlistMenuOpen && (
                              <div className='android-now-playing-playlist-menu' role='group'>
                                {playlists.map((playlist) => (
                                  <button
                                    key={playlist.id}
                                    type='button'
                                    role='menuitem'
                                    onClick={() => {
                                      setMoreMenuOpen(false);
                                      setPlaylistMenuOpen(false);
                                      onAddTrackToPlaylist(playlist.id);
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
                                  role='menuitem'
                                  onClick={() => selectTrackMenuAction(item.action)}
                                >
                                  <span className='material-symbols-outlined' aria-hidden='true'>
                                    add
                                  </span>
                                  <span>Create new playlist…</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            key={item.action}
                            type='button'
                            role='menuitem'
                            onClick={() => selectTrackMenuAction(item.action)}
                          >
                            <span className='material-symbols-outlined' aria-hidden='true'>
                              {item.icon}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        )
                      )}
                    </div>,
                    document.body
                  )}
              </div>
            </div>
          </div>

          {isPortraitLyricsOpen && (
            <div className='android-now-playing-lyrics-progress-region'>
              {lyricsSection}
              {progressSection}
            </div>
          )}

          {isQueueLayoutOpen && isInlineQueue && (
            <section className='android-now-playing-queue-inline' aria-label='Play queue'>
              <div className='android-now-playing-queue-modes' aria-label='Playback modes'>
                <button
                  type='button'
                  className={isShuffled ? 'is-active' : ''}
                  aria-label='Toggle shuffle'
                  aria-pressed={isShuffled}
                  disabled={!track}
                  onClick={onToggleShuffle}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    shuffle
                  </span>
                  <span className='android-now-playing-queue-mode-label'>Shuffle</span>
                </button>
                <button
                  type='button'
                  className={repeatMode !== 'off' ? 'is-active' : ''}
                  aria-label='Toggle repeat'
                  aria-pressed={repeatMode !== 'off'}
                  disabled={!track}
                  onClick={onToggleRepeat}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
                  </span>
                  <span className='android-now-playing-queue-mode-label'>Repeat</span>
                </button>
                {autoplayButton}
                <button
                  type='button'
                  className='android-now-playing-add-songs android-now-playing-queue-mode-add-songs'
                  aria-label='Add songs to queue'
                  onClick={() => {
                    closePlayQueue();
                    onAddSongsToQueue();
                  }}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    add
                  </span>
                </button>
              </div>
              <div
                className='android-now-playing-queue-list android-now-playing-queue-scroll'
                ref={queueScrollRef}
                onScroll={captureQueueRowPositions}
              >
                {renderQueueHistory()}
                <section className='anp-queue-section android-now-playing-queue-upcoming'>
                  <div className='android-now-playing-queue-heading'>
                    <h2>Queue</h2>
                    <button type='button' disabled={playQueue.length === 0} onClick={onClearQueue}>
                      Clear
                    </button>
                  </div>
                  {renderUpcomingQueue()}
                </section>
              </div>
              {isLandscapeQueue && (
                <div className='android-now-playing-queue-footer'>
                  {renderQueueFooterActions()}
                </div>
              )}
            </section>
          )}

          {!isPortraitLyricsOpen && progressSection}

          <div className='android-now-playing-controls'>
            <button
              type='button'
              className={`android-now-playing-transport control-btn android-now-playing-tablet-control${isShuffled ? ' is-active' : ''}`}
              aria-label='Toggle shuffle'
              aria-pressed={isShuffled}
              disabled={!track}
              onClick={onToggleShuffle}
            >
              <TransportIcon name='shuffle' />
            </button>
            <button
              type='button'
              className='android-now-playing-transport control-btn'
              aria-label='Previous track'
              disabled={!track}
              onClick={onPrevious}
            >
              <TransportIcon name='previous' />
            </button>
            <button
              type='button'
              className='android-now-playing-play-pause control-btn play-pause'
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!track}
              onClick={onPlayPause}
            >
              <PlayPauseIcon key={isPlaying ? 'playing' : 'paused'} isPlaying={isPlaying} />
            </button>
            <button
              type='button'
              className='android-now-playing-transport control-btn'
              aria-label='Next track'
              disabled={!track}
              onClick={onNext}
            >
              <TransportIcon name='next' />
            </button>
            <button
              type='button'
              className={`android-now-playing-transport control-btn android-now-playing-tablet-control${repeatMode !== 'off' ? ' is-active' : ''}`}
              aria-label='Toggle repeat'
              aria-pressed={repeatMode !== 'off'}
              disabled={!track}
              onClick={onToggleRepeat}
            >
              <TransportIcon name={repeatMode === 'one' ? 'repeat_one' : 'repeat'} />
            </button>
          </div>

          <div className='android-now-playing-volume volume-control'>
            <button
              type='button'
              className='android-now-playing-volume-toggle control-btn mute-btn'
              aria-label={volume === 0 ? 'Unmute' : 'Mute'}
              onClick={onMuteToggle}
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
            </button>
            <input
              type='range'
              aria-label='Volume'
              min={0}
              max={1}
              step={0.01}
              value={volume}
              style={volumeStyle}
              onChange={(event) => onVolumeChange(event.currentTarget.valueAsNumber)}
            />
            <span
              className='material-symbols-outlined android-now-playing-volume-high'
              aria-hidden='true'
            >
              volume_up
            </span>
          </div>

          <div className='android-now-playing-bottom-actions'>
            <button
              type='button'
              className={`android-now-playing-bottom-action${showLyrics ? ' is-active' : ''}`}
              aria-label={lyricsToggleLabel}
              aria-pressed={showLyrics}
              disabled={!lyricsAvailable}
              onClick={onToggleLyrics}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                lyrics
              </span>
            </button>
            <div className='android-now-playing-output'>
              <AudioOutputSelector
                selectedDeviceId={audioOutputDeviceId}
                onSelectDevice={onAudioOutputDeviceChange}
              />
            </div>
            <button
              type='button'
              className={`android-now-playing-bottom-action${showPlayQueue ? ' is-active' : ''}`}
              aria-label={showPlayQueue ? 'Close play queue' : 'Open play queue'}
              aria-pressed={showPlayQueue}
              onClick={togglePlayQueue}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                queue_music
              </span>
              {repeatMode !== 'off' && (
                <span className='android-now-playing-repeat-badge' aria-hidden='true'>
                  <span className='material-symbols-outlined'>
                    {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>
      </main>

      {isQueueLayoutOpen && !isInlineQueue && (
        <div className='android-now-playing-overlay android-now-playing-queue-overlay'>
          <button
            type='button'
            className='android-now-playing-overlay-backdrop'
            aria-label='Close play queue'
            onClick={closePlayQueue}
          />
          <section
            className='android-now-playing-sheet android-now-playing-queue-sheet'
            role='dialog'
            aria-modal='true'
            aria-label='Play queue'
          >
            <header className='android-now-playing-sheet-header'>
              <div>
                <h2>Now playing</h2>
                <p>{playQueue.length} tracks</p>
              </div>
              <button type='button' aria-label='Close play queue' onClick={closePlayQueue}>
                <span className='material-symbols-outlined' aria-hidden='true'>
                  close
                </span>
              </button>
            </header>
            {playQueue.length === 0 ? (
              <p className='android-now-playing-empty-queue'>Play a track to start a queue.</p>
            ) : (
              <div
                className='anp-queue-sections android-now-playing-queue-scroll'
                ref={queueScrollRef}
                onScroll={captureQueueRowPositions}
              >
                {renderQueueHistory()}
                <section className='anp-queue-section android-now-playing-queue-upcoming'>
                  <h3>Queue</h3>
                  {renderUpcomingQueue()}
                </section>
              </div>
            )}
            <div className='android-now-playing-queue-sheet-autoplay'>{autoplayButton}</div>
          </section>
        </div>
      )}

      {showLyrics && lyricsAvailable && !isQueueLayoutOpen && !isPortraitLayout && (
        <div className='android-now-playing-overlay'>
          <button
            type='button'
            className='android-now-playing-overlay-backdrop'
            aria-label='Close lyrics'
            onClick={onCloseLyrics}
          />
          <section
            className='android-now-playing-sheet android-now-playing-lyrics-sheet'
            role='dialog'
            aria-modal='true'
            aria-label='Lyrics'
          >
            <header className='android-now-playing-sheet-header'>
              <div>
                <h2>Lyrics</h2>
                <p>{track?.name || 'Now Playing'}</p>
              </div>
              <button type='button' aria-label='Close lyrics' onClick={onCloseLyrics}>
                <span className='material-symbols-outlined' aria-hidden='true'>
                  close
                </span>
              </button>
            </header>
            <div className='android-now-playing-lyrics-text' dir='auto'>
              {lyricsText || 'Lyrics are not available for this track.'}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default AndroidNowPlaying;
