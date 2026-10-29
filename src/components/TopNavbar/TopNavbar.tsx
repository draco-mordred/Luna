import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { MusicLibraryResponse } from '../../types/electron';
import type { Track } from '../../services/MusicLibrary';
import { buildSearchGroups } from '../../services/search';
import './TopNavbar.css';

interface TopNavbarProps {
  tracks: Track[];
  isAndroidApp: boolean;
  onSelectMusicFolders: () => Promise<MusicLibraryResponse | null>;
  onRescanMusicLibrary: () => Promise<MusicLibraryResponse>;
}

type Section =
  | 'library'
  | 'browse'
  | 'radio'
  | 'search'
  | 'settings'
  | 'playlists';
type TabType = 'tracks' | 'albums' | 'artists' | 'composer' | 'genres';

const LIBRARY_TABS: Array<{ id: TabType; label: string; icon: string }> = [
  { id: 'tracks', label: 'Tracks', icon: 'music_note' },
  { id: 'albums', label: 'Albums', icon: 'album' },
  { id: 'artists', label: 'Artists', icon: 'person' },
  { id: 'composer', label: 'Composers', icon: 'edit_note' },
  { id: 'genres', label: 'Genres', icon: 'style' },
];

const SECTION_TITLES: Record<Section, string> = {
  library: 'Library',
  browse: 'Browse',
  radio: 'Radio',
  search: 'Search',
  settings: 'Settings',
  playlists: 'Playlists',
};

const TopNavbar = ({
  tracks,
  isAndroidApp,
  onSelectMusicFolders,
  onRescanMusicLibrary,
}: TopNavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchGroups = useMemo(() => buildSearchGroups(tracks, searchQuery), [searchQuery, tracks]);

  const path = location.pathname.split('/')[1] ?? '';
  const libraryTab = LIBRARY_TABS.find((tab) => tab.id === path);
  const section: Section = libraryTab
    ? 'library'
    : path === '' || path === 'tracks'
      ? 'library'
      : path.startsWith('settings')
        ? 'settings'
        : path === 'playlists'
          ? 'playlists'
        : path === 'browse' ||
            path === 'radio' ||
            path === 'search'
          ? path
          : 'library';

  // Handle tab change
  const handleTabChange = (tabId: TabType) => {
    navigate(`/${tabId}`);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setShowAccountMenu(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchExpanded(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (nextQuery: string) => {
    const trimmedQuery = nextQuery.trim();
    setSearchQuery(trimmedQuery);
    setIsSearchExpanded(false);
    if (trimmedQuery) {
      navigate(`/search?q=${encodeURIComponent(trimmedQuery)}`);
      return;
    }
    navigate('/search');
  };

  const handleSearchInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleSearchSubmit(event.currentTarget.value);
    }
  };

  const toggleSettingsMenu = () => {
    setShowSettingsMenu(!showSettingsMenu);
    setShowAccountMenu(false);
  };

  const toggleAccountMenu = () => {
    setShowAccountMenu(!showAccountMenu);
    setShowSettingsMenu(false);
  };

  return (
    <nav className={`top-navbar${isAndroidApp ? ' android-top-navbar' : ''}`}>
      <div className="navbar-left">
        <h1 className="navbar-title">{SECTION_TITLES[section]}</h1>
        {section === 'library' && (
          <div className="tabs-container" role="tablist" aria-label="Library views">
            {LIBRARY_TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={libraryTab?.id === tab.id || (!libraryTab && tab.id === 'tracks')}
              className={`tab-button ${(libraryTab?.id === tab.id || (!libraryTab && tab.id === 'tracks')) ? 'active' : ''}`}
              onClick={() => handleTabChange(tab.id)}
            >
              <span className="material-symbols-outlined tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
            ))}
          </div>
        )}
      </div>

      <div className="navbar-right" ref={searchRef}>
        {/* Search */}
        <div className={`search-inline ${isSearchExpanded ? 'open' : ''}`}>
          <button
            type="button"
            className="navbar-button search-button"
            aria-label="Search"
            onClick={() => setIsSearchExpanded((current) => !current)}
          >
            <span className="material-symbols-outlined">search</span>
          </button>

          {isSearchExpanded && (
            <div className="search-dropdown">
              <div className="search-input-row">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  placeholder="Search library"
                  aria-label="Search the library"
                  autoFocus
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={handleSearchInputKeyDown}
                />
              </div>

              <div className="search-results-panel">
                {searchQuery.trim() ? (
                  searchGroups.some((group) => group.items.length > 0) ? (
                    searchGroups.map((group) => (
                      group.items.length > 0 ? (
                        <div key={group.title} className="search-result-group">
                          <div className="search-result-header">{group.title}</div>
                          {group.items.slice(0, 4).map((item) => (
                            <button
                              key={`${group.title}-${item.id}`}
                              type="button"
                              className="search-result-item"
                              onClick={() => {
                                if (item.type === 'track' && item.track) {
                                  navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                                  setIsSearchExpanded(false);
                                  return;
                                }
                                navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                                setIsSearchExpanded(false);
                              }}
                            >
                              <span className="material-symbols-outlined">{item.type === 'track' ? 'music_note' : item.type === 'album' ? 'album' : item.type === 'artist' ? 'person' : 'tag'}</span>
                              <span className="search-result-copy">
                                <strong>{item.title}</strong>
                                <small>{item.subtitle}</small>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null
                    ))
                  ) : (
                    <div className="search-empty-state-inline">No matches found.</div>
                  )
                ) : (
                  <div className="search-empty-state-inline">Type a song, artist, album, or genre.</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Account/Profile */}
        <div className="account-section" ref={accountMenuRef}>
          <button className="navbar-button account-button" onClick={toggleAccountMenu}>
            <span className="material-symbols-outlined">account_circle</span>
          </button>
          
          {showAccountMenu && (
            <div className="account-menu">
              <div className="menu-header">
                <h3>Account</h3>
              </div>
              <ul className="menu-list">
                <li className="menu-item">
                  <Link className="menu-button" to="/settings/profile">
                    <span className="material-symbols-outlined">person</span>
                    <span>Profile</span>
                  </Link>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">logout</span>
                    <span>Sign Out</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Options/Settings */}
        <div className="options-section" ref={settingsMenuRef}>
          <button className="navbar-button options-button" onClick={toggleSettingsMenu}>
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          
          {showSettingsMenu && (
            <div className="settings-menu">
              <div className="menu-header">
                <h3>Options</h3>
              </div>
              <ul className="menu-list">
                <li className="menu-item">
                  <Link className="menu-button" to="/settings" onClick={() => setShowSettingsMenu(false)}>
                    <span className="material-symbols-outlined">settings</span>
                    <span>Settings</span>
                  </Link>
                </li>
                <li className="menu-item">
                  <button
                    className="menu-button"
                    onClick={() => {
                      setShowSettingsMenu(false);
                      void onSelectMusicFolders();
                    }}
                  >
                    <span className="material-symbols-outlined">
                      {isAndroidApp ? 'library_music' : 'folder_open'}
                    </span>
                    <span>{isAndroidApp ? 'Scan Device Library' : 'Add Music Folder'}</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button
                    className="menu-button"
                    onClick={() => {
                      setShowSettingsMenu(false);
                      void onRescanMusicLibrary();
                    }}
                  >
                    <span className="material-symbols-outlined">refresh</span>
                    <span>{isAndroidApp ? 'Scan Device Library' : 'Rescan Library'}</span>
                  </button>
                </li>
                <li className="menu-item divider">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">help</span>
                    <span>Help</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button
                    className="menu-button"
                    onClick={() => {
                      setShowSettingsMenu(false);
                      navigate('/settings/about');
                    }}
                  >
                    <span className="material-symbols-outlined">info</span>
                    <span>About</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default memo(TopNavbar);
