import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Settings.css';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsPageProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  systemAccentColor: string | null;
  musicFolders: string[];
  trackCount: number;
  isDesktopApp: boolean;
  onAddMusicFolder: () => void;
  onRescanMusicLibrary: () => void;
  onRemoveMusicFolder: (folder: string) => void;
}

type SettingsSection = {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
};

const SettingsPage: React.FC<SettingsPageProps> = ({
  themeMode,
  onThemeChange,
  accentColor,
  onAccentColorChange,
  systemAccentColor,
  musicFolders,
  trackCount,
  isDesktopApp,
  onAddMusicFolder,
  onRescanMusicLibrary,
  onRemoveMusicFolder,
}) => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('appearance');

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
              <p>Choose a theme or follow your system appearance</p>
            </div>
            <div className="setting-control">
              <div className="theme-options">
                <button 
                  className={`theme-option ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => onThemeChange('light')}
                  aria-pressed={themeMode === 'light'}
                >
                  <span className="theme-icon light"></span>
                  <span>Light</span>
                </button>
                <button 
                  className={`theme-option ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => onThemeChange('dark')}
                  aria-pressed={themeMode === 'dark'}
                >
                  <span className="theme-icon dark"></span>
                  <span>Dark</span>
                </button>
                <button 
                  className={`theme-option ${themeMode === 'system' ? 'active' : ''}`}
                  onClick={() => onThemeChange('system')}
                  aria-pressed={themeMode === 'system'}
                >
                  <span className="theme-icon system"></span>
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Accent Color</h3>
              <p>Personalize highlights and controls across Luna</p>
            </div>
            <div className="setting-control accent-color-control">
              <input
                type="color"
                aria-label="Accent color"
                value={accentColor}
                onChange={(event) => onAccentColorChange(event.currentTarget.value)}
              />
              {systemAccentColor && (
                <button
                  type="button"
                  className="manage-button"
                  onClick={() => onAccentColorChange(systemAccentColor)}
                >
                  Use Windows accent
                </button>
              )}
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
              <p>{isDesktopApp ? `${musicFolders.length} folder(s) • ${trackCount} tracks indexed` : 'Folder management is available in the desktop app'}</p>
            </div>
            <div className="setting-control">
              {isDesktopApp && (
                <button type="button" className="manage-button" onClick={onAddMusicFolder}>
                  Add Folder
                </button>
              )}
            </div>
          </div>
          {musicFolders.length > 0 && (
            <div className="music-folder-list" aria-label="Indexed music folders">
              {musicFolders.map((folder) => (
                <div className="music-folder-path" key={folder} title={folder}>
                  <span className="material-symbols-outlined" aria-hidden="true">folder</span>
                  <span>{folder}</span>
                  {isDesktopApp && (
                    <button
                      className="remove-music-folder"
                      type="button"
                      aria-label={`Remove ${folder} from music folders`}
                      onClick={() => onRemoveMusicFolder(folder)}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">close</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="setting-item">
            <div className="setting-info">
              <h3>Rescan Library</h3>
              <p>Search the saved folders for new, changed, or missing tracks</p>
            </div>
            <div className="setting-control">
              {isDesktopApp && (
                <button type="button" className="manage-button" onClick={onRescanMusicLibrary}>
                  Rescan
                </button>
              )}
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
