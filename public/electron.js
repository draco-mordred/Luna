const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    backgroundColor: '#111111',
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle window controls
  ipcMain.handle('minimize-window', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('close-window', () => {
    if (mainWindow) mainWindow.close();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Handle touch bar for Mac
if (process.platform === 'darwin') {
  const { TouchBar } = require('electron');
  const { TouchBarLabel, TouchBarButton, TouchBarSpacer } = TouchBar;

  const touchBar = new TouchBar([
    new TouchBarLabel('Luna Music'),
    new TouchBarSpacer({ size: 'large' }),
    new TouchBarButton({
      label: '←',
      click: () => mainWindow.webContents.send('touchbar-previous'),
    }),
    new TouchBarButton({
      label: '▮▮',
      click: () => mainWindow.webContents.send('touchbar-play-pause'),
    }),
    new TouchBarButton({
      label: '→',
      click: () => mainWindow.webContents.send('touchbar-next'),
    }),
  ]);

  mainWindow = new BrowserWindow({
    touchBar,
  });
}
