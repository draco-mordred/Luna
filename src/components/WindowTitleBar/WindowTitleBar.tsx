import { useEffect, useState } from 'react';
import AppIcon from '../AppIcon';
import type { PlayerWindowMode } from '../../types/electron';

const WindowTitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);
  const [playerWindowMode, setPlayerWindowMode] = useState<PlayerWindowMode>('normal');

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

  return (
    <header
      className={`window-titlebar ${playerWindowMode}`}
      onDoubleClick={playerWindowMode === 'normal' ? toggleMaximize : undefined}
    >
      <div className='window-titlebar-brand'>
        <AppIcon className='window-titlebar-icon' />
        <span>Luna Music</span>
      </div>
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
