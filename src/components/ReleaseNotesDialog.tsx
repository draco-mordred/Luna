import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReleaseNotesData } from '../types/electron';
import './ReleaseNotesDialog.css';

const renderReleaseNotesText = (text: string) =>
  text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={`${index}-${part}`}>{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );

interface ReleaseNotesDialogProps {
  version: string;
  onClose: () => void;
}

const ReleaseNotesDialog = ({ version, onClose }: ReleaseNotesDialogProps) => {
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNotesData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);

  const finishClosing = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onClose();
  }, [onClose]);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      isClosingRef.current = true;
      finishClosing();
      return;
    }
    isClosingRef.current = true;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(finishClosing, 260);
  }, [finishClosing]);

  useEffect(
    () => () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    },
    []
  );

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
      if (event.key === 'Escape') handleClose();
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
  }, [handleClose]);

  return createPortal(
    <div
      className={`release-notes-backdrop${isClosing ? ' is-closing' : ''}`}
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === 'release-notes-backdrop-exit' &&
          isClosing
        ) {
          finishClosing();
        }
      }}
    >
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
          onClick={handleClose}
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
            <pre className='release-notes-current'>
              {renderReleaseNotesText(releaseNotes.current.trim())}
            </pre>
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
          onClick={handleClose}
          ref={continueButtonRef}
        >
          Continue to Luna
        </button>
      </section>
    </div>,
    document.body
  );
};

export default ReleaseNotesDialog;
