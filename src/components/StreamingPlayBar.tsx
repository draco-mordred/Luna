import { useEffect, useState } from 'react';
import type { Track } from '../services/MusicLibrary';
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
}: StreamingPlayBarProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(track.duration);
  const providerName = track.streamingProvider === 'jamendo' ? 'Jamendo' : 'Audiomack';
  const actualDuration =
    activeAudio && Number.isFinite(activeAudio.duration) && activeAudio.duration > 0
      ? activeAudio.duration
      : duration;

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
      className={`streaming-play-bar ${track.streamingProvider || ''}`}
      aria-label={`${providerName} playback`}
    >
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
