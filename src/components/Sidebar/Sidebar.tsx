import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Sidebar.css';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const [activeSection, setActiveSection] = useState('library');

  const navigate = (section: string) => {
    setActiveSection(section);
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Sidebar Header */}
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">music_note</span>
          {!collapsed && <span className="logo-text">Luna</span>}
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          <li className="nav-item">
            <Link 
              to="/" 
              className={`nav-button ${activeSection === 'library' ? 'active' : ''}`}
              onClick={() => navigate('library')}
            >
              <span className="nav-icon">library_music</span>
              {!collapsed && <span className="nav-label">Library</span>}
            </Link>
          </li>
          
          <li className="nav-item">
            <Link 
              to="/browse" 
              className={`nav-button ${activeSection === 'browse' ? 'active' : ''}`}
              onClick={() => navigate('browse')}
            >
              <span className="nav-icon">explore</span>
              {!collapsed && <span className="nav-label">Browse</span>}
            </Link>
          </li>

          <li className="nav-item">
            <Link 
              to="/radio" 
              className={`nav-button ${activeSection === 'radio' ? 'active' : ''}`}
              onClick={() => navigate('radio')}
            >
              <span className="nav-icon">radio</span>
              {!collapsed && <span className="nav-label">Radio</span>}
            </Link>
          </li>

          <li className="nav-item">
            <Link 
              to="/search" 
              className={`nav-button ${activeSection === 'search' ? 'active' : ''}`}
              onClick={() => navigate('search')}
            >
              <span className="nav-icon">search</span>
              {!collapsed && <span className="nav-label">Search</span>}
            </Link>
          </li>
        </ul>
      </nav>

      {/* Playlists Section */}
      <div className="sidebar-footer">
        <div className="playlists-section">
          {!collapsed && <h4 className="playlists-title">Playlists</h4>}
          <ul className="playlists-list">
            <li className="playlist-item active">
              <span className="playlist-icon">play_circle</span>
              {!collapsed && <span className="playlist-name">Recently Played</span>}
            </li>
            <li className="playlist-item">
              <span className="playlist-icon">favorite</span>
              {!collapsed && <span className="playlist-name">Favorites</span>}
            </li>
            <li className="playlist-item">
              <span className="playlist-icon">queue_music</span>
              {!collapsed && <span className="playlist-name">My Queue</span>}
            </li>
          </ul>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button className="collapse-toggle" onClick={onToggle}>
        <span className="material-symbols-outlined">
          {collapsed ? 'chevron_right' : 'chevron_left'}
        </span>
      </button>
    </aside>
  );
};

export default Sidebar;
