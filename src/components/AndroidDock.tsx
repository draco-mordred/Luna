import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { AndroidPlayBarStyle } from '../types/android';
import type { Track } from '../services/MusicLibrary';
import { buildSearchGroups, type SearchItem } from '../services/search';
import { getLibraryItemPath } from '../utils/libraryNavigation';
import './AndroidDock.css';

interface AndroidDockProps {
  compact: boolean;
  menuOpen: boolean;
  playBarStyle: AndroidPlayBarStyle;
  tracks: Track[];
  onCompactChange: (compact: boolean) => void;
  onMenuOpenChange: (open: boolean) => void;
  onClearLibrarySearchQuery: () => void;
}

const WIDE_DOCK_QUERY = '(orientation: landscape), (min-width: 600px)';

const DOCK_ITEMS = [
  { label: 'Home', icon: 'home', path: '/' },
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
  menuOpen,
  playBarStyle,
  tracks,
  onCompactChange,
  onMenuOpenChange,
  onClearLibrarySearchQuery,
}: AndroidDockProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [collapseMenuOpen, setCollapseMenuOpen] = useState(false);
  const [isWideDockLayout, setIsWideDockLayout] = useState(
    () => window.matchMedia(WIDE_DOCK_QUERY).matches
  );
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dockRef = useRef<HTMLElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const holdTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const searchGroups = useMemo(
    () => buildSearchGroups(tracks, searchQuery, true),
    [searchQuery, tracks]
  );
  const currentItem = DOCK_ITEMS.find((item) => isItemActive(item.path, currentPath));
  const compactToggleIcon = menuOpen
    ? 'close'
    : currentPath === '/search'
      ? 'search'
      : (currentItem?.icon ?? 'menu');

  const clearHoldTimer = () => {
    if (holdTimerRef.current === null) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  const goTo = (path: string) => {
    navigate(path);
    onMenuOpenChange(false);
    setCollapseMenuOpen(false);
    setSearchOpen(false);
  };

  const handleSearchResultClick = (item: SearchItem) => {
    setSearchOpen(false);
    setCollapseMenuOpen(false);
    onClearLibrarySearchQuery();
    if (item.type === 'track' && item.track) {
      navigate(`/tracks?track=${encodeURIComponent(item.track.id)}`);
      return;
    }
    if (item.type === 'album') {
      navigate(getLibraryItemPath('album', item.title, item.track?.artist ?? item.subtitle));
      return;
    }
    if (item.type === 'artist') {
      navigate(getLibraryItemPath('artist', item.title));
      return;
    }
    if (item.type === 'composer') {
      navigate(`/composer?${new URLSearchParams({ name: item.title }).toString()}`);
      return;
    }
    navigate(getLibraryItemPath('genre', item.title));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (
      compact ||
      (event.target instanceof Element &&
        event.target.closest('.android-dock-context-menu, .android-dock-search'))
    ) {
      return;
    }

    clearHoldTimer();
    longPressTriggeredRef.current = false;
    holdTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setSearchOpen(false);
      setCollapseMenuOpen(true);
    }, 550);
  };

  const handlePointerUp = () => {
    clearHoldTimer();
    if (longPressTriggeredRef.current) {
      window.setTimeout(() => {
        longPressTriggeredRef.current = false;
      }, 0);
    }
  };

  const handlePointerLeave = () => {
    clearHoldTimer();
    longPressTriggeredRef.current = false;
  };

  const handlePointerCancel = () => {
    clearHoldTimer();
    longPressTriggeredRef.current = false;
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!longPressTriggeredRef.current) return;
    longPressTriggeredRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest('.android-dock-search')
    ) {
      return;
    }
    event.preventDefault();
    clearHoldTimer();
    if (!compact) {
      setSearchOpen(false);
      setCollapseMenuOpen(true);
    }
  };

  useEffect(() => {
    return () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const wideDockQuery = window.matchMedia(WIDE_DOCK_QUERY);
    const handleMediaChange = (event: MediaQueryListEvent) => {
      setIsWideDockLayout(event.matches);
      if (!event.matches) setSearchOpen(false);
    };
    wideDockQuery.addEventListener('change', handleMediaChange);
    return () => wideDockQuery.removeEventListener('change', handleMediaChange);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  useLayoutEffect(() => {
    if (!searchOpen || !isWideDockLayout) return undefined;
    const updateSearchPanelTop = () => {
      const searchPanel = searchPanelRef.current;
      if (!searchPanel) return;
      const topNavbar = document.querySelector<HTMLElement>(
        '.top-navbar.android-top-navbar.android-navigation-visible'
      );
      if (topNavbar?.getClientRects().length) {
        searchPanel.style.top = `${topNavbar.getBoundingClientRect().bottom + 8}px`;
      } else {
        searchPanel.style.top =
          'calc(var(--anp-safe-top, env(safe-area-inset-top, 0px)) + 62px)';
      }
    };
    updateSearchPanelTop();
    window.addEventListener('resize', updateSearchPanelTop);
    return () => window.removeEventListener('resize', updateSearchPanelTop);
  }, [isWideDockLayout, searchOpen]);

  useEffect(() => {
    if (!collapseMenuOpen) return;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !dockRef.current?.contains(event.target)) {
        setCollapseMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCollapseMenuOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [collapseMenuOpen]);

  useEffect(() => {
    if (!searchOpen) return undefined;
    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        dockRef.current?.contains(event.target) ||
        searchButtonRef.current?.contains(event.target) ||
        searchPanelRef.current?.contains(event.target)
      ) {
        return;
      }
      setSearchOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [searchOpen]);

  return (
    <>
      <nav
        ref={dockRef}
        className={`android-dock${compact ? ' is-compact' : ''}${menuOpen ? ' menu-open' : ''}${playBarStyle === 'dock' || playBarStyle === 'flock' ? ' attached-playbar' : ''}`}
        aria-label='Main navigation'
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
        onClickCapture={handleClickCapture}
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
                    <span className='android-dock-label'>{item.label}</span>
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
              onClick={() => {
                setSearchOpen(false);
                onMenuOpenChange(!menuOpen);
              }}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                {compactToggleIcon}
              </span>
            </button>
          </>
        ) : (
          <div className='android-dock-items'>
            {DOCK_ITEMS.map((item) => {
              const isActive = isItemActive(item.path, currentPath);
              return (
                <button
                  key={item.path}
                  type='button'
                  className={`android-dock-item${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => goTo(item.path)}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {item.icon}
                  </span>
                  <span className='android-dock-label'>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
        {collapseMenuOpen && !compact && (
          <div className='android-dock-context-menu' role='menu' aria-label='Navigation options'>
            <button
              type='button'
              role='menuitem'
              className='android-dock-context-menu-item'
              onClick={() => {
                onMenuOpenChange(false);
                onCompactChange(true);
                setCollapseMenuOpen(false);
              }}
            >
              Collapse
            </button>
          </div>
        )}
      </nav>
      <button
        ref={searchButtonRef}
        type='button'
        className={`android-dock-search${currentPath === '/search' ? ' active' : ''}${searchOpen ? ' is-open' : ''}`}
        aria-label='Search'
        aria-expanded={isWideDockLayout ? searchOpen : undefined}
        aria-current={!isWideDockLayout && currentPath === '/search' ? 'page' : undefined}
        onClick={() => {
          if (isWideDockLayout) {
            setSearchOpen((open) => !open);
            setCollapseMenuOpen(false);
          } else {
            setSearchOpen(false);
            setCollapseMenuOpen(false);
            window.dispatchEvent(new Event('luna-toggle-top-navbar-search'));
          }
        }}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          search
        </span>
      </button>
      {isWideDockLayout && searchOpen && (
        <div
          ref={searchPanelRef}
          className='android-dock-search-panel'
          role='search'
          aria-label='Search your music library'
        >
          <label className='android-dock-search-input'>
            <span className='material-symbols-outlined' aria-hidden='true'>
              search
            </span>
            <input
              ref={searchInputRef}
              type='search'
              value={searchQuery}
              placeholder='Search your library'
              aria-label='Search songs, albums, artists, and composers'
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
            />
          </label>
          {searchQuery.trim() && (
            <div className='android-dock-search-results' role='region' aria-label='Search results'>
              {searchGroups.some((group) => group.items.length > 0) ? (
                searchGroups.map(
                  (group) =>
                    group.items.length > 0 && (
                      <section
                        key={group.title}
                        className='android-dock-search-group'
                        role='group'
                        aria-label={group.title === 'Tracks' ? 'Songs' : group.title}
                      >
                        <h2>{group.title === 'Tracks' ? 'Songs' : group.title}</h2>
                        {group.items.slice(0, 5).map((item) => (
                          <button
                            key={`${group.title}-${item.id}`}
                            type='button'
                            className='android-dock-search-result'
                            onClick={() => handleSearchResultClick(item)}
                          >
                            <span className='material-symbols-outlined' aria-hidden='true'>
                              {item.type === 'track'
                                ? 'music_note'
                                : item.type === 'album'
                                  ? 'album'
                                  : item.type === 'artist'
                                    ? 'person'
                                    : item.type === 'composer'
                                      ? 'edit_note'
                                      : 'style'}
                            </span>
                            <span className='android-dock-search-result-copy'>
                              <strong>{item.title}</strong>
                              <small>{item.subtitle}</small>
                            </span>
                          </button>
                        ))}
                      </section>
                    )
                )
              ) : (
                <p className='android-dock-search-empty'>No matches found.</p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default memo(AndroidDock);
