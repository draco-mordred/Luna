import { useState } from 'react';
import PlayBar from './components/PlayBar';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import './App.css';

const App = () => {
  const [currentTrack, setCurrentTrack] = useState<{
    name: string;
    artist: string;
    album: string;
    albumArt?: string;
  } | null>({
    name: 'Blinding Lights',
    artist: 'The Weeknd',
    album: 'After Hours',
    albumArt: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=300&h=300&fit=crop',
  });
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180); // 3 minutes

  // UI-only handlers (no actual audio)
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handlePrevious = () => console.log('Previous');
  const handleNext = () => console.log('Next');
  const handleVolumeChange = (newVolume: number) => setVolume(newVolume);
  const handleSeek = (time: number) => setCurrentTime(time);

  return (
    <div className="app">
      <div className="app-container">
        <Sidebar />
        <MainContent />
      </div>
      
      <PlayBar
        track={currentTrack}
        isPlaying={isPlaying}
        onPlayPause={handlePlayPause}
        onPrevious={handlePrevious}
        onNext={handleNext}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
      />
    </div>
  );
};

export default App;
