import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../AppIcon';
import type { DesktopTitleBarStyle, PlayerWindowMode, UsbSyncProgress } from '../../types/electron';
import { USB_SYNC_INDICATOR_EVENT, type UsbSyncIndicator } from '../../services/usbSyncIndicator';

interface WindowTitleBarProps {
  desktopTitleBarStyle: DesktopTitleBarStyle;
}

const WindowTitleBar = ({ desktopTitleBarStyle }: WindowTitleBarProps) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [playerWindowMode, setPlayerWindowMode] = useState<PlayerWindowMode>('normal');
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(
    () => document.documentElement.getAttribute('data-now-playing-open') === 'true'
  );
  const [syncIndicator, setSyncIndicator] = useState<UsbSyncIndicator | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const syncIndicatorTimeoutRef = useRef<number | null>(null);
  const historyIndex = window.history.state?.idx;
  const canNavigateBack =
    playerWindowMode === 'normal' &&
    (isNowPlayingOpen ||
      (typeof historyIndex === 'number' && historyIndex > 0) ||
      (location.pathname !== '/' && location.pathname !== '/tracks'));
  const syncProgressPercent =
    syncIndicator?.status === 'complete'
      ? 100
      : syncIndicator?.status === 'running'
        ? syncIndicator.progress.phase === 'manifest'
          ? 99
          : Math.min(
              96,
              Math.round(
                (syncIndicator.progress.current / Math.max(syncIndicator.progress.total, 1)) * 96
              )
            )
        : 0;

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api
      .getWindowState()
      .then(setIsMaximized)
      .catch((error: unknown) => {
        console.error('Could not read window state:', error);
      });
    api
      .getWindowMode()
      .then(setPlayerWindowMode)
      .catch((error: unknown) => {
        console.error('Could not read player window mode:', error);
      });
    const unsubscribeMaximized = api.onWindowStateChanged(setIsMaximized);
    const unsubscribeMode = api.onWindowModeChanged(setPlayerWindowMode);
    return () => {
      unsubscribeMaximized();
      unsubscribeMode();
    };
  }, []);

  useEffect(() => {
    const handleNowPlayingStateChange = () => {
      setIsNowPlayingOpen(
        document.documentElement.getAttribute('data-now-playing-open') === 'true'
      );
    };
    window.addEventListener('luna-now-playing-state-change', handleNowPlayingStateChange);
    return () =>
      window.removeEventListener('luna-now-playing-state-change', handleNowPlayingStateChange);
  }, []);

  useEffect(() => {
    const clearIndicatorTimeout = () => {
      if (syncIndicatorTimeoutRef.current !== null) {
        window.clearTimeout(syncIndicatorTimeoutRef.current);
        syncIndicatorTimeoutRef.current = null;
      }
    };
    const showTerminalIndicator = (indicator: UsbSyncIndicator) => {
      clearIndicatorTimeout();
      setSyncIndicator(indicator);
      if (indicator.status !== 'running') {
        syncIndicatorTimeoutRef.current = window.setTimeout(
          () => setSyncIndicator(null),
          indicator.status === 'complete' ? 3000 : 5000
        );
      }
    };
    const handleIndicatorEvent = (event: Event) => {
      showTerminalIndicator((event as CustomEvent<UsbSyncIndicator>).detail);
    };
    const unsubscribeProgress = window.electronAPI?.onUsbSyncProgress(
      (progress: UsbSyncProgress) => {
        showTerminalIndicator({ status: 'running', progress });
      }
    );
    window.addEventListener(USB_SYNC_INDICATOR_EVENT, handleIndicatorEvent);
    return () => {
      clearIndicatorTimeout();
      unsubscribeProgress?.();
      window.removeEventListener(USB_SYNC_INDICATOR_EVENT, handleIndicatorEvent);
    };
  }, []);

  useEffect(() => {
    if (playerWindowMode !== 'mini') return undefined;
    const root = document.documentElement;
    let hideTimeout = 0;
    const revealTitlebar = () => {
      root.classList.remove('titlebar-hidden');
      window.clearTimeout(hideTimeout);
      hideTimeout = window.setTimeout(() => root.classList.add('titlebar-hidden'), 3000);
    };
    const activityEvents: Array<keyof WindowEventMap> = [
      'mousemove',
      'pointerdown',
      'keydown',
      'wheel',
    ];
    activityEvents.forEach((eventName) => window.addEventListener(eventName, revealTitlebar));
    revealTitlebar();
    return () => {
      window.clearTimeout(hideTimeout);
      root.classList.remove('titlebar-hidden');
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, revealTitlebar));
    };
  }, [playerWindowMode]);

  const exitPlayerMode = async () => {
    const api = window.electronAPI;
    if (!api) return;
    try {
      await api.exitPlayerMode();
      window.dispatchEvent(new Event('luna-collapse-now-playing'));
    } catch (error) {
      console.error('Could not exit player mode:', error);
    }
  };

  const toggleMaximize = () => {
    if (playerWindowMode === 'fullscreen') {
      void exitPlayerMode();
      return;
    }
    window.electronAPI?.toggleWindowMaximize().catch((error: unknown) => {
      console.error('Could not toggle window maximize state:', error);
    });
  };

  const runWindowAction = (action: (() => Promise<void>) | undefined) => {
    action?.().catch((error: unknown) => {
      console.error('Could not update the window:', error);
    });
  };

  const navigateBack = () => {
    if (isNowPlayingOpen) {
      window.dispatchEvent(new Event('luna-collapse-now-playing'));
      return;
    }
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1);
    else if (location.pathname.startsWith('/settings/')) navigate('/settings');
    else if (location.pathname.startsWith('/playlists/')) navigate('/playlists');
    else if (location.pathname.startsWith('/albums/')) navigate('/albums');
    else if (location.pathname.startsWith('/artists/')) navigate('/artists');
    else if (location.pathname.startsWith('/genres/')) navigate('/genres');
    else navigate('/');
  };

  const isMacosStyle = desktopTitleBarStyle === 'macos';
  const appBrand = (
    <>
      <AppIcon className='window-titlebar-icon' />
      <span>Luna Music</span>
    </>
  );
  const backButton = (
    <button
      type='button'
      className='window-titlebar-button window-titlebar-back'
      aria-label='Go back'
      title={canNavigateBack ? 'Go back' : 'No previous page'}
      disabled={!canNavigateBack}
      onClick={canNavigateBack ? navigateBack : undefined}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <span className='material-symbols-outlined' aria-hidden='true'>
        arrow_back
      </span>
    </button>
  );
  const minimizeIcon = desktopTitleBarStyle === 'music' ? 'music_note' : 'remove';
  const maximizeIcon =
    desktopTitleBarStyle === 'music' ? 'album' : isMaximized ? 'filter_none' : 'crop_square';
  const windowControls = (
    <div
      className={`window-titlebar-controls${isMacosStyle ? ' macos-controls' : ''}`}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      {playerWindowMode !== 'mini' && (
        <button
          type='button'
          className={`window-titlebar-button${isMacosStyle ? ' traffic-light minimize' : ''}`}
          aria-label='Minimize window'
          title='Minimize'
          onClick={() => runWindowAction(window.electronAPI?.minimizeWindow)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            {minimizeIcon}
          </span>
        </button>
      )}
      {playerWindowMode === 'normal' ? (
        <button
          type='button'
          className={`window-titlebar-button${isMacosStyle ? ' traffic-light maximize' : ''}`}
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          title={isMaximized ? 'Restore' : 'Maximize'}
          onClick={toggleMaximize}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            {maximizeIcon}
          </span>
        </button>
      ) : playerWindowMode === 'fullscreen' ? (
        <button
          type='button'
          className={`window-titlebar-button${isMacosStyle ? ' traffic-light maximize' : ''}`}
          aria-label='Exit fullscreen player mode'
          title='Exit fullscreen player mode'
          onClick={() => void exitPlayerMode()}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            {desktopTitleBarStyle === 'music' ? 'album' : 'close_fullscreen'}
          </span>
        </button>
      ) : null}
      <button
        type='button'
        className={`window-titlebar-button close${isMacosStyle ? ' traffic-light close-light' : ''}`}
        aria-label='Close window'
        title='Close'
        onClick={() => runWindowAction(window.electronAPI?.closeWindow)}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          {desktopTitleBarStyle === 'music' ? 'stop_circle' : 'close'}
        </span>
      </button>
    </div>
  );

  return (
    <header
      className={`window-titlebar ${playerWindowMode} ${desktopTitleBarStyle}${syncIndicator ? ` syncing-${syncIndicator.status}` : ''}`}
      onDoubleClick={playerWindowMode === 'normal' ? toggleMaximize : undefined}
    >
      {isMacosStyle ? (
        <>
          {windowControls}
          <div className='window-titlebar-brand window-titlebar-macos-brand'>{appBrand}</div>
          <div className='window-titlebar-macos-back'>
            {backButton}
          </div>
        </>
      ) : (
        <>
          <div className='window-titlebar-brand'>
            {backButton}
            {appBrand}
          </div>
          {windowControls}
        </>
      )}
      {syncIndicator && (
        <div
          className={`window-titlebar-sync ${syncIndicator.status}`}
          role='status'
          aria-live='polite'
          title={
            syncIndicator.status === 'error'
              ? syncIndicator.message
              : syncIndicator.status === 'running'
                ? `${syncIndicator.progress.trackName} (${syncIndicator.progress.fileName})`
                : syncIndicator.message
          }
        >
          <span className='material-symbols-outlined window-titlebar-sync-icon' aria-hidden='true'>
            {syncIndicator.status === 'complete'
              ? 'check_circle'
              : syncIndicator.status === 'error'
                ? 'error'
                : 'sync'}
          </span>
          <span className='window-titlebar-sync-label'>
            {syncIndicator.status === 'complete'
              ? 'Sync complete'
              : syncIndicator.status === 'error'
                ? 'Sync failed'
                : syncIndicator.progress.phase === 'manifest'
                  ? 'Saving sync details'
                  : syncIndicator.progress.phase === 'preparing'
                    ? `Preparing ${syncIndicator.progress.trackName} · ${Math.min(syncIndicator.progress.current + 1, syncIndicator.progress.total)} of ${syncIndicator.progress.total}`
                    : `Syncing ${syncIndicator.progress.trackName} · ${syncIndicator.progress.current} of ${syncIndicator.progress.total}`}
          </span>
        </div>
      )}
      {syncIndicator && syncIndicator.status !== 'error' && (
        <div
          className='window-titlebar-sync-progress'
          role='progressbar'
          aria-label='Android sync progress'
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={syncProgressPercent}
        >
          <span style={{ width: `${syncProgressPercent}%` }} />
        </div>
      )}
    </header>
  );
};

export default WindowTitleBar;
