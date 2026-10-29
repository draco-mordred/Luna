import { memo, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { Playlist } from '../../services/MusicLibrary';
import type { Track } from '../../services/MusicLibrary';
import PlaylistArtwork from '../PlaylistArtwork';
import AppIcon from '../AppIcon';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  playlists: Playlist[];
  tracks: Track[];
  showBrowseSection: boolean;
  showRadioSection: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  playlists,
  tracks,
  showBrowseSection,
  showRadioSection,
}) => {
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const location = useLocation();
  const path = location.pathname.split('/')[1] || '';
  const activeSection = ['tracks', 'albums', 'artists', 'composer', 'genres'].includes(path)
    ? 'library'
    : path === 'playlists'
      ? 'playlists'
      : path || 'library';

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className='sidebar-header'>
        <button
          type='button'
          className={`logo ${collapsed ? 'collapsed' : ''}`}
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <AppIcon className='logo-icon' />
          {!collapsed && <span className='logo-text'>Luna</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className='sidebar-nav'>
        <ul className='nav-list'>
          <li className='nav-item'>
            <Link to='/' className={`nav-button ${activeSection === 'library' ? 'active' : ''}`}>
              <span className='nav-icon'>library_music</span>
              {!collapsed && <span className='nav-label'>Library</span>}
            </Link>
          </li>

          {showBrowseSection && (
            <li className='nav-item'>
              <Link
                to='/browse'
                className={`nav-button ${activeSection === 'browse' ? 'active' : ''}`}
              >
                <span className='nav-icon'>explore</span>
                {!collapsed && <span className='nav-label'>Browse</span>}
              </Link>
            </li>
          )}

          {showRadioSection && (
            <li className='nav-item'>
              <Link
                to='/radio'
                className={`nav-button ${activeSection === 'radio' ? 'active' : ''}`}
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
            >
              <span className='nav-icon'>playlist_add</span>
              {!collapsed && <span className='nav-label'>Playlists</span>}
            </Link>
          </li>

          <li className='nav-item'>
            <Link
              to='/search'
              className={`nav-button ${activeSection === 'search' ? 'active' : ''}`}
            >
              <span className='nav-icon'>search</span>
              {!collapsed && <span className='nav-label'>Search</span>}
            </Link>
          </li>

        </ul>
      </nav>

      {/* Playlists Section */}
      <div className='sidebar-footer'>
        <div className='playlists-section'>
          {!collapsed && <h4 className='playlists-title'>Playlists</h4>}
          <ul className='playlists-list'>
            {playlists.map((playlist) => (
              <li className='playlist-item' key={playlist.id}>
                <Link
                  to={`/playlists/${encodeURIComponent(playlist.id)}`}
                  className={`playlist-link ${location.pathname.endsWith(encodeURIComponent(playlist.id)) ? 'active' : ''}`}
                  title={playlist.name}
                >
                  <PlaylistArtwork
                    size='small'
                    coverTrackIds={playlist.coverTrackIds}
                    tracks={playlist.trackIds
                      .map((id) => tracksById.get(id))
                      .filter((track): track is Track => Boolean(track))}
                  />
                  {!collapsed && <span className='playlist-name'>{playlist.name}</span>}
                </Link>
              </li>
            ))}
            {playlists.length === 0 && !collapsed && (
              <li className='playlist-empty-label'>No playlists</li>
            )}
          </ul>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button className='collapse-toggle' onClick={onToggle}>
        <span className='material-symbols-outlined'>
          {collapsed ? 'chevron_right' : 'chevron_left'}
        </span>
      </button>
    </aside>
  );
};

export default memo(Sidebar);
