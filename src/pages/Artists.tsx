import { useState } from 'react';
import './Artists.css';

// Mock data
const mockArtists = [
  {
    id: '1',
    name: 'The Weeknd',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    albumCount: 4,
    trackCount: 62,
    topTracks: ['Blinding Lights', 'Save Your Tears', 'Starboy'],
  },
  {
    id: '2',
    name: 'Drake',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    albumCount: 6,
    trackCount: 87,
    topTracks: ['Gods Plan', 'Hotline Bling', 'One Dance'],
  },
  {
    id: '3',
    name: 'Taylor Swift',
    image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop',
    albumCount: 10,
    trackCount: 125,
    topTracks: ['Blank Space', 'Shake It Off', 'Love Story'],
  },
  {
    id: '4',
    name: 'Travis Scott',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    albumCount: 4,
    trackCount: 54,
    topTracks: ['SICKO MODE', 'Goosebumps', 'Antidote'],
  },
];

const ArtistsPage = () => {
  const [sortBy, setSortBy] = useState<'name' | 'albums' | 'tracks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sort artists
  const sortedArtists = [...mockArtists].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    
    switch (sortBy) {
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'albums':
        aVal = a.albumCount;
        bVal = b.albumCount;
        break;
      case 'tracks':
        aVal = a.trackCount;
        bVal = b.trackCount;
        break;
      default:
        aVal = a.name;
        bVal = b.name;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sort
  const handleSort = (field: 'name' | 'albums' | 'tracks') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="artists-page">
      <header className="page-header">
        <h1>Artists</h1>
        <p className="artist-count">{mockArtists.length} artists</p>
      </header>

      <div className="artists-grid">
        {sortedArtists.map((artist) => (
          <div key={artist.id} className="artist-card">
            <div className="artist-image">
              <img src={artist.image} alt={artist.name} />
              <button className="play-button">
                <span className="material-symbols-outlined">shuffle</span>
              </button>
            </div>
            <div className="artist-info">
              <h3 className="artist-name">{artist.name}</h3>
              <p className="artist-stats">{artist.albumCount} albums • {artist.trackCount} tracks</p>
              <div className="artist-toptracks">
                {artist.topTracks.map((track, index) => (
                  <span key={index} className="toptrack">{track}{index < artist.topTracks.length - 1 ? ', ' : ''}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ArtistsPage;
