import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppIcon from '../AppIcon';
import type { PlayerWindowMode, UsbSyncProgress } from '../../types/electron';
import { USB_SYNC_INDICATOR_EVENT, type UsbSyncIndicator } from '../../services/usbSyncIndicator';

const WindowTitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [playerWindowMode, setPlayerWindowMode] = useState<PlayerWindowMode>('normal');
  const [syncIndicator, setSyncIndicator] = useState<UsbSyncIndicator | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const syncIndicatorTimeoutRef = useRef<number | null>(null);
  const canNavigateBack =
    playerWindowMode === 'normal' && location.pathname !== '/' && location.pathname !== '/tracks';
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
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1);
    else if (location.pathname.startsWith('/settings/')) navigate('/settings');
    else if (location.pathname.startsWith('/playlists/')) navigate('/playlists');
    else if (location.pathname.startsWith('/albums/')) navigate('/albums');
    else if (location.pathname.startsWith('/artists/')) navigate('/artists');
    else if (location.pathname.startsWith('/genres/')) navigate('/genres');
    else navigate('/');
  };

  return (
    <header
      className={`window-titlebar ${playerWindowMode}${syncIndicator ? ` syncing-${syncIndicator.status}` : ''}`}
      onDoubleClick={playerWindowMode === 'normal' ? toggleMaximize : undefined}
    >
      <div className='window-titlebar-brand'>
        {canNavigateBack && (
          <button
            type='button'
            className='window-titlebar-button window-titlebar-back'
            aria-label='Go back'
            onClick={navigateBack}
            onDoubleClick={(event) => event.stopPropagation()}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              arrow_back
            </span>
          </button>
        )}
        <AppIcon className='window-titlebar-icon' />
        <span>Luna Music</span>
      </div>
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
      <div className='window-titlebar-controls' onDoubleClick={(event) => event.stopPropagation()}>
        {playerWindowMode !== 'mini' && (
          <button
            type='button'
            className='window-titlebar-button'
            aria-label='Minimize window'
            onClick={() => runWindowAction(window.electronAPI?.minimizeWindow)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              remove
            </span>
          </button>
        )}
        {playerWindowMode === 'normal' ? (
          <button
            type='button'
            className='window-titlebar-button'
            aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
            onClick={toggleMaximize}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              {isMaximized ? 'filter_none' : 'crop_square'}
            </span>
          </button>
        ) : playerWindowMode === 'fullscreen' ? (
          <button
            type='button'
            className='window-titlebar-button'
            aria-label='Exit fullscreen player mode'
            title='Exit fullscreen player mode'
            onClick={() => void exitPlayerMode()}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              close_fullscreen
            </span>
          </button>
        ) : null}
        <button
          type='button'
          className='window-titlebar-button close'
          aria-label='Close window'
          onClick={() => runWindowAction(window.electronAPI?.closeWindow)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            close
          </span>
        </button>
      </div>
    </header>
  );
};

export default WindowTitleBar;
