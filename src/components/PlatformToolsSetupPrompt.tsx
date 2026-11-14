import { useEffect, useRef, useState } from 'react';
import type { PlatformToolsInstallProgress } from '../types/electron';
import './PlatformToolsSetupPrompt.css';

const formatBytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Android Platform Tools could not be installed.';

const PlatformToolsSetupPrompt = ({ enabled }: { enabled: boolean }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState<PlatformToolsInstallProgress | null>(null);
  const laterButtonRef = useRef<HTMLButtonElement>(null);
  const electronAPI = window.electronAPI;

  useEffect(() => {
    if (
      !enabled ||
      !electronAPI ||
      (electronAPI.platform !== 'darwin' && electronAPI.platform !== 'linux') ||
      window.localStorage.getItem('luna-platform-tools-setup-choice')
    ) {
      return undefined;
    }

    let active = true;
    electronAPI
      .getUsbSyncStatus()
      .then((status) => {
        if (active && !status.adbPath) setIsVisible(true);
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(getErrorMessage(error));
          setIsVisible(true);
        }
      });

    return () => {
      active = false;
    };
  }, [electronAPI, enabled]);

  useEffect(() => {
    if (!isVisible || !electronAPI) return undefined;
    return electronAPI.onPlatformToolsInstallProgress(setProgress);
  }, [electronAPI, isVisible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isInstalling) {
        window.localStorage.setItem('luna-platform-tools-setup-choice', 'later');
        setIsVisible(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isInstalling, isVisible]);

  useEffect(() => {
    if (isVisible) laterButtonRef.current?.focus();
  }, [isVisible]);

  if (!isVisible || !electronAPI) return null;

  const handleLater = () => {
    window.localStorage.setItem('luna-platform-tools-setup-choice', 'later');
    setIsVisible(false);
  };

  const handleInstall = async () => {
    if (!acceptedTerms || isInstalling) return;
    setIsInstalling(true);
    setErrorMessage('');
    setProgress({ phase: 'downloading', downloadedBytes: 0, totalBytes: null });
    try {
      await electronAPI.installPlatformTools();
      window.localStorage.setItem('luna-platform-tools-setup-choice', 'installed');
      setIsVisible(false);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIsInstalling(false);
      setProgress(null);
    }
  };

  const handleOpenTerms = () => {
    void electronAPI.openPlatformToolsTerms().catch((error: unknown) => {
      setErrorMessage(getErrorMessage(error));
    });
  };

  const progressMessage = !progress
    ? ''
    : progress.phase === 'downloading'
      ? progress.totalBytes
        ? `Downloading Platform Tools: ${formatBytes(progress.downloadedBytes)} of ${formatBytes(progress.totalBytes)}`
        : `Downloading Platform Tools: ${formatBytes(progress.downloadedBytes)}`
      : progress.phase === 'extracting'
        ? 'Extracting Platform Tools…'
        : 'Verifying ADB…';

  return (
    <div className='platform-tools-prompt-backdrop'>
      <section
        className='platform-tools-prompt'
        role='dialog'
        aria-modal='true'
        aria-labelledby='platform-tools-prompt-title'
        aria-busy={isInstalling}
      >
        <span className='material-symbols-outlined platform-tools-prompt-icon' aria-hidden='true'>
          usb
        </span>
        <p className='platform-tools-prompt-eyebrow'>Optional setup</p>
        <h2 id='platform-tools-prompt-title'>Install Android Platform Tools?</h2>
        <p>
          Luna can download the official tools now to enable USB music sync. This requires an
          internet connection; the download is not included with the app.
        </p>
        <button
          type='button'
          className='platform-tools-terms-link'
          onClick={handleOpenTerms}
          disabled={isInstalling}
        >
          Review the Android SDK terms
          <span className='material-symbols-outlined' aria-hidden='true'>
            open_in_new
          </span>
        </button>
        <label className='platform-tools-accept'>
          <input
            type='checkbox'
            checked={acceptedTerms}
            onChange={(event) => setAcceptedTerms(event.currentTarget.checked)}
            disabled={isInstalling}
          />
          <span>I have reviewed and accept the Android SDK terms.</span>
        </label>
        {progressMessage && (
          <p className='platform-tools-prompt-status' role='status' aria-live='polite'>
            {progressMessage}
          </p>
        )}
        {errorMessage && (
          <p className='platform-tools-prompt-error' role='alert'>
            {errorMessage}
          </p>
        )}
        <div className='platform-tools-prompt-actions'>
          <button
            ref={laterButtonRef}
            type='button'
            className='platform-tools-prompt-secondary'
            onClick={handleLater}
            disabled={isInstalling}
          >
            Not now
          </button>
          <button
            type='button'
            className='platform-tools-prompt-primary'
            aria-busy={isInstalling}
            onClick={() => void handleInstall()}
            disabled={!acceptedTerms || isInstalling}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              {isInstalling ? 'progress_activity' : 'download'}
            </span>
            {isInstalling ? 'Installing…' : 'Install tools'}
          </button>
        </div>
      </section>
    </div>
  );
};

export default PlatformToolsSetupPrompt;
