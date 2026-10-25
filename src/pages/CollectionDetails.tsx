import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LibraryTrackList from '../components/LibraryTrackList';
import QueueContextMenu from '../components/QueueContextMenu';
import type { Track } from '../services/MusicLibrary';
import { getArtistInfo, type ArtistWebInfo } from '../services/artistImages';
import { artistCreditIncludes, splitArtistCredits } from '../utils/artistCredits';
import { getLibraryItemPath } from '../utils/libraryNavigation';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import './CollectionDetails.css';

type CollectionType = 'album' | 'artist' | 'genre';

interface CollectionDetailsProps {
  type: CollectionType;
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const CollectionDetails = ({ type, tracks, onPlayTrack, onQueueTracks }: CollectionDetailsProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const name = searchParams.get('name')?.trim() ?? '';
  const artistName = searchParams.get('artist')?.trim() ?? '';

  const collectionTracks = useMemo(() => {
    if (!name) return [];
    const normalizedName = name.toLocaleLowerCase();
    const normalizedArtist = artistName.toLocaleLowerCase();
    const matchingTracks = tracks.filter((track) => {
      if (type === 'album') {
        return track.album.trim().toLocaleLowerCase() === normalizedName
          && (track.artist.trim().toLocaleLowerCase() === normalizedArtist ||
            artistCreditIncludes(track.artist, normalizedArtist));
      }
      if (type === 'artist') return artistCreditIncludes(track.artist, normalizedName);
      return track.genre?.trim().toLocaleLowerCase() === normalizedName;
    });
    return sortCollectionTracks(matchingTracks);
  }, [artistName, name, tracks, type]);

  const firstTrack = collectionTracks[0];
  const title =
    type === 'album'
      ? firstTrack?.album
      : type === 'artist'
        ? splitArtistCredits(firstTrack?.artist ?? '').find(
            (artist) => artist.toLocaleLowerCase() === name.toLocaleLowerCase()
          ) ?? name
        : firstTrack?.genre;
  const subtitle =
    type === 'album' ? firstTrack?.artist : type === 'genre' ? `${collectionTracks.length} tracks` : undefined;
  const pageTitle = type === 'album' ? 'Albums' : type === 'artist' ? 'Artists' : 'Genres';

  const artistAlbums = useMemo(() => {
    if (type !== 'artist') return [];
    const albumsByName = new Map<string, Track[]>();
    collectionTracks.forEach((track) => {
      const key = track.album.trim().toLocaleLowerCase();
      const albumTracks = albumsByName.get(key) ?? [];
      albumTracks.push(track);
      albumsByName.set(key, albumTracks);
    });
    return Array.from(albumsByName.values())
      .map((albumTracks) => {
        const sortedTracks = sortCollectionTracks(albumTracks);
        return {
          name: sortedTracks[0].album,
          tracks: sortedTracks,
          firstTrack: sortedTracks[0],
          year: sortedTracks.find((track) => track.year)?.year,
        };
      })
      .sort((a, b) => {
        if (a.year && b.year && a.year !== b.year) return a.year - b.year;
        return a.name.localeCompare(b.name);
      });
  }, [collectionTracks, type]);

  const [artistWebInfo, setArtistWebInfo] = useState<{
    artist: string;
    info: ArtistWebInfo;
  } | null>(null);
  useEffect(() => {
    if (type !== 'artist' || !title) return;
    let isCurrentArtist = true;
    void getArtistInfo(title).then((info) => {
      if (isCurrentArtist) setArtistWebInfo({ artist: title.toLocaleLowerCase(), info });
    });
    return () => {
      isCurrentArtist = false;
    };
  }, [title, type]);

  const image =
    type === 'artist' && artistWebInfo?.artist === title?.toLocaleLowerCase()
      ? artistWebInfo?.info.imageUrl ?? firstTrack?.albumArt
      : firstTrack?.albumArt;

  if (!firstTrack || !title) {
    return (
      <section className='collection-details-page'>
        <button type='button' className='collection-details-back' onClick={() => navigate(-1)}>
          <span className='material-symbols-outlined' aria-hidden='true'>arrow_back</span>
          Back
        </button>
        <p className='library-message'>This {type} could not be found in your music library.</p>
      </section>
    );
  }

  const detail = type === 'album'
    ? `${collectionTracks.length} tracks${firstTrack.year ? ` · ${firstTrack.year}` : ''}`
    : type === 'artist'
      ? `${new Set(collectionTracks.map((track) => track.album.toLocaleLowerCase())).size} albums · ${collectionTracks.length} tracks`
      : `${collectionTracks.length} tracks`;

  return (
    <div className='collection-details-page'>
      <nav className='collection-details-breadcrumb' aria-label='Breadcrumb'>
        <Link to={`/${type}s`}>{pageTitle}</Link>
        <span className='material-symbols-outlined' aria-hidden='true'>chevron_right</span>
        <span>{title}</span>
      </nav>

      <QueueContextMenu tracks={collectionTracks} onQueueTracks={onQueueTracks}>
      <header className={`collection-details-hero ${image ? 'has-image' : ''}`}>
        {image ? (
          <img className='collection-details-image' src={image} alt={`${title} artwork`} />
        ) : (
          <div className='collection-details-image collection-details-image-placeholder' aria-hidden='true'>
            <span className='material-symbols-outlined'>{type === 'artist' ? 'person' : type === 'genre' ? 'style' : 'album'}</span>
          </div>
        )}
        <div className='collection-details-info'>
          <p className='collection-details-type'>{type}</p>
          <h1>{title}</h1>
          {subtitle && <p className='collection-details-subtitle'>{subtitle}</p>}
          <p className='collection-details-meta'>{detail}</p>
          <button type='button' className='collection-details-play' onClick={() => onPlayTrack(firstTrack, collectionTracks)}>
            <span className='material-symbols-outlined' aria-hidden='true'>play_arrow</span>
            Play
          </button>
        </div>
      </header>
      </QueueContextMenu>

      <section className='collection-details-tracks' aria-label={`${title} tracks`}>
        <h2>Tracks</h2>
        <LibraryTrackList tracks={collectionTracks} onPlayTrack={onPlayTrack} onQueueTracks={onQueueTracks} />
      </section>

      {type === 'artist' && (
        <>
          <section className='collection-details-albums' aria-label={`${title} albums`}>
            <h2>Albums</h2>
            {artistAlbums.length ? (
              <div className='collection-details-album-grid'>
                {artistAlbums.map((album) => (
                  <QueueContextMenu
                    key={album.name}
                    tracks={album.tracks}
                    onQueueTracks={onQueueTracks}
                  >
                    <article className='collection-details-album-card'>
                      <button
                        type='button'
                        className='collection-details-album-cover'
                        aria-label={`Open ${album.name}`}
                        onClick={() => navigate(getLibraryItemPath('album', album.name, title))}
                      >
                        {album.firstTrack.albumArt ? (
                          <img src={album.firstTrack.albumArt} alt={`${album.name} cover`} />
                        ) : (
                          <span className='material-symbols-outlined' aria-hidden='true'>album</span>
                        )}
                      </button>
                      <div className='collection-details-album-info'>
                        <button
                          type='button'
                          className='collection-details-album-title'
                          onClick={() => navigate(getLibraryItemPath('album', album.name, title))}
                        >
                          {album.name}
                        </button>
                        <p>{album.year ?? 'Year unknown'} · {album.tracks.length} tracks</p>
                      </div>
                      <button
                        type='button'
                        className='collection-details-album-play'
                        aria-label={`Play ${album.name}`}
                        onClick={() => onPlayTrack(album.firstTrack, album.tracks)}
                      >
                        <span className='material-symbols-outlined' aria-hidden='true'>play_arrow</span>
                      </button>
                    </article>
                  </QueueContextMenu>
                ))}
              </div>
            ) : (
              <p className='collection-details-about-empty'>No albums found for this artist.</p>
            )}
          </section>

          <section className='collection-details-about' aria-labelledby='about-artist-heading'>
            <h2 id='about-artist-heading'>About {title}</h2>
            {artistWebInfo?.artist === title.toLocaleLowerCase() && artistWebInfo.info.biography ? (
              <>
                <p>{artistWebInfo.info.biography}</p>
                {artistWebInfo.info.articleUrl && (
                  <a href={artistWebInfo.info.articleUrl} target='_blank' rel='noreferrer'>
                    Read more on Wikipedia
                  </a>
                )}
              </>
            ) : (
              <p className='collection-details-about-empty'>
                {artistWebInfo?.artist === title.toLocaleLowerCase()
                  ? 'No artist biography is available.'
                  : 'Loading artist information…'}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default memo(CollectionDetails);
