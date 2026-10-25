import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Track } from '../services/MusicLibrary';
import type { TrackMetadataUpdate } from '../types/electron';
import './TrackMetadataEditor.css';

interface TrackMetadataEditorProps {
  track: Track;
  onClose: () => void;
  onSave: (track: Track, metadata: TrackMetadataUpdate) => Promise<void>;
}

const formatLyricsAsLrc = (track: Track): string =>
  [...(track.syncedLyrics ?? [])]
    .sort((left, right) => left.time - right.time)
    .map(({ time, text }) => {
      const minutes = Math.floor(time / 60)
        .toString()
        .padStart(2, '0');
      const seconds = (time % 60).toFixed(2).padStart(5, '0');
      return `[${minutes}:${seconds}]${text}`;
    })
    .join('\n');

const getInitialLyrics = (track: Track): string =>
  track.syncedLyrics?.length ? formatLyricsAsLrc(track) : (track.lyrics ?? '');

const readImageFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the selected image.'));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });

const TrackMetadataEditor = ({ track, onClose, onSave }: TrackMetadataEditorProps) => {
  const [title, setTitle] = useState(track.name);
  const [artist, setArtist] = useState(track.artist === 'Unknown Artist' ? '' : track.artist);
  const [album, setAlbum] = useState(track.album === 'Unknown Album' ? '' : track.album);
  const [albumArtist, setAlbumArtist] = useState(track.albumArtist ?? '');
  const [composer, setComposer] = useState(track.composer ?? '');
  const [genre, setGenre] = useState(track.genre ?? '');
  const [comment, setComment] = useState(track.comment ?? '');
  const [year, setYear] = useState(track.year?.toString() ?? '');
  const [trackNumber, setTrackNumber] = useState(track.trackNumber?.toString() ?? '');
  const [discNumber, setDiscNumber] = useState(track.discNumber?.toString() ?? '');
  const [lyrics, setLyrics] = useState(getInitialLyrics(track));
  const [artworkData, setArtworkData] = useState<string | null | undefined>(undefined);
  const [artworkMimeType, setArtworkMimeType] = useState<string | undefined>();
  const [artworkPreview, setArtworkPreview] = useState(track.albumArt ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const artworkObjectUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (artworkObjectUrlRef.current) URL.revokeObjectURL(artworkObjectUrlRef.current);
    },
    []
  );

  useEffect(() => {
    titleInputRef.current?.focus();
    titleInputRef.current?.select();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleArtworkChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError('Choose a supported image file for album art.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('Album art must be 20 MB or smaller.');
      return;
    }
    try {
      setArtworkData(await readImageFile(file));
      setArtworkMimeType(file.type);
      if (artworkObjectUrlRef.current) URL.revokeObjectURL(artworkObjectUrlRef.current);
      artworkObjectUrlRef.current = URL.createObjectURL(file);
      setArtworkPreview(artworkObjectUrlRef.current);
    } catch (readError) {
      console.error('Could not load selected album artwork:', readError);
      setError('Could not load the selected album artwork.');
    }
  };

  const handleLyricsFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.name.toLocaleLowerCase().endsWith('.lrc')) {
      setError('Choose an .lrc file to import synchronized lyrics.');
      return;
    }
    try {
      const contents = await file.text();
      if (!/\[\d{1,2}:\d{2}(?:[.,]\d{1,3})?\][^\r\n]*\S/.test(contents)) {
        setError('The selected .lrc file does not contain timestamped lyric lines.');
        return;
      }
      setLyrics(contents);
    } catch (readError) {
      console.error('Could not read the selected LRC file:', readError);
      setError('Could not read the selected .lrc file.');
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const numericFields = [
      ['Year', year, 9999],
      ['Track number', trackNumber, 9999],
      ['Disc number', discNumber, 9999],
    ] as const;
    for (const [label, value, max] of numericFields) {
      if (value && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max)) {
        setError(`${label} must be a whole number from 1 to ${max}.`);
        return;
      }
    }

    setIsSaving(true);
    try {
      await onSave(track, {
        title: title.trim(),
        artist: artist.trim(),
        album: album.trim(),
        albumArtist: albumArtist.trim(),
        composer: composer.trim(),
        genre: genre.trim(),
        comment: comment.trim(),
        year: year ? Number(year) : null,
        trackNumber: trackNumber ? Number(trackNumber) : null,
        discNumber: discNumber ? Number(discNumber) : null,
        lyrics,
        ...(artworkData !== undefined
          ? { albumArtBase64: artworkData, albumArtMimeType: artworkMimeType }
          : {}),
      });
      onClose();
    } catch (saveError) {
      console.error('Could not save track metadata:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save track metadata.');
      setIsSaving(false);
    }
  };

  return (
    <div className='track-metadata-backdrop'>
      <button
        className='track-metadata-backdrop-close'
        type='button'
        aria-label='Close metadata editor'
        disabled={isSaving}
        tabIndex={-1}
        onClick={onClose}
      />
      <section
        className='track-metadata-editor'
        role='dialog'
        aria-modal='true'
        aria-labelledby='track-metadata-title'
      >
        <header className='track-metadata-header'>
          <div>
            <h2 id='track-metadata-title'>Edit track metadata</h2>
            <p>{track.filename}</p>
          </div>
          <button
            className='track-metadata-close'
            type='button'
            aria-label='Close metadata editor'
            disabled={isSaving}
            onClick={onClose}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              close
            </span>
          </button>
        </header>

        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
        >
          <div className='track-metadata-fields'>
            <label>
              Song name
              <input
                ref={titleInputRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              Artist
              <input
                value={artist}
                onChange={(event) => setArtist(event.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              Album
              <input
                value={album}
                onChange={(event) => setAlbum(event.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              Album artist
              <input
                value={albumArtist}
                onChange={(event) => setAlbumArtist(event.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              Composer
              <input
                value={composer}
                onChange={(event) => setComposer(event.target.value)}
                maxLength={300}
              />
            </label>
            <label>
              Genre
              <input
                value={genre}
                onChange={(event) => setGenre(event.target.value)}
                maxLength={150}
              />
            </label>
            <label>
              Year
              <input
                type='number'
                min='1'
                max='9999'
                value={year}
                onChange={(event) => setYear(event.target.value)}
              />
            </label>
            <label>
              Track number
              <input
                type='number'
                min='1'
                max='9999'
                value={trackNumber}
                onChange={(event) => setTrackNumber(event.target.value)}
              />
            </label>
            <label>
              Disc number
              <input
                type='number'
                min='1'
                max='9999'
                value={discNumber}
                onChange={(event) => setDiscNumber(event.target.value)}
              />
            </label>
            <label className='track-metadata-wide'>
              Comment
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                maxLength={2000}
              />
            </label>
          </div>

          <section className='track-metadata-artwork'>
            <div className='track-metadata-art-preview'>
              {artworkPreview ? (
                <img src={artworkPreview} alt='Selected album artwork' />
              ) : (
                <span className='material-symbols-outlined' aria-hidden='true'>
                  album
                </span>
              )}
            </div>
            <div>
              <h3>Album art</h3>
              <label className='track-metadata-file-button'>
                Choose image
                <input
                  type='file'
                  accept='image/jpeg,image/png,image/webp,image/gif,image/bmp'
                  onChange={(event) => {
                    void handleArtworkChange(event.target.files?.[0]);
                  }}
                />
              </label>
              {(track.albumArt || artworkData !== undefined) && (
                <button
                  className='track-metadata-remove-art'
                  type='button'
                  onClick={() => {
                    setArtworkData(null);
                    setArtworkMimeType(undefined);
                    setArtworkPreview(null);
                    if (artworkObjectUrlRef.current)
                      URL.revokeObjectURL(artworkObjectUrlRef.current);
                    artworkObjectUrlRef.current = null;
                  }}
                >
                  Remove artwork
                </button>
              )}
            </div>
          </section>

          <section className='track-metadata-lyrics'>
            <div className='track-metadata-section-heading'>
              <div>
                <h3>Lyrics</h3>
                <p>Paste plain lyrics or import an .lrc file to keep its timestamps.</p>
              </div>
              <label className='track-metadata-file-button'>
                Import .lrc
                <input
                  type='file'
                  accept='.lrc,text/plain'
                  onChange={(event) => {
                    void handleLyricsFileChange(event.target.files?.[0]);
                  }}
                />
              </label>
            </div>
            <textarea
              value={lyrics}
              onChange={(event) => setLyrics(event.target.value)}
              rows={8}
              maxLength={100000}
              placeholder='Paste lyrics here. Timestamped [mm:ss.xx] lines are synchronized.'
            />
          </section>

          {error && (
            <p className='track-metadata-error' role='alert'>
              {error}
            </p>
          )}
          <footer className='track-metadata-actions'>
            <button type='button' disabled={isSaving} onClick={onClose}>
              Cancel
            </button>
            <button type='submit' disabled={isSaving}>
              {isSaving ? 'Saving to file…' : 'Save to file'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
};

export default TrackMetadataEditor;
