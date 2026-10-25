import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import QueueContextMenu from '../components/QueueContextMenu';
import { getLibraryItemHash, getLibraryItemPath, useScrollToLibraryItem } from '../utils/libraryNavigation';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import './Genres.css';

interface GenresPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const GenresPage = ({ tracks, onPlayTrack, onQueueTracks }: GenresPageProps) => {
  const navigate = useNavigate();
  useScrollToLibraryItem();
  const genres = useMemo(() => {
    const tracksByGenre = new Map<string, { name: string; tracks: Track[] }>();
    tracks.forEach((track) => {
      const name = track.genre?.trim();
      if (!name) return;
      const key = name.toLocaleLowerCase();
      const genre = tracksByGenre.get(key) ?? { name, tracks: [] };
      genre.tracks.push(track);
      tracksByGenre.set(key, genre);
    });
    return [...tracksByGenre.values()]
      .map((genre) => ({ ...genre, tracks: sortCollectionTracks(genre.tracks) }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [tracks]);

  return (
    <div className='genres-page'>
      <header className='page-header'>
        <h1>Genres</h1>
        <p className='genre-count'>{genres.length} genres</p>
      </header>
      {genres.length === 0 ? (
        <p className='library-message'>Genres from your indexed music will appear here when available in track metadata.</p>
      ) : (
        <div className='genres-grid'>
          {genres.map((genre) => (
            <QueueContextMenu key={genre.name.toLocaleLowerCase()} tracks={genre.tracks} onQueueTracks={onQueueTracks}>
            <section
              id={getLibraryItemHash('genre', genre.name).slice(1)}
              className='genre-card'
              role='link'
              tabIndex={0}
              aria-label={`Open ${genre.name}`}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                navigate(getLibraryItemPath('genre', genre.name));
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                event.preventDefault();
                navigate(getLibraryItemPath('genre', genre.name));
              }}
            >
              <header className='genre-card-header'>
                <button
                  type='button'
                  className='genre-expand-button'
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(getLibraryItemPath('genre', genre.name));
                  }}
                >
                  <span>
                    <span className='genre-card-name'>{genre.name}</span>
                    <span className='genre-card-count'>{genre.tracks.length} tracks</span>
                  </span>
                </button>
                <button
                  className='genre-play-button'
                  type='button'
                  aria-label={`Play ${genre.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onPlayTrack(genre.tracks[0], genre.tracks);
                  }}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>play_arrow</span>
                </button>
              </header>
            </section>
            </QueueContextMenu>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(GenresPage);
