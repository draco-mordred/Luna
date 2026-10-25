import type { Track } from '../services/MusicLibrary';
import './PlaylistArtwork.css';

interface PlaylistArtworkProps {
  tracks: Track[];
  size: 'small' | 'large';
  coverTrackIds?: string[];
}

const PlaylistArtwork = ({ tracks, size, coverTrackIds }: PlaylistArtworkProps) => {
  const tracksById = new Map(tracks.map((track) => [track.id, track]));
  const coverTracks = coverTrackIds
    ?.map((id) => tracksById.get(id))
    .filter((track): track is Track => Boolean(track && track.albumArt));
  const covers = (coverTracks?.length ? coverTracks : tracks).reduce<string[]>((artwork, track) => {
    if (track.albumArt && !artwork.includes(track.albumArt) && artwork.length < 4) {
      artwork.push(track.albumArt);
    }
    return artwork;
  }, []);

  return (
    <span className={`playlist-artwork playlist-artwork-${size}`} aria-hidden="true">
      <span className="playlist-artwork-disc" />
      <span className="playlist-artwork-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <span className={`playlist-artwork-tile ${covers[index] ? '' : 'is-placeholder'}`} key={index}>
            {covers[index] ? (
              <img src={covers[index]} alt="" loading="lazy" decoding="async" />
            ) : (
              <span className="material-symbols-outlined">music_note</span>
            )}
          </span>
        ))}
      </span>
    </span>
  );
};

export default PlaylistArtwork;
