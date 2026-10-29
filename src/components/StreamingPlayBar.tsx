import { useEffect, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
import type { PlayerWindowMode } from '../types/electron';
import { useArtistImage } from '../services/artistImages';
import { splitArtistCredits } from '../utils/artistCredits';
import './StreamingPlayBar.css';

interface StreamingPlayBarProps {
  track: Track;
  activeAudio: HTMLAudioElement | null;
  isPlaying: boolean;
  volume: number;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onVolumeChange: (volume: number) => void;
  onSeek: (time: number) => void;
  isDesktopApp: boolean;
  playerWindowMode: PlayerWindowMode;
  onEnterMiniPlayer: () => void;
  onEnterFullscreenPlayer: () => void;
  onExitPlayerMode: () => void;
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'one' | 'all';
  onToggleRepeat: () => void;
}

const formatTime = (seconds: number) => {
  const safeSeconds = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
};

const StreamingPlayBar = ({
  track,
  activeAudio,
  isPlaying,
  volume,
  onPlayPause,
  onPrevious,
  onNext,
  onVolumeChange,
  onSeek,
  isDesktopApp,
  playerWindowMode,
  onEnterMiniPlayer,
  onEnterFullscreenPlayer,
  onExitPlayerMode,
  isShuffled,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
}: StreamingPlayBarProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration);
  const [showLyrics, setShowLyrics] = useState(false);
  const primaryArtist = splitArtistCredits(track.artist)[0] ?? '';
  const { imageUrl: artistImageUrl } = useArtistImage(primaryArtist, {
    enabled: playerWindowMode !== 'normal',
    allowDownload: false,
  });
  const providerName = track.streamingProvider === 'jamendo' ? 'Jamendo' : 'Audiomack';
  const actualDuration =
    activeAudio && Number.isFinite(activeAudio.duration) && activeAudio.duration > 0
      ? activeAudio.duration
      : duration;
  const activeSyncedLyrics = track.syncedLyrics?.filter((line) => line.time <= currentTime);
  const currentSyncedLyric = activeSyncedLyrics?.[activeSyncedLyrics.length - 1]?.text;
  const lyricsText = currentSyncedLyric || track.lyrics || '';

  useEffect(() => {
    if (!activeAudio) {
      setCurrentTime(0);
      setDuration(track.duration);
      return undefined;
    }

    setDuration(track.duration);
    const updateTime = () => setCurrentTime(activeAudio.currentTime || 0);
    const updateDuration = () => {
      if (Number.isFinite(activeAudio.duration) && activeAudio.duration > 0) {
        setDuration(activeAudio.duration);
      }
    };
    updateTime();
    updateDuration();
    activeAudio.addEventListener('timeupdate', updateTime);
    activeAudio.addEventListener('durationchange', updateDuration);
    activeAudio.addEventListener('loadedmetadata', updateDuration);
    activeAudio.addEventListener('seeked', updateTime);
    return () => {
      activeAudio.removeEventListener('timeupdate', updateTime);
      activeAudio.removeEventListener('durationchange', updateDuration);
      activeAudio.removeEventListener('loadedmetadata', updateDuration);
      activeAudio.removeEventListener('seeked', updateTime);
    };
  }, [activeAudio, track.duration, track.id]);

  return (
    <section
      className={`streaming-play-bar ${track.streamingProvider || ''} ${playerWindowMode !== 'normal' ? 'player-mode' : ''}`}
      aria-label={`${providerName} playback`}
    >
      {playerWindowMode !== 'normal' && (artistImageUrl || track.albumArt) && (
        <div className='streaming-player-mode-background' aria-hidden='true'>
          <img src={artistImageUrl || track.albumArt || ''} alt='' />
        </div>
      )}
      {playerWindowMode !== 'normal' && (
        <div className='streaming-player-mode-art'>
          {track.albumArt ? (
            <img src={track.albumArt} alt={`${track.album} artwork`} />
          ) : (
            <span className='material-symbols-outlined' aria-hidden='true'>
              album
            </span>
          )}
        </div>
      )}
      <div className='streaming-play-bar-main'>
        {track.albumArt ? (
          <img className='streaming-play-bar-art' src={track.albumArt} alt='' />
        ) : (
          <span
            className='streaming-play-bar-art-placeholder material-symbols-outlined'
            aria-hidden='true'
          >
            album
          </span>
        )}
        <div className='streaming-play-bar-track'>
          <strong title={track.name}>{track.name}</strong>
          <span title={track.artist}>{track.artist || providerName}</span>
          <small>{providerName}</small>
        </div>
        <div className='streaming-play-bar-transport'>
          <button type='button' aria-label='Previous track' onClick={onPrevious}>
            <span className='material-symbols-outlined' aria-hidden='true'>
              skip_previous
            </span>
          </button>
          <button
            type='button'
            className='streaming-play-bar-toggle'
            aria-label={isPlaying ? 'Pause' : 'Play'}
            onClick={onPlayPause}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
          </button>
          <button type='button' aria-label='Next track' onClick={onNext}>
            <span className='material-symbols-outlined' aria-hidden='true'>
              skip_next
            </span>
          </button>
          {isDesktopApp && playerWindowMode === 'normal' && (
            <>
              <button
                type='button'
                aria-label='Enter mini player mode'
                title='Enter mini player mode'
                onClick={onEnterMiniPlayer}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  picture_in_picture_alt
                </span>
              </button>
              <button
                type='button'
                aria-label='Enter fullscreen player mode'
                title='Enter fullscreen player mode'
                onClick={onEnterFullscreenPlayer}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  fullscreen
                </span>
              </button>
            </>
          )}
        </div>
        <label className='streaming-play-bar-volume'>
          <span className='material-symbols-outlined' aria-hidden='true'>
            volume_up
          </span>
          <input
            type='range'
            aria-label='Volume'
            min='0'
            max='1'
            step='0.01'
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
          />
        </label>
      </div>
      {playerWindowMode !== 'normal' && (
        <>
          {showLyrics && lyricsText.trim() && (
            <div className='streaming-player-mode-lyrics' dir='auto'>
              {lyricsText}
            </div>
          )}
          <div className='streaming-player-mode-controls'>
            <button
              type='button'
              className={isShuffled ? 'active' : ''}
              aria-label='Toggle shuffle'
              aria-pressed={isShuffled}
              onClick={onToggleShuffle}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                shuffle
              </span>
            </button>
            {(track.lyrics?.trim() || track.syncedLyrics?.length) && (
              <button
                type='button'
                className={showLyrics ? 'active' : ''}
                aria-label={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
                aria-pressed={showLyrics}
                onClick={() => setShowLyrics((visible) => !visible)}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  lyrics
                </span>
              </button>
            )}
            <button
              type='button'
              className={repeatMode !== 'off' ? 'active' : ''}
              aria-label={`Repeat ${repeatMode}`}
              aria-pressed={repeatMode !== 'off'}
              onClick={onToggleRepeat}
            >
              <span className='material-symbols-outlined' aria-hidden='true'>
                {repeatMode === 'one' ? 'repeat_one' : 'repeat'}
              </span>
            </button>
          </div>
        </>
      )}
      {playerWindowMode !== 'normal' && (
        <button type='button' className='streaming-player-mode-exit' onClick={onExitPlayerMode}>
          <span className='material-symbols-outlined' aria-hidden='true'>
            close_fullscreen
          </span>
          Exit player mode
        </button>
      )}
      <div className='streaming-play-bar-progress'>
        <span>{formatTime(currentTime)}</span>
        <input
          type='range'
          aria-label='Seek track'
          min='0'
          max={actualDuration || 0}
          step='0.1'
          value={Math.min(currentTime, actualDuration || 0)}
          onChange={(event) => onSeek(Number(event.currentTarget.value))}
        />
        <span>{formatTime(actualDuration)}</span>
      </div>
    </section>
  );
};

export default StreamingPlayBar;
