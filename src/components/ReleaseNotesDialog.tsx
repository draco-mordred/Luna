import { useEffect, useRef, useState } from 'react';
import type { ReleaseNotesData } from '../types/electron';
import './ReleaseNotesDialog.css';

interface ReleaseNotesDialogProps {
  version: string;
  onClose: () => void;
}

const ReleaseNotesDialog = ({ version, onClose }: ReleaseNotesDialogProps) => {
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let isActive = true;
    const loadNotes = async () => {
      try {
        let result: ReleaseNotesData;
        if (window.electronAPI) {
          result = await window.electronAPI.loadReleaseNotes(version);
        } else {
          const publicBase = process.env.PUBLIC_URL === '.' ? '' : process.env.PUBLIC_URL;
          const [currentResponse, previousResponse] = await Promise.all([
            fetch(`${publicBase}/release-notes/${encodeURIComponent(version)}.txt`),
            fetch(`${publicBase}/release-notes/previous-releases.json`),
          ]);
          if (!currentResponse.ok || !previousResponse.ok) {
            throw new Error(`Release notes for Luna ${version} could not be found.`);
          }
          result = {
            current: await currentResponse.text(),
            previous: await previousResponse.json(),
          };
        }
        if (isActive) setReleaseNotes(result);
      } catch (loadError) {
        console.error('Could not load release notes:', loadError);
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : `Release notes for Luna ${version} could not be loaded.`
          );
        }
      }
    };

    void loadNotes();
    return () => {
      isActive = false;
    };
  }, [version]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === closeButtonRef.current) {
          event.preventDefault();
          continueButtonRef.current?.focus();
        } else if (!event.shiftKey && document.activeElement === continueButtonRef.current) {
          event.preventDefault();
          closeButtonRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className='release-notes-backdrop'>
      <section
        className='release-notes-dialog'
        role='dialog'
        aria-modal='true'
        aria-labelledby='release-notes-title'
        aria-busy={!releaseNotes && !error}
      >
        <button
          type='button'
          className='release-notes-close'
          aria-label='Close release notes'
          onClick={onClose}
          ref={closeButtonRef}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            close
          </span>
        </button>
        <p className='release-notes-eyebrow'>What’s new</p>
        <h2 id='release-notes-title'>Luna {version}</h2>
        {error ? (
          <p className='release-notes-error' role='alert'>
            {error}
          </p>
        ) : releaseNotes ? (
          <div className='release-notes-content'>
            <pre className='release-notes-current'>{releaseNotes.current.trim()}</pre>
            {releaseNotes.previous.length > 0 && (
              <section className='release-notes-previous' aria-labelledby='previous-releases-title'>
                <h3 id='previous-releases-title'>Previous releases</h3>
                {releaseNotes.previous.map((release) => (
                  <p key={release.version}>
                    <strong>v{release.version}</strong> — {release.summary}
                  </p>
                ))}
              </section>
            )}
          </div>
        ) : (
          <p className='release-notes-loading' role='status'>
            Loading release notes…
          </p>
        )}
        <button
          type='button'
          className='release-notes-done'
          onClick={onClose}
          ref={continueButtonRef}
        >
          Continue to Luna
        </button>
      </section>
    </div>
  );
};

export default ReleaseNotesDialog;
