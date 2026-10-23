import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import PlayBar from './components/PlayBar';
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
import { Tracks, Albums, Artists, Composer, Settings } from './pages';
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
  const [duration, setDuration] = useState(180);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // UI-only handlers (no actual audio)
  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handlePrevious = () => console.log('Previous');
  const handleNext = () => console.log('Next');
  const handleVolumeChange = (newVolume: number) => setVolume(newVolume);
  const handleSeek = (time: number) => setCurrentTime(time);

  // Toggle sidebar
  const toggleSidebar = () => setSidebarCollapsed(!sidebarCollapsed);

  return (
    <div className={`app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="app-container">
        {/* Sidebar */}
        <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
        
        {/* Main Content Area */}
        <div className="main-area">
          {/* Top Navigation */}
          <TopNavbar />
          
          {/* Page Content */}
          <main className="page-content">
            <Routes>
              <Route path="/" element={<Tracks />} />
              <Route path="/tracks" element={<Tracks />} />
              <Route path="/albums" element={<Albums />} />
              <Route path="/artists" element={<Artists />} />
              <Route path="/composer" element={<Composer />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/*" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
      
      {/* PlayBar */}
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
