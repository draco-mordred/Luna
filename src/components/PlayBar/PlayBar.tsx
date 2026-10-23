import { useState, useRef, useEffect } from 'react';
import './PlayBar.css';

interface PlayBarProps {
  track?: {
    name: string;
    artist: string;
    album: string;
    albumArt?: string;
  } | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

// Inline SVG for default album art
const DEFAULT_ALBUM_ART = (
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#4a4a4a" />
        <stop offset="100%" stopColor="#2a2a2a" />
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="12" fill="url(#grad)" />
    <path d="M60 60 L140 60 L140 140 L60 140 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
    <path d="M70 70 L130 70 L130 130 L70 130 Z" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
    <path d="M80 80 L120 80 L120 120 L80 120 Z" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" />
    <circle cx="100" cy="100" r="15" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
    <text x="100" y="170" fontFamily="Arial" fontSize="12" fill="rgba(255,255,255,0.6)" textAnchor="middle">MUSIC</text>
  </svg>
);

const PlayBar: React.FC<PlayBarProps> = ({
  track,
  isPlaying,
  onPlayPause,
  onPrevious,
  onNext,
  volume,
  onVolumeChange,
  currentTime,
  duration,
  onSeek,
}) => {
  const [state, setState] = useState<'collapsed' | 'expanded'>('collapsed');
  const [height, setHeight] = useState(72);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);
  const [startHeight, setStartHeight] = useState<number | null>(null);
  const playBarRef = useRef<HTMLDivElement>(null);

  // Sync state with height
  useEffect(() => {
    setHeight(state === 'expanded' ? 400 : 72);
  }, [state]);

  // Toggle expand/collapse when clicking album art
  const handleAlbumArtClick = () => {
    setState(state === 'expanded' ? 'collapsed' : 'expanded');
  };

  // Handle drag to expand/collapse
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setStartY(clientY);
    setStartHeight(height);
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDrag);
    document.addEventListener('touchend', handleDragEnd);
  };

  const handleDrag = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || startY === null || startHeight === null) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = startY - clientY;
    let newHeight = startHeight + deltaY;
    newHeight = Math.max(72, Math.min(400, newHeight));
    setHeight(newHeight);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDrag);
    document.removeEventListener('touchend', handleDragEnd);
    
    // Snap to state based on threshold
    const shouldExpand = height > 200;
    setHeight(shouldExpand ? 400 : 72);
    if (shouldExpand !== (state === 'expanded')) {
      setState(shouldExpand ? 'expanded' : 'collapsed');
    }
  };

  // Format time display
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={playBarRef}
      className={`play-bar ${state} ${isDragging ? 'dragging' : ''}`}
      style={{ height: `${height}px` }}
    >
      {/* Drag handle */}
      <div className="drag-handle" onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
        <div className="drag-indicator" />
      </div>

      {/* Expanded View - Now Playing */}
      <div className={`now-playing ${state === 'expanded' ? 'visible' : 'hidden'}`}>
        <div className="album-art" onClick={handleAlbumArtClick}>
          {track?.albumArt ? (
            <img src={track.albumArt} alt={track.album} />
          ) : (
            <div className="default-art">{DEFAULT_ALBUM_ART}</div>
          )}
        </div>
        <div className="track-info">
          <h2 className="track-name">{track?.name || 'No Track Selected'}</h2>
          <p className="artist-name">{track?.artist || 'Unknown Artist'}</p>
          <p className="album-name">{track?.album || 'Unknown Album'}</p>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar" onClick={(e) => {
            const rect = (e.target as HTMLDivElement).getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            onSeek(percent * duration);
          }}>
            <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Collapsed View - Mini Player */}
      <div className="mini-player">
        <div className="track-info-mini">
          <div className="album-art-mini" onClick={handleAlbumArtClick}>
            {track?.albumArt ? (
              <img src={track.albumArt} alt={track.album} />
            ) : (
              <div className="default-art-mini">{DEFAULT_ALBUM_ART}</div>
            )}
          </div>
          <div className="text-info">
            <span className="track-name-mini">{track?.name || 'No Track'}</span>
            <span className="artist-name-mini">{track?.artist || 'Unknown'}</span>
          </div>
        </div>
        
        {/* Mini Progress Bar */}
        <div className="mini-progress-container">
          <div className="mini-progress-bar" onClick={(e) => {
            const rect = (e.target as HTMLDivElement).getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            onSeek(percent * duration);
          }}>
            <div className="mini-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="mini-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
        
        <div className="controls">
          <button className="control-btn" onClick={onPrevious} disabled={!track}>
            <span className="material-symbols-outlined">skip_previous</span>
          </button>
          <button className="control-btn play-pause" onClick={onPlayPause}>
            <span className="material-symbols-outlined">{isPlaying ? 'pause' : 'play_arrow'}</span>
          </button>
          <button className="control-btn" onClick={onNext} disabled={!track}>
            <span className="material-symbols-outlined">skip_next</span>
          </button>
        </div>

        <div className="volume-control">
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="volume-slider"
          />
          <button className="control-btn mute-btn">
            <span className="material-symbols-outlined">volume_up</span>
          </button>
        </div>

        <button className="control-btn expand-btn" onClick={() => setState(state === 'expanded' ? 'collapsed' : 'expanded')}>
          <span className="material-symbols-outlined">{state === 'expanded' ? 'fullscreen_exit' : 'fullscreen'}</span>
        </button>
      </div>
    </div>
  );
};

export default PlayBar;
