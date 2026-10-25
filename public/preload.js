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
  loadMusicLibrary: () => ipcRenderer.invoke('load-music-library'),
  loadAppSettings: () => ipcRenderer.invoke('load-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),
  savePlaylists: (playlists) => ipcRenderer.invoke('save-playlists', playlists),
  selectMusicFolders: () => ipcRenderer.invoke('select-music-folders'),
  rescanMusicLibrary: () => ipcRenderer.invoke('rescan-music-library'),
  removeMusicFolder: (folder) => ipcRenderer.invoke('remove-music-folder', folder),
  saveTrackMetadata: (trackPath, metadata) => ipcRenderer.invoke('save-track-metadata', trackPath, metadata),
  onWindowStateChanged: (callback) => subscribe('window-state-changed', callback),
  onSystemThemeChanged: (callback) => subscribe('system-theme-changed', callback),
  onTouchBarPrevious: (callback) => ipcRenderer.on('touchbar-previous', callback),
  onTouchBarPlayPause: (callback) => ipcRenderer.on('touchbar-play-pause', callback),
  onTouchBarNext: (callback) => ipcRenderer.on('touchbar-next', callback),
});
