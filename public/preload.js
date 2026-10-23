const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  onTouchBarPrevious: (callback) => ipcRenderer.on('touchbar-previous', callback),
  onTouchBarPlayPause: (callback) => ipcRenderer.on('touchbar-play-pause', callback),
  onTouchBarNext: (callback) => ipcRenderer.on('touchbar-next', callback),
});
