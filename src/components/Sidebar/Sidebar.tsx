import { useState } from 'react';
import './Sidebar.css';

interface SidebarProps {
  onNavigate?: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const [activeSection, setActiveSection] = useState('library');

  const navigate = (section: string) => {
    setActiveSection(section);
    onNavigate?.(section);
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">music_note</span>
          <span className="logo-text">Luna</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul className="nav-list">
          <li className="nav-item">
            <button 
              className={`nav-button ${activeSection === 'library' ? 'active' : ''}`}
              onClick={() => navigate('library')}
            >
              <span className="nav-icon">library_music</span>
              <span className="nav-label">Library</span>
            </button>
          </li>
          
          <li className="nav-item">
            <button 
              className={`nav-button ${activeSection === 'browse' ? 'active' : ''}`}
              onClick={() => navigate('browse')}
            >
              <span className="nav-icon">explore</span>
              <span className="nav-label">Browse</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeSection === 'radio' ? 'active' : ''}`}
              onClick={() => navigate('radio')}
            >
              <span className="nav-icon">radio</span>
              <span className="nav-label">Radio</span>
            </button>
          </li>

          <li className="nav-item">
            <button 
              className={`nav-button ${activeSection === 'search' ? 'active' : ''}`}
              onClick={() => navigate('search')}
            >
              <span className="nav-icon">search</span>
              <span className="nav-label">Search</span>
            </button>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="playlists-section">
          <h4 className="playlists-title">Playlists</h4>
          <ul className="playlists-list">
            <li className="playlist-item active">
              <span className="playlist-icon">play_circle</span>
              <span className="playlist-name">Recently Played</span>
            </li>
            <li className="playlist-item">
              <span className="playlist-icon">favorite</span>
              <span className="playlist-name">Favorites</span>
            </li>
            <li className="playlist-item">
              <span className="playlist-icon">queue_music</span>
              <span className="playlist-name">My Queue</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
