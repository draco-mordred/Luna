import { memo, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Playlist } from '../../services/MusicLibrary';
import type { Track } from '../../services/MusicLibrary';
import PlaylistArtwork from '../PlaylistArtwork';
import { DEVELOPER_GITHUB, DEVELOPER_NAME } from '../../constants/developer';
import { useDeveloperAvatar } from '../../hooks/useDeveloperAvatar';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  playlists: Playlist[];
  tracks: Track[];
  showBrowseSection: boolean;
  showRadioSection: boolean;
  isAndroidApp: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  playlists,
  tracks,
  showBrowseSection,
  showRadioSection,
  isAndroidApp,
}) => {
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const [playlistsExpanded, setPlaylistsExpanded] = useState(false);
  const location = useLocation();
  const developerAvatar = useDeveloperAvatar();
  const path = location.pathname.split('/')[1] || '';
  const activeSection = ['tracks', 'albums', 'artists', 'composer', 'genres'].includes(path)
    ? 'library'
    : path === ''
      ? 'home'
    : path === 'playlists'
      ? 'playlists'
      : path || 'library';
  const formatPlaylistDuration = (seconds: number) => {
    const totalMinutes = Math.floor(seconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${totalMinutes} min`;
    return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  };
  const closeDrawerAfterNavigation = isAndroidApp ? onToggle : undefined;

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className='sidebar-header'>
        <button
          type='button'
          className={`logo ${collapsed ? 'collapsed' : ''}`}
          onClick={onToggle}
          aria-label={collapsed ? 'Open sidebar' : 'Close sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Open sidebar' : 'Close sidebar'}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            menu
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className='sidebar-nav'>
        <ul className='nav-list'>
          <li className='nav-item'>
            <Link
              to='/'
              className={`nav-button ${activeSection === 'home' ? 'active' : ''}`}
              onClick={closeDrawerAfterNavigation}
            >
              <span className='nav-icon'>home</span>
              {!collapsed && <span className='nav-label'>Home</span>}
            </Link>
          </li>
          <li className='nav-item'>
            <Link
              to='/tracks'
              className={`nav-button ${activeSection === 'library' ? 'active' : ''}`}
              onClick={closeDrawerAfterNavigation}
            >
              <span className='nav-icon'>library_music</span>
              {!collapsed && <span className='nav-label'>Library</span>}
            </Link>
          </li>

          {showBrowseSection && (
            <li className='nav-item'>
              <Link
                to='/browse'
                className={`nav-button ${activeSection === 'browse' ? 'active' : ''}`}
                onClick={closeDrawerAfterNavigation}
              >
                <span className='nav-icon'>explore</span>
                {!collapsed && <span className='nav-label'>Browse</span>}
              </Link>
            </li>
          )}

          <li className='nav-item'>
            <Link
              to='/queue'
              className={`nav-button ${activeSection === 'queue' ? 'active' : ''}`}
              onClick={closeDrawerAfterNavigation}
            >
              <span className='nav-icon'>queue_music</span>
              {!collapsed && <span className='nav-label'>Play queue</span>}
            </Link>
          </li>
          {isAndroidApp && (
            <li className='nav-item'>
              <Link
                to='/settings/about'
                className='nav-button'
                onClick={closeDrawerAfterNavigation}
              >
                <span className='nav-icon'>info</span>
                {!collapsed && <span className='nav-label'>About</span>}
              </Link>
            </li>
          )}

          {showRadioSection && (
            <li className='nav-item'>
              <Link
                to='/radio'
                className={`nav-button ${activeSection === 'radio' ? 'active' : ''}`}
                onClick={closeDrawerAfterNavigation}
              >
                <span className='nav-icon'>radio</span>
                {!collapsed && <span className='nav-label'>Radio</span>}
              </Link>
            </li>
          )}

          <li className='nav-item'>
            <Link
              to='/playlists'
              className={`nav-button ${activeSection === 'playlists' ? 'active' : ''}`}
              onClick={closeDrawerAfterNavigation}
            >
              <span className='nav-icon'>playlist_add</span>
              {!collapsed && <span className='nav-label'>Playlists</span>}
            </Link>
          </li>

          <li className='nav-item'>
            <Link
              to='/search'
              className={`nav-button ${activeSection === 'search' ? 'active' : ''}`}
              onClick={closeDrawerAfterNavigation}
            >
              <span className='nav-icon'>search</span>
              {!collapsed && <span className='nav-label'>Search</span>}
            </Link>
          </li>
        </ul>
      </nav>

      {/* Playlists Section */}
      <div className='sidebar-footer'>
        <nav className='sidebar-footer-nav' aria-label='Additional navigation'>
          <Link
            to='/settings'
            className={`nav-button ${activeSection === 'settings' ? 'active' : ''}`}
            onClick={closeDrawerAfterNavigation}
            title={collapsed ? 'Settings' : undefined}
          >
            <span className='nav-icon'>settings</span>
            {!collapsed && <span className='nav-label'>Settings</span>}
          </Link>
        </nav>
        <div className='playlists-section'>
          <button
            type='button'
            className='playlists-title'
            aria-label={`${playlistsExpanded ? 'Hide' : 'Show'} playlists`}
            aria-controls='sidebar-playlists-list'
            aria-expanded={playlistsExpanded}
            title={collapsed ? `${playlistsExpanded ? 'Hide' : 'Show'} playlists` : undefined}
            onClick={() => setPlaylistsExpanded((expanded) => !expanded)}
          >
            {!collapsed && <span className='playlists-title-label'>Playlists</span>}
            <span className='material-symbols-outlined' aria-hidden='true'>
              {collapsed ? 'queue_music' : playlistsExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {playlistsExpanded && (
            <ul className='playlists-list' id='sidebar-playlists-list'>
              {playlists.map((playlist) => {
                const playlistTracks = playlist.trackIds
                  .map((id) => tracksById.get(id))
                  .filter((track): track is Track => Boolean(track));
                const totalDuration = playlistTracks.reduce(
                  (total, playlistTrack) => total + playlistTrack.duration,
                  0
                );
                const encodedId = encodeURIComponent(playlist.id);
                const isActive = location.pathname.endsWith(encodedId);

                return (
                  <li className='playlist-item' key={playlist.id}>
                    <Link
                      to={`/playlists/${encodedId}`}
                      className={`playlist-link ${isActive ? 'active' : ''}`}
                      aria-describedby={collapsed ? `playlist-hover-${playlist.id}` : undefined}
                      title={collapsed ? undefined : playlist.name}
                    >
                      <PlaylistArtwork
                        size='small'
                        coverTrackIds={playlist.coverTrackIds}
                        tracks={playlistTracks}
                      />
                      {!collapsed && <span className='playlist-name'>{playlist.name}</span>}
                    </Link>
                    {collapsed && (
                      <span
                        className='playlist-hover-card'
                        id={`playlist-hover-${playlist.id}`}
                        role='tooltip'
                      >
                        <PlaylistArtwork
                          size='small'
                          coverTrackIds={playlist.coverTrackIds}
                          tracks={playlistTracks}
                        />
                        <span className='playlist-hover-card-copy'>
                          <strong>{playlist.name}</strong>
                          <span>{playlistTracks.length} songs</span>
                          <span>{formatPlaylistDuration(totalDuration)}</span>
                        </span>
                      </span>
                    )}
                  </li>
                );
              })}
              {playlists.length === 0 && !collapsed && (
                <li className='playlist-empty-label'>No playlists</li>
              )}
            </ul>
          )}
        </div>
        <a
          className='sidebar-developer'
          href={DEVELOPER_GITHUB}
          target='_blank'
          rel='noopener noreferrer'
          title={DEVELOPER_NAME}
        >
          {developerAvatar ? (
            <img src={developerAvatar} alt='' />
          ) : (
            <span className='material-symbols-outlined' aria-hidden='true'>account_circle</span>
          )}
          {!collapsed && (
            <span className='sidebar-developer-copy'>
              <small>Developer</small>
              <strong>{DEVELOPER_NAME}</strong>
            </span>
          )}
        </a>
      </div>

    </aside>
  );
};

export default memo(Sidebar);
