import { memo, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import { buildSearchGroups } from '../services/search';
import CollectionContextMenu from '../components/CollectionContextMenu';
import QueueContextMenu from '../components/QueueContextMenu';
import { artistCreditIncludes } from '../utils/artistCredits';
import { getLibraryItemPath } from '../utils/libraryNavigation';
import './Search.css';

interface SearchPageProps {
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  favoriteAlbumKeys: string[];
  favoriteArtistNames: string[];
  onToggleFavoriteCollection: (type: 'album' | 'artist', key: string) => void;
  onAddToPlaylist: (tracks: Track[], label: string) => void;
}

const SearchPage = ({
  tracks,
  onPlayTrack,
  onQueueTracks,
  favoriteAlbumKeys,
  favoriteArtistNames,
  onToggleFavoriteCollection,
  onAddToPlaylist,
}: SearchPageProps) => {
  const navigate = useNavigate();
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
                    {visibleItems.map((item) => {
                      const queueTracks = item.type === 'track' && item.track
                        ? [item.track]
                        : item.type === 'album'
                          ? tracks.filter((track) => track.album === item.title && track.artist === item.subtitle)
                          : item.type === 'artist'
                            ? tracks.filter((track) => artistCreditIncludes(track.artist, item.title))
                            : tracks.filter((track) => track.genre === item.title);
                      const resultCard = (
                        <button
                            type="button"
                            className="search-result-card"
                            onClick={() => {
                              if (item.type === 'track' && item.track) {
                                onPlayTrack(item.track, searchGroups[0].items.flatMap((trackItem) => trackItem.track ? [trackItem.track] : []));
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
                      );
                      if (item.type === 'album' || item.type === 'artist') {
                        const albumTitle = queueTracks[0]?.album ?? item.title;
                        const albumArtist = queueTracks[0]?.artist ?? item.subtitle;
                        const isAlbum = item.type === 'album';
                        const favoriteKey = isAlbum
                          ? `${albumTitle}\u0000${albumArtist}`
                          : item.title.toLocaleLowerCase();
                        const isFavorite = isAlbum
                          ? favoriteAlbumKeys.includes(favoriteKey)
                          : favoriteArtistNames.includes(favoriteKey);
                        return (
                          <CollectionContextMenu
                            key={`${group.title}-${item.id}`}
                            label={item.title}
                            tracks={queueTracks}
                            isFavorite={isFavorite}
                            onOpen={() =>
                              navigate(
                                isAlbum
                                  ? getLibraryItemPath('album', albumTitle, albumArtist)
                                  : getLibraryItemPath('artist', item.title)
                              )
                            }
                            onPlayNow={() => {
                              if (queueTracks[0]) onPlayTrack(queueTracks[0], queueTracks);
                            }}
                            onQueueTracks={onQueueTracks}
                            onAddToPlaylist={onAddToPlaylist}
                            onToggleFavorite={() =>
                              onToggleFavoriteCollection(isAlbum ? 'album' : 'artist', favoriteKey)
                            }
                          >
                            {resultCard}
                          </CollectionContextMenu>
                        );
                      }
                      return (
                        <QueueContextMenu
                          key={`${group.title}-${item.id}`}
                          tracks={queueTracks}
                          onQueueTracks={onQueueTracks}
                        >
                          {resultCard}
                        </QueueContextMenu>
                      );
                    })}
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

export default memo(SearchPage);
