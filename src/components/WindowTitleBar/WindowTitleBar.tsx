import { useEffect, useState } from 'react';

const WindowTitleBar = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return;

    api.getWindowState().then(setIsMaximized).catch((error: unknown) => {
      console.error('Could not read window state:', error);
    });
    return api.onWindowStateChanged(setIsMaximized);
  }, []);

  const toggleMaximize = () => {
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
    <header className='window-titlebar' onDoubleClick={toggleMaximize}>
      <div className='window-titlebar-brand'>
        <span className='material-symbols-outlined' aria-hidden='true'>music_note</span>
        <span>Luna Music</span>
      </div>
      <div className='window-titlebar-controls' onDoubleClick={(event) => event.stopPropagation()}>
        <button
          type='button'
          className='window-titlebar-button'
          aria-label='Minimize window'
          onClick={() => runWindowAction(window.electronAPI?.minimizeWindow)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>remove</span>
        </button>
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
        <button
          type='button'
          className='window-titlebar-button close'
          aria-label='Close window'
          onClick={() => runWindowAction(window.electronAPI?.closeWindow)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>close</span>
        </button>
      </div>
    </header>
  );
};

export default WindowTitleBar;
