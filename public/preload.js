const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  toggleWindowMaximize: () => ipcRenderer.invoke('toggle-window-maximize'),
  getWindowState: () => ipcRenderer.invoke('get-window-state'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  restartApp: (windowMaterial) => ipcRenderer.invoke('restart-app', windowMaterial),
  isLocalTrackAvailable: (trackPath) =>
    ipcRenderer.invoke('is-local-track-available', trackPath),
  activateOpenAudioFiles: () => ipcRenderer.invoke('activate-open-audio-files'),
  loadOpenAudioFiles: (filePaths) => ipcRenderer.invoke('load-open-audio-files', filePaths),
  openWindowsDefaultApps: () => ipcRenderer.invoke('open-windows-default-apps'),
  loadMusicLibrary: () => ipcRenderer.invoke('load-music-library'),
  loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),
  loadReleaseNotes: (version) => ipcRenderer.invoke('load-release-notes', version),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  audiomackHasCredentials: () => ipcRenderer.invoke('audiomack-has-credentials'),
  audiomackSaveCredentials: (consumerKey, consumerSecret) =>
    ipcRenderer.invoke('audiomack-save-credentials', consumerKey, consumerSecret),
  audiomackClearCredentials: () => ipcRenderer.invoke('audiomack-clear-credentials'),
  audiomackSearchTracks: (query) => ipcRenderer.invoke('audiomack-search-tracks', query),
  audiomackPlayTrack: (musicId, session) =>
    ipcRenderer.invoke('audiomack-play-track', musicId, session),
  savePlaylists: (playlists) => ipcRenderer.invoke('save-playlists', playlists),
  selectMusicFolders: () => ipcRenderer.invoke('select-music-folders'),
  rescanMusicLibrary: () => ipcRenderer.invoke('rescan-music-library'),
  removeMusicFolder: (folder) => ipcRenderer.invoke('remove-music-folder', folder),
  saveTrackMetadata: (trackPath, metadata) =>
    ipcRenderer.invoke('save-track-metadata', trackPath, metadata),
  onWindowStateChanged: (callback) => subscribe('window-state-changed', callback),
  onWindowFocusChanged: (callback) => subscribe('window-focus-changed', callback),
  onSystemThemeChanged: (callback) => subscribe('system-theme-changed', callback),
  onMusicLibraryScanProgress: (callback) => subscribe('music-library-scan-progress', callback),
  onOpenAudioFiles: (callback) => subscribe('open-audio-files', callback),
  setTaskbarPlaybackState: (isPlaying) => ipcRenderer.send('taskbar-playback-state', isPlaying),
  onTaskbarPrevious: (callback) => subscribe('taskbar-previous', callback),
  onTaskbarPlayPause: (callback) => subscribe('taskbar-play-pause', callback),
  onTaskbarNext: (callback) => subscribe('taskbar-next', callback),
  onTouchBarPrevious: (callback) => ipcRenderer.on('touchbar-previous', callback),
  onTouchBarPlayPause: (callback) => ipcRenderer.on('touchbar-play-pause', callback),
  onTouchBarNext: (callback) => ipcRenderer.on('touchbar-next', callback),
});
