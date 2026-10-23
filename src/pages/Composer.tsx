import { useState } from 'react';
import './Composer.css';

// Mock data - composers with their works
const mockComposers = [
  {
    id: '1',
    name: 'Hans Zimmer',
    image: 'https://images.unsplash.com/photo-1551847677-a84c2b426ba3?w=200&h=200&fit=crop',
    worksCount: 150,
    popularWorks: ['Inception', 'Interstellar', 'The Dark Knight'],
    genre: 'Film Score',
  },
  {
    id: '2',
    name: 'Ludwig Göransson',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
    worksCount: 85,
    popularWorks: ['Black Panther', 'Tenet', 'The Mandalorian'],
    genre: 'Film Score',
  },
  {
    id: '3',
    name: 'John Williams',
    image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    worksCount: 200,
    popularWorks: ['Star Wars', 'Jurassic Park', 'Indiana Jones'],
    genre: 'Film Score',
  },
  {
    id: '4',
    name: 'Max Richter',
    image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&h=200&fit=crop',
    worksCount: 120,
    popularWorks: ['On the Nature of Daylight', 'The Blue Notebooks', 'Three Worlds'],
    genre: 'Modern Classical',
  },
];

const ComposerPage = () => {
  const [sortBy, setSortBy] = useState<'name' | 'works' | 'genre'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sort composers
  const sortedComposers = [...mockComposers].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;
    
    switch (sortBy) {
      case 'name':
        aVal = a.name;
        bVal = b.name;
        break;
      case 'works':
        aVal = a.worksCount;
        bVal = b.worksCount;
        break;
      case 'genre':
        aVal = a.genre;
        bVal = b.genre;
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
  const handleSort = (field: 'name' | 'works' | 'genre') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="composer-page">
      <header className="page-header">
        <h1>Composers</h1>
        <p className="composer-count">{mockComposers.length} composers</p>
      </header>

      <div className="composers-grid">
        {sortedComposers.map((composer) => (
          <div key={composer.id} className="composer-card">
            <div className="composer-image">
              <img src={composer.image} alt={composer.name} />
              <div className="composer-badge">{composer.genre}</div>
              <button className="play-button">
                <span className="material-symbols-outlined">shuffle</span>
              </button>
            </div>
            <div className="composer-info">
              <h3 className="composer-name">{composer.name}</h3>
              <p className="composer-stats">{composer.worksCount} works</p>
              <div className="composer-works">
                {composer.popularWorks.slice(0, 2).map((work, index) => (
                  <span key={index} className="work">{work}{index < composer.popularWorks.slice(0, 2).length - 1 ? ', ' : ''}</span>
                ))}
                {composer.popularWorks.length > 2 && <span> +{composer.popularWorks.length - 2} more</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ComposerPage;
