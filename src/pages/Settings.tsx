import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Settings.css';

type ThemeMode = 'light' | 'dark' | 'system';

type SettingsSection = {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [activeSection, setActiveSection] = useState('appearance');

  // Load saved settings
  useEffect(() => {
    const savedTheme = localStorage.getItem('luna-theme') as ThemeMode | null;
    if (savedTheme) {
      setThemeMode(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  // Update theme
  useEffect(() => {
    localStorage.setItem('luna-theme', themeMode);
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  // Handle theme change
  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  // Navigation
  const goBack = () => {
    navigate(-1);
  };

  // Settings sections
  const sections: SettingsSection[] = [
    {
      id: 'appearance',
      title: 'Appearance',
      icon: 'palette',
      component: (
        <div className="settings-section-content">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Theme</h3>
              <p>Choose your preferred color theme</p>
            </div>
            <div className="setting-control">
              <div className="theme-options">
                <button 
                  className={`theme-option ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('light')}
                >
                  <span className="theme-icon light"></span>
                  <span>Light</span>
                </button>
                <button 
                  className={`theme-option ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('dark')}
                >
                  <span className="theme-icon dark"></span>
                  <span>Dark</span>
                </button>
                <button 
                  className={`theme-option ${themeMode === 'system' ? 'active' : ''}`}
                  onClick={() => handleThemeChange('system')}
                >
                  <span className="theme-icon system"></span>
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'library',
      title: 'Library',
      icon: 'library_music',
      component: (
        <div className="settings-section-content">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Music Folders</h3>
              <p>Manage your music library folders</p>
            </div>
            <div className="setting-control">
              <Link to="/settings/library" className="manage-button">
                Manage Folders
              </Link>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Auto Rescan</h3>
              <p>Rescan library on startup</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'playback',
      title: 'Playback',
      icon: 'play_circle',
      component: (
        <div className="settings-section-content">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Crossfade</h3>
              <p>Smooth transition between tracks</p>
            </div>
            <div className="setting-control">
              <div className="range-slider">
                <input type="range" min={0} max={10} step={1} defaultValue={0} />
                <span>0s</span>
              </div>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Volume Normalization</h3>
              <p>Balance volume across tracks</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Gapless Playback</h3>
              <p>Seamless playback between tracks</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'nowplaying',
      title: 'Now Playing',
      icon: 'music_note',
      component: (
        <div className="settings-section-content">
          <div className="setting-item">
            <div className="setting-info">
              <h3>Show Lyrics</h3>
              <p>Display lyrics when available</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Show Visualizer</h3>
              <p>Animate visualizer with music</p>
            </div>
            <div className="setting-control">
              <label className="toggle-switch">
                <input type="checkbox" />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'about',
      title: 'About',
      icon: 'info',
      component: (
        <div className="settings-section-content about-content">
          <div className="about-header">
            <div className="about-logo">
              <span className="material-symbols-outlined">music_note</span>
            </div>
            <h2>Luna Music</h2>
            <p className="version">v1.0.0</p>
          </div>
          <div className="about-info">
            <p>A beautiful, cross-platform music player with Apple Music inspired design.</p>
            <p>Built with React, Electron, and Capacitor.</p>
          </div>
          <div className="about-links">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <span className="material-symbols-outlined">code</span>
              <span>View Source</span>
            </a>
            <a href="#">
              <span className="material-symbols-outlined">description</span>
              <span>License</span>
            </a>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button className="back-button" onClick={goBack}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1>Settings</h1>
      </header>

      <div className="settings-container">
        {/* Sidebar Navigation */}
        <aside className="settings-sidebar">
          <ul className="settings-nav">
            {sections.map((section) => (
              <li key={section.id} className="settings-nav-item">
                <button 
                  className={`settings-nav-button ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className="material-symbols-outlined">{section.icon}</span>
                  <span className="settings-nav-label">{section.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className="settings-main">
          {sections.find(s => s.id === activeSection)?.component}
        </main>
      </div>
    </div>
  );
};

export default SettingsPage;
