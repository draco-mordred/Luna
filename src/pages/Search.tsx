import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import { buildSearchGroups } from '../services/search';
import './Search.css';

interface SearchPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track) => void;
}

const SearchPage = ({ tracks, onPlayTrack }: SearchPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAllByGroup, setShowAllByGroup] = useState<Record<string, boolean>>({});
  const query = searchParams.get('q') ?? '';

  const searchGroups = useMemo(() => buildSearchGroups(tracks, query), [query, tracks]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    const params = new URLSearchParams(searchParams);
    if (nextValue.trim()) {
      params.set('q', nextValue);
    } else {
      params.delete('q');
    }
    setSearchParams(params, { replace: true });
  };

  const showAllFor = (title: string) => {
    setShowAllByGroup((current) => ({ ...current, [title]: !current[title] }));
  };

  return (
    <div className="search-page">
      <header className="page-header search-header">
        <h1>Search</h1>
      </header>

      <div className="search-toolbar">
        <label className="search-input-wrap" htmlFor="search-page-input">
          <span className="material-symbols-outlined">search</span>
          <input
            id="search-page-input"
            type="text"
            value={query}
            placeholder="Search tracks, albums, artists, genres"
            onChange={handleSearchChange}
          />
        </label>
      </div>

      {!query ? (
        <div className="search-empty-state">
          <span className="material-symbols-outlined">search</span>
          <h2>Search your library</h2>
          <p>Find tracks, albums, artists, and genres from your saved music folders.</p>
        </div>
      ) : (
        <div className="search-results">
          {searchGroups.map((group) => {
            const visibleItems = showAllByGroup[group.title] ? group.items : group.items.slice(0, 10);
            const hasMatches = group.items.length > 0;

            return (
              <section key={group.title} className="search-group">
                <div className="group-header">
                  <h2>{group.title}</h2>
                  {hasMatches && group.items.length > 10 && (
                    <button type="button" className="see-all-button" onClick={() => showAllFor(group.title)}>
                      {showAllByGroup[group.title] ? 'Show less' : 'See all'}
                    </button>
                  )}
                </div>

                {!hasMatches ? (
                  <p className="search-group-empty">No matches found.</p>
                ) : (
                  <div className="search-grid">
                    {visibleItems.map((item) => (
                      <button
                        key={`${group.title}-${item.id}`}
                        type="button"
                        className="search-result-card"
                        onClick={() => {
                          if (item.type === 'track' && item.track) {
                            onPlayTrack(item.track);
                          }
                        }}
                      >
                        <span className="material-symbols-outlined result-icon">
                          {item.type === 'track' ? 'music_note' : item.type === 'album' ? 'album' : item.type === 'artist' ? 'person' : 'tag'}
                        </span>
                        <div className="result-copy">
                          <strong>{item.title}</strong>
                          <span>{item.subtitle}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
