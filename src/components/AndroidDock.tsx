import { memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AndroidPlayBarStyle } from '../types/android';
import './AndroidDock.css';

interface AndroidDockProps {
  compact: boolean;
  showLabels: boolean;
  menuOpen: boolean;
  playBarStyle: AndroidPlayBarStyle;
  onCompactChange: (compact: boolean) => void;
  onMenuOpenChange: (open: boolean) => void;
}

const DOCK_ITEMS = [
  { label: 'Home', icon: 'home', path: '/' },
  { label: 'Browse', icon: 'explore', path: '/browse' },
  { label: 'Library', icon: 'library_music', path: '/tracks' },
  { label: 'Radio', icon: 'radio', path: '/radio' },
  { label: 'Settings', icon: 'settings', path: '/settings' },
] as const;

const isItemActive = (path: string, currentPath: string) => {
  if (path === '/') return currentPath === '/';
  if (path === '/tracks') {
    return ['/tracks', '/albums', '/artists', '/composer', '/genres'].some(
      (route) => currentPath === route || currentPath.startsWith(`${route}/`)
    );
  }
  return currentPath === path || currentPath.startsWith(`${path}/`);
};

const AndroidDock = ({
  compact,
  showLabels,
  menuOpen,
  playBarStyle,
  onCompactChange,
  onMenuOpenChange,
}: AndroidDockProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const goTo = (path: string) => {
    navigate(path);
    onMenuOpenChange(false);
  };

  return (
    <nav
      className={`android-dock${compact ? ' is-compact' : ''}${menuOpen ? ' menu-open' : ''}${showLabels ? ' show-labels' : ''}${playBarStyle === 'dock' || playBarStyle === 'flock' ? ' attached-playbar' : ''}`}
      aria-label='Main navigation'
    >
      {compact ? (
        <>
          {menuOpen && (
            <div className='android-dock-menu' aria-label='Expanded navigation'>
              {DOCK_ITEMS.map((item) => (
                <button
                  key={item.path}
                  type='button'
                  className={`android-dock-item${isItemActive(item.path, currentPath) ? ' active' : ''}`}
                  aria-current={isItemActive(item.path, currentPath) ? 'page' : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {item.icon}
                  </span>
                  {showLabels && <span className='android-dock-label'>{item.label}</span>}
                </button>
              ))}
              <button
                type='button'
                className='android-dock-expand'
                aria-label='Expand dock to full width'
                title='Expand dock'
                onClick={() => {
                  onMenuOpenChange(false);
                  onCompactChange(false);
                }}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  chevron_right
                </span>
              </button>
            </div>
          )}
          <button
            type='button'
            className='android-dock-compact-toggle'
            aria-label={menuOpen ? 'Collapse navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => onMenuOpenChange(!menuOpen)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
          <button
            type='button'
            className={`android-dock-search${currentPath === '/search' ? ' active' : ''}`}
            aria-label='Search'
            aria-current={currentPath === '/search' ? 'page' : undefined}
            onClick={() => goTo('/search')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              search
            </span>
          </button>
        </>
      ) : (
        <>
          <button
            type='button'
            className='android-dock-collapse'
            aria-label='Collapse dock'
            title='Collapse dock'
            onClick={() => onCompactChange(true)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              chevron_left
            </span>
          </button>
          <div className='android-dock-items'>
            {DOCK_ITEMS.map((item) => (
              <button
                key={item.path}
                type='button'
                className={`android-dock-item${isItemActive(item.path, currentPath) ? ' active' : ''}`}
                aria-current={isItemActive(item.path, currentPath) ? 'page' : undefined}
                onClick={() => goTo(item.path)}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {item.icon}
                </span>
                {showLabels && <span className='android-dock-label'>{item.label}</span>}
              </button>
            ))}
          </div>
          <button
            type='button'
            className={`android-dock-search${currentPath === '/search' ? ' active' : ''}`}
            aria-label='Search'
            aria-current={currentPath === '/search' ? 'page' : undefined}
            onClick={() => goTo('/search')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              search
            </span>
            {showLabels && <span className='android-dock-label'>Search</span>}
          </button>
        </>
      )}
    </nav>
  );
};

export default memo(AndroidDock);
