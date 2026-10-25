const { app, BrowserWindow, ipcMain, dialog, protocol, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Readable } = require('stream');
const { execFileSync } = require('child_process');
const { parseFile, selectCover } = require('music-metadata');
const { ByteVector, File: TagLibFile, Picture, PictureType } = require('node-taglib-sharp');
const { extractEmbeddedLyrics } = require('./lyrics');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'luna-media',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

let mainWindow;
let indexedAudioPaths = new Set();
const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.m4a',
  '.wav',
  '.flac',
  '.ogg',
  '.oga',
  '.aac',
  '.mp4',
  '.m4b',
  '.m4p',
  '.mpg',
  '.mp2',
  '.mpe',
  '.mpeg',
  '.wma',
  '.wmv',
  '.asf',
  '.aif',
  '.aiff',
  '.aifc',
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
const EDITABLE_AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.mp4', '.ogg', '.oga']);
const EDITABLE_ARTWORK_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/bmp',
]);

const getLibraryPath = () => path.join(app.getPath('userData'), 'music-library.json');
const getPlaylistsPath = () => path.join(app.getPath('userData'), 'playlists.json');
const getSettingsPath = () => path.join(app.getPath('userData'), 'settings.ini');
const getLegacySettingsPath = () => path.join(app.getPath('userData'), 'app-settings.json');
const getArtworkPath = (fileName) => path.join(app.getPath('userData'), 'artwork', fileName);
const DEFAULT_SETTINGS = {
  themeMode: 'system',
  accentColor: '#ff4444',
  lastPlayedTrackPath: null,
  crossfadeSeconds: 0,
  iconStyle: 'material',
  seekbarStyle: 'default',
  visualizerStyle: 'wave-smooth',
  showVisualizer: false,
  autoDownloadArtistImages: true,
  showArtistImageBackground: false,
  showLyrics: true,
  isShuffled: false,
  repeatMode: 'off',
  showBrowseSection: true,
  showRadioSection: true,
  showSpotifySection: true,
};
let appSettingsWriteQueue = Promise.resolve();
let settingsFlushInProgress = false;
let allowQuitAfterSettingsFlush = false;

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

let libraryWriteQueue = Promise.resolve();
let playlistWriteQueue = Promise.resolve();
const updateLibraryConfig = (update) => {
  const operation = libraryWriteQueue
    .catch(() => undefined)
    .then(async () => {
      const current = await readLibraryConfig();
      const next = update(current);
      await writeJsonFile(getLibraryPath(), next);
      return next;
    });
  libraryWriteQueue = operation;
  return operation;
};
const writePlaylists = (playlists) => {
  const operation = playlistWriteQueue
    .catch(() => undefined)
    .then(() => writeJsonFile(getPlaylistsPath(), playlists));
  playlistWriteQueue = operation;
  return operation;
};

const parseIniValue = (value) => {
  if (value === '') return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
};

const readIniFile = async (filePath) => {
  const contents = await fs.promises.readFile(filePath, 'utf8');
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith('#') || trimmed.startsWith('['))
      continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    values[key] = parseIniValue(trimmed.slice(separator + 1).trim());
  }
  return values;
};

const writeIniFile = async (filePath, values) => {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  const lines = [
    '; Luna Music Player',
    `; Version: ${app.getVersion()}`,
    '[Settings]',
    ...Object.entries(values).map(
      ([key, value]) => `${key}=${value === null ? '' : String(value)}`
    ),
    '',
  ];
  const temporaryPath = `${filePath}.tmp`;
  await fs.promises.writeFile(temporaryPath, lines.join('\n'), 'utf8');
  await fs.promises.rename(temporaryPath, filePath);
};

const readSettingsFile = async () => {
  try {
    return await readIniFile(getSettingsPath());
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    const legacySettings = await readJsonFile(getLegacySettingsPath(), {});
    if (Object.keys(legacySettings).length > 0) {
      await writeIniFile(getSettingsPath(), { ...DEFAULT_SETTINGS, ...legacySettings });
      return { ...DEFAULT_SETTINGS, ...legacySettings };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return {};
};

const persistSettings = (settings) => {
  const persisted = { ...settings };
  delete persisted.systemTheme;
  delete persisted.systemAccentColor;
  delete persisted.platform;
  return writeIniFile(getSettingsPath(), persisted);
};

const readLibraryConfig = async () => {
  const library = await readJsonFile(getLibraryPath(), { folders: [], tracks: [] });
  return {
    folders: Array.isArray(library.folders)
      ? library.folders.filter((folder) => typeof folder === 'string')
      : [],
    tracks: Array.isArray(library.tracks)
      ? library.tracks.map((track) =>
          track && track.metadataVersion < 5
            ? { ...track, lyrics: undefined, syncedLyrics: undefined }
            : track
        )
      : [],
  };
};

const readPlaylists = async () => {
  const playlists = await readJsonFile(getPlaylistsPath(), []);
  return Array.isArray(playlists)
    ? playlists.filter(
        (playlist) =>
          playlist &&
          typeof playlist.id === 'string' &&
          typeof playlist.name === 'string' &&
          Array.isArray(playlist.trackIds) &&
          playlist.trackIds.every((trackId) => typeof trackId === 'string') &&
          (playlist.coverTrackIds === undefined ||
            (Array.isArray(playlist.coverTrackIds) &&
              playlist.coverTrackIds.every((trackId) => typeof trackId === 'string'))) &&
          Number.isFinite(playlist.createdAt)
      )
    : [];
};

const getWindowsAccentColor = () => {
  if (process.platform !== 'win32') return null;
  try {
    const output = execFileSync(
      'reg.exe',
      ['query', 'HKCU\\Software\\Microsoft\\Windows\\DWM', '/v', 'ColorizationColor'],
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const match = /ColorizationColor\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(output);
    if (!match) return null;
    return `#${match[1].slice(-6).padStart(6, '0')}`;
  } catch (error) {
    console.warn('Could not read the Windows accent color:', error.message);
    return null;
  }
};

const readAppSettings = async () => {
  const saved = await readSettingsFile();
  const systemAccentColor = getWindowsAccentColor();
  const autoDownloadArtistImages =
    typeof saved.autoDownloadArtistImages === 'boolean'
      ? saved.autoDownloadArtistImages
      : DEFAULT_SETTINGS.autoDownloadArtistImages;
  const settings = {
    ...DEFAULT_SETTINGS,
    ...saved,
    themeMode: ['light', 'dark', 'system'].includes(saved.themeMode)
      ? saved.themeMode
      : DEFAULT_SETTINGS.themeMode,
    accentColor: /^#[\da-f]{6}$/i.test(saved.accentColor || '')
      ? saved.accentColor
      : systemAccentColor || DEFAULT_SETTINGS.accentColor,
    lastPlayedTrackPath:
      typeof saved.lastPlayedTrackPath === 'string' ? saved.lastPlayedTrackPath : null,
    crossfadeSeconds:
      Number.isInteger(saved.crossfadeSeconds) &&
      saved.crossfadeSeconds >= 0 &&
      saved.crossfadeSeconds <= 10
        ? saved.crossfadeSeconds
        : DEFAULT_SETTINGS.crossfadeSeconds,
    iconStyle: ['material', 'windows', 'apple', 'vlc', 'round-filled', 'round-outline'].includes(
      saved.iconStyle
    )
      ? saved.iconStyle
      : DEFAULT_SETTINGS.iconStyle,
    seekbarStyle: ['default', 'windows', 'vlc', 'apple', 'samsung'].includes(saved.seekbarStyle)
      ? saved.seekbarStyle
      : DEFAULT_SETTINGS.seekbarStyle,
    visualizerStyle: [
      'wave-smooth',
      'wave-sharp',
      'wave-organic',
      'bars-thin',
      'bars-rounded',
      'bars-outline',
      'bars-alternating',
      'bars-dense',
      'bars-pill',
    ].includes(saved.visualizerStyle)
      ? saved.visualizerStyle
      : DEFAULT_SETTINGS.visualizerStyle,
    showVisualizer:
      typeof saved.showVisualizer === 'boolean'
        ? saved.showVisualizer
        : DEFAULT_SETTINGS.showVisualizer,
    autoDownloadArtistImages,
    showArtistImageBackground:
      autoDownloadArtistImages &&
      typeof saved.showArtistImageBackground === 'boolean'
        ? saved.showArtistImageBackground
        : false,
    showLyrics:
      typeof saved.showLyrics === 'boolean' ? saved.showLyrics : DEFAULT_SETTINGS.showLyrics,
    isShuffled:
      typeof saved.isShuffled === 'boolean' ? saved.isShuffled : DEFAULT_SETTINGS.isShuffled,
    repeatMode: ['off', 'one', 'all'].includes(saved.repeatMode)
      ? saved.repeatMode
      : DEFAULT_SETTINGS.repeatMode,
    showBrowseSection:
      typeof saved.showBrowseSection === 'boolean'
        ? saved.showBrowseSection
        : DEFAULT_SETTINGS.showBrowseSection,
    showRadioSection:
      typeof saved.showRadioSection === 'boolean'
        ? saved.showRadioSection
        : DEFAULT_SETTINGS.showRadioSection,
    showSpotifySection:
      typeof saved.showSpotifySection === 'boolean'
        ? saved.showSpotifySection
        : DEFAULT_SETTINGS.showSpotifySection,
    systemTheme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
    systemAccentColor,
    platform: process.platform,
  };
  if (
    saved.themeMode !== settings.themeMode ||
    saved.accentColor !== settings.accentColor ||
    (saved.lastPlayedTrackPath ?? null) !== settings.lastPlayedTrackPath ||
    saved.crossfadeSeconds !== settings.crossfadeSeconds ||
    saved.iconStyle !== settings.iconStyle ||
    saved.seekbarStyle !== settings.seekbarStyle ||
    saved.visualizerStyle !== settings.visualizerStyle ||
    saved.showVisualizer !== settings.showVisualizer ||
    saved.autoDownloadArtistImages !== settings.autoDownloadArtistImages ||
    saved.showArtistImageBackground !== settings.showArtistImageBackground ||
    saved.showLyrics !== settings.showLyrics ||
    saved.isShuffled !== settings.isShuffled ||
    saved.repeatMode !== settings.repeatMode ||
    saved.showBrowseSection !== settings.showBrowseSection ||
    saved.showRadioSection !== settings.showRadioSection ||
    saved.showSpotifySection !== settings.showSpotifySection
  ) {
    await persistSettings({ ...saved, ...settings });
  }
  return settings;
};

const updateAppSettings = async (patch) => {
  const current = await readSettingsFile();
  const next = { ...DEFAULT_SETTINGS, ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) continue;
    if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(key)) {
      throw new TypeError(`Invalid setting name "${key}".`);
    }
    const invalidValue =
      (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) ||
      (typeof value === 'number' && !Number.isFinite(value)) ||
      (typeof value === 'string' && /[\r\n]/.test(value));
    if (invalidValue) {
      throw new TypeError(`Setting "${key}" must be a finite scalar value without line breaks.`);
    }
    next[key] = value;
  }
  if (patch.themeMode !== undefined) {
    if (!['light', 'dark', 'system'].includes(patch.themeMode))
      throw new TypeError('Invalid theme mode.');
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
  if (patch.crossfadeSeconds !== undefined) {
    if (
      !Number.isInteger(patch.crossfadeSeconds) ||
      patch.crossfadeSeconds < 0 ||
      patch.crossfadeSeconds > 10
    ) {
      throw new TypeError('Crossfade duration must be a whole number between 0 and 10 seconds.');
    }
    next.crossfadeSeconds = patch.crossfadeSeconds;
  }
  if (patch.iconStyle !== undefined) {
    if (
      !['material', 'windows', 'apple', 'vlc', 'round-filled', 'round-outline'].includes(
        patch.iconStyle
      )
    ) {
      throw new TypeError('Invalid icon style.');
    }
    next.iconStyle = patch.iconStyle;
  }
  if (patch.seekbarStyle !== undefined) {
    if (!['default', 'windows', 'vlc', 'apple', 'samsung'].includes(patch.seekbarStyle)) {
      throw new TypeError('Invalid seekbar style.');
    }
    next.seekbarStyle = patch.seekbarStyle;
  }
  if (patch.visualizerStyle !== undefined) {
    if (
      ![
        'wave-smooth',
        'wave-sharp',
        'wave-organic',
        'bars-thin',
        'bars-rounded',
        'bars-outline',
        'bars-alternating',
        'bars-dense',
        'bars-pill',
      ].includes(patch.visualizerStyle)
    ) {
      throw new TypeError('Invalid audio visualizer style.');
    }
    next.visualizerStyle = patch.visualizerStyle;
  }
  if (patch.showVisualizer !== undefined) {
    if (typeof patch.showVisualizer !== 'boolean')
      throw new TypeError('Show visualizer must be a boolean.');
    next.showVisualizer = patch.showVisualizer;
  }
  if (patch.showArtistImageBackground !== undefined) {
    if (typeof patch.showArtistImageBackground !== 'boolean')
      throw new TypeError('Show artist image background must be a boolean.');
    if (
      patch.showArtistImageBackground &&
      !(patch.autoDownloadArtistImages ?? next.autoDownloadArtistImages)
    )
      throw new TypeError('Artist image backgrounds require automatic artist image downloads.');
    next.showArtistImageBackground = patch.showArtistImageBackground;
  }
  if (patch.autoDownloadArtistImages !== undefined) {
    if (typeof patch.autoDownloadArtistImages !== 'boolean')
      throw new TypeError('Automatic artist image downloads must be a boolean.');
    next.autoDownloadArtistImages = patch.autoDownloadArtistImages;
    if (!patch.autoDownloadArtistImages) next.showArtistImageBackground = false;
  }
  if (patch.showLyrics !== undefined) {
    if (typeof patch.showLyrics !== 'boolean')
      throw new TypeError('Show lyrics must be a boolean.');
    next.showLyrics = patch.showLyrics;
  }
  if (patch.isShuffled !== undefined) {
    if (typeof patch.isShuffled !== 'boolean')
      throw new TypeError('Shuffle state must be a boolean.');
    next.isShuffled = patch.isShuffled;
  }
  if (patch.repeatMode !== undefined) {
    if (!['off', 'one', 'all'].includes(patch.repeatMode))
      throw new TypeError('Invalid repeat mode.');
    next.repeatMode = patch.repeatMode;
  }
  for (const key of ['showBrowseSection', 'showRadioSection', 'showSpotifySection']) {
    if (patch[key] !== undefined) {
      if (typeof patch[key] !== 'boolean') throw new TypeError(`${key} must be a boolean.`);
      next[key] = patch[key];
    }
  }
  await persistSettings(next);
  return readAppSettings();
};

const saveAppSettings = (patch) => {
  const update = appSettingsWriteQueue.then(() => updateAppSettings(patch));
  appSettingsWriteQueue = update.then(
    () => undefined,
    () => undefined
  );
  return update;
};

const saveEmbeddedArtwork = async (picture, trackPath, stat) => {
  const extension = ARTWORK_MIME_TYPES[picture?.format?.toLowerCase()];
  if (!extension || !Buffer.isBuffer(picture.data) || picture.data.length > 20 * 1024 * 1024)
    return undefined;

  const cacheKey = crypto
    .createHash('sha256')
    .update(`${trackPath}\0${stat.size}\0${stat.mtimeMs}`)
    .update(picture.data)
    .digest('hex');
  const fileName = `${cacheKey}.${extension}`;
  const artworkPath = getArtworkPath(fileName);
  await fs.promises.mkdir(path.dirname(artworkPath), { recursive: true });
  await fs.promises.writeFile(artworkPath, picture.data);
  return `luna-media://artwork/${fileName}`;
};

const isWithinDirectory = (filePath, directory) => {
  const relative = path.relative(directory, filePath);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
};

const scanMusicFolders = async (folders, cachedTracks = []) => {
  const tracks = [];
  const errors = [];
  const unavailableDirectories = [];
  const seenPaths = new Set();
  const cachedByPath = new Map(cachedTracks.map((track) => [track.path, track]));

  const shouldReuseCachedTrack = (cachedTrack, stat) =>
    cachedTrack &&
    cachedTrack.metadataVersion >= 5 &&
    cachedTrack.size === stat.size &&
    cachedTrack.lastModified === stat.mtimeMs &&
    typeof cachedTrack.path === 'string';

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
      if (!entry.isFile() || !AUDIO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        continue;
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
        const lyricData = extractEmbeddedLyrics(metadata);

        tracks.push({
          id: entryPath,
          path: entryPath,
          src: `luna-media://track/${Buffer.from(entryPath).toString('base64url')}`,
          filename: entry.name,
          name: common.title || filename,
          artist: common.artist || 'Unknown Artist',
          album: common.album || 'Unknown Album',
          albumArtist: common.albumartist || undefined,
          albumArt,
          lyrics: lyricData.lyrics,
          syncedLyrics: lyricData.syncedLyrics,
          metadataVersion: 5,
          duration: metadata?.format?.duration || 0,
          trackNumber: common.track?.no || undefined,
          discNumber: common.disk?.no || undefined,
          year: common.year || undefined,
          genre: common.genre?.[0] || undefined,
          composer: Array.isArray(common.composer)
            ? common.composer[0]
            : common.composer || undefined,
          comment: Array.isArray(common.comment)
            ? common.comment.join('\n')
            : common.comment || undefined,
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

  const retainedTracks = cachedTracks.filter(
    (track) =>
      unavailableDirectories.some((directory) => isWithinDirectory(track.path, directory)) &&
      !seenPaths.has(track.path)
  );
  return { tracks: [...tracks, ...retainedTracks], errors };
};

const removeStaleMetadataCache = async () => {
  try {
    const library = await readLibraryConfig();
    if (library.tracks.length === 0) return;

    const updatedTracks = library.tracks.map((track) => {
      if (!track || typeof track.path !== 'string') return track;
      if (track.metadataVersion < 5 || track.metadataVersion === undefined) {
        return { ...track, metadataVersion: 4, lyrics: undefined, syncedLyrics: undefined };
      }
      return track;
    });

    await updateLibraryConfig((current) => ({ ...current, tracks: updatedTracks }));
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
  indexedAudioPaths = new Set(tracks.map((track) => track.path));
  const library = await updateLibraryConfig(() => ({ folders: normalizedFolders, tracks }));
  return { ...library, playlists: await readPlaylists(), errors };
};

const validateMetadataText = (value, field, maximumLength) => {
  if (typeof value !== 'string' || value.length > maximumLength || value.includes('\0')) {
    throw new TypeError(`${field} must be text no longer than ${maximumLength} characters.`);
  }
  return value.trim();
};

const validateMetadataNumber = (value, field) => {
  if (value === null) return 0;
  if (!Number.isInteger(value) || value < 1 || value > 9999) {
    throw new TypeError(`${field} must be a whole number from 1 to 9999, or empty.`);
  }
  return value;
};

const saveTrackMetadataToFile = async (trackPath, metadata) => {
  if (typeof trackPath !== 'string' || !indexedAudioPaths.has(trackPath)) {
    throw new Error('This track is not in the indexed music library.');
  }
  const extension = path.extname(trackPath).toLowerCase();
  if (!EDITABLE_AUDIO_EXTENSIONS.has(extension)) {
    throw new Error(
      `Metadata editing is currently supported for MP3, FLAC, M4A/MP4, and OGG/OGA files. This file is ${extension || 'an unsupported format'}.`
    );
  }
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new TypeError('Track metadata must be provided.');
  }

  const values = {
    title: validateMetadataText(metadata.title, 'Song name', 300),
    artist: validateMetadataText(metadata.artist, 'Artist', 300),
    album: validateMetadataText(metadata.album, 'Album', 300),
    albumArtist: validateMetadataText(metadata.albumArtist, 'Album artist', 300),
    composer: validateMetadataText(metadata.composer, 'Composer', 300),
    genre: validateMetadataText(metadata.genre, 'Genre', 150),
    comment: validateMetadataText(metadata.comment, 'Comment', 2000),
    lyrics: validateMetadataText(metadata.lyrics, 'Lyrics', 100000),
    year: validateMetadataNumber(metadata.year, 'Year'),
    trackNumber: validateMetadataNumber(metadata.trackNumber, 'Track number'),
    discNumber: validateMetadataNumber(metadata.discNumber, 'Disc number'),
  };

  const originalStat = await fs.promises.stat(trackPath);
  if (!originalStat.isFile()) throw new Error('The selected audio file is not available.');
  await fs.promises.access(trackPath, fs.constants.W_OK);

  const temporaryPath = `${trackPath}.luna-${crypto.randomUUID()}${extension}`;
  await fs.promises.copyFile(trackPath, temporaryPath, fs.constants.COPYFILE_EXCL);
  let audioFile;
  try {
    try {
      audioFile = TagLibFile.createFromPath(temporaryPath);
      if (!audioFile.isWritable)
        throw new Error('This audio file cannot be written by the metadata editor.');
      if (audioFile.isPossiblyCorrupt) {
        throw new Error(
          `The file may be damaged and was not modified: ${audioFile.corruptionReasons.join('; ')}`
        );
      }
      const tag = audioFile.tag;
      if (!tag) throw new Error('This audio file does not contain a writable metadata tag.');
      tag.title = values.title;
      tag.performers = values.artist ? [values.artist] : [];
      tag.album = values.album;
      tag.albumArtists = values.albumArtist ? [values.albumArtist] : [];
      tag.composers = values.composer ? [values.composer] : [];
      tag.genres = values.genre ? [values.genre] : [];
      tag.comment = values.comment;
      tag.year = values.year;
      tag.track = values.trackNumber;
      tag.disc = values.discNumber;
      tag.lyrics = values.lyrics;

      if (metadata.albumArtBase64 !== undefined) {
        if (metadata.albumArtBase64 === null) {
          tag.pictures = tag.pictures.filter((picture) => picture.type !== PictureType.FrontCover);
        } else {
          if (
            typeof metadata.albumArtBase64 !== 'string' ||
            !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
              metadata.albumArtBase64
            ) ||
            metadata.albumArtBase64.length > 28 * 1024 * 1024 ||
            !EDITABLE_ARTWORK_MIME_TYPES.has(metadata.albumArtMimeType)
          ) {
            throw new TypeError('Album art must be a supported image file no larger than 20 MB.');
          }
          const imageBytes = Buffer.from(metadata.albumArtBase64, 'base64');
          if (imageBytes.length === 0 || imageBytes.length > 20 * 1024 * 1024) {
            throw new TypeError('Album art must be a supported image file no larger than 20 MB.');
          }
          const picture = Picture.fromData(ByteVector.fromByteArray(imageBytes));
          if (!EDITABLE_ARTWORK_MIME_TYPES.has(picture.mimeType)) {
            throw new TypeError('The selected album art format is not supported.');
          }
          picture.mimeType = picture.mimeType.toLowerCase();
          picture.type = PictureType.FrontCover;
          tag.pictures = [
            ...tag.pictures.filter((item) => item.type !== PictureType.FrontCover),
            picture,
          ];
        }
      }

      audioFile.save();
    } finally {
      if (audioFile) {
        audioFile.dispose();
        audioFile = undefined;
      }
    }
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }

  try {
    const currentStat = await fs.promises.stat(trackPath);
    if (currentStat.size !== originalStat.size || currentStat.mtimeMs !== originalStat.mtimeMs) {
      throw new Error(
        'The audio file changed while metadata was being saved. No changes were applied.'
      );
    }
    await fs.promises.chmod(temporaryPath, originalStat.mode);
    await fs.promises.rename(temporaryPath, trackPath);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
};

ipcMain.handle('load-music-library', async () => {
  const library = await readLibraryConfig();
  const playlists = await readPlaylists();
  indexedAudioPaths = new Set(
    library.tracks.filter((track) => typeof track.path === 'string').map((track) => track.path)
  );
  if (library.folders.length === 0) {
    const selectedFolders = await selectMusicFolders();
    if (selectedFolders.length > 0) {
      const initialLibrary = await scanAndSaveLibrary(selectedFolders, library.tracks);
      return { ...initialLibrary, initialScan: true };
    }
  }
  return { ...library, playlists, errors: [] };
});

ipcMain.handle('load-app-settings', () => readAppSettings());
ipcMain.handle('save-app-settings', (_event, patch) => saveAppSettings(patch));
ipcMain.handle('save-playlists', async (_event, playlists) => {
  if (!Array.isArray(playlists)) throw new TypeError('Playlists must be an array.');
  const normalizedPlaylists = playlists.map((playlist) => {
    if (
      !playlist ||
      typeof playlist.id !== 'string' ||
      !playlist.id.trim() ||
      typeof playlist.name !== 'string' ||
      !playlist.name.trim() ||
      !Array.isArray(playlist.trackIds) ||
      !playlist.trackIds.every((trackId) => typeof trackId === 'string') ||
      (playlist.coverTrackIds !== undefined &&
        (!Array.isArray(playlist.coverTrackIds) ||
          !playlist.coverTrackIds.every((trackId) => typeof trackId === 'string'))) ||
      !Number.isFinite(playlist.createdAt)
    ) {
      throw new TypeError('Invalid playlist data.');
    }
    return {
      id: playlist.id.trim(),
      name: playlist.name.trim(),
      trackIds: [...playlist.trackIds],
      ...(playlist.coverTrackIds ? { coverTrackIds: [...playlist.coverTrackIds] } : {}),
      createdAt: playlist.createdAt,
    };
  });
  await writePlaylists(normalizedPlaylists);
  return normalizedPlaylists;
});
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
  return scanAndSaveLibrary(
    library.folders.filter((savedFolder) => savedFolder !== folder),
    library.tracks
  );
});

ipcMain.handle('save-track-metadata', async (_event, trackPath, metadata) => {
  await saveTrackMetadataToFile(trackPath, metadata);
  const library = await readLibraryConfig();
  const cachedTracks = library.tracks.map((track) =>
    track.path === trackPath ? { ...track, metadataVersion: 0 } : track
  );
  try {
    return await scanAndSaveLibrary(library.folders, cachedTracks);
  } catch (error) {
    throw new Error(
      `Metadata was written to the audio file, but the library refresh failed: ${error.message}`
    );
  }
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
    mainWindow?.webContents.send(
      'system-theme-changed',
      nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    );
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
        const contentType = Object.entries(ARTWORK_MIME_TYPES).find(
          ([, supportedExtension]) => `.${supportedExtension}` === extension
        )?.[0];
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
      'Content-Type':
        AUDIO_MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    });
    const range = request.headers.get('range');
    let start = 0;
    let end = stat.size - 1;
    let status = 200;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${stat.size}` },
        });
      }

      if (!match[1]) {
        const suffixLength = Number(match[2]);
        start = Math.max(0, stat.size - suffixLength);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
      }

      if (start >= stat.size || start > end) {
        return new Response(null, {
          status: 416,
          headers: { 'Content-Range': `bytes */${stat.size}` },
        });
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

app.on('before-quit', (event) => {
  if (allowQuitAfterSettingsFlush) return;
  event.preventDefault();
  if (settingsFlushInProgress) return;
  settingsFlushInProgress = true;
  Promise.all([appSettingsWriteQueue, libraryWriteQueue, playlistWriteQueue])
    .then(() => {
      allowQuitAfterSettingsFlush = true;
      app.quit();
    })
    .catch((error) => {
      console.error('Could not finish saving app data before exit:', error);
      allowQuitAfterSettingsFlush = true;
      app.quit();
    });
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
