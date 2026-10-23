import { useMemo, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
import './Artists.css';

interface ArtistsPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}

const ArtistsPage = ({ tracks, onPlayTrack }: ArtistsPageProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'albums' | 'tracks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const artists = useMemo(() => {
    const artistsByName = new Map<string, { id: string; name: string; albums: Set<string>; tracks: Track[] }>();
    tracks.forEach((track) => {
      const id = track.artist.toLocaleLowerCase();
      const artist = artistsByName.get(id) ?? { id, name: track.artist, albums: new Set<string>(), tracks: [] };
      artist.albums.add(track.album.toLocaleLowerCase());
      artist.tracks.push(track);
      artistsByName.set(id, artist);
    });
    return Array.from(artistsByName.values());
  }, [tracks]);

  const sortedArtists = [...artists].sort((a, b) => {
    const aValue = sortBy === 'name' ? a.name : sortBy === 'albums' ? a.albums.size : a.tracks.length;
    const bValue = sortBy === 'name' ? b.name : sortBy === 'albums' ? b.albums.size : b.tracks.length;
    const comparison = typeof aValue === 'number' && typeof bValue === 'number'
      ? aValue - bValue
      : String(aValue).localeCompare(String(bValue));
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className='artists-page'>
      <header className='page-header'>
        <div>
          <h1>Artists</h1>
          <p className='artist-count'>{artists.length} artists</p>
        </div>
        {artists.length > 0 && (
          <div className='sort-selector'>
            <label className='sort-label' htmlFor='artist-sort'>Sort by:</label>
            <select id='artist-sort' className='sort-select' value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
              <option value='name'>Name</option>
              <option value='albums'>Albums</option>
              <option value='tracks'>Tracks</option>
            </select>
            <button className='sort-direction' type='button' aria-label='Change sort direction' onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
              <span className='material-symbols-outlined'>{sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>
            </button>
          </div>
        )}
      </header>

      {artists.length === 0 ? (
        <p className='library-message'>Artists from your indexed music folders will appear here.</p>
      ) : (
        <div className='artists-grid'>
          {sortedArtists.map((artist) => (
            <div key={artist.id} className='artist-card'>
              <div className='artist-image artist-image-placeholder'>
                <span className='material-symbols-outlined' aria-hidden='true'>person</span>
                <button className='play-button' type='button' aria-label={`Play ${artist.name}`} onClick={() => onPlayTrack(artist.tracks[0])}>
                  <span className='material-symbols-outlined'>play_arrow</span>
                </button>
              </div>
              <div className='artist-info'>
                <h3 className='artist-name'>{artist.name}</h3>
                <p className='artist-stats'>{artist.albums.size} albums • {artist.tracks.length} tracks</p>
                <div className='artist-toptracks'>
                  {artist.tracks.slice(0, 3).map((track) => (
                    <button key={track.id} type='button' className='artist-track-button' onClick={() => onPlayTrack(track)}>
                      {track.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtistsPage;
