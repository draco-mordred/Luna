import { useState } from 'react';
import './Tracks.css';

// Mock data - replace with real data from MusicLibrary
const mockTracks = [
  { id: '1', name: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200, trackNumber: 1 },
  { id: '2', name: 'Save Your Tears', artist: 'The Weeknd', album: 'After Hours', duration: 235, trackNumber: 2 },
  { id: '3', name: 'In Your Eyes', artist: 'The Weeknd', album: 'After Hours', duration: 238, trackNumber: 3 },
  { id: '4', name: 'Heartless', artist: 'The Weeknd', album: 'After Hours', duration: 192, trackNumber: 4 },
  { id: '5', name: 'After Hours', artist: 'The Weeknd', album: 'After Hours', duration: 367, trackNumber: 5 },
  { id: '6', name: 'Starboy', artist: 'The Weeknd', album: 'Starboy', duration: 234, trackNumber: 1 },
  { id: '7', name: 'Party Monster', artist: 'The Weeknd', album: 'Starboy', duration: 252, trackNumber: 2 },
  { id: '8', name: 'False Alarm', artist: 'The Weeknd', album: 'Starboy', duration: 194, trackNumber: 3 },
];

const TracksPage = () => {
  const [sortBy, setSortBy] = useState<'name' | 'artist' | 'album' | 'duration'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sort tracks
  const sortedTracks = [...mockTracks].sort((a, b) => {
    const aVal = a[sortBy as keyof typeof mockTracks[0]];
    const bVal = b[sortBy as keyof typeof mockTracks[0]];
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle sort
  const handleSort = (field: 'name' | 'artist' | 'album' | 'duration') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="tracks-page">
      {/* Page Header */}
      <header className="page-header">
        <h1>Tracks</h1>
        <p className="track-count">{mockTracks.length} tracks</p>
      </header>

      {/* Track List Header */}
      <div className="track-list-header">
        <button 
          className={`sort-button ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => handleSort('name')}
        >
          <span>Title</span>
          <span className="sort-icon">
            {sortBy === 'name' && (
              <span className="material-symbols-outlined">
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </span>
        </button>
        <button 
          className={`sort-button ${sortBy === 'artist' ? 'active' : ''}`}
          onClick={() => handleSort('artist')}
        >
          <span>Artist</span>
          <span className="sort-icon">
            {sortBy === 'artist' && (
              <span className="material-symbols-outlined">
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </span>
        </button>
        <button 
          className={`sort-button ${sortBy === 'album' ? 'active' : ''}`}
          onClick={() => handleSort('album')}
        >
          <span>Album</span>
          <span className="sort-icon">
            {sortBy === 'album' && (
              <span className="material-symbols-outlined">
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </span>
        </button>
        <div className="header-spacer"></div>
        <button 
          className={`sort-button ${sortBy === 'duration' ? 'active' : ''}`}
          onClick={() => handleSort('duration')}
        >
          <span className="material-symbols-outlined">timer</span>
          <span className="sort-icon">
            {sortBy === 'duration' && (
              <span className="material-symbols-outlined">
                {sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
              </span>
            )}
          </span>
        </button>
      </div>

      {/* Track List */}
      <div className="track-list">
        {sortedTracks.map((track, index) => (
          <div key={track.id} className="track-item">
            <div className="track-number">{index + 1}</div>
            <div className="track-info">
              <h3 className="track-name">{track.name}</h3>
              <p className="track-artist">{track.artist}</p>
            </div>
            <div className="track-album">{track.album}</div>
            <div className="track-duration">{formatDuration(track.duration)}</div>
            <button className="track-menu">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TracksPage;
