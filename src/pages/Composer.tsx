import { memo, useMemo, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
import QueueContextMenu from '../components/QueueContextMenu';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import './Composer.css';

interface ComposerPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const ComposerPage = ({ tracks, onPlayTrack, onQueueTracks }: ComposerPageProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'works' | 'genre'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const composers = useMemo(() => {
    const composersByName = new Map<string, { id: string; name: string; tracks: Track[]; genres: Set<string> }>();
    tracks.forEach((track) => {
      if (!track.composer) return;
      const id = track.composer.toLocaleLowerCase();
      const composer = composersByName.get(id) ?? {
        id,
        name: track.composer,
        tracks: [],
        genres: new Set<string>(),
      };
      composer.tracks.push(track);
      if (track.genre) composer.genres.add(track.genre);
      composersByName.set(id, composer);
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

  return (
    <div className='composer-page'>
      <header className='page-header'>
        <div>
          <h1>Composers</h1>
          <p className='composer-count'>{composers.length} composers</p>
        </div>
        {composers.length > 0 && (
          <div className='sort-selector'>
            <label className='sort-label' htmlFor='composer-sort'>Sort by:</label>
            <select id='composer-sort' className='sort-select' value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
              <option value='name'>Name</option>
              <option value='works'>Works</option>
              <option value='genre'>Genre</option>
            </select>
            <button className='sort-direction' type='button' aria-label='Change sort direction' onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
              <span className='material-symbols-outlined'>{sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
            </button>
          </div>
        )}
      </header>

      {composers.length === 0 ? (
        <p className='library-message'>Composer credits from your indexed tracks will appear here when available in their metadata.</p>
      ) : (
        <div className='composers-grid'>
          {sortedComposers.map((composer) => (
            <QueueContextMenu key={composer.id} tracks={composer.tracks} onQueueTracks={onQueueTracks}>
            <div className='composer-card'>
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
