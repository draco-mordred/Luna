import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { Provider, Session } from '@supabase/supabase-js';
import type { MusicLibraryResponse } from '../../types/electron';
import type { Track } from '../../services/MusicLibrary';
import { buildSearchGroups } from '../../services/search';
import {
  addNativeOAuthCallbackListener,
  getSupabaseClient,
  handleOAuthCallback,
  isSupabaseConfigured,
  signInWithOAuth,
} from '../../services/supabaseAuth';
import './TopNavbar.css';

interface TopNavbarProps {
  tracks: Track[];
  isAndroidApp: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onSelectMusicFolders: () => Promise<MusicLibraryResponse | null>;
  onRescanMusicLibrary: () => Promise<MusicLibraryResponse>;
}

type Section =
  | 'home'
  | 'library'
  | 'browse'
  | 'radio'
  | 'search'
  | 'settings'
  | 'playlists'
  | 'queue';
type TabType = 'tracks' | 'albums' | 'artists' | 'composer' | 'genres';

const LIBRARY_TABS: Array<{ id: TabType; label: string; icon: string }> = [
  { id: 'tracks', label: 'Tracks', icon: 'music_note' },
  { id: 'albums', label: 'Albums', icon: 'album' },
  { id: 'artists', label: 'Artists', icon: 'person' },
  { id: 'composer', label: 'Composers', icon: 'edit_note' },
  { id: 'genres', label: 'Genres', icon: 'style' },
];

const SECTION_TITLES: Record<Section, string> = {
  home: 'Home',
  library: 'Library',
  browse: 'Browse',
  radio: 'Radio',
  search: 'Search',
  settings: 'Settings',
  playlists: 'Playlists',
  queue: 'Play queue',
};

const TopNavbar = ({
  tracks,
  isAndroidApp,
  sidebarOpen,
  onToggleSidebar,
  onSelectMusicFolders,
  onRescanMusicLibrary,
}: TopNavbarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authBusy, setAuthBusy] = useState<Provider | 'signout' | 'finishing' | null>(null);
  const [authError, setAuthError] = useState('');
  const authTimeoutRef = useRef<number | null>(null);
  const processedAuthCallbacksRef = useRef(new Set<string>());
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchGroups = useMemo(() => buildSearchGroups(tracks, searchQuery), [searchQuery, tracks]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    let active = true;
    let authStateChanged = false;
    const { data: authListener } = client.auth.onAuthStateChange((event, session) => {
      authStateChanged = true;
      if (active) {
        setAuthSession(session);
        if (session || event === 'SIGNED_OUT') {
          setAuthBusy(null);
          setAuthError('');
          if (authTimeoutRef.current !== null) {
            window.clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = null;
          }
        }
      }
    });

    const processCallback = (url: string) => {
      if (processedAuthCallbacksRef.current.has(url)) return;
      processedAuthCallbacksRef.current.add(url);
      setAuthBusy('finishing');
      if (authTimeoutRef.current !== null) window.clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = window.setTimeout(() => {
        setAuthBusy(null);
        setAuthError(
          'Luna received the sign-in callback, but Supabase did not finish verifying it. Check your connection and Supabase project settings.'
        );
        authTimeoutRef.current = null;
      }, 60_000);
      void handleOAuthCallback(url)
        .then((session) => {
          if (active && session) {
            setAuthSession(session);
            setAuthBusy(null);
            setAuthError('');
          }
        })
        .catch((error: unknown) => {
          if (active) {
            setAuthError(error instanceof Error ? error.message : String(error));
          }
        })
        .finally(() => {
          if (active) {
            setAuthBusy(null);
            if (authTimeoutRef.current !== null) {
              window.clearTimeout(authTimeoutRef.current);
              authTimeoutRef.current = null;
            }
          }
          if (window.electronAPI && url.startsWith('luna-auth://')) {
            window.electronAPI.acknowledgeAuthCallback();
          }
        });
    };
    const removeElectronListener = window.electronAPI?.onAuthCallback(processCallback);
    let removeNativeListener: (() => void) | undefined;
    void addNativeOAuthCallbackListener(processCallback)
      .then((removeListener) => {
        if (active) removeNativeListener = removeListener;
        else removeListener();
      })
      .catch((error: unknown) => {
        if (active) setAuthError(error instanceof Error ? error.message : String(error));
      });

    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        if (active && !authStateChanged) setAuthSession(data.session);
      })
      .catch((error: unknown) => {
        if (active) setAuthError(error instanceof Error ? error.message : String(error));
      });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      removeElectronListener?.();
      removeNativeListener?.();
      if (authTimeoutRef.current !== null) {
        window.clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
    };
  }, []);

  const handleOAuthSignIn = async (provider: Provider) => {
    setAuthBusy(provider);
    setAuthError('');
    if (authTimeoutRef.current !== null) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      setAuthBusy(null);
      setAuthError(
        'Sign-in did not finish in time. In development, close all Luna/Electron windows, restart with npm run dev, and try again.'
      );
      authTimeoutRef.current = null;
    }, 60_000);
    try {
      await signInWithOAuth(provider);
    } catch (error) {
      if (authTimeoutRef.current !== null) {
        window.clearTimeout(authTimeoutRef.current);
        authTimeoutRef.current = null;
      }
      setAuthError(error instanceof Error ? error.message : String(error));
      setAuthBusy(null);
    }
  };

  const handleSignOut = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setAuthBusy('signout');
    setAuthError('');
    if (authTimeoutRef.current !== null) {
      window.clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
    try {
      const { error } = await client.auth.signOut();
      if (error) setAuthError(error.message);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : String(error));
    } finally {
      setAuthBusy(null);
    }
  };

  const path = location.pathname.split('/')[1] ?? '';
  const libraryTab = LIBRARY_TABS.find((tab) => tab.id === path);
  const section: Section = libraryTab
    ? 'library'
    : path === ''
      ? 'home'
      : path === 'tracks'
      ? 'library'
      : path === 'queue'
        ? 'queue'
      : path.startsWith('settings')
        ? 'settings'
        : path === 'playlists'
          ? 'playlists'
        : path === 'browse' ||
            path === 'radio' ||
            path === 'search'
          ? path
          : 'library';
  const canNavigateBack = isAndroidApp && path !== '' && path !== 'tracks';

  // Handle tab change
  const handleTabChange = (tabId: TabType) => {
    navigate(`/${tabId}`);
  };

  const handleNavigateBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
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
      {isAndroidApp && (
        <button
          type='button'
          className='android-sidebar-toggle'
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          aria-expanded={sidebarOpen}
          onClick={onToggleSidebar}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>menu</span>
        </button>
      )}
      <div className="navbar-left">
        {canNavigateBack && (
          <button
            type='button'
            className='navbar-back-button'
            aria-label='Go back'
            onClick={handleNavigateBack}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>arrow_back</span>
          </button>
        )}
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
        <div className='account-section' ref={accountMenuRef}>
          <button className='navbar-button account-button' onClick={toggleAccountMenu}>
            <span className='material-symbols-outlined'>account_circle</span>
          </button>

          {showAccountMenu && (
            <div className='account-menu'>
              <div className='menu-header'>
                <h3>Account</h3>
              </div>
              <ul className='menu-list'>
                {authSession ? (
                  <>
                    <li className='account-user'>
                      <strong>
                        {authSession.user.user_metadata?.full_name ||
                          authSession.user.email ||
                          'Signed in'}
                      </strong>
                      {authSession.user.email && <small>{authSession.user.email}</small>}
                    </li>
                    <li className='menu-item'>
                      <Link
                        className='menu-button'
                        to='/settings/profile'
                        onClick={() => setShowAccountMenu(false)}
                      >
                        <span className='material-symbols-outlined'>person</span>
                        <span>Profile</span>
                      </Link>
                    </li>
                    <li className='menu-item'>
                      <button
                        className='menu-button'
                        onClick={() => void handleSignOut()}
                        disabled={authBusy !== null}
                      >
                        <span className='material-symbols-outlined'>logout</span>
                        <span>{authBusy === 'signout' ? 'Signing out…' : 'Sign out'}</span>
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li className='account-auth-intro'>Sign in to your Luna account</li>
                    <li className='menu-item'>
                      <button
                        className='menu-button account-auth-button'
                        onClick={() => void handleOAuthSignIn('google')}
                        disabled={!isSupabaseConfigured || authBusy !== null}
                      >
                        <span className='material-symbols-outlined'>login</span>
                        <span>
                              {authBusy === 'google'
                                ? 'Connecting…'
                                : authBusy === 'finishing'
                                  ? 'Finishing sign-in…'
                                  : 'Continue with Google'}
                        </span>
                      </button>
                    </li>
                    <li className='menu-item'>
                      <button
                        className='menu-button account-auth-button'
                        onClick={() => void handleOAuthSignIn('github')}
                        disabled={!isSupabaseConfigured || authBusy !== null}
                      >
                        <span className='material-symbols-outlined'>code</span>
                        <span>
                          {authBusy === 'github'
                            ? 'Connecting…'
                            : authBusy === 'finishing'
                              ? 'Finishing sign-in…'
                              : 'Continue with GitHub'}
                        </span>
                      </button>
                    </li>
                    {!isSupabaseConfigured && (
                      <li className='account-auth-hint'>
                        Add the Supabase URL and public key to <code>.env.local</code> to enable
                        sign-in.
                      </li>
                    )}
                  </>
                )}
                {authError && (
                  <li className='account-auth-error' role='alert'>
                    {authError}
                  </li>
                )}
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
