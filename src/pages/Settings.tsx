import { memo, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  DesktopDeviceInfo,
  IconStyle,
  SeekbarStyle,
  VisualizerStyle,
  WindowMaterial,
} from '../types/electron';
import packageMetadata from '../../package.json';
import type { AndroidDeviceInfo } from '../services/androidMusicLibrary';
import ReleaseNotesDialog from '../components/ReleaseNotesDialog';
import {
  DEVELOPER_EMAIL,
  DEVELOPER_GITHUB,
  DEVELOPER_LINKEDIN,
  DEVELOPER_NAME,
} from '../constants/developer';
import { useDeveloperAvatar } from '../hooks/useDeveloperAvatar';
import './Settings.css';

type ThemeMode = 'light' | 'dark' | 'system';
type UpdateState = 'idle' | 'checking' | 'current' | 'available' | 'error';

const compareVersions = (left: string, right: string) => {
  const leftParts = left.replace(/^v/i, '').split('.').map(Number);
  const rightParts = right.replace(/^v/i, '').split('.').map(Number);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
};

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
  volumeNormalization: boolean;
  onVolumeNormalizationChange: (enabled: boolean) => void;
  gaplessPlayback: boolean;
  onGaplessPlaybackChange: (enabled: boolean) => void;
  systemAccentColor: string | null;
  musicFolders: string[];
  trackCount: number;
  isDesktopApp: boolean;
  alwaysOnTop: boolean;
  onAlwaysOnTopChange: (enabled: boolean) => void;
  isAndroidApp: boolean;
  androidBackgroundPlaybackEnabled: boolean;
  onAndroidBackgroundPlaybackChange: (enabled: boolean) => void;
  androidLockScreenControlsEnabled: boolean;
  onAndroidLockScreenControlsChange: (enabled: boolean) => void;
  androidDeviceInfo: AndroidDeviceInfo | null;
  androidMaterialYouEnabled: boolean;
  androidMaterialYouAvailable: boolean;
  androidMaterialYouLoading: boolean;
  androidMaterialYouError: string | null;
  onAndroidMaterialYouChange: (enabled: boolean) => void;
  androidAmoledDarkMode: boolean;
  onAndroidAmoledDarkModeChange: (enabled: boolean) => void;
  rememberRecentMedia: boolean;
  onRememberRecentMediaChange: (enabled: boolean) => void;
  onAddMusicFolder: () => void;
  onRescanMusicLibrary: () => void;
  onRemoveMusicFolder: (folder: string) => void;
  showBrowseSection: boolean;
  onShowBrowseSectionChange: (show: boolean) => void;
  showRadioSection: boolean;
  onShowRadioSectionChange: (show: boolean) => void;
  isWindowsDesktopApp: boolean;
  supportsWindowMaterial: boolean;
  windowMaterial: WindowMaterial;
  onWindowMaterialChange: (material: WindowMaterial) => void;
  materialRestartRequired: boolean;
  onRestartApp: () => void;
  onOpenWindowsDefaultApps: () => void;
}

type SettingsSection = {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
};

const SettingsCategory: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className={`settings-category${isExpanded ? ' is-expanded' : ''}`}>
      <button
        className='settings-category-toggle'
        type='button'
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span>{title}</span>
        <span className='material-symbols-outlined' aria-hidden='true'>
          expand_more
        </span>
      </button>
      <div className='settings-category-panel' aria-hidden={!isExpanded}>
        <div className='settings-category-content'>{children}</div>
      </div>
    </section>
  );
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
  volumeNormalization,
  onVolumeNormalizationChange,
  gaplessPlayback,
  onGaplessPlaybackChange,
  systemAccentColor,
  musicFolders,
  trackCount,
  isDesktopApp,
  alwaysOnTop,
  onAlwaysOnTopChange,
  isAndroidApp,
  androidBackgroundPlaybackEnabled,
  onAndroidBackgroundPlaybackChange,
  androidLockScreenControlsEnabled,
  onAndroidLockScreenControlsChange,
  androidDeviceInfo,
  androidMaterialYouEnabled,
  androidMaterialYouAvailable,
  androidMaterialYouLoading,
  androidMaterialYouError,
  onAndroidMaterialYouChange,
  androidAmoledDarkMode,
  onAndroidAmoledDarkModeChange,
  rememberRecentMedia,
  onRememberRecentMediaChange,
  onAddMusicFolder,
  onRescanMusicLibrary,
  onRemoveMusicFolder,
  showBrowseSection,
  onShowBrowseSectionChange,
  showRadioSection,
  onShowRadioSectionChange,
  isWindowsDesktopApp,
  supportsWindowMaterial,
  windowMaterial,
  onWindowMaterialChange,
  materialRestartRequired,
  onRestartApp,
  onOpenWindowsDefaultApps,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAboutReleaseNotes, setShowAboutReleaseNotes] = useState(false);
  const [desktopDeviceInfo, setDesktopDeviceInfo] = useState<DesktopDeviceInfo | null>(null);
  const [desktopDeviceInfoLoadFailed, setDesktopDeviceInfoLoadFailed] = useState(false);
  const developerAvatar = useDeveloperAvatar();
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [availableUpdate, setAvailableUpdate] = useState<{
    version: string;
    releaseUrl: string;
    downloadUrl: string;
  } | null>(null);
  const [showDeveloperInfo, setShowDeveloperInfo] = useState(false);
  const [activeSection, setActiveSection] = useState(() =>
    location.pathname.replace(/\/+$/, '').endsWith('/about') ? 'about' : 'appearance'
  );
  const [sectionHistory, setSectionHistory] = useState<string[]>([]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) return undefined;

    let active = true;
    api
      .getDesktopDeviceInfo()
      .then((deviceInfo) => {
        if (active) setDesktopDeviceInfo(deviceInfo);
      })
      .catch((error: unknown) => {
        console.error('Could not read desktop device information:', error);
        if (active) setDesktopDeviceInfoLoadFailed(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateState('checking');
    setAvailableUpdate(null);
    try {
      const response = await fetch('https://api.github.com/repos/draco-mordred/Luna/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) throw new Error(`GitHub update check failed (${response.status}).`);
      const release = (await response.json()) as {
        tag_name?: string;
        html_url?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
        draft?: boolean;
        prerelease?: boolean;
      };
      const latestVersion = release.tag_name?.replace(/^v/i, '');
      if (
        !latestVersion ||
        !release.html_url ||
        release.draft ||
        release.prerelease ||
        compareVersions(latestVersion, packageMetadata.version) <= 0
      ) {
        setUpdateState('current');
        return;
      }

      const platform = isAndroidApp
        ? 'android'
        : window.electronAPI?.platform === 'win32'
          ? 'windows'
          : window.electronAPI?.platform;
      const matchingAsset = release.assets?.find((asset) => {
        const name = asset.name.toLowerCase();
        if (platform === 'android') return name.endsWith('.apk');
        if (platform === 'windows') return name.endsWith('.exe') && !name.includes('portable');
        if (platform === 'darwin') return name.endsWith('.dmg');
        if (platform === 'linux') return name.endsWith('.appimage');
        return false;
      });
      setAvailableUpdate({
        version: latestVersion,
        releaseUrl: release.html_url,
        downloadUrl: matchingAsset?.browser_download_url ?? release.html_url,
      });
      setUpdateState('available');
    } catch (error) {
      console.error('Could not check for Luna updates:', error);
      setUpdateState('error');
    }
  };
  const desktopSystemName =
    desktopDeviceInfo?.systemName === 'Windows_NT'
      ? 'Windows'
      : desktopDeviceInfo?.systemName === 'Darwin'
        ? 'macOS'
        : desktopDeviceInfo?.systemName;
  const sessionIdLabel = desktopDeviceInfo?.sessionId
    ? desktopDeviceInfo.sessionId
    : desktopDeviceInfoLoadFailed
      ? 'Unavailable'
      : 'Loading…';

  // Navigation
  const goBack = () => {
    const previousSection = sectionHistory[sectionHistory.length - 1];
    if (previousSection) {
      setActiveSection(previousSection);
      setSectionHistory((history) => history.slice(0, -1));
      return;
    }
    navigate(-1);
  };

  const selectSection = (sectionId: string) => {
    if (sectionId === activeSection) return;
    setSectionHistory((history) => [...history, activeSection]);
    setActiveSection(sectionId);
  };

  // Settings sections
  const sections: SettingsSection[] = [
    {
      id: 'appearance',
      title: 'Appearance',
      icon: 'palette',
      component: (
        <div className='settings-section-content'>
          <SettingsCategory title='Theme and window behavior'>
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
          {isDesktopApp && (
            <div className='setting-item'>
              <div className='setting-info'>
                <h3>Always on top</h3>
                <p>Keep Luna above other windows, including in player modes</p>
              </div>
              <div className='setting-control'>
                <label className='toggle-switch'>
                  <input
                    type='checkbox'
                    checked={alwaysOnTop}
                    onChange={(event) => onAlwaysOnTopChange(event.currentTarget.checked)}
                    aria-label='Keep Luna always on top'
                  />
                  <span className='toggle-slider'></span>
                </label>
              </div>
            </div>
          )}
          {isAndroidApp && (
            <div
              className={`setting-item ${
                !androidMaterialYouAvailable ? 'setting-item-disabled' : ''
              }`}
            >
              <div className='setting-info'>
                <h3>Android Material You colors</h3>
                <p>
                  {androidMaterialYouError ??
                    (androidMaterialYouLoading
                      ? 'Checking Android color support…'
                      : androidMaterialYouAvailable
                        ? 'Use colors derived from your Android wallpaper'
                        : 'Wallpaper colors require Android 12 or later')}
                </p>
              </div>
              <div className='setting-control'>
                <label className='toggle-switch'>
                  <input
                    type='checkbox'
                    checked={androidMaterialYouEnabled}
                    disabled={!androidMaterialYouAvailable}
                    onChange={(event) => onAndroidMaterialYouChange(event.currentTarget.checked)}
                    aria-label='Use Android Material You colors'
                  />
                  <span className='toggle-slider'></span>
                </label>
              </div>
            </div>
          )}
          {isAndroidApp && (
            <div className={`setting-item ${themeMode === 'light' ? 'setting-item-disabled' : ''}`}>
              <div className='setting-info'>
                <h3>AMOLED dark mode</h3>
                <p>Use a true black background while dark theme is active</p>
              </div>
              <div className='setting-control'>
                <label className='toggle-switch'>
                  <input
                    type='checkbox'
                    checked={androidAmoledDarkMode}
                    disabled={themeMode === 'light'}
                    onChange={(event) =>
                      onAndroidAmoledDarkModeChange(event.currentTarget.checked)
                    }
                    aria-label='Use AMOLED black backgrounds in dark mode'
                  />
                  <span className='toggle-slider'></span>
                </label>
              </div>
            </div>
          )}
          </SettingsCategory>
          <SettingsCategory title='Colors and player appearance'>
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
          {isWindowsDesktopApp && (
            <div className='setting-item'>
              <div className='setting-info'>
                <h3>App background material</h3>
                <p>
                  {supportsWindowMaterial
                    ? materialRestartRequired
                      ? 'Restart Luna to apply this change'
                      : 'Mica adds a subtle wallpaper tint; Frosty uses a stronger Acrylic blur'
                    : 'Requires Windows 11 version 22H2 or newer'}
                </p>
              </div>
              <div className='setting-control window-material-control'>
                <select
                  className='appearance-select'
                  aria-label='App background material'
                  value={windowMaterial}
                  onChange={(event) =>
                    onWindowMaterialChange(event.currentTarget.value as WindowMaterial)
                  }
                >
                  <option value='default'>Default</option>
                  <option value='mica' disabled={!supportsWindowMaterial}>
                    Mica
                  </option>
                  <option value='frosty' disabled={!supportsWindowMaterial}>
                    Frosty
                  </option>
                </select>
                {supportsWindowMaterial && materialRestartRequired && (
                  <button type='button' className='manage-button' onClick={onRestartApp}>
                    Restart now
                  </button>
                )}
              </div>
            </div>
          )}
          {isWindowsDesktopApp && (
            <div className='setting-item'>
              <div className='setting-info'>
                <h3>Default audio player</h3>
                <p>
                  Install Luna with the Windows setup installer to register it, then choose it for
                  supported formats in Windows Default apps. Windows requires you to confirm each
                  format.
                </p>
              </div>
              <div className='setting-control default-audio-player-control'>
                <button type='button' className='manage-button' onClick={onOpenWindowsDefaultApps}>
                  Open Windows Default Apps
                </button>
              </div>
            </div>
          )}
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
          </SettingsCategory>
        </div>
      ),
    },
    {
      id: 'library',
      title: 'Library',
      icon: 'library_music',
      component: (
        <div className='settings-section-content'>
          <SettingsCategory title='History and queue'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Remember recent media</h3>
              <p>Keep play history, favorites, and the previous play queue on this device</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  checked={rememberRecentMedia}
                  onChange={(event) =>
                    onRememberRecentMediaChange(event.currentTarget.checked)
                  }
                  aria-label='Remember recent media'
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          </SettingsCategory>
          <SettingsCategory title='Music library'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>{isAndroidApp ? 'Music Library' : 'Music Folders'}</h3>
              <p>
                {isDesktopApp
                  ? `${musicFolders.length} folder(s) • ${trackCount} tracks indexed`
                  : isAndroidApp
                    ? `${trackCount} tracks found in the device audio library`
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
              <p>
                {isAndroidApp
                  ? 'Find audio files currently available in the device media library'
                  : 'Search the saved folders for new, changed, or missing tracks'}
              </p>
            </div>
            <div className='setting-control'>
              {(isDesktopApp || isAndroidApp) && (
                <button type='button' className='manage-button' onClick={onRescanMusicLibrary}>
                  {isAndroidApp ? 'Scan device' : 'Rescan'}
                </button>
              )}
            </div>
          </div>
          </SettingsCategory>
          <SettingsCategory title='Sidebar sections'>
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
          </SettingsCategory>
        </div>
      ),
    },
    {
      id: 'playback',
      title: 'Playback',
      icon: 'play_circle',
      component: (
        <div className='settings-section-content'>
          <SettingsCategory title='Playback and transitions'>
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
                <input
                  type='checkbox'
                  aria-label='Enable volume normalization'
                  checked={volumeNormalization}
                  onChange={(event) =>
                    onVolumeNormalizationChange(event.currentTarget.checked)
                  }
                />
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
                  aria-label='Enable gapless playback'
                  checked={gaplessPlayback}
                  onChange={(event) => onGaplessPlaybackChange(event.currentTarget.checked)}
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          {isAndroidApp && (
            <>
              <div className='setting-item'>
                <div className='setting-info'>
                  <h3>Background playback and notification controls</h3>
                  <p>
                    Keep playback active in a foreground service and show play, pause, skip, and
                    seek controls in Android notifications
                  </p>
                </div>
                <div className='setting-control'>
                  <label className='toggle-switch'>
                    <input
                      type='checkbox'
                      aria-label='Enable Android background playback and notification controls'
                      checked={androidBackgroundPlaybackEnabled}
                      onChange={(event) =>
                        onAndroidBackgroundPlaybackChange(event.currentTarget.checked)
                      }
                    />
                    <span className='toggle-slider'></span>
                  </label>
                </div>
              </div>
              <div className='setting-item'>
                <div className='setting-info'>
                  <h3>Lock-screen media controls</h3>
                  <p>Allow Android to show Luna playback controls on the lock screen</p>
                </div>
                <div className='setting-control'>
                  <label className='toggle-switch'>
                    <input
                      type='checkbox'
                      aria-label='Show Android lock-screen media controls'
                      checked={androidLockScreenControlsEnabled}
                      disabled={!androidBackgroundPlaybackEnabled}
                      onChange={(event) =>
                        onAndroidLockScreenControlsChange(event.currentTarget.checked)
                      }
                    />
                    <span className='toggle-slider'></span>
                  </label>
                </div>
              </div>
            </>
          )}
          </SettingsCategory>
        </div>
      ),
    },
    {
      id: 'nowplaying',
      title: 'Now Playing',
      icon: 'music_note',
      component: (
        <div className='settings-section-content'>
          <SettingsCategory title='Lyrics'>
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
                  onChange={(event) => onSyncLyricsDisplayChange(event.currentTarget.checked)}
                />
                <span className='toggle-slider'></span>
              </label>
            </div>
          </div>
          <div className={`setting-item ${!showLyrics ? 'setting-item-disabled' : ''}`}>
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
          </SettingsCategory>
          <SettingsCategory title='Artist imagery'>
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
          <div
            className={`setting-item ${!autoDownloadArtistImages ? 'setting-item-disabled' : ''}`}
          >
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
          </SettingsCategory>
          <SettingsCategory title='Visualizer'>
          <div className='setting-item'>
            <div className='setting-info'>
              <h3>Show Visualizer</h3>
              <p>Show an audio-reactive visualizer in Now Playing</p>
            </div>
            <div className='setting-control'>
              <label className='toggle-switch'>
                <input
                  type='checkbox'
                  aria-label='Show visualizer in Now Playing'
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
          </SettingsCategory>
        </div>
      ),
    },
    {
      id: 'about',
      title: 'About',
      icon: 'info',
      component: (
        <div className='settings-section-content about-content'>
          <SettingsCategory title='About Luna'>
          <div className='about-hero'>
            <div className='about-logo'>
              <img
                src={window.electronAPI ? `${process.env.PUBLIC_URL}/icon.png` : '/icon.png'}
                alt='Luna Music app icon'
              />
            </div>
            <div className='about-heading'>
              <p className='about-eyebrow'>YOUR MUSIC, YOUR WAY</p>
              <h2>Luna Music</h2>
              <div className='about-version-row'>
                <button
                  type='button'
                  className='about-release-notes-button'
                  onClick={() => setShowAboutReleaseNotes(true)}
                  aria-label={`Version ${packageMetadata.version}. Session ID: ${sessionIdLabel}. View release notes.`}
                  title='View release notes'
                >
                  <span>Version: {packageMetadata.version}</span>
                  {window.electronAPI && <span>Session ID: {sessionIdLabel}</span>}
                </button>
              </div>
            </div>
          </div>
          {showAboutReleaseNotes && (
            <ReleaseNotesDialog
              version={packageMetadata.version}
              onClose={() => setShowAboutReleaseNotes(false)}
            />
          )}
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
              {isAndroidApp
                ? 'Android app'
                : window.electronAPI
                  ? `${window.electronAPI.platform} desktop app`
                  : 'Web browser'}
            </strong>
          </div>
          {isAndroidApp && androidDeviceInfo && (
            <>
              <div className='about-meta'>
                <span>Device</span>
                <strong>
                  {[androidDeviceInfo.manufacturer, androidDeviceInfo.model]
                    .filter(Boolean)
                    .filter(
                      (value, index, values) =>
                        index === 0 || value.toLowerCase() !== values[0].toLowerCase()
                    )
                    .join(' ') || 'Android device'}
                </strong>
              </div>
              <div className='about-meta'>
                <span>Android version</span>
                <strong>
                  {androidDeviceInfo.androidVersion} (API {androidDeviceInfo.apiLevel})
                </strong>
              </div>
            </>
          )}
          {window.electronAPI && desktopDeviceInfo && (
            <>
              <div className='about-meta'>
                <span>Device</span>
                <strong>{desktopDeviceInfo.deviceName}</strong>
              </div>
              <div className='about-meta'>
                <span>System</span>
                <strong>
                  {desktopSystemName} {desktopDeviceInfo.systemVersion}
                </strong>
              </div>
              <div className='about-meta'>
                <span>Architecture</span>
                <strong>{desktopDeviceInfo.architecture}</strong>
              </div>
            </>
          )}
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
          </SettingsCategory>
          <SettingsCategory title='Updates'>
          <section className='about-updates' aria-label='Application updates'>
            <div className='about-update-copy'>
              <strong>App updates</strong>
              <span>
                {updateState === 'checking'
                  ? 'Checking GitHub for a newer version…'
                  : updateState === 'current'
                    ? 'You’re using the latest available version.'
                    : updateState === 'available' && availableUpdate
                      ? `Version ${availableUpdate.version} is available.`
                      : updateState === 'error'
                        ? 'Could not check for updates. Check your connection and try again.'
                        : 'Check GitHub for the latest Luna release.'}
              </span>
            </div>
            {updateState === 'available' && availableUpdate ? (
              <a
                className='about-update-button'
                href={availableUpdate.downloadUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                Download update
              </a>
            ) : (
              <button
                type='button'
                className='about-update-button'
                onClick={() => void handleCheckForUpdates()}
                disabled={updateState === 'checking'}
              >
                {updateState === 'checking' ? 'Checking…' : 'Check for updates'}
              </button>
            )}
          </section>
          </SettingsCategory>
          <SettingsCategory title='Developer information'>
          <section className={`about-developer${showDeveloperInfo ? ' is-expanded' : ''}`}>
            <button
              type='button'
              className='about-developer-toggle'
              aria-expanded={showDeveloperInfo}
              onClick={() => setShowDeveloperInfo((expanded) => !expanded)}
            >
              <span className='about-developer-identity'>
                {developerAvatar ? (
                  <img src={developerAvatar} alt='' />
                ) : (
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    account_circle
                  </span>
                )}
                <span className='about-developer-name'>
                  {showDeveloperInfo ? DEVELOPER_NAME : 'Developer information'}
                </span>
              </span>
              <span className='material-symbols-outlined' aria-hidden='true'>
                {showDeveloperInfo ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <div className='about-developer-details' aria-hidden={!showDeveloperInfo}>
              <a
                href={DEVELOPER_GITHUB}
                target='_blank'
                rel='noopener noreferrer'
                tabIndex={showDeveloperInfo ? 0 : -1}
              >
                <svg className='developer-brand-icon' viewBox='0 0 24 24' aria-hidden='true'>
                  <path
                    fill='currentColor'
                    d='M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.14.68-3.8-1.33-3.8-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15a10.8 10.8 0 0 1 5.64 0c2.15-1.45 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z'
                  />
                </svg>
                GitHub profile
              </a>
              <a
                href={DEVELOPER_LINKEDIN}
                target='_blank'
                rel='noopener noreferrer'
                tabIndex={showDeveloperInfo ? 0 : -1}
              >
                <svg className='developer-brand-icon' viewBox='0 0 24 24' aria-hidden='true'>
                  <path
                    fill='currentColor'
                    d='M20.45 2H3.55C2.69 2 2 2.68 2 3.52v16.96c0 .84.69 1.52 1.55 1.52h16.9c.86 0 1.55-.68 1.55-1.52V3.52c0-.84-.69-1.52-1.55-1.52ZM7.93 18.45H4.96V9.02h2.97v9.43ZM6.45 7.73a1.72 1.72 0 1 1 .02-3.44 1.72 1.72 0 0 1-.02 3.44Zm12 10.72h-2.96v-4.59c0-1.09-.02-2.49-1.52-2.49-1.53 0-1.76 1.19-1.76 2.41v4.67H9.25V9.02h2.84v1.29h.04c.4-.74 1.36-1.52 2.8-1.52 3 0 3.55 1.97 3.55 4.53v5.13Z'
                  />
                </svg>
                LinkedIn
              </a>
              <a href={`mailto:${DEVELOPER_EMAIL}`} tabIndex={showDeveloperInfo ? 0 : -1}>
                <span className='material-symbols-outlined' aria-hidden='true'>
                  mail
                </span>
                {DEVELOPER_EMAIL}
              </a>
            </div>
          </section>
          </SettingsCategory>
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
                  onClick={() => selectSection(section.id)}
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
          <div key={activeSection}>{sections.find((s) => s.id === activeSection)?.component}</div>
        </main>
      </div>
    </div>
  );
};

export default memo(SettingsPage);
