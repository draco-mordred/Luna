import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import CollectionContextMenu from '../components/CollectionContextMenu';
import {
  loadRecentMediaHistory,
  MAX_RECENT_MEDIA_ITEMS,
  rememberRecentMediaEnabled,
} from '../services/recentMedia';
import { useAndroidAlbumArtwork } from '../hooks/useAndroidAlbumArtwork';
import { useArtistImage } from '../services/artistImages';
import { getDominantImageColor } from '../utils/imageColors';
import { splitArtistCredits } from '../utils/artistCredits';
import { getLibraryItemPath } from '../utils/libraryNavigation';
import { createMusicMix } from '../utils/musicMix';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import './Home.css';

type HomeSection = 'top-picks' | 'recently-played' | 'recently-added' | 'recently-added-tracks';

interface HomePageProps {
  tracks: Track[];
  lovedTrackIds: string[];
  favoriteAlbumKeys: string[];
  favoriteArtistNames: string[];
  autoDownloadArtistImages: boolean;
  persistTopPickColors: boolean;
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  onAddToPlaylist: (tracks: Track[], label: string) => void;
  onToggleLove: (track: Track) => void;
  onToggleFavoriteCollection: (type: 'album' | 'artist', key: string) => void;
  onShufflePlay: (tracks: Track[]) => void;
}

interface AlbumGroup {
  key: string;
  name: string;
  artist: string;
  tracks: Track[];
  lastModified: number;
  playCount: number;
}

interface ArtistGroup {
  name: string;
  tracks: Track[];
  lastModified: number;
}

interface TopPickGroup {
  key: string;
  seedTrack: Track;
  tracks: Track[];
}

const hashTopPickPaletteValue = (value: string): string => {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charCodeAt(index);
    first = Math.imul(first ^ character, 16777619);
    second = Math.imul(second ^ character, 3266489917);
  }
  return `${(first >>> 0).toString(36)}${(second >>> 0).toString(36)}`;
};

const getTopPickPaletteStorageKey = (group: TopPickGroup): string =>
  `luna-home-top-pick-colors:${hashTopPickPaletteValue(group.key)}`;

const getTopPickPaletteSignature = (group: TopPickGroup): string =>
  hashTopPickPaletteValue(
    group.tracks
      .slice(0, 4)
      .map((track) => `${track.id}:${track.lastModified}`)
      .join('|')
  );

const isValidRgbColor = (color: unknown): color is string =>
  typeof color === 'string' &&
  color.split(',').length === 3 &&
  color.split(',').every((channel) => {
    const value = Number(channel.trim());
    return Number.isInteger(value) && value >= 0 && value <= 255;
  });

const loadTopPickColors = (
  storageKey: string,
  signature: string,
  persistColors: boolean
): Record<number, string> => {
  if (!persistColors) return {};
  try {
    const savedColors = window.localStorage.getItem(storageKey);
    if (!savedColors) return {};
    const parsed: unknown = JSON.parse(savedColors);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('signature' in parsed) ||
      parsed.signature !== signature ||
      !('colors' in parsed) ||
      typeof parsed.colors !== 'object' ||
      parsed.colors === null
    ) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.colors)
        .filter(([index, color]) => ['0', '1', '2', '3'].includes(index) && isValidRgbColor(color))
        .map(([index, color]) => [Number(index), color])
    );
  } catch (error) {
    console.warn('Could not load saved Top Picks artwork colors:', error);
    return {};
  }
};

const HomeArtwork = memo(
  ({
    track,
    className = '',
    onColorResolved,
  }: {
    track: Track;
    className?: string;
    onColorResolved?: (color: string) => void;
  }) => {
    const { elementRef, imageUrl } = useAndroidAlbumArtwork(track);

    useEffect(() => {
      if (!imageUrl || !onColorResolved) return undefined;
      let active = true;
      void getDominantImageColor(imageUrl, '38, 78, 124').then((color) => {
        if (active) onColorResolved(color);
      });
      return () => {
        active = false;
      };
    }, [imageUrl, onColorResolved]);

    return (
      <div ref={elementRef} className={`home-artwork ${className}`}>
        {imageUrl ? (
          <img src={imageUrl} alt='' loading='lazy' decoding='async' />
        ) : (
          <span className='material-symbols-outlined' aria-hidden='true'>
            album
          </span>
        )}
      </div>
    );
  }
);

const HomeArtistCard = memo(
  ({
    artist,
    autoDownloadArtistImages,
    onOpen,
  }: {
    artist: ArtistGroup;
    autoDownloadArtistImages: boolean;
    onOpen: () => void;
  }) => {
    const { elementRef, imageUrl } = useArtistImage(artist.name, {
      allowDownload: autoDownloadArtistImages,
      loadWhenVisible: true,
    });

    return (
      <div ref={elementRef} className='home-artist-card-anchor'>
        <button type='button' className='home-artist-card' onClick={onOpen}>
          <span className='home-artist-image'>
            {imageUrl ? (
              <img src={imageUrl} alt='' loading='lazy' decoding='async' />
            ) : (
              <span className='material-symbols-outlined' aria-hidden='true'>
                person
              </span>
            )}
          </span>
          <strong>{artist.name}</strong>
          <small>{artist.tracks.length} tracks</small>
        </button>
      </div>
    );
  }
);

const HomeAlbumCard = memo(({ album, onOpen }: { album: AlbumGroup; onOpen: () => void }) => (
  <button type='button' className='home-album-card' onClick={onOpen}>
    <HomeArtwork track={album.tracks[0]} />
    <strong>{album.name}</strong>
    <small>{album.artist}</small>
  </button>
));

const TopPicksCard = memo(
  ({
    group,
    colorUpdateOrder,
    persistColors,
    onOpen,
    onPlayTrack,
    onShufflePlay,
  }: {
    group: TopPickGroup;
    colorUpdateOrder: number;
    persistColors: boolean;
    onOpen: () => void;
    onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
    onShufflePlay: (tracks: Track[]) => void;
  }) => {
    const storageKey = getTopPickPaletteStorageKey(group);
    const paletteSignature = getTopPickPaletteSignature(group);
    const [colors, setColors] = useState<Record<number, string>>(() =>
      loadTopPickColors(storageKey, paletteSignature, persistColors)
    );
    const handleColorResolved = useCallback((index: number, color: string) => {
      setColors((current) => (current[index] === color ? current : { ...current, [index]: color }));
    }, []);
    useEffect(() => {
      if (!persistColors) return;
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ signature: paletteSignature, colors })
        );
      } catch (error) {
        console.warn('Could not save Top Picks artwork colors:', error);
      }
    }, [colors, paletteSignature, persistColors, storageKey]);
    const colorCallbacks = useMemo(
      () => [0, 1, 2, 3].map((index) => (color: string) => handleColorResolved(index, color)),
      [handleColorResolved]
    );
    const cardColors = [0, 1, 2, 3].map((index) =>
      colors[index] ? `rgb(${colors[index]})` : ['#173b67', '#237f8a', '#3aa38c', '#214b67'][index]
    );
    const cardStyle = {
      '--home-pick-color-a': cardColors[0],
      '--home-pick-color-b': cardColors[1],
      '--home-pick-color-c': cardColors[2],
      '--home-pick-color-d': cardColors[3],
      '--home-pick-color-delay': `${colorUpdateOrder * 720}ms`,
    } as CSSProperties;

    return (
      <article className='home-top-pick-card' style={cardStyle}>
        <button type='button' className='home-top-pick-main' onClick={onOpen}>
          <span className='home-top-pick-artwork-grid' aria-hidden='true'>
            {group.tracks.slice(0, 4).map((track, index) => (
              <HomeArtwork
                key={track.id}
                track={track}
                className={`home-top-pick-artwork artwork-${index + 1}`}
                onColorResolved={persistColors && colors[index] ? undefined : colorCallbacks[index]}
              />
            ))}
          </span>
          <span className='home-top-pick-copy'>
            <strong>Your Top Picks</strong>
            <small>{group.tracks.length} top tracks · Made for you</small>
          </span>
        </button>
        <div className='home-top-pick-actions'>
          <button
            type='button'
            aria-label='Shuffle this Top Picks mix'
            title='Shuffle play'
            onClick={() => onShufflePlay(group.tracks)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              shuffle
            </span>
          </button>
          <button
            type='button'
            aria-label='Play this Top Picks mix'
            title='Play'
            onClick={() => onPlayTrack(group.tracks[0], group.tracks)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              play_arrow
            </span>
          </button>
        </div>
      </article>
    );
  }
);

const HomeTrackList = ({
  tracks,
  lovedTrackIds,
  onPlayTrack,
  onToggleLove,
}: {
  tracks: Track[];
  lovedTrackIds: string[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onToggleLove: (track: Track) => void;
}) => (
  <div className='home-track-list'>
    {tracks.map((track) => (
      <div className='home-track-row' key={track.id}>
        <button
          type='button'
          className='home-track-main'
          onClick={() => onPlayTrack(track, tracks)}
        >
          <HomeArtwork track={track} />
          <span className='home-track-copy'>
            <strong>{track.name}</strong>
            <small>
              {splitArtistCredits(track.artist).join(', ')} · {track.album}
            </small>
          </span>
        </button>
        <button
          type='button'
          className={`home-favorite-button${lovedTrackIds.includes(track.id) ? ' loved' : ''}`}
          aria-label={`${lovedTrackIds.includes(track.id) ? 'Remove' : 'Add'} ${track.name} ${lovedTrackIds.includes(track.id) ? 'from' : 'to'} favorites`}
          aria-pressed={lovedTrackIds.includes(track.id)}
          onClick={() => onToggleLove(track)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            {lovedTrackIds.includes(track.id) ? 'favorite' : 'favorite_border'}
          </span>
        </button>
      </div>
    ))}
  </div>
);

const HomePage = ({
  tracks,
  lovedTrackIds,
  favoriteAlbumKeys,
  favoriteArtistNames,
  autoDownloadArtistImages,
  persistTopPickColors,
  onPlayTrack,
  onQueueTracks,
  onAddToPlaylist,
  onToggleLove,
  onToggleFavoriteCollection,
  onShufflePlay,
}: HomePageProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const history = loadRecentMediaHistory();
  const rememberEnabled = rememberRecentMediaEnabled();
  const section = searchParams.get('section') as HomeSection | null;
  const selectedTopPickKey = searchParams.get('mix');
  const tracksById = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);

  const albums = useMemo(() => {
    const albumMap = new Map<string, Track[]>();
    tracks.forEach((track) => {
      const key = `${track.album}\u0000${track.artist}`;
      albumMap.set(key, [...(albumMap.get(key) ?? []), track]);
    });
    return Array.from(albumMap, ([key, albumTracks]) => {
      const sortedTracks = sortCollectionTracks(albumTracks);
      return {
        key,
        name: sortedTracks[0].album,
        artist: sortedTracks[0].artist,
        tracks: sortedTracks,
        lastModified: Math.max(...sortedTracks.map((track) => track.lastModified)),
        playCount: sortedTracks.reduce(
          (total, track) => total + (history.playCounts[track.id] ?? 0),
          0
        ),
      };
    });
  }, [history.playCounts, tracks]);

  const albumByKey = useMemo(() => new Map(albums.map((album) => [album.key, album])), [albums]);
  const recentlyPlayedAlbums = useMemo(
    () =>
      history.viewedAlbumKeys
        .map((key) => albumByKey.get(key))
        .filter((album): album is AlbumGroup => Boolean(album))
        .slice(0, MAX_RECENT_MEDIA_ITEMS),
    [albumByKey, history.viewedAlbumKeys]
  );
  const recentlyAddedAlbums = useMemo(
    () =>
      [...albums]
        .sort((left, right) => right.lastModified - left.lastModified)
        .slice(0, MAX_RECENT_MEDIA_ITEMS),
    [albums]
  );
  const artists = useMemo(() => {
    const artistMap = new Map<string, { name: string; tracks: Track[] }>();
    tracks.forEach((track) => {
      splitArtistCredits(track.artist).forEach((name) => {
        const key = name.toLocaleLowerCase();
        const existing = artistMap.get(key);
        artistMap.set(key, {
          name: existing?.name ?? name,
          tracks: [...(existing?.tracks ?? []), track],
        });
      });
    });
    return Array.from(artistMap.values()).map(({ name, tracks: artistTracks }) => ({
      name,
      tracks: artistTracks,
      lastModified: Math.max(...artistTracks.map((track) => track.lastModified)),
    }));
  }, [tracks]);
  const artistByName = useMemo(
    () => new Map(artists.map((artist) => [artist.name.toLocaleLowerCase(), artist])),
    [artists]
  );
  const recentlyPlayedArtists = useMemo(
    () =>
      history.viewedArtistNames
        .map((name) => artistByName.get(name.toLocaleLowerCase()))
        .filter((artist): artist is ArtistGroup => Boolean(artist))
        .slice(0, MAX_RECENT_MEDIA_ITEMS),
    [artistByName, history.viewedArtistNames]
  );
  const recentlyAddedArtists = useMemo(
    () =>
      [...artists]
        .sort((left, right) => right.lastModified - left.lastModified)
        .slice(0, MAX_RECENT_MEDIA_ITEMS),
    [artists]
  );
  const favoriteTracks = useMemo(
    () =>
      lovedTrackIds
        .map((id) => tracksById.get(id))
        .filter((track): track is Track => Boolean(track)),
    [lovedTrackIds, tracksById]
  );
  const favoriteAlbums = useMemo(
    () =>
      favoriteAlbumKeys
        .map((key) => albumByKey.get(key))
        .filter((album): album is AlbumGroup => Boolean(album)),
    [albumByKey, favoriteAlbumKeys]
  );
  const favoriteArtists = useMemo(
    () =>
      favoriteArtistNames
        .map((name) => artistByName.get(name.toLocaleLowerCase()))
        .filter((artist): artist is ArtistGroup => Boolean(artist)),
    [artistByName, favoriteArtistNames]
  );

  const recentlyPlayedTracks = useMemo(
    () =>
      history.playedTrackIds
        .map((id) => tracksById.get(id))
        .filter((track): track is Track => Boolean(track))
        .slice(0, MAX_RECENT_MEDIA_ITEMS),
    [history.playedTrackIds, tracksById]
  );
  const recentlyAddedTracks = useMemo(
    () => [...tracks].sort((left, right) => right.lastModified - left.lastModified).slice(0, 50),
    [tracks]
  );

  const topPickGroups = useMemo(() => {
    const recentOrder = new Map(history.playedTrackIds.map((id, index) => [id, index]));
    const preferences = {
      lovedTrackIds: new Set(lovedTrackIds),
      playCounts: history.playCounts,
    };
    const frequentSeeds = tracks
      .filter((track) => (history.playCounts[track.id] ?? 0) > 0)
      .sort(
        (left, right) =>
          (history.playCounts[right.id] ?? 0) - (history.playCounts[left.id] ?? 0) ||
          (recentOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (recentOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      );

    return frequentSeeds
      .flatMap((seedTrack) => {
        const similarTracks = createMusicMix(
          seedTrack,
          tracks,
          new Set([seedTrack.id]),
          preferences,
          49,
          { requireSimilarity: true }
        );
        if (similarTracks.length === 0) return [];
        return [
          {
            key: seedTrack.id,
            seedTrack,
            tracks: [seedTrack, ...similarTracks].slice(0, 50),
          },
        ];
      })
      .slice(0, 10);
  }, [history.playCounts, history.playedTrackIds, lovedTrackIds, tracks]);

  const allTopPickTracks = useMemo(() => {
    const uniqueTracks = new Map<string, Track>();
    topPickGroups.forEach((group) =>
      group.tracks.forEach((track) => uniqueTracks.set(track.id, track))
    );
    return [...uniqueTracks.values()]
      .sort(
        (left, right) => (history.playCounts[right.id] ?? 0) - (history.playCounts[left.id] ?? 0)
      )
      .slice(0, 50);
  }, [history.playCounts, topPickGroups]);
  const selectedTopPickGroup = topPickGroups.find((group) => group.key === selectedTopPickKey);

  const showSection = (nextSection: HomeSection) =>
    navigate({ pathname: '/', search: `?section=${nextSection}` });
  const openTopPick = (group: TopPickGroup) =>
    navigate({
      pathname: '/',
      search: `?section=top-picks&mix=${encodeURIComponent(group.key)}`,
    });
  const openAlbum = (album: AlbumGroup) =>
    navigate(getLibraryItemPath('album', album.name, album.artist));
  const openArtist = (artist: ArtistGroup) => navigate(getLibraryItemPath('artist', artist.name));
  const renderAlbumCard = (album: AlbumGroup) => (
    <CollectionContextMenu
      key={album.key}
      label={album.name}
      tracks={album.tracks}
      isFavorite={favoriteAlbumKeys.includes(album.key)}
      onOpen={() => openAlbum(album)}
      onPlayNow={() => onPlayTrack(album.tracks[0], album.tracks)}
      onQueueTracks={onQueueTracks}
      onAddToPlaylist={onAddToPlaylist}
      onToggleFavorite={() => onToggleFavoriteCollection('album', album.key)}
    >
      <HomeAlbumCard album={album} onOpen={() => openAlbum(album)} />
    </CollectionContextMenu>
  );
  const renderArtistCard = (artist: ArtistGroup) => (
    <CollectionContextMenu
      key={artist.name}
      label={artist.name}
      tracks={artist.tracks}
      isFavorite={favoriteArtistNames.includes(artist.name.toLocaleLowerCase())}
      onOpen={() => openArtist(artist)}
      onPlayNow={() => onPlayTrack(artist.tracks[0], artist.tracks)}
      onQueueTracks={onQueueTracks}
      onAddToPlaylist={onAddToPlaylist}
      onToggleFavorite={() => onToggleFavoriteCollection('artist', artist.name.toLocaleLowerCase())}
    >
      <HomeArtistCard
        artist={artist}
        autoDownloadArtistImages={autoDownloadArtistImages}
        onOpen={() => openArtist(artist)}
      />
    </CollectionContextMenu>
  );

  const renderAlbumRail = (items: AlbumGroup[], emptyMessage: string) =>
    items.length ? (
      <div className='home-horizontal-rail'>{items.map(renderAlbumCard)}</div>
    ) : (
      <p className='home-empty'>{emptyMessage}</p>
    );

  const renderArtistRail = (items: ArtistGroup[], emptyMessage: string) =>
    items.length ? (
      <div className='home-horizontal-rail home-artist-rail'>{items.map(renderArtistCard)}</div>
    ) : (
      <p className='home-empty'>{emptyMessage}</p>
    );

  const sectionTitle =
    section === 'top-picks'
      ? 'Top Picks for You'
      : section === 'recently-played'
        ? 'Recently Played'
        : section === 'recently-added'
          ? 'Recently Added'
          : section === 'recently-added-tracks'
            ? 'Recently Added Tracks'
            : 'Home';

  if (section) {
    return (
      <div className='home-page home-detail-page'>
        <header className='home-header'>
          <button type='button' className='home-back-button' onClick={() => navigate('/')}>
            <span className='material-symbols-outlined' aria-hidden='true'>
              arrow_back
            </span>
            Home
          </button>
          <h1>{sectionTitle}</h1>
          {section === 'recently-played' && (
            <button
              type='button'
              className='home-shuffle-button'
              disabled={!recentlyPlayedTracks.length}
              onClick={() => onShufflePlay(recentlyPlayedTracks)}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                shuffle
              </span>
              Shuffle
            </button>
          )}
        </header>

        {section === 'top-picks' && (
          <>
            {selectedTopPickGroup ? (
              <>
                <section className='home-section'>
                  <div className='home-section-heading'>
                    <h2>Inspired by {selectedTopPickGroup.seedTrack.name}</h2>
                  </div>
                  <HomeTrackList
                    tracks={selectedTopPickGroup.tracks}
                    lovedTrackIds={lovedTrackIds}
                    onPlayTrack={onPlayTrack}
                    onToggleLove={onToggleLove}
                  />
                </section>
                <button
                  type='button'
                  className='home-back-button'
                  onClick={() => showSection('top-picks')}
                >
                  All Top Picks
                </button>
              </>
            ) : (
              <>
                <section className='home-section'>
                  <div className='home-top-picks-grid'>
                    {topPickGroups.map((group, index) => (
                      <TopPicksCard
                        key={`${getTopPickPaletteStorageKey(group)}:${getTopPickPaletteSignature(group)}`}
                        group={group}
                        colorUpdateOrder={index}
                        persistColors={persistTopPickColors}
                        onOpen={() => openTopPick(group)}
                        onPlayTrack={onPlayTrack}
                        onShufflePlay={onShufflePlay}
                      />
                    ))}
                  </div>
                  {!topPickGroups.length && (
                    <p className='home-empty'>Top Picks will appear as you listen to your music.</p>
                  )}
                </section>
                {allTopPickTracks.length > 0 && (
                  <section className='home-section'>
                    <div className='home-section-heading'>
                      <h2>Top pick tracks</h2>
                    </div>
                    <HomeTrackList
                      tracks={allTopPickTracks.slice(0, 12)}
                      lovedTrackIds={lovedTrackIds}
                      onPlayTrack={onPlayTrack}
                      onToggleLove={onToggleLove}
                    />
                  </section>
                )}
              </>
            )}
          </>
        )}

        {section === 'recently-played' && (
          <>
            <section className='home-section'>
              <div className='home-section-heading'>
                <h2>Albums</h2>
              </div>
              {renderAlbumRail(recentlyPlayedAlbums, 'Albums you play will appear here.')}
            </section>
            <section className='home-section'>
              <div className='home-section-heading'>
                <h2>Artists</h2>
              </div>
              {renderArtistRail(recentlyPlayedArtists, 'Artists you play will appear here.')}
            </section>
            <section className='home-section'>
              <div className='home-section-heading'>
                <h2>Tracks</h2>
              </div>
              {recentlyPlayedTracks.length ? (
                <HomeTrackList
                  tracks={recentlyPlayedTracks}
                  lovedTrackIds={lovedTrackIds}
                  onPlayTrack={onPlayTrack}
                  onToggleLove={onToggleLove}
                />
              ) : (
                <p className='home-empty'>Tracks you play will appear here.</p>
              )}
            </section>
          </>
        )}

        {section === 'recently-added' && (
          <>
            <section className='home-section'>
              <div className='home-section-heading'>
                <h2>Albums</h2>
              </div>
              {renderAlbumRail(recentlyAddedAlbums, 'Recently added albums will appear here.')}
            </section>
            <section className='home-section'>
              <div className='home-section-heading'>
                <h2>Artists</h2>
              </div>
              {renderArtistRail(recentlyAddedArtists, 'Recently added artists will appear here.')}
            </section>
            <section className='home-section'>
              <div className='home-section-heading'>
                <h2>Tracks</h2>
              </div>
              <HomeTrackList
                tracks={recentlyAddedTracks}
                lovedTrackIds={lovedTrackIds}
                onPlayTrack={onPlayTrack}
                onToggleLove={onToggleLove}
              />
            </section>
          </>
        )}

        {section === 'recently-added-tracks' && (
          <section className='home-section'>
            <HomeTrackList
              tracks={recentlyAddedTracks}
              lovedTrackIds={lovedTrackIds}
              onPlayTrack={onPlayTrack}
              onToggleLove={onToggleLove}
            />
            {!recentlyAddedTracks.length && <p className='home-empty'>No tracks to show yet.</p>}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className='home-page'>
      <header className='home-header'>
        <h1>Home</h1>
        <button
          type='button'
          className='home-shuffle-button'
          disabled={!rememberEnabled || recentlyPlayedTracks.length === 0}
          title={rememberEnabled ? 'Shuffle recently played tracks' : 'Recent media is disabled'}
          onClick={() => onShufflePlay(recentlyPlayedTracks)}
        >
          <span className='material-symbols-outlined' aria-hidden='true'>
            shuffle
          </span>
          Shuffle recent
        </button>
      </header>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>Top Picks for You</h2>
          <button
            type='button'
            aria-label='View all Top Picks'
            onClick={() => showSection('top-picks')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              chevron_right
            </span>
          </button>
        </div>
        {topPickGroups.length ? (
          <div className='home-horizontal-rail home-top-picks-rail'>
            {topPickGroups.map((group, index) => (
              <TopPicksCard
                key={`${getTopPickPaletteStorageKey(group)}:${getTopPickPaletteSignature(group)}`}
                group={group}
                colorUpdateOrder={index}
                persistColors={persistTopPickColors}
                onOpen={() => openTopPick(group)}
                onPlayTrack={onPlayTrack}
                onShufflePlay={onShufflePlay}
              />
            ))}
          </div>
        ) : (
          <p className='home-empty'>Top Picks will appear as you listen to your music.</p>
        )}
      </section>

      <section className='home-section home-favorites-section'>
        <div className='home-section-heading'>
          <h2>Favorites</h2>
        </div>
        <div className='home-favorites-columns'>
          <section className='home-favorites-column' aria-label='Favorite tracks'>
            <h3>Tracks</h3>
            <div className='home-favorite-tracks-scroll'>
              {favoriteTracks.length ? (
                <HomeTrackList
                  tracks={favoriteTracks}
                  lovedTrackIds={lovedTrackIds}
                  onPlayTrack={onPlayTrack}
                  onToggleLove={onToggleLove}
                />
              ) : (
                <p className='home-empty'>No favorite tracks yet.</p>
              )}
            </div>
          </section>
          <section className='home-favorites-column' aria-label='Favorite albums'>
            <h3>Albums</h3>
            {favoriteAlbums.length ? (
              <div className='home-horizontal-rail home-favorites-rail'>
                {favoriteAlbums.map(renderAlbumCard)}
              </div>
            ) : (
              <p className='home-empty'>No favorite albums yet.</p>
            )}
          </section>
          <section className='home-favorites-column' aria-label='Favorite artists'>
            <h3>Artists</h3>
            {favoriteArtists.length ? (
              <div className='home-horizontal-rail home-favorites-rail home-artist-rail'>
                {favoriteArtists.map(renderArtistCard)}
              </div>
            ) : (
              <p className='home-empty'>No favorite artists yet.</p>
            )}
          </section>
        </div>
      </section>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>Recently Played</h2>
          <button
            type='button'
            aria-label='View recently played'
            onClick={() => showSection('recently-played')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              chevron_right
            </span>
          </button>
        </div>
        {renderAlbumRail(recentlyPlayedAlbums.slice(0, 12), 'Albums you play will appear here.')}
      </section>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>Recently Added</h2>
          <button
            type='button'
            aria-label='View recently added'
            onClick={() => showSection('recently-added')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              chevron_right
            </span>
          </button>
        </div>
        {renderAlbumRail(
          recentlyAddedAlbums.slice(0, 12),
          'Recently added albums will appear here.'
        )}
      </section>

      <section className='home-section'>
        <div className='home-section-heading'>
          <h2>Recently Added Tracks</h2>
          <button
            type='button'
            aria-label='View recently added tracks'
            onClick={() => showSection('recently-added-tracks')}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              chevron_right
            </span>
          </button>
        </div>
        <HomeTrackList
          tracks={recentlyAddedTracks.slice(0, 8)}
          lovedTrackIds={lovedTrackIds}
          onPlayTrack={onPlayTrack}
          onToggleLove={onToggleLove}
        />
        {!recentlyAddedTracks.length && <p className='home-empty'>No tracks to show yet.</p>}
      </section>
    </div>
  );
};

export default HomePage;
