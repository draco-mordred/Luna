import { memo, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import LibraryTrackList from '../components/LibraryTrackList';
import QueueContextMenu from '../components/QueueContextMenu';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import { splitArtistCredits } from '../utils/artistCredits';
import AndroidLibrarySortMenu from '../components/AndroidLibrarySortMenu';
import './Composer.css';

interface ComposerPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const ComposerPage = ({ tracks, onPlayTrack, onQueueTracks }: ComposerPageProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<'name' | 'works' | 'genre'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const selectedComposerName = searchParams.get('name')?.trim() ?? '';
  const sortOptions = [
    { value: 'name', label: 'Name' },
    { value: 'works', label: 'Works' },
    { value: 'genre', label: 'Genre' },
  ] as const;

  const composers = useMemo(() => {
    const composersByName = new Map<string, { id: string; name: string; tracks: Track[]; genres: Set<string> }>();
    tracks.forEach((track) => {
      if (!track.composer) return;
      splitArtistCredits(track.composer).forEach((composerName) => {
        const id = composerName.toLocaleLowerCase();
        const composer = composersByName.get(id) ?? {
          id,
          name: composerName,
          tracks: [],
          genres: new Set<string>(),
        };
        composer.tracks.push(track);
        if (track.genre) {
          track.genre
            .split(/[;,]/)
            .map((genre) => genre.trim())
            .filter(Boolean)
            .forEach((genre) => composer.genres.add(genre));
        }
        composersByName.set(id, composer);
      });
    });
    return Array.from(composersByName.values()).map((composer) => ({
      ...composer,
      tracks: sortCollectionTracks(composer.tracks),
    }));
  }, [tracks]);

  const sortedComposers = [...composers].sort((a, b) => {
    const aValue = sortBy === 'name' ? a.name : sortBy === 'works' ? a.tracks.length : [...a.genres].join(', ');
    const bValue = sortBy === 'name' ? b.name : sortBy === 'works' ? b.tracks.length : [...b.genres].join(', ');
    const comparison = typeof aValue === 'number' && typeof bValue === 'number'
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  if (selectedComposerName) {
    const composer = composers.find(
      (item) => item.name.toLocaleLowerCase() === selectedComposerName.toLocaleLowerCase()
    );
    return (
      <div className='composer-page composer-detail-page'>
        <header className='page-header composer-detail-header'>
          <button
            type='button'
            className='composer-back-button'
            onClick={() => navigate('/composer')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              arrow_back
            </span>
            Composers
          </button>
          <div>
            <h1>{composer?.name ?? selectedComposerName}</h1>
            <p className='composer-count'>
              {composer ? `${composer.tracks.length} works` : 'Composer not found'}
            </p>
          </div>
        </header>
        {composer ? (
          <LibraryTrackList
            tracks={composer.tracks}
            onPlayTrack={onPlayTrack}
            onQueueTracks={onQueueTracks}
          />
        ) : (
          <p className='library-message'>
            No tracks in your library have a composer credit matching this name.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className='composer-page'>
      <header className='page-header'>
        <div>
          <h1>Composers</h1>
          <p className='composer-count'>{composers.length} composers</p>
        </div>
        {composers.length > 0 && (
          <>
            <AndroidLibrarySortMenu
              options={sortOptions}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortDirection={sortDirection}
              onToggleDirection={() =>
                setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
              }
            />
            <div className='sort-selector'>
              <label className='sort-label' htmlFor='composer-sort'>
                Sort by:
              </label>
              <select
                id='composer-sort'
                className='sort-select'
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as typeof sortBy)}
              >
                <option value='name'>Name</option>
                <option value='works'>Works</option>
                <option value='genre'>Genre</option>
              </select>
              <button
                className='sort-direction'
                type='button'
                aria-label='Change sort direction'
                onClick={() =>
                  setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
                }
              >
                <span className='material-symbols-outlined'>
                  {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                </span>
              </button>
            </div>
          </>
        )}
      </header>

      {composers.length === 0 ? (
        <p className='library-message'>Composer credits from your indexed tracks will appear here when available in their metadata.</p>
      ) : (
        <div className='composers-grid'>
          {sortedComposers.map((composer) => (
            <QueueContextMenu key={composer.id} tracks={composer.tracks} onQueueTracks={onQueueTracks}>
            <div
              className='composer-card'
              role='link'
              tabIndex={0}
              aria-label={`Open ${composer.name}`}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                navigate(`/composer?${new URLSearchParams({ name: composer.name }).toString()}`);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' '))
                  return;
                event.preventDefault();
                navigate(`/composer?${new URLSearchParams({ name: composer.name }).toString()}`);
              }}
            >
              <div className='composer-image composer-image-placeholder'>
                <span className='material-symbols-outlined' aria-hidden='true'>edit_note</span>
                <div className='composer-badge'>{[...composer.genres].join(', ') || 'Composer'}</div>
                <button className='play-button' type='button' aria-label={`Play ${composer.name}`} onClick={() => onPlayTrack(composer.tracks[0], composer.tracks)}>
                  <span className='material-symbols-outlined'>play_arrow</span>
                </button>
              </div>
              <div className='composer-info'>
                <h3 className='composer-name'>{composer.name}</h3>
                <p className='composer-stats'>{composer.tracks.length} works</p>
                <div className='composer-works'>
                  {composer.tracks.slice(0, 3).map((track) => (
                    <button key={track.id} type='button' className='composer-track-button' onClick={() => onPlayTrack(track, composer.tracks)}>
                      {track.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            </QueueContextMenu>
          ))}
        </div>
      )}
    </div>
  );
};

export default memo(ComposerPage);
