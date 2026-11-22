import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import LibraryTrackList from '../components/LibraryTrackList';
import CollectionContextMenu from '../components/CollectionContextMenu';
import QueueContextMenu from '../components/QueueContextMenu';
import type { Track } from '../services/MusicLibrary';
import { getArtistInfo, type ArtistWebInfo } from '../services/artistImages';
import { artistCreditIncludes, splitArtistCredits } from '../utils/artistCredits';
import { getLibraryItemPath } from '../utils/libraryNavigation';
import { sortCollectionTracks } from '../utils/sortCollectionTracks';
import { useAndroidAlbumArtwork } from '../hooks/useAndroidAlbumArtwork';
import { isAndroidApp } from '../services/androidMusicLibrary';
import {
  createArtworkColorSampler,
  getContrastingTextColor,
  getDominantImageColor,
  type ArtworkColorSampler,
} from '../utils/imageColors';
import './CollectionDetails.css';

type CollectionType = 'album' | 'artist' | 'genre';
const EMPTY_PLAY_COUNTS: Readonly<Record<string, number>> = {};

const getObjectPositionFraction = (position: string, axis: 'x' | 'y') => {
  const [horizontal = '50%', vertical = '50%'] = position.split(/\s+/);
  const value = axis === 'x' ? horizontal : vertical;
  const percentage = Number.parseFloat(value);
  if (value.endsWith('%') && Number.isFinite(percentage)) {
    return Math.max(0, Math.min(1, percentage / 100));
  }
  if (value === 'left' || value === 'top') return 0;
  if (value === 'right' || value === 'bottom') return 1;
  return 0.5;
};

const getArtistAboutPreview = (biography: string, wordLimit = 30): string => {
  const words = biography.trim().split(/\s+/).filter(Boolean);
  return words.length <= wordLimit ? biography.trim() : `${words.slice(0, wordLimit).join(' ')}…`;
};

interface CollectionDetailsProps {
  type: CollectionType;
  tracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  lovedTrackIds?: string[];
  onToggleLove?: (track: Track | null) => void;
  favoriteAlbumKeys?: string[];
  favoriteArtistNames?: string[];
  onToggleFavoriteCollection?: (type: 'album' | 'artist', key: string) => void;
  onAddToPlaylist?: (tracks: Track[], label: string) => void;
  playCounts?: Readonly<Record<string, number>>;
  playHistoryEnabled?: boolean;
}

interface CollectionAlbumCardProps {
  album: {
    name: string;
    tracks: Track[];
    firstTrack: Track;
    year?: number;
  };
  onOpen: () => void;
  onPlay: () => void;
}

const CollectionAlbumCard = ({ album, onOpen, onPlay }: CollectionAlbumCardProps) => {
  const { imageUrl } = useAndroidAlbumArtwork(album.firstTrack, true);
  return (
    <article className='collection-details-album-card'>
      <button
        type='button'
        className='collection-details-album-cover'
        aria-label={`Open ${album.name}`}
        onClick={onOpen}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={`${album.name} cover`} />
        ) : (
          <span className='material-symbols-outlined' aria-hidden='true'>
            album
          </span>
        )}
      </button>
      <div className='collection-details-album-info'>
        <button type='button' className='collection-details-album-title' onClick={onOpen}>
          {album.name}
        </button>
        <p>
          {album.year ?? 'Year unknown'} · {album.tracks.length} tracks
        </p>
      </div>
      <button
        type='button'
        className='collection-details-album-play'
        aria-label={`Play ${album.name}`}
        onClick={onPlay}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          play_arrow
        </span>
      </button>
    </article>
  );
};

interface CollectionFeaturedAlbumCardProps {
  album: CollectionAlbumCardProps['album'];
  onOpen: () => void;
  onQueue: () => void;
}

const CollectionFeaturedAlbumCard = ({
  album,
  onOpen,
  onQueue,
}: CollectionFeaturedAlbumCardProps) => {
  const { imageUrl } = useAndroidAlbumArtwork(album.firstTrack, true);
  return (
    <article className='collection-details-featured-album-card'>
      <button
        type='button'
        className='collection-details-featured-album-cover'
        aria-label={`Open ${album.name}`}
        onClick={onOpen}
      >
        {imageUrl ? (
          <img src={imageUrl} alt={`${album.name} cover`} />
        ) : (
          <span className='material-symbols-outlined' aria-hidden='true'>
            album
          </span>
        )}
      </button>
      <div className='collection-details-featured-album-info'>
        <p>{album.year ? `Released ${album.year}` : 'Release year not listed'}</p>
        <button type='button' onClick={onOpen}>
          {album.name}
        </button>
        <span>{album.tracks.length} songs</span>
      </div>
      <button
        type='button'
        className='collection-details-featured-album-queue'
        aria-label={`Add ${album.name} to the play queue`}
        onClick={onQueue}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          add
        </span>
      </button>
    </article>
  );
};

interface CollectionArtistTopTrackRowProps {
  track: Track;
  queueTracks: Track[];
  onPlayTrack: (track: Track, queueTracks?: Track[]) => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
}

const CollectionArtistTopTrackRow = ({
  track,
  queueTracks,
  onPlayTrack,
  onQueueTracks,
}: CollectionArtistTopTrackRowProps) => {
  const { imageUrl } = useAndroidAlbumArtwork(track, true);
  return (
    <QueueContextMenu tracks={[track]} onQueueTracks={onQueueTracks} asListItem showTrigger>
      <button
        type='button'
        className='collection-details-top-song'
        onClick={() => onPlayTrack(track, queueTracks)}
        aria-label={`Play ${track.name} by ${track.artist}`}
      >
        {imageUrl ? (
          <img src={imageUrl} alt='' />
        ) : (
          <span
            className='material-symbols-outlined collection-details-top-song-placeholder'
            aria-hidden='true'
          >
            album
          </span>
        )}
        <span className='collection-details-top-song-info'>
          <strong>{track.name}</strong>
          <span>
            {track.album}
            {track.year ? ` · ${track.year}` : ''}
          </span>
        </span>
      </button>
    </QueueContextMenu>
  );
};

const CollectionDetails = ({
  type,
  tracks,
  onPlayTrack,
  onQueueTracks,
  lovedTrackIds,
  onToggleLove,
  favoriteAlbumKeys,
  favoriteArtistNames,
  onToggleFavoriteCollection,
  onAddToPlaylist,
  playCounts = EMPTY_PLAY_COUNTS,
  playHistoryEnabled = true,
}: CollectionDetailsProps) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const [artistAboutExpanded, setArtistAboutExpanded] = useState(false);
  const [showArtworkSecondaryHeader, setShowArtworkSecondaryHeader] = useState(false);
  const artworkHeroRef = useRef<HTMLElement>(null);
  const artworkPageTopnavRef = useRef<HTMLElement>(null);
  const isAndroid = isAndroidApp();
  const hasArtworkHero = type === 'album' || type === 'artist';
  useLayoutEffect(() => {
    if (!isAndroid || !hasArtworkHero) return undefined;

    const topnav = artworkPageTopnavRef.current;
    const topNavbar = document.querySelector<HTMLElement>('.android-top-navbar');
    if (!topnav) return undefined;

    const updateTopnavPosition = () => {
      const safeTop = Number.parseFloat(
        window.getComputedStyle(document.documentElement).getPropertyValue('--anp-safe-top')
      );
      const navbarRect = topNavbar?.getBoundingClientRect();
      const navbarVisible = Boolean(
        topNavbar &&
          navbarRect &&
          navbarRect.height > 0 &&
          window.getComputedStyle(topNavbar).display !== 'none'
      );
      const top = navbarVisible && navbarRect ? navbarRect.bottom + 8 : (safeTop || 0) + 8;
      topnav.style.top = `${top}px`;
    };

    updateTopnavPosition();
    window.addEventListener('resize', updateTopnavPosition);
    const resizeObserver =
      typeof ResizeObserver === 'undefined' || !topNavbar
        ? null
        : new ResizeObserver(updateTopnavPosition);
    if (resizeObserver && topNavbar) resizeObserver.observe(topNavbar);
    const mutationObserver = topNavbar ? new MutationObserver(updateTopnavPosition) : null;
    if (topNavbar && mutationObserver) {
      mutationObserver.observe(topNavbar, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      window.removeEventListener('resize', updateTopnavPosition);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
    };
  }, [hasArtworkHero, isAndroid]);
  const name = searchParams.get('name')?.trim() ?? '';
  const artistName = searchParams.get('artist')?.trim() ?? '';
  const normalizedName = name.toLocaleLowerCase();
  const normalizedArtist = artistName.toLocaleLowerCase();

  const collectionTracks = useMemo(() => {
    if (!name) return [];
    const matchingTracks = tracks.filter((track) => {
      if (type === 'album') {
        const trackAlbum = track.album?.trim().toLocaleLowerCase() ?? '';
        const trackArtist = track.artist?.trim().toLocaleLowerCase() ?? '';
        return (
          trackAlbum === normalizedName &&
          (trackArtist === normalizedArtist ||
            artistCreditIncludes(track.artist ?? '', normalizedArtist))
        );
      }
      if (type === 'artist') return artistCreditIncludes(track.artist ?? '', normalizedName);
      return track.genre?.trim().toLocaleLowerCase() === normalizedName;
    });
    return sortCollectionTracks(matchingTracks);
  }, [normalizedArtist, normalizedName, name, tracks, type]);

  const firstTrack = collectionTracks[0];
  const { imageUrl: androidAlbumArt } = useAndroidAlbumArtwork(firstTrack, true);
  const title =
    type === 'album'
      ? firstTrack?.album
      : type === 'artist'
        ? (splitArtistCredits(firstTrack?.artist ?? '').find(
            (artist) => artist.toLocaleLowerCase() === name.toLocaleLowerCase()
          ) ?? name)
        : firstTrack?.genre;
  const subtitle =
    type === 'album'
      ? firstTrack?.artist
      : type === 'genre'
        ? `${collectionTracks.length} tracks`
        : undefined;
  const pageTitle = type === 'album' ? 'Albums' : type === 'artist' ? 'Artists' : 'Genres';

  const artistAlbums = useMemo(() => {
    if (type !== 'artist') return [];
    const albumsByName = new Map<string, Track[]>();
    collectionTracks.forEach((track) => {
      const key = track.album?.trim().toLocaleLowerCase() ?? '';
      if (!key) return;
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
  const hasArtistPlayHistory = collectionTracks.some((track) => (playCounts[track.id] ?? 0) > 0);
  const artistTopTracks = useMemo(
    () =>
      [...collectionTracks]
        .sort(
          (left, right) =>
            (playCounts[right.id] ?? 0) - (playCounts[left.id] ?? 0) ||
            (right.year ?? 0) - (left.year ?? 0) ||
            right.lastModified - left.lastModified ||
            left.name.localeCompare(right.name)
        )
        .slice(0, 5),
    [collectionTracks, playCounts]
  );
  const latestArtistAlbum = useMemo(
    () =>
      [...artistAlbums].sort((left, right) => {
        const yearDifference = (right.year ?? 0) - (left.year ?? 0);
        if (yearDifference) return yearDifference;
        const leftModified = Math.max(...left.tracks.map((track) => track.lastModified));
        const rightModified = Math.max(...right.tracks.map((track) => track.lastModified));
        return rightModified - leftModified || left.name.localeCompare(right.name);
      })[0] ?? null,
    [artistAlbums]
  );

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
      ? (artistWebInfo?.info.imageUrl ?? androidAlbumArt)
      : androidAlbumArt;
  const isDesktopCollection =
    Boolean(window.electronAPI) && !isAndroid && hasArtworkHero && Boolean(image);
  const [dominantColor, setDominantColor] = useState('19, 23, 31');
  const foregroundColor = getContrastingTextColor(dominantColor);
  useEffect(() => {
    if (!image) return undefined;
    let active = true;
    void getDominantImageColor(image, '19, 23, 31').then((color) => {
      if (active) setDominantColor(color);
    });
    return () => {
      active = false;
    };
  }, [image]);
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (hasArtworkHero && image) {
      root.setAttribute('data-collection-artwork-theme', 'true');
      root.style.setProperty('--collection-artwork-color', dominantColor);
      root.style.setProperty('--collection-artwork-foreground-color', foregroundColor);
      root.style.setProperty('--collection-dock-foreground-color', foregroundColor);
      root.style.setProperty('--collection-dock-search-foreground-color', foregroundColor);
      root.style.setProperty('--collection-playbar-foreground-color', foregroundColor);
      document
        .querySelectorAll<HTMLElement>(
          '.android-dock, .android-dock-item, .android-dock-label, .android-dock-compact-toggle, .android-dock .material-symbols-outlined'
        )
        .forEach((target) => target.style.setProperty('color', foregroundColor, 'important'));
      document
        .querySelectorAll<HTMLElement>(
          '.android-dock-search, .android-dock-search .material-symbols-outlined'
        )
        .forEach((target) => target.style.setProperty('color', foregroundColor, 'important'));
      document
        .querySelectorAll<HTMLElement>(
          '.play-bar.android-playbar, .play-bar.android-playbar :is(.track-name, .artist-name, .track-name-mini, .artist-name-mini, .control-btn, .transport-icon, .play-pause-icon, .material-symbols-outlined, .apple-volume-icon)'
        )
        .forEach((target) => target.style.setProperty('color', foregroundColor, 'important'));
    } else {
      root.removeAttribute('data-collection-artwork-theme');
      root.style.removeProperty('--collection-artwork-color');
      root.style.removeProperty('--collection-artwork-foreground-color');
      root.style.removeProperty('--collection-dock-foreground-color');
      root.style.removeProperty('--collection-dock-search-foreground-color');
      root.style.removeProperty('--collection-playbar-foreground-color');
      document
        .querySelectorAll<HTMLElement>(
          '.android-dock, .android-dock-item, .android-dock-label, .android-dock-compact-toggle, .android-dock .material-symbols-outlined, .android-dock-search, .android-dock-search .material-symbols-outlined, .play-bar.android-playbar, .play-bar.android-playbar :is(.track-name, .artist-name, .track-name-mini, .artist-name-mini, .control-btn, .transport-icon, .play-pause-icon, .material-symbols-outlined, .apple-volume-icon)'
        )
        .forEach((target) => target.style.removeProperty('color'));
    }
    if (isDesktopCollection) {
      root.setAttribute('data-collection-topbar-theme', 'true');
      root.style.setProperty('--collection-topbar-color', dominantColor);
      root.style.setProperty('--collection-topbar-foreground-color', foregroundColor);
    } else {
      root.removeAttribute('data-collection-topbar-theme');
      root.style.removeProperty('--collection-topbar-color');
      root.style.removeProperty('--collection-topbar-foreground-color');
    }
    return () => {
      root.removeAttribute('data-collection-artwork-theme');
      root.removeAttribute('data-collection-topbar-theme');
      root.style.removeProperty('--collection-artwork-color');
      root.style.removeProperty('--collection-artwork-foreground-color');
      root.style.removeProperty('--collection-dock-foreground-color');
      root.style.removeProperty('--collection-dock-search-foreground-color');
      root.style.removeProperty('--collection-playbar-foreground-color');
      root.style.removeProperty('--collection-topbar-color');
      root.style.removeProperty('--collection-topbar-foreground-color');
      document
        .querySelectorAll<HTMLElement>(
          '.android-dock, .android-dock-item, .android-dock-label, .android-dock-compact-toggle, .android-dock .material-symbols-outlined, .android-dock-search, .android-dock-search .material-symbols-outlined, .play-bar.android-playbar, .play-bar.android-playbar :is(.track-name, .artist-name, .track-name-mini, .artist-name-mini, .control-btn, .transport-icon, .play-pause-icon, .material-symbols-outlined, .apple-volume-icon)'
        )
        .forEach((target) => target.style.removeProperty('color'));
    };
  }, [dominantColor, foregroundColor, hasArtworkHero, image, isDesktopCollection]);
  useEffect(() => {
    if (!hasArtworkHero || !image) return undefined;

    const hero = artworkHeroRef.current;
    const artworkImage = hero?.querySelector<HTMLImageElement>('.collection-artwork-image img');
    if (!hero || !artworkImage) return undefined;

    let active = true;
    let sampler: ArtworkColorSampler | null = null;
    let animationFrame = 0;
    const textTargetsSelector = [
      '.collection-artwork-info .collection-details-type',
      '.collection-artwork-info h1',
      '.collection-artwork-info .collection-details-subtitle',
      '.collection-artwork-info .collection-details-meta',
      '.collection-artwork-more-info',
      '.collection-artwork-show-more',
      '.collection-artwork-page-topnav',
      '.collection-artwork-page-topnav .collection-artwork-icon-button',
    ].join(', ');

    const updateTextColors = () => {
      animationFrame = 0;
      if (!active || !artworkImage.complete || !artworkImage.naturalWidth) return;
      const activeSampler = sampler;
      if (!activeSampler) return;

      const imageRect = artworkImage.getBoundingClientRect();
      if (!imageRect.width || !imageRect.height) return;

      const imageScale = Math.max(
        imageRect.width / artworkImage.naturalWidth,
        imageRect.height / artworkImage.naturalHeight
      );
      const renderedWidth = artworkImage.naturalWidth * imageScale;
      const renderedHeight = artworkImage.naturalHeight * imageScale;
      const objectPosition = getComputedStyle(artworkImage).objectPosition;
      const cropLeft =
        (renderedWidth - imageRect.width) * getObjectPositionFraction(objectPosition, 'x');
      const cropTop =
        (renderedHeight - imageRect.height) * getObjectPositionFraction(objectPosition, 'y');

      const updateFixedForeground = (
        selector: string,
        variableName:
          | '--collection-dock-foreground-color'
          | '--collection-dock-search-foreground-color'
          | '--collection-playbar-foreground-color'
      ) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) return;
        const elementRect = element.getBoundingClientRect();
        const centerX = elementRect.left + elementRect.width / 2;
        const centerY = elementRect.top + elementRect.height / 2;
        let color = getContrastingTextColor(dominantColor);

        if (
          centerX >= imageRect.left &&
          centerX <= imageRect.right &&
          centerY >= imageRect.top &&
          centerY <= imageRect.bottom
        ) {
          color =
            activeSampler(
              (centerX - imageRect.left + cropLeft) / renderedWidth,
              (centerY - imageRect.top + cropTop) / renderedHeight,
              0.01,
              0.01
            ) ?? color;
        } else {
          const collectionPage =
            document.querySelector<HTMLElement>('.collection-artwork-layout') ??
            document.querySelector<HTMLElement>('.collection-details-page');
          const backgroundColor =
            collectionPage ? getComputedStyle(collectionPage).backgroundColor : '';
          const channels = backgroundColor
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map((channel) => Number(channel));
          if (channels?.length === 3) {
            color = getContrastingTextColor(channels.join(', '));
          }
        }

        document.documentElement.style.setProperty(variableName, color);

        if (variableName === '--collection-dock-foreground-color') {
          document
            .querySelectorAll<HTMLElement>(
              '.android-dock, .android-dock-item, .android-dock-label, .android-dock-compact-toggle, .android-dock .material-symbols-outlined'
            )
            .forEach((target) => target.style.setProperty('color', color, 'important'));
        } else if (variableName === '--collection-dock-search-foreground-color') {
          document
            .querySelectorAll<HTMLElement>(
              '.android-dock-search, .android-dock-search .material-symbols-outlined'
            )
            .forEach((target) => target.style.setProperty('color', color, 'important'));
        } else if (variableName === '--collection-playbar-foreground-color') {
          document
            .querySelectorAll<HTMLElement>(
              '.play-bar.android-playbar, .play-bar.android-playbar :is(.track-name, .artist-name, .track-name-mini, .artist-name-mini, .control-btn, .transport-icon, .play-pause-icon, .material-symbols-outlined, .apple-volume-icon)'
            )
            .forEach((target) => target.style.setProperty('color', color, 'important'));
        }
      };

      updateFixedForeground('.android-dock', '--collection-dock-foreground-color');
      updateFixedForeground('.android-dock-search', '--collection-dock-search-foreground-color');
      updateFixedForeground(
        '.play-bar.android-playbar',
        '--collection-playbar-foreground-color'
      );

      hero.querySelectorAll<HTMLElement>(textTargetsSelector).forEach((element) => {
        const elementRect = element.getBoundingClientRect();
        const left = Math.max(elementRect.left, imageRect.left);
        const top = Math.max(elementRect.top, imageRect.top);
        const right = Math.min(elementRect.right, imageRect.right);
        const bottom = Math.min(elementRect.bottom, imageRect.bottom);
        if (right <= left || bottom <= top) {
          element.style.removeProperty('--collection-local-foreground-color');
          element.style.removeProperty('--collection-local-contrast-shadow');
          return;
        }

        const color = activeSampler(
          (left - imageRect.left + cropLeft) / renderedWidth,
          (top - imageRect.top + cropTop) / renderedHeight,
          (right - left) / renderedWidth,
          (bottom - top) / renderedHeight
        );
        if (!color) {
          element.style.removeProperty('--collection-local-foreground-color');
          element.style.removeProperty('--collection-local-contrast-shadow');
          return;
        }
        element.style.setProperty('--collection-local-foreground-color', color);
        element.style.setProperty(
          '--collection-local-contrast-shadow',
          color === '#fff' ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'
        );
      });
    };

    const scheduleTextColorUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateTextColors);
    };
    const scrollContainer = hero.closest('.page-content');
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleTextColorUpdate);
    resizeObserver?.observe(hero);
    resizeObserver?.observe(artworkImage);
    const content = hero.querySelector('.collection-artwork-content');
    const pageTopnav = hero.querySelector('.collection-artwork-page-topnav');
    if (content) resizeObserver?.observe(content);
    if (pageTopnav) resizeObserver?.observe(pageTopnav);
    const mutationObserver = new MutationObserver(scheduleTextColorUpdate);
    mutationObserver.observe(hero, { characterData: true, childList: true, subtree: true });

    scrollContainer?.addEventListener('scroll', scheduleTextColorUpdate, { passive: true });
    window.addEventListener('scroll', scheduleTextColorUpdate, { passive: true });
    window.addEventListener('resize', scheduleTextColorUpdate);
    artworkImage.addEventListener('load', scheduleTextColorUpdate);
    void createArtworkColorSampler(image).then((nextSampler) => {
      if (!active) return;
      sampler = nextSampler;
      scheduleTextColorUpdate();
    });

    return () => {
      active = false;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      scrollContainer?.removeEventListener('scroll', scheduleTextColorUpdate);
      window.removeEventListener('scroll', scheduleTextColorUpdate);
      window.removeEventListener('resize', scheduleTextColorUpdate);
      artworkImage.removeEventListener('load', scheduleTextColorUpdate);
      hero.querySelectorAll<HTMLElement>(textTargetsSelector).forEach((element) => {
        element.style.removeProperty('--collection-local-foreground-color');
        element.style.removeProperty('--collection-local-contrast-shadow');
      });
    };
  }, [dominantColor, hasArtworkHero, image]);
  useEffect(() => {
    if (isAndroid || !hasArtworkHero) return undefined;

    const hero = artworkHeroRef.current;
    const scrollContainer = hero?.closest('.page-content');
    if (!hero || !scrollContainer) return undefined;

    const updateHeaderVisibility = () => {
      const topNavbar = document.querySelector<HTMLElement>('.top-navbar');
      const navbarBottom = topNavbar?.getBoundingClientRect().bottom ?? 0;
      const shouldShow = hero.getBoundingClientRect().bottom <= navbarBottom;
      setShowArtworkSecondaryHeader((visible) => (visible === shouldShow ? visible : shouldShow));
    };

    scrollContainer.addEventListener('scroll', updateHeaderVisibility, { passive: true });
    window.addEventListener('resize', updateHeaderVisibility);
    const initialVisibilityFrame = window.requestAnimationFrame(updateHeaderVisibility);
    return () => {
      window.cancelAnimationFrame(initialVisibilityFrame);
      scrollContainer.removeEventListener('scroll', updateHeaderVisibility);
      window.removeEventListener('resize', updateHeaderVisibility);
    };
  }, [artistName, hasArtworkHero, isAndroid, name, title]);
  const albumGenres = useMemo(
    () =>
      Array.from(
        new Set(
          collectionTracks
            .map((track) => track.genre?.trim())
            .filter((genre): genre is string => Boolean(genre))
        )
      ),
    [collectionTracks]
  );
  const albumYears = useMemo(
    () =>
      Array.from(
        new Set(
          collectionTracks
            .map((track) => track.year)
            .filter((year): year is number => Boolean(year))
        )
      ).sort((a, b) => a - b),
    [collectionTracks]
  );

  if (!firstTrack || !title) {
    return (
      <section className='collection-details-page'>
        <button type='button' className='collection-details-back' onClick={() => navigate(-1)}>
          <span className='material-symbols-outlined' aria-hidden='true'>
            arrow_back
          </span>
          Back
        </button>
        <p className='library-message'>This {type} could not be found in your music library.</p>
      </section>
    );
  }

  const detail =
    type === 'album'
      ? `${collectionTracks.length} tracks${firstTrack.year ? ` · ${firstTrack.year}` : ''}`
      : type === 'artist'
        ? `${
            new Set(
              collectionTracks
                .map((track) => track.album?.trim().toLocaleLowerCase())
                .filter((album): album is string => Boolean(album))
            ).size
          } albums · ${collectionTracks.length} tracks`
        : `${collectionTracks.length} tracks`;
  const isAndroidAlbum = isAndroid && type === 'album';
  const albumDescription = type === 'album' ? firstTrack.comment?.trim() ?? '' : '';
  const albumMetadata = [
    albumGenres.join(', '),
    firstTrack.year,
    firstTrack.format?.toUpperCase(),
  ]
    .filter(Boolean)
    .join(' · ');

  const isLoved = Boolean(firstTrack && lovedTrackIds?.includes(firstTrack.id));
  const albumFavoriteKey = firstTrack ? `${firstTrack.album}\u0000${firstTrack.artist}` : '';
  const isCollectionFavorite =
    type === 'album'
      ? Boolean(favoriteAlbumKeys?.includes(albumFavoriteKey))
      : type === 'artist'
        ? Boolean(favoriteArtistNames?.includes(title.toLocaleLowerCase()))
        : isLoved;
  const toggleCollectionFavorite = () => {
    if (type === 'album' || type === 'artist') {
      onToggleFavoriteCollection?.(
        type,
        type === 'album' ? albumFavoriteKey : title.toLocaleLowerCase()
      );
    } else {
      onToggleLove?.(firstTrack);
    }
  };
  const openCollection = () => {
    if (type === 'album') navigate(getLibraryItemPath('album', title, subtitle ?? ''));
    else if (type === 'artist') navigate(getLibraryItemPath('artist', title));
  };
  const shareCollection = async () => {
    const shareData = {
      title,
      text: type === 'album' && subtitle ? `${title} — ${subtitle}` : title,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      }
    } catch {
      // The share sheet can be dismissed by the user.
    }
  };
  const renderArtworkTopnav = () => (
    <nav
      ref={isAndroid ? artworkPageTopnavRef : undefined}
      className={`collection-artwork-page-topnav${isAndroid ? ' android-collection-artwork-page-topnav' : ''}`}
      aria-label='Collection actions'
    >
      <button
        type='button'
        className='collection-artwork-icon-button'
        aria-label='Back'
        onClick={() => navigate(-1)}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          arrow_back
        </span>
      </button>
      <div className='collection-artwork-page-topnav-actions'>
        {isAndroidAlbum || type === 'artist' ? (
          <button
            type='button'
            className='collection-artwork-icon-button'
            aria-label={`Share ${type}`}
            onClick={() => void shareCollection()}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              share
            </span>
          </button>
        ) : (
          <button
            type='button'
            className='collection-artwork-icon-button'
            aria-label={isCollectionFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isCollectionFavorite}
            onClick={toggleCollectionFavorite}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              {isCollectionFavorite ? 'favorite' : 'favorite_border'}
            </span>
          </button>
        )}
        <CollectionContextMenu
          label={title}
          tracks={collectionTracks}
          isFavorite={isCollectionFavorite}
          onOpen={openCollection}
          onPlayNow={() => onPlayTrack(firstTrack, collectionTracks)}
          onQueueTracks={onQueueTracks}
          onAddToPlaylist={onAddToPlaylist}
          onToggleFavorite={toggleCollectionFavorite}
          renderTrigger={(onClick, isOpen) => (
            <button
              type='button'
              className='collection-artwork-icon-button'
              aria-label='More options'
              aria-haspopup='menu'
              aria-expanded={isOpen}
              onClick={onClick}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                more_horiz
              </span>
            </button>
          )}
        />
      </div>
    </nav>
  );
  return (
    <div
      className={`collection-details-page${isAndroid ? ' android-collection-page' : ''}${
        hasArtworkHero ? ' collection-artwork-layout' : ''
      }${isAndroidAlbum ? ' android-collection-album-page' : ''}${
        type === 'artist' ? ' collection-details-artist-page' : ''
      }${isAndroid && type === 'artist' ? ' android-collection-artist-page' : ''}`}
      style={
        {
          '--collection-dominant-color': image ? dominantColor : '19, 23, 31',
          '--collection-foreground-color': foregroundColor,
        } as CSSProperties
      }
    >
      {isAndroid && hasArtworkHero && typeof document !== 'undefined'
        ? createPortal(renderArtworkTopnav(), document.body)
        : null}
      {hasArtworkHero && image && (
        <div className='collection-artwork-atmosphere' aria-hidden='true'>
          <img src={image} alt='' />
        </div>
      )}
      {isAndroid && type === 'genre' && image && (
        <div className='android-collection-bg' aria-hidden='true'>
          <img src={image} alt='' />
        </div>
      )}
      {isAndroid && type === 'genre' && (
        <header className='android-collection-hero'>
          <div className='android-collection-floating'>
            <button
              type='button'
              className='android-collection-float-btn'
              aria-label='Back'
              onClick={() => navigate(-1)}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                arrow_back
              </span>
            </button>
            <div className='android-collection-floating-right'>
              <button
                type='button'
                className='android-collection-float-btn'
                aria-label={isLoved ? 'Remove from favourites' : 'Add to favourites'}
                onClick={() => onToggleLove?.(firstTrack)}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {isLoved ? 'favorite' : 'favorite_border'}
                </span>
              </button>
              <QueueContextMenu tracks={collectionTracks} onQueueTracks={onQueueTracks}>
                <button
                  type='button'
                  className='android-collection-float-btn'
                  aria-label='More options'
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    more_horiz
                  </span>
                </button>
              </QueueContextMenu>
            </div>
          </div>
          {image ? (
            <img className='android-collection-art' src={image} alt={`${title} artwork`} />
          ) : (
            <div
              className='android-collection-art android-collection-art-placeholder'
              aria-hidden='true'
            >
              <span className='material-symbols-outlined'>album</span>
            </div>
          )}
          <div className='android-collection-actions'>
            <button
              type='button'
              className='android-collection-btn'
              aria-label='Shuffle play'
              onClick={() => {
                const shuffled = [...collectionTracks];
                for (let i = shuffled.length - 1; i > 0; i -= 1) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                onPlayTrack(shuffled[0], shuffled);
              }}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                shuffle
              </span>
            </button>
            <button
              type='button'
              className='android-collection-btn android-collection-btn-play'
              aria-label='Play album'
              onClick={() => onPlayTrack(firstTrack, collectionTracks)}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                play_arrow
              </span>
            </button>
            <QueueContextMenu tracks={collectionTracks} onQueueTracks={onQueueTracks}>
              <button type='button' className='android-collection-btn' aria-label='Add to playlist'>
                <span className='material-symbols-outlined' aria-hidden='true'>
                  playlist_add
                </span>
              </button>
            </QueueContextMenu>
          </div>
          <div className='android-collection-info'>
            <h1>{title}</h1>
            {subtitle && <p className='android-collection-subtitle'>{subtitle}</p>}
            <p className='android-collection-meta'>{detail}</p>
            <button
              type='button'
              className='android-collection-show-more'
              aria-expanded={showMoreInfo}
              onClick={() => setShowMoreInfo((visible) => !visible)}
            >
              {showMoreInfo ? 'Show less' : 'Show more'}
              <span className='material-symbols-outlined' aria-hidden='true'>
                {showMoreInfo ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            <div
              className={`android-collection-more-info${showMoreInfo ? ' is-open' : ''}`}
              aria-hidden={!showMoreInfo}
            >
              <p>Album artist: {subtitle ?? 'Unknown'}</p>
              <p>Released: {albumYears.length ? albumYears.join(', ') : 'Year unknown'}</p>
              <p>Genres: {albumGenres.length ? albumGenres.join(', ') : 'Unknown'}</p>
              <p>{collectionTracks.length} tracks</p>
            </div>
          </div>
        </header>
      )}

      <nav className='collection-details-breadcrumb' aria-label='Breadcrumb'>
        <Link to={`/${type}s`}>{pageTitle}</Link>
        <span className='material-symbols-outlined' aria-hidden='true'>
          chevron_right
        </span>
        <span>{title}</span>
      </nav>

      {hasArtworkHero ? (
        <header className='collection-artwork-hero' ref={artworkHeroRef}>
          <div className='collection-artwork-image' aria-hidden='true'>
            {image ? (
              <img src={image} alt='' />
            ) : (
              <span className='material-symbols-outlined'>
                {type === 'artist' ? 'person' : 'album'}
              </span>
            )}
          </div>
          {!isAndroid && renderArtworkTopnav()}
          <div className='collection-artwork-content'>
            <div className='collection-artwork-info'>
              <p className='collection-details-type'>
                {type === 'artist' ? 'In your library' : type}
              </p>
              <h1>{title}</h1>
              {subtitle && <p className='collection-details-subtitle'>{subtitle}</p>}
              <p className='collection-details-meta'>
                {isAndroidAlbum ? albumMetadata || detail : detail}
              </p>
              {!isAndroidAlbum && (
                <button
                  type='button'
                  className='collection-artwork-show-more'
                  aria-expanded={showMoreInfo}
                  onClick={() => setShowMoreInfo((visible) => !visible)}
                >
                  {showMoreInfo ? 'Show less' : 'Show more'}
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {showMoreInfo ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
              )}
              {showMoreInfo && !isAndroidAlbum && (
                <div className='collection-artwork-more-info'>
                  <p>{type === 'album' ? `Album artist: ${subtitle ?? 'Unknown'}` : detail}</p>
                  <p>Released: {albumYears.length ? albumYears.join(', ') : 'Year unknown'}</p>
                  <p>Genres: {albumGenres.length ? albumGenres.join(', ') : 'Unknown'}</p>
                </div>
              )}
            </div>
            <div className='collection-artwork-actions'>
              {type === 'artist' ? (
                <>
                  <button
                    type='button'
                    className='collection-artwork-icon-button collection-artwork-artist-action-button'
                    aria-label='Artist information'
                    onClick={() =>
                      document.getElementById('artist-about')?.scrollIntoView({
                        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
                          ? 'auto'
                          : 'smooth',
                      })
                    }
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      info
                    </span>
                  </button>
                  <button
                    type='button'
                    className='collection-artwork-play-button collection-artwork-artist-play-button'
                    aria-label={`Play songs by ${title}`}
                    onClick={() => onPlayTrack(firstTrack, collectionTracks)}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      play_arrow
                    </span>
                  </button>
                  <button
                    type='button'
                    className='collection-artwork-icon-button collection-artwork-artist-action-button'
                    aria-label={isCollectionFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    aria-pressed={isCollectionFavorite}
                    onClick={toggleCollectionFavorite}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      {isCollectionFavorite ? 'star' : 'star_border'}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type='button'
                    className='collection-artwork-icon-button'
                    aria-label='Shuffle play'
                    onClick={() => {
                      const shuffled = [...collectionTracks];
                      for (let index = shuffled.length - 1; index > 0; index -= 1) {
                        const randomIndex = Math.floor(Math.random() * (index + 1));
                        [shuffled[index], shuffled[randomIndex]] = [
                          shuffled[randomIndex],
                          shuffled[index],
                        ];
                      }
                      onPlayTrack(shuffled[0], shuffled);
                    }}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      shuffle
                    </span>
                  </button>
                  <button
                    type='button'
                    className='collection-artwork-play-button'
                    onClick={() => onPlayTrack(firstTrack, collectionTracks)}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      play_arrow
                    </span>
                    Play
                  </button>
                  <button
                    type='button'
                    className='collection-artwork-icon-button'
                    aria-label='Add to playlist'
                    onClick={() => onAddToPlaylist?.(collectionTracks, title)}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      playlist_add
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
      ) : (
        <QueueContextMenu tracks={collectionTracks} onQueueTracks={onQueueTracks}>
          <header className={`collection-details-hero ${image ? 'has-image' : ''}`}>
            {image ? (
              <img className='collection-details-image' src={image} alt={`${title} artwork`} />
            ) : (
              <div
                className='collection-details-image collection-details-image-placeholder'
                aria-hidden='true'
              >
                <span className='material-symbols-outlined'>style</span>
              </div>
            )}
            <div className='collection-details-info'>
              <p className='collection-details-type'>{type}</p>
              <h1>{title}</h1>
              {subtitle && <p className='collection-details-subtitle'>{subtitle}</p>}
              <p className='collection-details-meta'>{detail}</p>
              <button
                type='button'
                className='collection-details-play'
                onClick={() => onPlayTrack(firstTrack, collectionTracks)}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  play_arrow
                </span>
                Play
              </button>
            </div>
          </header>
        </QueueContextMenu>
      )}

      {hasArtworkHero && !isAndroid && (
        <div
          className={`collection-artwork-secondary-header${showArtworkSecondaryHeader ? ' is-visible' : ''}`}
          aria-hidden={!showArtworkSecondaryHeader}
        >
          <div className='collection-artwork-secondary-header-inner'>
            <button
              type='button'
              className='collection-artwork-icon-button collection-artwork-secondary-back'
              aria-label='Back'
              onClick={() => navigate(-1)}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                arrow_back
              </span>
            </button>
            <div className='collection-artwork-secondary-identity'>
              {image ? (
                <img src={image} alt='' />
              ) : (
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {type === 'artist' ? 'person' : 'album'}
                </span>
              )}
              <div>
                <span className='collection-artwork-secondary-type'>{type}</span>
                <strong title={title}>{title}</strong>
                <span title={`${subtitle ?? ''}${subtitle ? ' · ' : ''}${detail}`}>
                  {subtitle ? `${subtitle} · ${detail}` : detail}
                </span>
              </div>
            </div>
            <div className='collection-artwork-secondary-actions'>
              {type === 'artist' ? (
                <button
                  type='button'
                  className='collection-artwork-icon-button'
                  aria-label='Share artist'
                  onClick={() => void shareCollection()}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    share
                  </span>
                </button>
              ) : (
                <button
                  type='button'
                  className='collection-artwork-icon-button'
                  aria-label={isCollectionFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  aria-pressed={isCollectionFavorite}
                  onClick={toggleCollectionFavorite}
                >
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {isCollectionFavorite ? 'favorite' : 'favorite_border'}
                  </span>
                </button>
              )}
              <CollectionContextMenu
                label={title}
                tracks={collectionTracks}
                isFavorite={isCollectionFavorite}
                onOpen={openCollection}
                onPlayNow={() => onPlayTrack(firstTrack, collectionTracks)}
                onQueueTracks={onQueueTracks}
                onAddToPlaylist={onAddToPlaylist}
                onToggleFavorite={toggleCollectionFavorite}
                renderTrigger={(onClick, isOpen) => (
                  <button
                    type='button'
                    className='collection-artwork-icon-button'
                    aria-label='More options'
                    aria-haspopup='menu'
                    aria-expanded={isOpen}
                    onClick={onClick}
                  >
                    <span className='material-symbols-outlined' aria-hidden='true'>
                      more_horiz
                    </span>
                  </button>
                )}
              />
            </div>
          </div>
        </div>
      )}

      {isAndroidAlbum && albumDescription && (
        <section className='android-album-description' aria-label={`About ${title}`}>
          <p className={showMoreInfo ? 'is-expanded' : ''}>{albumDescription}</p>
          <button
            type='button'
            aria-expanded={showMoreInfo}
            onClick={() => setShowMoreInfo((visible) => !visible)}
          >
            {showMoreInfo ? 'Less' : 'More'}
          </button>
        </section>
      )}

      {type === 'artist' ? (
        <>
          {latestArtistAlbum && (
            <section
              className='collection-details-featured-album'
              aria-labelledby='featured-artist-album-heading'
            >
              <h2 id='featured-artist-album-heading'>Latest album in your library</h2>
              <CollectionFeaturedAlbumCard
                album={latestArtistAlbum}
                onOpen={() =>
                  navigate(getLibraryItemPath('album', latestArtistAlbum.name, title))
                }
                onQueue={() => onQueueTracks(latestArtistAlbum.tracks, false)}
              />
            </section>
          )}

          <section className='collection-details-top-songs' aria-labelledby='top-songs-heading'>
            <div className='collection-details-top-songs-heading'>
              <h2 id='top-songs-heading'>
                Top Songs
                <span className='material-symbols-outlined' aria-hidden='true'>
                  chevron_right
                </span>
              </h2>
              <p>
                {hasArtistPlayHistory
                  ? 'Ranked by your play count'
                  : playHistoryEnabled
                    ? 'Play history will shape this list'
                    : 'Enable play history to rank songs'}
              </p>
            </div>
            <ol className='collection-details-top-song-list'>
              {artistTopTracks.map((track) => (
                <CollectionArtistTopTrackRow
                  key={track.id}
                  track={track}
                  queueTracks={artistTopTracks}
                  onPlayTrack={onPlayTrack}
                  onQueueTracks={onQueueTracks}
                />
              ))}
            </ol>
          </section>
        </>
      ) : (
        <section className='collection-details-tracks' aria-label={`${title} tracks`}>
          <h2>Tracks</h2>
          <LibraryTrackList
            tracks={collectionTracks}
            onPlayTrack={onPlayTrack}
            onQueueTracks={onQueueTracks}
            variant={isAndroidAlbum ? 'album-details' : 'default'}
          />
        </section>
      )}

      {type === 'artist' && (
        <>
          <section className='collection-details-albums' aria-label={`${title} albums`}>
            <h2>Albums</h2>
            {artistAlbums.length ? (
              <div className='collection-details-album-grid'>
                {artistAlbums.map((album) => (
                  <CollectionContextMenu
                    key={album.name}
                    label={album.name}
                    tracks={album.tracks}
                    isFavorite={Boolean(
                      favoriteAlbumKeys?.includes(
                        `${album.name}\u0000${album.firstTrack.artist}`
                      )
                    )}
                    onOpen={() => navigate(getLibraryItemPath('album', album.name, title))}
                    onPlayNow={() => onPlayTrack(album.firstTrack, album.tracks)}
                    onQueueTracks={onQueueTracks}
                    onAddToPlaylist={onAddToPlaylist}
                    onToggleFavorite={
                      onToggleFavoriteCollection
                        ? () =>
                            onToggleFavoriteCollection('album', `${album.name}\u0000${album.firstTrack.artist}`)
                        : undefined
                    }
                  >
                    <CollectionAlbumCard
                      album={album}
                      onOpen={() => navigate(getLibraryItemPath('album', album.name, title))}
                      onPlay={() => onPlayTrack(album.firstTrack, album.tracks)}
                    />
                  </CollectionContextMenu>
                ))}
              </div>
            ) : (
              <p className='collection-details-about-empty'>No albums found for this artist.</p>
            )}
          </section>

          <section
            id='artist-about'
            className='collection-details-about'
            aria-labelledby='about-artist-heading'
          >
            <h2 id='about-artist-heading'>About {title}</h2>
            {artistWebInfo?.artist === title.toLocaleLowerCase() && artistWebInfo.info.biography ? (
              <>
                <div
                  className={`artist-about-body${artistAboutExpanded ? ' is-expanded' : ''}`}
                >
                  <div className='artist-about-inner'>
                    <p>
                      {artistAboutExpanded
                        ? artistWebInfo.info.biography
                        : getArtistAboutPreview(artistWebInfo.info.biography)}
                    </p>
                    {artistAboutExpanded && artistWebInfo.info.articleUrl && (
                      <a href={artistWebInfo.info.articleUrl} target='_blank' rel='noreferrer'>
                        Read more on Wikipedia
                      </a>
                    )}
                  </div>
                </div>
                <button
                  type='button'
                  className='artist-about-toggle'
                  aria-expanded={artistAboutExpanded}
                  onClick={() => setArtistAboutExpanded((expanded) => !expanded)}
                >
                  {artistAboutExpanded ? 'See less' : 'See more'}
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    {artistAboutExpanded ? 'expand_less' : 'expand_more'}
                  </span>
                </button>
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
