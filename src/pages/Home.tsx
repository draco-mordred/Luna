import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import { useArtistImage } from '../services/artistImages';
import {
  loadRecentMediaHistory,
  MAX_RECENT_MEDIA_ITEMS,
  rememberRecentMediaEnabled,
} from '../services/recentMedia';
import { splitArtistCredits } from '../utils/artistCredits';
import { getLibraryItemPath } from '../utils/libraryNavigation';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import './Home.css';

type HomeTab = 'history' | 'favorites' | 'most-played';

interface HomePageProps {
  tracks: Track[];
  lovedTrackIds: string[];
  autoDownloadArtistImages: boolean;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onToggleLove: (track: Track) => void;
  onShufflePlay: (tracks: Track[]) => void;
}

const HomeArtistCard = memo(
  ({
    name,
    tracks,
    autoDownloadArtistImages,
  }: {
    name: string;
    tracks: Track[];
    autoDownloadArtistImages: boolean;
  }) => {
    const navigate = useNavigate();
    const { elementRef, imageUrl } = useArtistImage(name, {
      allowDownload: autoDownloadArtistImages,
      loadWhenVisible: true,
    });
    return (
      <div
        ref={elementRef}
        className='home-artist-card'
        role='button'
        tabIndex={0}
        onClick={() => navigate(getLibraryItemPath('artist', name))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            navigate(getLibraryItemPath('artist', name));
          }
        }}
      >
        <span className='home-artist-image'>
          {imageUrl ? (
            <img src={imageUrl} alt='' loading='lazy' decoding='async' />
          ) : (
            <span className='material-symbols-outlined' aria-hidden='true'>
              person
            </span>
          )}
        </span>
        <span className='home-artist-name'>{name}</span>
        <span className='home-artist-count'>{tracks.length} tracks</span>
      </div>
    );
  }
);

const HomePage = ({
  tracks,
  lovedTrackIds,
  autoDownloadArtistImages,
  onPlayTrack,
  onToggleLove,
  onShufflePlay,
}: HomePageProps) => {
  const [activeTab, setActiveTab] = useState<HomeTab>('history');
  const [celebratingTrackId, setCelebratingTrackId] = useState<string | null>(null);
  const favoriteCelebrationTimeoutRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const rememberEnabled = rememberRecentMediaEnabled();
  const history = loadRecentMediaHistory();

  useEffect(
    () => () => {
      if (favoriteCelebrationTimeoutRef.current !== null) {
        window.clearTimeout(favoriteCelebrationTimeoutRef.current);
      }
    },
    []
  );

  const toggleFavorite = (track: Track, isLoved: boolean) => {
    onToggleLove(track);
    if (isLoved) {
      if (celebratingTrackId === track.id) {
        setCelebratingTrackId(null);
        if (favoriteCelebrationTimeoutRef.current !== null) {
          window.clearTimeout(favoriteCelebrationTimeoutRef.current);
          favoriteCelebrationTimeoutRef.current = null;
        }
      }
      return;
    }
    setCelebratingTrackId(track.id);
    if (favoriteCelebrationTimeoutRef.current !== null) {
      window.clearTimeout(favoriteCelebrationTimeoutRef.current);
    }
    favoriteCelebrationTimeoutRef.current = window.setTimeout(() => {
      setCelebratingTrackId(null);
      favoriteCelebrationTimeoutRef.current = null;
    }, 3_000);
  };

  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  const trackHistory = useMemo(() => {
    if (activeTab === 'favorites') {
      return lovedTrackIds.map((id) => tracksById.get(id)).filter((track): track is Track => !!track);
    }
    if (activeTab === 'most-played') {
      return Object.entries(history.playCounts)
        .sort((left, right) => right[1] - left[1])
        .map(([id]) => tracksById.get(id))
        .filter((track): track is Track => !!track)
        .slice(0, MAX_RECENT_MEDIA_ITEMS);
    }
    const played = history.playedTrackIds
      .map((id) => tracksById.get(id))
      .filter((track): track is Track => !!track);
    const recentlyAdded = [...tracks]
      .sort((left, right) => right.lastModified - left.lastModified)
      .filter((track) => !played.some((recent) => recent.id === track.id));
    return [...played, ...recentlyAdded].slice(0, MAX_RECENT_MEDIA_ITEMS);
  }, [activeTab, history.playCounts, history.playedTrackIds, lovedTrackIds, tracks, tracksById]);

  const albumCards = useMemo(() => {
    const albumMap = new Map<string, { name: string; artist: string; tracks: Track[] }>();
    tracks.forEach((track) => {
      const key = `${track.album}\u0000${track.artist}`;
      const album = albumMap.get(key) ?? { name: track.album, artist: track.artist, tracks: [] };
      album.tracks.push(track);
      albumMap.set(key, album);
    });
    const allAlbums = Array.from(albumMap.entries()).map(([key, album]) => ({
      key,
      ...album,
      tracks: sortCollectionTracks(album.tracks),
    }));
    if (activeTab === 'favorites') {
      const favorites = new Set(lovedTrackIds);
      return allAlbums.filter((album) => album.tracks.some((track) => favorites.has(track.id)));
    }
    if (activeTab === 'most-played') {
      const counts = history.playCounts;
      return allAlbums
        .map((album) => ({
          ...album,
          score: album.tracks.reduce((total, track) => total + (counts[track.id] ?? 0), 0),
        }))
        .filter((album) => album.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, MAX_RECENT_MEDIA_ITEMS);
    }
    const visited = new Map(history.viewedAlbumKeys.map((key, index) => [key, index]));
    return allAlbums
      .sort(
        (left, right) =>
          (visited.get(left.key) ?? MAX_RECENT_MEDIA_ITEMS) -
          (visited.get(right.key) ?? MAX_RECENT_MEDIA_ITEMS)
      )
      .slice(0, MAX_RECENT_MEDIA_ITEMS);
  }, [activeTab, history.playCounts, history.viewedAlbumKeys, lovedTrackIds, tracks]);

  const artistCards = useMemo(() => {
    const artistMap = new Map<string, Track[]>();
    tracks.forEach((track) => {
      splitArtistCredits(track.artist).forEach((name) => {
        artistMap.set(name, [...(artistMap.get(name) ?? []), track]);
      });
    });
    const allArtists = Array.from(artistMap, ([name, artistTracks]) => ({
      name,
      tracks: artistTracks,
    }));
    if (activeTab === 'favorites') {
      const favorites = new Set(lovedTrackIds);
      return allArtists.filter((artist) => artist.tracks.some((track) => favorites.has(track.id)));
    }
    if (activeTab === 'most-played') {
      const counts = history.playCounts;
      return allArtists
        .map((artist) => ({
          ...artist,
          score: artist.tracks.reduce((total, track) => total + (counts[track.id] ?? 0), 0),
        }))
        .filter((artist) => artist.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, MAX_RECENT_MEDIA_ITEMS);
    }
    const visited = new Map(
      history.viewedArtistNames.map((name, index) => [name.toLocaleLowerCase(), index])
    );
    return allArtists
      .sort(
        (left, right) =>
          (visited.get(left.name.toLocaleLowerCase()) ?? MAX_RECENT_MEDIA_ITEMS) -
          (visited.get(right.name.toLocaleLowerCase()) ?? MAX_RECENT_MEDIA_ITEMS)
      )
      .slice(0, MAX_RECENT_MEDIA_ITEMS);
  }, [activeTab, history.playCounts, history.viewedArtistNames, lovedTrackIds, tracks]);

  return (
    <div className='home-page'>
      <header className='home-header'>
        <div>
          <p>YOUR LISTENING SPACE</p>
          <h1>Home</h1>
        </div>
        <button
          type='button'
          className='home-shuffle-button'
          disabled={!rememberEnabled || trackHistory.length === 0}
          title={
            rememberEnabled
              ? 'Shuffle recently played tracks'
              : 'Enable Remember recent media in Settings to use recent shuffle'
          }
          onClick={() => onShufflePlay(trackHistory)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            shuffle
          </span>
          Shuffle recent
        </button>
      </header>

      <div className='home-tabs' role='tablist' aria-label='Home views'>
        {([
          ['history', 'History'],
          ['favorites', 'Favorites'],
          ['most-played', 'Most played'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            type='button'
            role='tab'
            aria-selected={activeTab === tab}
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {label}
          </button>
        ))}
        {!rememberEnabled && (
          <span className='home-history-disabled'>Recent history is disabled in Settings.</span>
        )}
      </div>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>{activeTab === 'favorites' ? 'Favorite tracks' : activeTab === 'most-played' ? 'Most played tracks' : 'Recently played and added'}</h2>
        </div>
        {trackHistory.length ? (
          <div className='home-track-list'>
            {trackHistory.slice(0, MAX_RECENT_MEDIA_ITEMS).map((track) => (
              <div className='home-track-row' key={track.id}>
                <button
                  type='button'
                  className='home-track-main'
                  onClick={() => onPlayTrack(track, trackHistory)}
                >
                  {track.albumArt ? (
                    <img src={track.albumArt} alt='' loading='lazy' decoding='async' />
                  ) : (
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      music_note
                    </span>
                  )}
                  <span>
                    <strong>{track.name}</strong>
                    <small>{track.artist} · {track.album}</small>
                  </span>
                </button>
                <button
                  type='button'
                  className={`home-favorite-button${lovedTrackIds.includes(track.id) ? ' loved' : ''}${celebratingTrackId === track.id ? ' celebrating' : ''}`}
                  aria-label={`${lovedTrackIds.includes(track.id) ? 'Remove' : 'Add'} ${track.name} ${lovedTrackIds.includes(track.id) ? 'from' : 'to'} favorites`}
                  onClick={() => toggleFavorite(track, lovedTrackIds.includes(track.id))}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {lovedTrackIds.includes(track.id) || celebratingTrackId === track.id
                      ? 'favorite'
                      : 'favorite_border'}
                  </span>
                  {celebratingTrackId === track.id && (
                    <span className='favorite-heart-burst' aria-hidden='true'>
                      {[0, 1, 2, 3, 4].map((heart) => (
                        <span
                          key={heart}
                          className={`material-symbols-outlined favorite-heart-${heart + 1}`}
                        >
                          favorite
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className='home-empty'>No tracks to show yet.</p>
        )}
      </section>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>{activeTab === 'favorites' ? 'Favorite albums' : 'Albums'}</h2>
          <button type='button' onClick={() => navigate('/albums')}>View all</button>
        </div>
        <div className='home-album-grid'>
          {albumCards.slice(0, 12).map((album) => (
            <button
              type='button'
              className='home-album-card'
              key={album.key}
              onClick={() => navigate(getLibraryItemPath('album', album.name, album.artist))}
            >
              {album.tracks[0]?.albumArt ? (
                <img src={album.tracks[0].albumArt} alt='' loading='lazy' decoding='async' />
              ) : (
                <span className='material-symbols-outlined' aria-hidden='true'>album</span>
              )}
              <strong>{album.name}</strong>
              <small>{album.artist}</small>
            </button>
          ))}
        </div>
      </section>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>{activeTab === 'favorites' ? 'Favorite artists' : 'Artists'}</h2>
          <button type='button' onClick={() => navigate('/artists')}>View all</button>
        </div>
        <div className='home-artist-grid'>
          {artistCards.slice(0, 12).map((artist) => (
            <HomeArtistCard
              key={artist.name}
              name={artist.name}
              tracks={artist.tracks}
              autoDownloadArtistImages={autoDownloadArtistImages}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
