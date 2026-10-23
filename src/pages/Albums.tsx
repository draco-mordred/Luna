import { useState } from 'react';
import './Albums.css';

// Mock data - replace with real data
const mockAlbums = [
  {
    id: '1',
    name: 'After Hours',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=200&h=200&fit=crop',
    year: 2020,
    trackCount: 14,
    duration: 2980, // seconds
  },
  {
    id: '2',
    name: 'Starboy',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    year: 2016,
    trackCount: 18,
    duration: 3540,
  },
  {
    id: '3',
    name: 'Dawn FM',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1587329310686-936875979855?w=200&h=200&fit=crop',
    year: 2022,
    trackCount: 16,
    duration: 3200,
  },
  {
    id: '4',
    name: 'Beauty Behind The Madness',
    artist: 'The Weeknd',
    cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    year: 2015,
    trackCount: 14,
    duration: 3100,
  },
];

// Sort options
const SORT_OPTIONS = [
  { id: 'name', label: 'Name' },
  { id: 'artist', label: 'Artist' },
  { id: 'year', label: 'Year' },
  { id: 'tracks', label: 'Track Count' },
];

const AlbumsPage = () => {
  const [sortBy, setSortBy] = useState<'name' | 'artist' | 'year' | 'tracks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Sort albums
  const sortedAlbums = [...mockAlbums].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    
    switch (sortBy) {
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'artist':
        aVal = a.artist;
        bVal = b.artist;
        break;
      case 'year':
        aVal = a.year || 0;
        bVal = b.year || 0;
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

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Handle sort
  const handleSort = (field: 'name' | 'artist' | 'year' | 'tracks') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="albums-page">
      {/* Page Header */}
      <header className="page-header">
        <div className="header-left">
          <h1>Albums</h1>
          <p className="album-count">{mockAlbums.length} albums</p>
        </div>
        <div className="header-right">
          <div className="view-mode-toggle">
            <button 
              className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <span className="material-symbols-outlined">grid_view</span>
            </button>
            <button 
              className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <span className="material-symbols-outlined">list</span>
            </button>
          </div>
          <div className="sort-selector">
            <span className="sort-label">Sort by:</span>
            <select 
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'artist' | 'year' | 'tracks')}
            >
              {SORT_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <button className="sort-direction" onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}>
              <span className="material-symbols-outlined">
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Albums Grid/List */}
      <div className={`albums-container ${viewMode}`}>
        {viewMode === 'grid' ? (
          /* Grid View */
          <div className="albums-grid">
            {sortedAlbums.map((album) => (
              <div key={album.id} className="album-card">
                <div className="album-cover">
                  <img src={album.cover} alt={album.name} />
                  <button className="play-button">
                    <span className="material-symbols-outlined">play_arrow</span>
                  </button>
                </div>
                <div className="album-info">
                  <h3 className="album-name">{album.name}</h3>
                  <p className="album-artist">{album.artist}</p>
                  <p className="album-meta">{album.year} • {album.trackCount} tracks</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="albums-list">
            {sortedAlbums.map((album, index) => (
              <div key={album.id} className="album-list-item">
                <div className="album-list-number">{index + 1}</div>
                <div className="album-list-cover">
                  <img src={album.cover} alt={album.name} />
                </div>
                <div className="album-list-info">
                  <h3 className="album-list-name">{album.name}</h3>
                  <p className="album-list-artist">{album.artist}</p>
                </div>
                <div className="album-list-year">{album.year}</div>
                <div className="album-list-tracks">{album.trackCount} tracks</div>
                <div className="album-list-duration">{formatDuration(album.duration)}</div>
                <button className="album-list-menu">
                  <span className="material-symbols-outlined">more_vert</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumsPage;
