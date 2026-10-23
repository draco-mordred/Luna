const { app, BrowserWindow, ipcMain, dialog, protocol, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const { execFileSync } = require('child_process');
const { parseFile, selectCover } = require('music-metadata');

protocol.registerSchemesAsPrivileged([
  { scheme: 'luna-media', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

let mainWindow;
let indexedAudioPaths = new Set();
const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.m4a', '.wav', '.flac', '.ogg', '.oga', '.aac', '.mp4', '.m4b',
  '.m4p', '.mpg', '.mp2', '.mpe', '.mpeg', '.wma', '.wmv', '.asf', '.aif',
  '.aiff', '.aifc',
]);
const AUDIO_MIME_TYPES = {
  '.aac': 'audio/aac',
  '.aif': 'audio/aiff',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.m4b': 'audio/mp4',
  '.mp4': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wma': 'audio/x-ms-wma',
};
const ARTWORK_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
};

const getLibraryPath = () => path.join(app.getPath('userData'), 'music-library.json');
const getSettingsPath = () => path.join(app.getPath('userData'), 'app-settings.json');
const getArtworkPath = (fileName) => path.join(app.getPath('userData'), 'artwork', fileName);
const DEFAULT_SETTINGS = {
  themeMode: 'system',
  accentColor: '#ff4444',
  lastPlayedTrackPath: null,
};
let appSettingsWriteQueue = Promise.resolve();

const readJsonFile = async (filePath, fallback) => {
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
};

const writeJsonFile = async (filePath, value) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp`;
  await fs.promises.writeFile(temporaryPath, JSON.stringify(value, null, 2), 'utf8');
  await fs.promises.rename(temporaryPath, filePath);
};

const readLibraryConfig = async () => {
  const library = await readJsonFile(getLibraryPath(), { folders: [], tracks: [] });
  return {
    folders: Array.isArray(library.folders) ? library.folders.filter(folder => typeof folder === 'string') : [],
    tracks: Array.isArray(library.tracks) ? library.tracks : [],
  };
};

const decodeTextBuffer = (buffer, fallback = 'utf8') => {
  if (!Buffer.isBuffer(buffer)) return '';
  if (buffer.length === 0) return '';

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    try {
      return buffer.toString('utf16le').replace(/\u0000+$/, '').trim();
    } catch (error) {
      return '';
    }
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    try {
      return buffer.toString('utf16be').replace(/\u0000+$/, '').trim();
    } catch (error) {
      return '';
    }
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 64));
  const hasUtf16Nulls = sample.some((byte, index) => index % 2 === 1 && byte === 0);
  if (hasUtf16Nulls) {
    try {
      return buffer.toString('utf16le').replace(/\u0000+$/, '').trim();
    } catch (error) {
      return '';
    }
  }

  const utf8Text = buffer.toString('utf8');
  if (utf8Text.includes('\uFFFD')) {
    const latin1Text = buffer.toString('latin1');
    return latin1Text.replace(/\u0000/g, '').trim();
  }

  try {
    const decoded = buffer.toString(fallback);
    return decoded.replace(/\u0000/g, '').trim();
  } catch (error) {
    try {
      return buffer.toString('latin1').replace(/\u0000/g, '').trim();
    } catch (innerError) {
      return '';
    }
  }
};

const normalizeTextValue = (value) => {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (Buffer.isBuffer(value)) return decodeTextBuffer(value).trim();
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeTextValue(entry))
      .filter(Boolean)
      .join('\n');
  }
  if (typeof value === 'object') {
    if (typeof value.text === 'string') return value.text.trim();
    if (typeof value.value === 'string') return value.value.trim();
    if (typeof value.data === 'string') return value.data.trim();
    if (Buffer.isBuffer(value.data)) return decodeTextBuffer(value.data).trim();
    if (typeof value.description === 'string' && !/lyrics/i.test(value.description)) {
      return value.description.trim();
    }
  }
  return '';
};

const parseTimestampToSeconds = (token) => {
  if (typeof token !== 'string') return null;

  const normalized = token.trim().replace(/\[,]/g, '.').replace(/\[|\]/g, '');
  if (!normalized) return null;

  const parts = normalized.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  try {
    const values = parts.map((part) => Number.parseFloat(part));
    if (values.some((value) => !Number.isFinite(value))) return null;

    if (parts.length === 2) {
      return values[0] * 60 + values[1];
    }

    return values[0] * 3600 + values[1] * 60 + values[2];
  } catch (error) {
    return null;
  }
};

const parseSyncedLyrics = (rawText) => {
  if (typeof rawText !== 'string') return [];

  const lines = rawText.replace(/\r/g, '').split(/\n+/);
  const cues = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const openBracketMatches = [...trimmed.matchAll(/\[(\d{1,2}:\d{2}(?:[.,]\d{1,3})?|\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?|\d{1,2}:\d{2}(?:[.,]\d{1,3})?\s*\+\d{2}?:\d{2})\]/g)];

    if (openBracketMatches.length > 0) {
      for (const match of openBracketMatches) {
        const timestampToken = match[1];
        const time = parseTimestampToSeconds(timestampToken);
        const valueAfter = trimmed.slice(match.index + match[0].length).trim();
        if (Number.isFinite(time) && valueAfter) {
          cues.push({ time, text: valueAfter });
        }
      }
      continue;
    }

    const vttMatch = trimmed.match(/^(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*$/);
    if (vttMatch) {
      continue;
    }

    const promptMatch = trimmed.match(/^(\d{1,2}:\d{2}(?:[.,]\d{1,3})?|\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)(?:\s*[-–:]\s*|\s+)(.+)$/);
    if (promptMatch) {
      const time = parseTimestampToSeconds(promptMatch[1]);
      const text = promptMatch[2].trim();
      if (Number.isFinite(time) && text) {
        cues.push({ time, text });
      }
    }
  }

  return cues
    .filter((entry) => entry && entry.text)
    .sort((a, b) => a.time - b.time);
};

const extractLyrics = (metadata) => {
  const flattenValues = (value, result = []) => {
    if (value == null) return result;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) result.push(trimmed);
      return result;
    }
    if (Buffer.isBuffer(value)) {
      const decoded = value.toString('utf8').trim();
      if (decoded) result.push(decoded);
      return result;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => flattenValues(item, result));
      return result;
    }
    if (typeof value === 'object') {
      if (typeof value.text === 'string') {
        const trimmed = value.text.trim();
        if (trimmed) result.push(trimmed);
      }
      if (typeof value.value === 'string') {
        const trimmed = value.value.trim();
        if (trimmed) result.push(trimmed);
      }
      if (typeof value.description === 'string') {
        const trimmed = value.description.trim();
        if (trimmed && !/lyrics/i.test(trimmed)) result.push(trimmed);
      }
      if (typeof value.data === 'string') {
        const trimmed = value.data.trim();
        if (trimmed) result.push(trimmed);
      }
      Object.values(value).forEach((item) => flattenValues(item, result));
    }
    return result;
  };

  const rawValues = [
    metadata?.common?.lyrics,
    metadata?.common?.comment,
    metadata?.native,
    metadata?.common?.description,
  ].flatMap((value) => flattenValues(value));

  const decodedRawValues = rawValues
    .map((value) => {
      const normalized = normalizeTextValue(value);
      return normalized || undefined;
    })
    .filter((value) => typeof value === 'string' && value.trim().length > 0);

  const syncedLyrics = decodedRawValues.flatMap((value) => parseSyncedLyrics(value));
  const dedupedSyncedLyrics = [];
  const seenSyncedKeys = new Set();

  for (const entry of syncedLyrics) {
    const key = `${entry.time.toFixed(3)}::${entry.text}`;
    if (!seenSyncedKeys.has(key)) {
      dedupedSyncedLyrics.push(entry);
      seenSyncedKeys.add(key);
    }
  }

  const plainText = decodedRawValues
    .filter((value) => !/\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\]/.test(value))
    .filter((value, index, array) => array.indexOf(value) === index)
    .join('\n\n');

  return {
    lyrics: plainText || undefined,
    syncedLyrics: dedupedSyncedLyrics.length > 0 ? dedupedSyncedLyrics : undefined,
  };
};

const getWindowsAccentColor = () => {
  if (process.platform !== 'win32') return null;
  try {
    const output = execFileSync('reg.exe', [
      'query',
      'HKCU\\Software\\Microsoft\\Windows\\DWM',
      '/v',
      'ColorizationColor',
    ], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const match = /ColorizationColor\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(output);
    if (!match) return null;
    return `#${match[1].slice(-6).padStart(6, '0')}`;
  } catch (error) {
    console.warn('Could not read the Windows accent color:', error.message);
    return null;
  }
};

const readAppSettings = async () => {
  const saved = await readJsonFile(getSettingsPath(), {});
  const systemAccentColor = getWindowsAccentColor();
  const settings = {
    themeMode: ['light', 'dark', 'system'].includes(saved.themeMode) ? saved.themeMode : DEFAULT_SETTINGS.themeMode,
    accentColor: /^#[\da-f]{6}$/i.test(saved.accentColor || '')
      ? saved.accentColor
      : systemAccentColor || DEFAULT_SETTINGS.accentColor,
    lastPlayedTrackPath: typeof saved.lastPlayedTrackPath === 'string' ? saved.lastPlayedTrackPath : null,
    systemTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    systemAccentColor,
    platform: process.platform,
  };
  if (
    saved.themeMode !== settings.themeMode
    || saved.accentColor !== settings.accentColor
    || (saved.lastPlayedTrackPath ?? null) !== settings.lastPlayedTrackPath
  ) {
    await writeJsonFile(getSettingsPath(), {
      themeMode: settings.themeMode,
      accentColor: settings.accentColor,
      lastPlayedTrackPath: settings.lastPlayedTrackPath,
    });
  }
  return settings;
};

const updateAppSettings = async (patch) => {
  const current = await readJsonFile(getSettingsPath(), DEFAULT_SETTINGS);
  const next = { ...DEFAULT_SETTINGS, ...current };
  if (patch.themeMode !== undefined) {
    if (!['light', 'dark', 'system'].includes(patch.themeMode)) throw new TypeError('Invalid theme mode.');
    next.themeMode = patch.themeMode;
  }
  if (patch.accentColor !== undefined) {
    if (typeof patch.accentColor !== 'string' || !/^#[\da-f]{6}$/i.test(patch.accentColor)) {
      throw new TypeError('Accent color must be a six-digit hexadecimal color.');
    }
    next.accentColor = patch.accentColor;
  }
  if (patch.lastPlayedTrackPath !== undefined) {
    if (patch.lastPlayedTrackPath !== null && typeof patch.lastPlayedTrackPath !== 'string') {
      throw new TypeError('Last played track path must be a string or null.');
    }
    next.lastPlayedTrackPath = patch.lastPlayedTrackPath;
  }
  await writeJsonFile(getSettingsPath(), next);
  return readAppSettings();
};

const saveAppSettings = (patch) => {
  const update = appSettingsWriteQueue.then(() => updateAppSettings(patch));
  appSettingsWriteQueue = update.then(() => undefined, () => undefined);
  return update;
};

const saveEmbeddedArtwork = async (picture, trackPath, stat) => {
  const extension = ARTWORK_MIME_TYPES[picture?.format?.toLowerCase()];
  if (!extension || !Buffer.isBuffer(picture.data) || picture.data.length > 20 * 1024 * 1024) return undefined;

  const cacheKey = crypto.createHash('sha256')
    .update(`${trackPath}\0${stat.size}\0${stat.mtimeMs}`)
    .digest('hex');
  const fileName = `${cacheKey}.${extension}`;
  const artworkPath = getArtworkPath(fileName);
  await fs.promises.mkdir(path.dirname(artworkPath), { recursive: true });
  await fs.promises.writeFile(artworkPath, picture.data);
  return `luna-media://artwork/${fileName}`;
};

const isWithinDirectory = (filePath, directory) => {
  const relative = path.relative(directory, filePath);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
};

const scanMusicFolders = async (folders, cachedTracks = []) => {
  const tracks = [];
  const errors = [];
  const unavailableDirectories = [];
  const seenPaths = new Set();
  const cachedByPath = new Map(cachedTracks.map(track => [track.path, track]));

  const shouldReuseCachedTrack = (cachedTrack, stat) => (
    cachedTrack
    && cachedTrack.metadataVersion >= 2
    && cachedTrack.size === stat.size
    && cachedTrack.lastModified === stat.mtimeMs
    && typeof cachedTrack.path === 'string'
    && !cachedTrack.lyrics?.trim() === false
  );

  const visitDirectory = async (directory) => {
    let entries;
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (error) {
      errors.push(`Cannot read "${directory}": ${error.message}`);
      unavailableDirectories.push(directory);
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visitDirectory(entryPath);
        continue;
      }
      if (!entry.isFile() || !AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
      if (seenPaths.has(entryPath)) continue;
      seenPaths.add(entryPath);

      try {
        const stat = await fs.promises.stat(entryPath);
        const cachedTrack = cachedByPath.get(entryPath);
        if (shouldReuseCachedTrack(cachedTrack, stat)) {
          tracks.push({
            ...cachedTrack,
            id: entryPath,
            path: entryPath,
            src: `luna-media://track/${Buffer.from(entryPath).toString('base64url')}`,
          });
          continue;
        }
        let metadata = null;
        try {
          metadata = await parseFile(entryPath, { duration: true });
        } catch (error) {
          console.warn(`Could not read audio metadata for "${entryPath}":`, error.message);
        }

        const common = metadata?.common ?? {};
        const filename = path.basename(entry.name, path.extname(entry.name));
        let albumArt;
        try {
          albumArt = await saveEmbeddedArtwork(selectCover(common.picture), entryPath, stat);
        } catch (error) {
          console.warn(`Could not cache embedded artwork for "${entryPath}":`, error.message);
        }
        const lyricData = extractLyrics(metadata);

        tracks.push({
          id: entryPath,
          path: entryPath,
          src: `luna-media://track/${Buffer.from(entryPath).toString('base64url')}`,
          filename: entry.name,
          name: common.title || filename,
          artist: common.artist || 'Unknown Artist',
          album: common.album || 'Unknown Album',
          albumArt,
          lyrics: lyricData.lyrics,
          syncedLyrics: lyricData.syncedLyrics,
          metadataVersion: 2,
          duration: metadata?.format?.duration || 0,
          trackNumber: common.track?.no || undefined,
          year: common.year || undefined,
          genre: common.genre?.[0] || undefined,
          composer: Array.isArray(common.composer)
            ? common.composer[0]
            : common.composer || undefined,
          format: path.extname(entry.name).slice(1).toLowerCase(),
          size: stat.size,
          lastModified: stat.mtimeMs,
        });
      } catch (error) {
        seenPaths.delete(entryPath);
        errors.push(`Cannot index "${entryPath}": ${error.message}`);
        unavailableDirectories.push(path.dirname(entryPath));
      }
    }
  };

  for (const folder of folders) {
    await visitDirectory(folder);
  }

  const retainedTracks = cachedTracks.filter(track => (
    unavailableDirectories.some(directory => isWithinDirectory(track.path, directory))
    && !seenPaths.has(track.path)
  ));
  return { tracks: [...tracks, ...retainedTracks], errors };
};

const removeStaleMetadataCache = async () => {
  try {
    const library = await readLibraryConfig();
    if (library.tracks.length === 0) return;

    const updatedTracks = library.tracks.map((track) => {
      if (!track || typeof track.path !== 'string') return track;
      if (track.metadataVersion === 1 || track.metadataVersion === undefined) {
        return { ...track, metadataVersion: 2, lyrics: undefined };
      }
      return track;
    });

    await writeJsonFile(getLibraryPath(), { folders: library.folders, tracks: updatedTracks });
  } catch (error) {
    console.warn('Could not clear stale cached music metadata:', error.message);
  }
};

const selectMusicFolders = async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Music Folders',
    buttonLabel: 'Add Folder',
    properties: ['openDirectory', 'multiSelections'],
  });
  return result.canceled ? [] : result.filePaths;
};

const scanAndSaveLibrary = async (folders, cachedTracks = []) => {
  const normalizedFolders = [...new Set(folders)];
  const { tracks, errors } = await scanMusicFolders(normalizedFolders, cachedTracks);
  indexedAudioPaths = new Set(tracks.map(track => track.path));
  const library = { folders: normalizedFolders, tracks };
  await writeJsonFile(getLibraryPath(), library);
  return { ...library, errors };
};

ipcMain.handle('load-music-library', async () => {
  const library = await readLibraryConfig();
  indexedAudioPaths = new Set(library.tracks.filter(track => typeof track.path === 'string').map(track => track.path));
  if (library.folders.length === 0) {
    const selectedFolders = await selectMusicFolders();
    if (selectedFolders.length > 0) {
      const initialLibrary = await scanAndSaveLibrary(selectedFolders, library.tracks);
      return { ...initialLibrary, initialScan: true };
    }
  }
  return { ...library, errors: [] };
});

ipcMain.handle('load-app-settings', () => readAppSettings());
ipcMain.handle('save-app-settings', (_event, patch) => saveAppSettings(patch));
ipcMain.handle('get-window-state', () => Boolean(mainWindow && mainWindow.isMaximized()));
ipcMain.handle('toggle-window-maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

ipcMain.handle('select-music-folders', async () => {
  const selectedFolders = await selectMusicFolders();
  if (selectedFolders.length === 0) return null;
  const currentLibrary = await readLibraryConfig();
  return scanAndSaveLibrary([...currentLibrary.folders, ...selectedFolders], currentLibrary.tracks);
});

ipcMain.handle('rescan-music-library', async () => {
  const library = await readLibraryConfig();
  return scanAndSaveLibrary(library.folders, library.tracks);
});

ipcMain.handle('remove-music-folder', async (_event, folder) => {
  if (typeof folder !== 'string') {
    throw new TypeError('A music folder path is required.');
  }
  const library = await readLibraryConfig();
  if (!library.folders.includes(folder)) {
    throw new Error('The requested folder is not part of the music library.');
  }
  return scanAndSaveLibrary(library.folders.filter(savedFolder => savedFolder !== folder), library.tracks);
});

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

function createWindow() {
  mainWindow = new BrowserWindow({
    title: 'Luna Music',
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 300,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    frame: process.platform !== 'win32',
    backgroundColor: '#111111',
  });

  if (!app.isPackaged || process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window-state-changed', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window-state-changed', false));
}

app.whenReady().then(() => {
  nativeTheme.themeSource = 'system';
  void removeStaleMetadataCache();
  nativeTheme.on('updated', () => {
    mainWindow?.webContents.send('system-theme-changed', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  });
  protocol.handle('luna-media', async (request) => {
    const mediaUrl = new URL(request.url);
    const requestPath = mediaUrl.pathname;
    if (mediaUrl.hostname === 'artwork') {
      const fileName = requestPath.slice(1);
      if (!/^[a-f\d]{64}\.(?:jpg|png|gif|webp|bmp)$/i.test(fileName)) {
        return new Response('Invalid artwork path.', { status: 400 });
      }
      try {
        const artwork = await fs.promises.readFile(getArtworkPath(fileName));
        const extension = path.extname(fileName).toLowerCase();
        const contentType = Object.entries(ARTWORK_MIME_TYPES)
          .find(([, supportedExtension]) => `.${supportedExtension}` === extension)?.[0];
        if (!contentType) return new Response('Unsupported artwork format.', { status: 415 });
        return new Response(request.method === 'HEAD' ? null : artwork, {
          headers: {
            'Content-Type': contentType,
            'Content-Length': String(artwork.length),
            'X-Content-Type-Options': 'nosniff',
          },
        });
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error(`Could not access cached artwork "${fileName}":`, error);
          return new Response('Could not read cached artwork.', { status: 500 });
        }
        return new Response('Artwork is not available.', { status: 404 });
      }
    }

    const encodedPath = requestPath.slice(1);
    const filePath = Buffer.from(encodedPath, 'base64url').toString();
    if (!indexedAudioPaths.has(filePath)) {
      return new Response('Audio file is not in the indexed music library.', { status: 404 });
    }

    let stat;
    try {
      stat = await fs.promises.stat(filePath);
    } catch (error) {
      console.error(`Could not access indexed audio file "${filePath}":`, error);
      return new Response('Audio file is no longer available.', { status: 404 });
    }

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Content-Type': AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    const range = request.headers.get('range');
    let start = 0;
    let end = stat.size - 1;
    let status = 200;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
      }

      if (!match[1]) {
        const suffixLength = Number(match[2]);
        start = Math.max(0, stat.size - suffixLength);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
      }

      if (start >= stat.size || start > end) {
        return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
      }
      status = 206;
      headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    }

    headers.set('Content-Length', String(end - start + 1));
    if (request.method === 'HEAD') return new Response(null, { status, headers });

    const fileStream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(fileStream), { status, headers });
  });
  createWindow();
});

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
      click: () => {
        if (mainWindow) mainWindow.webContents.send('touchbar-previous');
      },
    }),
    new TouchBarButton({
      label: '▮▮',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('touchbar-play-pause');
      },
    }),
    new TouchBarButton({
      label: '→',
      click: () => {
        if (mainWindow) mainWindow.webContents.send('touchbar-next');
      },
    }),
  ]);

  // Create a new window with touch bar or update existing
  if (mainWindow) {
    mainWindow.setTouchBar(touchBar);
  }
}
