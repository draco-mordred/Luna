const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  selectFolders: () => ipcRenderer.invoke('select-folders'),
  scanFolders: (folders) => ipcRenderer.invoke('scan-folders', folders),
  onTouchBarPrevious: (callback) => ipcRenderer.on('touchbar-previous', callback),
  onTouchBarPlayPause: (callback) => ipcRenderer.on('touchbar-play-pause', callback),
  onTouchBarNext: (callback) => ipcRenderer.on('touchbar-next', callback),
});
