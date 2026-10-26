import { memo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { IconStyle, SeekbarStyle, VisualizerStyle } from '../types/electron';
import packageMetadata from '../../package.json';
import './Settings.css';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsPageProps {
  themeMode: ThemeMode;
  onThemeChange: (mode: ThemeMode) => void;
  accentColor: string;
  onAccentColorChange: (color: string) => void;
  useSystemAccentColor: boolean;
  onUseSystemAccentColorChange: (useSystem: boolean) => void;
  iconStyle: IconStyle;
  onIconStyleChange: (style: IconStyle) => void;
  seekbarStyle: SeekbarStyle;
  onSeekbarStyleChange: (style: SeekbarStyle) => void;
  visualizerStyle: VisualizerStyle;
  onVisualizerStyleChange: (style: VisualizerStyle) => void;
  showVisualizer: boolean;
  onShowVisualizerChange: (show: boolean) => void;
  showArtistImageBackground: boolean;
  onShowArtistImageBackgroundChange: (show: boolean) => void;
  autoDownloadArtistImages: boolean;
  onAutoDownloadArtistImagesChange: (enabled: boolean) => void;
  showLyrics: boolean;
  onShowLyricsChange: (show: boolean) => void;
  showSyncedLyricsOnPlayBar: boolean;
  onShowSyncedLyricsOnPlayBarChange: (show: boolean) => void;
  syncLyricsDisplay: boolean;
  onSyncLyricsDisplayChange: (sync: boolean) => void;
  crossfadeSeconds: number;
  onCrossfadeChange: (seconds: number) => void;
  systemAccentColor: string | null;
  musicFolders: string[];
  trackCount: number;
  isDesktopApp: boolean;
  onAddMusicFolder: () => void;
  onRescanMusicLibrary: () => void;
  onRemoveMusicFolder: (folder: string) => void;
  showBrowseSection: boolean;
  onShowBrowseSectionChange: (show: boolean) => void;
  showRadioSection: boolean;
  onShowRadioSectionChange: (show: boolean) => void;
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
  useSystemAccentColor,
  onUseSystemAccentColorChange,
  iconStyle,
  onIconStyleChange,
  seekbarStyle,
  onSeekbarStyleChange,
  visualizerStyle,
  onVisualizerStyleChange,
  showVisualizer,
  onShowVisualizerChange,
  showArtistImageBackground,
  onShowArtistImageBackgroundChange,
  autoDownloadArtistImages,
  onAutoDownloadArtistImagesChange,
  showLyrics,
  onShowLyricsChange,
  showSyncedLyricsOnPlayBar,
  onShowSyncedLyricsOnPlayBarChange,
  syncLyricsDisplay,
  onSyncLyricsDisplayChange,
  crossfadeSeconds,
  onCrossfadeChange,
  systemAccentColor,
  musicFolders,
  trackCount,
  isDesktopApp,
  onAddMusicFolder,
  onRescanMusicLibrary,
  onRemoveMusicFolder,
  showBrowseSection,
  onShowBrowseSectionChange,
  showRadioSection,
  onShowRadioSectionChange,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState(() =>
    location.pathname.replace(/\/+$/, '').endsWith('/about') ? 'about' : 'appearance'
  );

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
        <div className='settings-section-content'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Theme</h3>
              <p>Choose a theme or follow your system appearance</p>
            </div>
            <div className='setting-control'>
              <div className='theme-options'>
                <button
                  className={`theme-option ${themeMode === 'light' ? 'active' : ''}`}
                  onClick={() => onThemeChange('light')}
                  aria-pressed={themeMode === 'light'}
                >
                  <span className='theme-icon light'></span>
                  <span>Light</span>
                </button>
                <button
                  className={`theme-option ${themeMode === 'dark' ? 'active' : ''}`}
                  onClick={() => onThemeChange('dark')}
                  aria-pressed={themeMode === 'dark'}
                >
                  <span className='theme-icon dark'></span>
                  <span>Dark</span>
                </button>
                <button
                  className={`theme-option ${themeMode === 'system' ? 'active' : ''}`}
                  onClick={() => onThemeChange('system')}
                  aria-pressed={themeMode === 'system'}
                >
                  <span className='theme-icon system'></span>
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Accent Color</h3>
              <p>Personalize highlights and controls across Luna</p>
            </div>
            <div className='setting-control accent-color-control'>
              <input
                type='color'
                aria-label='Accent color'
                value={accentColor}
                onChange={(event) => {
                  onAccentColorChange(event.currentTarget.value);
                  onUseSystemAccentColorChange(false);
                }}
              />
              {systemAccentColor && (
                <button
                  type='button'
                  className={`manage-button ${useSystemAccentColor ? 'active' : ''}`}
                  onClick={() => onUseSystemAccentColorChange(true)}
                  aria-pressed={useSystemAccentColor}
                >
                  {useSystemAccentColor ? 'Using system' : 'Use system'}
                </button>
              )}
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Icon Style</h3>
              <p>Choose a global icon treatment inspired by Material, Windows, Apple, or VLC.</p>
            </div>
            <div className='setting-control'>
              <select
                className='appearance-select'
                aria-label='Icon style'
                value={iconStyle}
                onChange={(event) => onIconStyleChange(event.currentTarget.value as IconStyle)}
              >
                <option value='material'>Material</option>
                <option value='windows'>Windows</option>
                <option value='apple'>Apple</option>
                <option value='vlc'>VLC</option>
                <option value='round-filled'>Round Filled</option>
                <option value='round-outline'>Round Outline</option>
              </select>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Song Seekbar Style</h3>
              <p>Choose a player-inspired progress bar design for both players</p>
            </div>
            <div className='setting-control'>
              <select
                className='appearance-select'
                aria-label='Song seekbar style'
                value={seekbarStyle}
                onChange={(event) =>
                  onSeekbarStyleChange(event.currentTarget.value as SeekbarStyle)
                }
              >
                <option value='default'>Default</option>
                <option value='windows'>Windows</option>
                <option value='vlc'>VLC</option>
                <option value='apple'>Apple</option>
                <option value='samsung'>Galaxy</option>
              </select>
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
        <div className='settings-section-content'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Music Folders</h3>
              <p>
                {isDesktopApp
                  ? `${musicFolders.length} folder(s) • ${trackCount} tracks indexed`
                  : 'Folder management is available in the desktop app'}
              </p>
            </div>
            <div className='setting-control'>
              {isDesktopApp && (
                <button type='button' className='manage-button' onClick={onAddMusicFolder}>
                  Add Folder
                </button>
              )}
            </div>
          </div>
          {musicFolders.length > 0 && (
            <div className='music-folder-list' aria-label='Indexed music folders'>
              {musicFolders.map((folder) => (
                <div className='music-folder-path' key={folder} title={folder}>
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    folder
                  </span>
                  <span>{folder}</span>
                  {isDesktopApp && (
                    <button
                      className='remove-music-folder'
                      type='button'
                      aria-label={`Remove ${folder} from music folders`}
                      onClick={() => onRemoveMusicFolder(folder)}
                    >
                      <span className='material-symbols-outlined' aria-hidden='true'>
                        close
                      </span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Rescan Library</h3>
              <p>Search the saved folders for new, changed, or missing tracks</p>
            </div>
            <div className='setting-control'>
              {isDesktopApp && (
                <button type='button' className='manage-button' onClick={onRescanMusicLibrary}>
                  Rescan
                </button>
              )}
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Browse section</h3>
              <p>Show Browse in the main sidebar</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Show Browse section in sidebar'
                  checked={showBrowseSection}
                  onChange={(event) => onShowBrowseSectionChange(event.currentTarget.checked)}
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Radio section</h3>
              <p>Show Radio in the main sidebar</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Show Radio section in sidebar'
                  checked={showRadioSection}
                  onChange={(event) => onShowRadioSectionChange(event.currentTarget.checked)}
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Synchronized lyrics on the play bar</h3>
              <p>Show a lyrics toggle when the current track has synchronized lyrics</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Show synchronized lyrics on the play bar'
                  checked={showSyncedLyricsOnPlayBar}
                  disabled={!showLyrics}
                  onChange={(event) =>
                    onShowSyncedLyricsOnPlayBarChange(event.currentTarget.checked)
                  }
                />
                <span className='toggle-slider'></span>
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
        <div className='settings-section-content'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Crossfade</h3>
              <p>Transition automatically between tracks in Repeat All mode</p>
            </div>
            <div className='setting-control'>
              <div className='range-slider'>
                <input
                  type='range'
                  min={0}
                  max={10}
                  step={1}
                  value={
                    Number.isInteger(crossfadeSeconds) &&
                    crossfadeSeconds >= 0 &&
                    crossfadeSeconds <= 10
                      ? crossfadeSeconds
                      : 0
                  }
                  aria-label='Crossfade duration in seconds'
                  onChange={(event) => onCrossfadeChange(Number(event.currentTarget.value))}
                />
                <span>{Number.isInteger(crossfadeSeconds) ? crossfadeSeconds : 0}s</span>
              </div>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Volume Normalization</h3>
              <p>Balance volume across tracks</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input type='checkbox' />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Gapless Playback</h3>
              <p>Seamless playback between tracks</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  disabled
                />
                <span className='toggle-slider'></span>
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
        <div className='settings-section-content'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Show Lyrics</h3>
              <p>Display lyrics when available</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Show lyrics when available'
                  checked={showLyrics}
                  onChange={(event) => onShowLyricsChange(event.currentTarget.checked)}
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className={`setting-item ${!showLyrics ? 'setting-item-disabled' : ''}`}>
            <div className='setting-info'>
              <h3>Synchronize lyric displays</h3>
              <p>Keep the play bar and Now Playing lyrics visibility in sync</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Synchronize lyric displays'
                  checked={syncLyricsDisplay}
                  disabled={!showLyrics}
                  onChange={(event) =>
                    onSyncLyricsDisplayChange(event.currentTarget.checked)
                  }
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Automatically download artist images</h3>
              <p>Fetch and cache artist images for the Artists page and Now Playing</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Automatically download artist images'
                  checked={autoDownloadArtistImages}
                  onChange={(event) =>
                    onAutoDownloadArtistImagesChange(event.currentTarget.checked)
                  }
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className={`setting-item ${!autoDownloadArtistImages ? 'setting-item-disabled' : ''}`}>
            <div className='setting-info'>
              <h3>Artist image background</h3>
              <p>Show the current artist’s web image behind Now Playing</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Show artist image background in Now Playing'
                  checked={showArtistImageBackground}
                  disabled={!autoDownloadArtistImages}
                  onChange={(event) =>
                    onShowArtistImageBackgroundChange(event.currentTarget.checked)
                  }
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Show Visualizer</h3>
              <p>Show an audio-reactive visualizer in Now Playing</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  checked={showVisualizer}
                  onChange={(event) => onShowVisualizerChange(event.currentTarget.checked)}
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className={`setting-item ${!showVisualizer ? 'setting-item-disabled' : ''}`}>
            <div className='setting-info'>
              <h3>Visualizer Design</h3>
              <p>Choose the waveform or spectrum appearance</p>
            </div>
            <div className='setting-control'>
              <select
                className='appearance-select'
                aria-label='Audio visualizer design'
                value={visualizerStyle}
                disabled={!showVisualizer}
                onChange={(event) =>
                  onVisualizerStyleChange(event.currentTarget.value as VisualizerStyle)
                }
              >
                <option value='wave-smooth'>Smooth Wave</option>
                <option value='wave-sharp'>Angular Wave</option>
                <option value='wave-organic'>Fine Wave</option>
                <option value='bars-thin'>Thin Bars</option>
                <option value='bars-rounded'>Rounded Bars</option>
                <option value='bars-outline'>Outlined Bars</option>
                <option value='bars-alternating'>Alternating Spectrum</option>
                <option value='bars-dense'>Dense Spectrum</option>
                <option value='bars-pill'>Capsule Bars</option>
              </select>
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
        <div className='settings-section-content about-content'>
          <div className='about-hero'>
            <div className='about-logo'>
              <span className='material-symbols-outlined' aria-hidden='true'>
                music_note
              </span>
            </div>
            <div className='about-heading'>
              <p className='about-eyebrow'>YOUR MUSIC, YOUR WAY</p>
              <h2>Luna Music</h2>
              <p className='version'>Version {packageMetadata.version}</p>
            </div>
          </div>
          <p className='about-description'>
            A personal music player for your local library. Enjoy your collection with a
            customizable player, synchronized lyrics, and an audio visualizer.
          </p>
          <div className='about-highlights'>
            <div className='about-highlight'>
              <span className='material-symbols-outlined' aria-hidden='true'>
                library_music
              </span>
              <div>
                <strong>Your library</strong>
                <span>Browse tracks, albums, artists, genres, and playlists.</span>
              </div>
            </div>
            <div className='about-highlight'>
              <span className='material-symbols-outlined' aria-hidden='true'>
                graphic_eq
              </span>
              <div>
                <strong>Made to listen</strong>
                <span>Shape the player with visualizer, lyrics, and appearance settings.</span>
              </div>
            </div>
            <div className='about-highlight'>
              <span className='material-symbols-outlined' aria-hidden='true'>
                devices
              </span>
              <div>
                <strong>Cross-platform</strong>
                <span>Built with React and Electron, with Capacitor support.</span>
              </div>
            </div>
          </div>
          <div className='about-meta'>
            <span>Running in</span>
            <strong>
              {window.electronAPI ? `${window.electronAPI.platform} desktop app` : 'Web browser'}
            </strong>
          </div>
          <div className='about-links'>
            <a
              href='https://github.com/draco-mordred/Luna'
              target='_blank'
              rel='noopener noreferrer'
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                code
              </span>
              <span>Source code</span>
            </a>
            <a
              href='https://github.com/draco-mordred/Luna/issues'
              target='_blank'
              rel='noopener noreferrer'
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                bug_report
              </span>
              <span>Report an issue</span>
            </a>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className='settings-page'>
      <header className='settings-header'>
        <button className='back-button' onClick={goBack}>
          <span className='material-symbols-outlined'>arrow_back</span>
        </button>
        <h1>Settings</h1>
      </header>

      <div className='settings-container'>
        {/* Sidebar Navigation */}
        <aside className='settings-sidebar'>
          <ul className='settings-nav'>
            {sections.map((section) => (
              <li key={section.id} className='settings-nav-item'>
                <button
                  className={`settings-nav-button ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.id)}
                >
                  <span className='material-symbols-outlined'>{section.icon}</span>
                  <span className='settings-nav-label'>{section.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Main Content */}
        <main className='settings-main'>
          <div key={activeSection}>
            {sections.find((s) => s.id === activeSection)?.component}
          </div>
        </main>
      </div>
    </div>
  );
};

export default memo(SettingsPage);
