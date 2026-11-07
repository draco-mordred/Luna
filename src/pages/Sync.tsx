import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { Playlist, Track } from '../services/MusicLibrary';
import type { UsbSyncProgress, UsbSyncStatus } from '../types/electron';
import { publishUsbSyncIndicator } from '../services/usbSyncIndicator';
import './Sync.css';

interface SyncPageProps {
  tracks: Track[];
  playlists: Playlist[];
  lovedTrackIds: string[];
}

interface SyncRouteState {
  syncTrackIds?: unknown;
  syncPlaylistIds?: unknown;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'USB sync failed. Check the connection and try again.';

const SyncPage = ({ tracks, playlists, lovedTrackIds }: SyncPageProps) => {
  const location = useLocation();
  const routeState = location.state as SyncRouteState | null;
  const routeTrackIds = routeState?.syncTrackIds;
  const requestedTrackIds = Array.isArray(routeTrackIds)
    ? routeTrackIds.filter((id): id is string => typeof id === 'string')
    : [];
  const routePlaylistIds = routeState?.syncPlaylistIds;
  const requestedPlaylistIds = Array.isArray(routePlaylistIds)
    ? routePlaylistIds.filter((id): id is string => typeof id === 'string')
    : [];
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(
    () => new Set(requestedTrackIds)
  );
  const [selectedPlaylistIds] = useState<Set<string>>(() => new Set(requestedPlaylistIds));
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UsbSyncStatus | null>(null);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [statusError, setStatusError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [progress, setProgress] = useState<UsbSyncProgress | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const electronAPI = window.electronAPI;

  const localTracks = useMemo(
    () => tracks.filter((track) => Boolean(track.path) && !track.streamingProvider),
    [tracks]
  );
  const filteredTracks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return localTracks;
    return localTracks.filter((track) =>
      `${track.name} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query)
    );
  }, [localTracks, search]);
  const selectedTracks = useMemo(
    () => localTracks.filter((track) => selectedTrackIds.has(track.id)),
    [localTracks, selectedTrackIds]
  );
  const playlistsToSync = useMemo(
    () =>
      selectedPlaylistIds.size > 0
        ? playlists.filter((playlist) => selectedPlaylistIds.has(playlist.id))
        : playlists,
    [playlists, selectedPlaylistIds]
  );
  const authorizedDevices = status?.devices.filter((device) => device.status === 'device') ?? [];

  const applyStatus = useCallback((nextStatus: UsbSyncStatus) => {
    setStatus(nextStatus);
    setSelectedSerial((current) =>
      nextStatus.devices.some((device) => device.serial === current && device.status === 'device')
        ? current
        : (nextStatus.devices.find((device) => device.status === 'device')?.serial ?? '')
    );
  }, []);

  const loadStatus = useCallback(async () => {
    if (!electronAPI) return;
    try {
      const nextStatus = await electronAPI.getUsbSyncStatus();
      applyStatus(nextStatus);
    } catch (error) {
      setStatusError(getErrorMessage(error));
    }
  }, [applyStatus, electronAPI]);

  const refreshStatus = useCallback(async () => {
    if (!electronAPI) return;
    setIsRefreshing(true);
    setStatusError('');
    try {
      await loadStatus();
    } finally {
      setIsRefreshing(false);
    }
  }, [electronAPI, loadStatus]);

  useEffect(() => {
    if (!electronAPI) return undefined;
    let active = true;
    electronAPI
      .getUsbSyncStatus()
      .then((nextStatus) => {
        if (active) applyStatus(nextStatus);
      })
      .catch((error: unknown) => {
        if (active) setStatusError(getErrorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [applyStatus, electronAPI]);

  useEffect(() => {
    if (!electronAPI) return undefined;
    return electronAPI.onUsbSyncProgress((nextProgress) => {
      setProgress(nextProgress);
      publishUsbSyncIndicator({ status: 'running', progress: nextProgress });
    });
  }, [electronAPI]);

  const handleSelectAdb = async () => {
    if (!electronAPI) return;
    setStatusError('');
    try {
      const nextStatus = await electronAPI.selectUsbSyncAdb();
      if (!nextStatus) return;
      setStatus(nextStatus);
      setSelectedSerial(
        nextStatus.devices.find((device) => device.status === 'device')?.serial ?? ''
      );
    } catch (error) {
      setStatusError(getErrorMessage(error));
    }
  };

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
    setResultMessage('');
  };

  const toggleFilteredTracks = () => {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      const allFilteredSelected =
        filteredTracks.length > 0 && filteredTracks.every((track) => next.has(track.id));
      filteredTracks.forEach((track) => {
        if (allFilteredSelected) next.delete(track.id);
        else next.add(track.id);
      });
      return next;
    });
    setResultMessage('');
  };

  const handleSync = async () => {
    if (!electronAPI || !selectedSerial || selectedTracks.length === 0) return;
    setIsSyncing(true);
    setProgress(null);
    setSyncError('');
    setResultMessage('');
    publishUsbSyncIndicator({
      status: 'running',
      progress: {
        phase: 'preparing',
        current: 0,
        total: selectedTracks.length,
        trackName: 'Starting transfer',
        fileName: '',
      },
    });
    try {
      const result = await electronAPI.syncTracksToAndroid({
        serial: selectedSerial,
        tracks: selectedTracks.map((track) => ({
          id: track.id,
          path: track.path,
          filename: track.filename,
          name: track.name,
          artist: track.artist,
          album: track.album,
          duration: track.duration,
          size: track.size,
        })),
        playlists: playlistsToSync,
        lovedTrackIds,
      });
      setResultMessage(
        `Copied ${result.copied} track${result.copied === 1 ? '' : 's'}; skipped ${result.skipped} already-synced track${result.skipped === 1 ? '' : 's'}. Playlist and favorite metadata was updated.`
      );
      publishUsbSyncIndicator({ status: 'complete', message: 'Sync complete' });
    } catch (error) {
      const message = getErrorMessage(error);
      setSyncError(message);
      publishUsbSyncIndicator({ status: 'error', message });
    } finally {
      setIsSyncing(false);
      setProgress(null);
      void refreshStatus();
    }
  };

  if (!electronAPI) {
    return (
      <section className='sync-page'>
        <header className='sync-page-header'>
          <h1>USB Sync</h1>
          <p>USB music transfer is available in the Luna Desktop app.</p>
        </header>
      </section>
    );
  }

  return (
    <section className='sync-page'>
      <header className='sync-page-header'>
        <div>
          <p className='sync-eyebrow'>Luna Desktop</p>
          <h1>USB Sync</h1>
          <p>Copy selected tracks and Luna playlist/favorite data to your Android device.</p>
        </div>
      </header>

      <section className='sync-setup-card' aria-labelledby='sync-setup-title'>
        <div className='sync-card-heading'>
          <span className='material-symbols-outlined' aria-hidden='true'>
            usb
          </span>
          <div>
            <h2 id='sync-setup-title'>Connect your Android device</h2>
            <p>ADB is used only to transfer files over the USB connection.</p>
          </div>
        </div>
        <ol className='sync-setup-steps'>
          <li>Install Android SDK Platform Tools on this computer.</li>
          <li>On Android, enable Developer options and USB debugging.</li>
          <li>
            Connect your phone with a data-capable USB cable and approve its debugging prompt.
          </li>
          <li>Choose the ADB executable if Luna cannot find it, then refresh devices.</li>
        </ol>
        <div className='sync-device-row'>
          <button
            className='sync-secondary-button'
            type='button'
            onClick={() => void handleSelectAdb()}
            disabled={isSyncing}
          >
            Choose ADB…
          </button>
          <button
            className='sync-secondary-button'
            type='button'
            onClick={() => void refreshStatus()}
            disabled={isRefreshing || isSyncing}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              refresh
            </span>
            {isRefreshing ? 'Checking…' : 'Refresh devices'}
          </button>
          {status?.adbPath && (
            <span className='sync-adb-path' title={status.adbPath}>
              {status.adbPath}
            </span>
          )}
          <label className='sync-device-select'>
            <span>Android device</span>
            <select
              value={selectedSerial}
              onChange={(event) => setSelectedSerial(event.currentTarget.value)}
              disabled={authorizedDevices.length === 0 || isSyncing}
            >
              <option value=''>No authorized device</option>
              {authorizedDevices.map((device) => (
                <option key={device.serial} value={device.serial}>
                  {device.model ?? device.serial} — {device.serial}
                </option>
              ))}
            </select>
          </label>
        </div>
        {!status?.adbPath && !isRefreshing && (
          <p className='sync-inline-notice'>
            ADB was not found. Choose the executable in your Android SDK Platform Tools folder.
          </p>
        )}
        {status?.devices.some((device) => device.status === 'unauthorized') && (
          <p className='sync-inline-notice'>
            Your phone is connected but not authorized. Unlock it and accept the USB debugging
            prompt.
          </p>
        )}
        {statusError && (
          <p className='sync-error' role='alert'>
            {statusError}
          </p>
        )}
      </section>

      <section className='sync-tracks-card' aria-labelledby='sync-tracks-title'>
        <div className='sync-tracks-heading'>
          <div>
            <h2 id='sync-tracks-title'>Choose tracks</h2>
            <p>
              {selectedTracks.length} selected · {localTracks.length} local tracks available
            </p>
          </div>
          <button
            className='sync-primary-button'
            type='button'
            onClick={() => void handleSync()}
            disabled={!selectedSerial || selectedTracks.length === 0 || isSyncing}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              sync
            </span>
            {isSyncing
              ? 'Syncing…'
              : `Sync ${selectedTracks.length} track${selectedTracks.length === 1 ? '' : 's'}`}
          </button>
        </div>
        <div className='sync-track-tools'>
          <label className='sync-search'>
            <span className='material-symbols-outlined' aria-hidden='true'>
              search
            </span>
            <input
              type='search'
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder='Search tracks'
              aria-label='Search tracks to sync'
            />
          </label>
          <button className='sync-text-button' type='button' onClick={toggleFilteredTracks}>
            {filteredTracks.length > 0 &&
            filteredTracks.every((track) => selectedTrackIds.has(track.id))
              ? 'Deselect visible'
              : 'Select visible'}
          </button>
        </div>
        <div className='sync-track-list'>
          {filteredTracks.map((track) => (
            <label className='sync-track-row' key={track.id}>
              <input
                type='checkbox'
                checked={selectedTrackIds.has(track.id)}
                onChange={() => toggleTrack(track.id)}
                disabled={isSyncing}
              />
              <span className='sync-track-copy'>
                <strong>{track.name}</strong>
                <span>
                  {track.artist} · {track.album}
                </span>
              </span>
              <span className='sync-track-size'>
                {track.size > 0 ? `${(track.size / (1024 * 1024)).toFixed(1)} MB` : ''}
              </span>
            </label>
          ))}
          {filteredTracks.length === 0 && (
            <p className='sync-empty-state'>
              {localTracks.length === 0
                ? 'Scan a local music folder to add tracks to your library.'
                : 'No tracks match your search.'}
            </p>
          )}
        </div>
        <p className='sync-safety-note'>
          Files are copied, not moved or deleted. Existing files with the same content are skipped.
          A manifest with track, playlist, and favorite data is saved in <code>Luna music</code>.
          The Android app integration for reading this transfer will follow.
        </p>
        {progress && (
          <p className='sync-progress' role='status' aria-live='polite'>
            {progress.phase === 'manifest'
              ? 'Updating playlist and favorite manifest…'
              : `${progress.phase === 'preparing' ? 'Preparing' : 'Copied'} ${progress.phase === 'preparing' ? Math.min(progress.current + 1, progress.total) : progress.current} of ${progress.total}: ${progress.fileName}`}
          </p>
        )}
        {syncError && (
          <p className='sync-error' role='alert'>
            {syncError}
          </p>
        )}
        {resultMessage && (
          <p className='sync-success' role='status'>
            {resultMessage}
          </p>
        )}
      </section>
    </section>
  );
};

export default SyncPage;
