import { useState, useRef, useEffect } from 'react';
import './MainContent.css';

// Mock data for library items
const libraryItems = [
  { id: '1', title: 'Recently Played', type: 'playlist', icon: 'history' },
  { id: '2', title: 'Favorites', type: 'playlist', icon: 'favorite' },
  { id: '3', title: 'Top Songs', type: 'playlist', icon: 'trending_up' },
];

const albums = [
  {
    id: '1',
    title: 'After Hours',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
    year: 2020,
  },
  {
    id: '2',
    title: 'Starboy',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    year: 2016,
  },
  {
    id: '3',
    title: 'Dawn FM',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1587329310686-936875979855?w=200&h=200&fit=crop',
    year: 2022,
  },
  {
    id: '4',
    title: 'Beauty Behind The Madness',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    year: 2015,
  },
];

const artists = [
  { id: '1', name: 'The Weeknd', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
  { id: '2', name: 'Drake', image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop' },
  { id: '3', name: 'Post Malone', image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop' },
  { id: '4', name: 'Travis Scott', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop' },
];

const MainContent = () => {
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setShowSettingsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSettingsMenu = () => {
    setShowSettingsMenu(!showSettingsMenu);
  };

  return (
    <main className="main-content">
      <header className="content-header">
        <div className="header-left">
          <h1 className="page-title">Library</h1>
        </div>
        <div className="header-right" ref={settingsMenuRef}>
          <button className="header-button" onClick={toggleSettingsMenu}>
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          
          {/* Settings Dropdown Menu */}
          {showSettingsMenu && (
            <div className="settings-menu">
              <div className="menu-header">
                <h3>Options</h3>
              </div>
              <ul className="menu-list">
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">settings</span>
                    <span>Settings</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">folder_open</span>
                    <span>Add Music Folder</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">refresh</span>
                    <span>Rescan Library</span>
                  </button>
                </li>
                <li className="menu-item divider">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">help</span>
                    <span>Help</span>
                  </button>
                </li>
                <li className="menu-item">
                  <button className="menu-button">
                    <span className="material-symbols-outlined">info</span>
                    <span>About</span>
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
      </header>

      <section className="library-section">
        <div className="section-header">
          <h2 className="section-title">Library</h2>
        </div>
        <div className="library-grid">
          {libraryItems.map((item) => (
            <div key={item.id} className="library-card">
              <div className="card-icon">
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
              <span className="card-title">{item.title}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-header">
          <h2 className="section-title">Albums</h2>
          <button className="see-all-button">See All</button>
        </div>
        <div className="albums-grid">
          {albums.map((album) => (
            <div key={album.id} className="album-card">
              <div className="album-cover">
                <img src={album.cover} alt={album.title} />
              </div>
              <div className="album-info">
                <h3 className="album-title">{album.title}</h3>
                <p className="album-artist">{album.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="content-section">
        <div className="section-header">
          <h2 className="section-title">Artists</h2>
          <button className="see-all-button">See All</button>
        </div>
        <div className="artists-grid">
          {artists.map((artist) => (
            <div key={artist.id} className="artist-card">
              <div className="artist-image">
                <img src={artist.image} alt={artist.name} />
              </div>
              <span className="artist-name">{artist.name}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
};

export default MainContent;
