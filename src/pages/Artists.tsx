import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import AlphaNumericIndex, { buildAlphaNumericIndex } from '../components/AlphaNumericIndex';
import QueueContextMenu from '../components/QueueContextMenu';
import { getLibraryItemHash, getLibraryItemPath, useScrollToLibraryItem } from '../utils/libraryNavigation';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import { splitArtistCredits } from '../utils/artistCredits';
import { compareAlphaNumericFirst } from '../utils/alphaNumericSort';
import { useArtistImage } from '../services/artistImages';
import './Artists.css';

interface ArtistCardProps {
  artist: {
    id: string;
    name: string;
    albums: Set<string>;
    tracks: Track[];
  };
  allowImageDownload: boolean;
  onOpen: () => void;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
}

const ArtistCard = ({ artist, allowImageDownload, onOpen, onPlayTrack }: ArtistCardProps) => {
  const { elementRef, imageUrl } = useArtistImage(artist.name, {
    allowDownload: allowImageDownload,
    loadWhenVisible: true,
  });
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const hasImage = Boolean(imageUrl && imageUrl !== failedImageUrl);

  return (
    <div
      ref={elementRef}
      id={getLibraryItemHash('artist', artist.name).slice(1)}
      className='artist-card'
      role='link'
      tabIndex={0}
      aria-label={`Open ${artist.name}`}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return;
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onOpen();
      }}
    >
      <div className={`artist-image ${hasImage ? '' : 'artist-image-placeholder'}`}>
        {hasImage ? (
          <img
            src={imageUrl ?? undefined}
            alt={`${artist.name}`}
            loading='lazy'
            decoding='async'
            onError={() => setFailedImageUrl(imageUrl)}
          />
        ) : (
          <span className='material-symbols-outlined' aria-hidden='true'>person</span>
        )}
        <button className='play-button' type='button' aria-label={`Play ${artist.name}`} onClick={(event) => {
          event.stopPropagation();
          onPlayTrack(artist.tracks[0], artist.tracks);
        }}>
          <span className='material-symbols-outlined'>play_arrow</span>
        </button>
      </div>
      <div className='artist-info'>
        <button
          type='button'
          className='collection-expand-title'
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <span className='artist-name'>{artist.name}</span>
        </button>
        <p className='artist-stats'>{artist.albums.size} albums • {artist.tracks.length} tracks</p>
      </div>
    </div>
  );
};

interface ArtistsPageProps {
  tracks: Track[];
  autoDownloadArtistImages: boolean;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onShufflePlay: (tracks: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const ArtistsPage = ({
  tracks,
  autoDownloadArtistImages,
  onPlayTrack,
  onShufflePlay,
  onQueueTracks,
}: ArtistsPageProps) => {
  const [sortBy, setSortBy] = useState<'name' | 'albums' | 'tracks'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const navigate = useNavigate();
  useScrollToLibraryItem();

  const artists = useMemo(() => {
    const artistsByName = new Map<string, { id: string; name: string; albums: Set<string>; tracks: Track[] }>();
    tracks.forEach((track) => {
      splitArtistCredits(track.artist).forEach((artistName) => {
        const id = artistName.toLocaleLowerCase();
        const artist = artistsByName.get(id) ?? { id, name: artistName, albums: new Set<string>(), tracks: [] };
        artist.albums.add(track.album.toLocaleLowerCase());
        artist.tracks.push(track);
        artistsByName.set(id, artist);
      });
    });
    return Array.from(artistsByName.values()).map((artist) => ({
      ...artist,
      tracks: sortCollectionTracks(artist.tracks),
    }));
  }, [tracks]);

  const sortedArtists = useMemo(
    () =>
      [...artists].sort((a, b) => {
        const aValue = sortBy === 'name' ? a.name : sortBy === 'albums' ? a.albums.size : a.tracks.length;
        const bValue = sortBy === 'name' ? b.name : sortBy === 'albums' ? b.albums.size : b.tracks.length;
        return compareAlphaNumericFirst(aValue, bValue, sortDirection);
      }),
    [artists, sortBy, sortDirection]
  );
  const artistIndexEntries = useMemo(
    () =>
      buildAlphaNumericIndex(
        sortedArtists,
        (artist) => (sortBy === 'name' ? artist.name : sortBy === 'albums' ? artist.albums.size : artist.tracks.length),
        (artist) => getLibraryItemHash('artist', artist.name).slice(1)
      ),
    [sortBy, sortedArtists]
  );

  return (
    <div
      className={`artists-page indexed-page-layout ${artistIndexEntries.length ? 'has-index' : ''}`}
    >
      <div className='indexed-page-content'>
        <header className='page-header'>
          <div>
            <h1>Artists</h1>
            <p className='artist-count'>{artists.length} artists</p>
          </div>
          <div className='artists-header-actions'>
            <button
              className='shuffle-play-button'
              type='button'
              disabled={tracks.length === 0}
              onClick={() => onShufflePlay(tracks)}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>shuffle</span>
              Shuffle &amp; Play
            </button>
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
          </div>
        </header>

        {artists.length === 0 ? (
          <p className='library-message'>Artists from your indexed music folders will appear here.</p>
        ) : (
          <div className='artists-grid'>
            {sortedArtists.map((artist) => (
              <QueueContextMenu key={artist.id} tracks={artist.tracks} onQueueTracks={onQueueTracks}>
                <ArtistCard
                  artist={artist}
                  allowImageDownload={autoDownloadArtistImages}
                  onOpen={() => navigate(getLibraryItemPath('artist', artist.name))}
                  onPlayTrack={onPlayTrack}
                />
              </QueueContextMenu>
            ))}
          </div>
        )}
      </div>
      {artistIndexEntries.length > 0 && (
        <AlphaNumericIndex
          entries={artistIndexEntries}
          ariaLabel='Artist list index'
          scrollContainerSelector='.page-content'
        />
      )}
    </div>
  );
};

export default memo(ArtistsPage);
