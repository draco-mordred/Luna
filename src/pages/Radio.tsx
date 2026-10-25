import { useSearchParams } from 'react-router-dom';
import type { Track } from '../services/MusicLibrary';
import AudiomackPage from './Audiomack';
import JamendoPage from './Jamendo';
import './Radio.css';

interface RadioPageProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayTrack: (track: Track, sourceTracks: Track[]) => Promise<void>;
  onPlayPause: () => void;
}

type RadioTab = 'radio' | 'jamendo' | 'audiomack';

const RADIO_TABS: Array<{ id: RadioTab; label: string; icon: string }> = [
  { id: 'radio', label: 'Radio', icon: 'radio' },
  { id: 'jamendo', label: 'Jamendo', icon: 'headphones' },
  { id: 'audiomack', label: 'Audiomack', icon: 'graphic_eq' },
];

const RadioPage = ({
  currentTrack,
  isPlaying,
  onPlayTrack,
  onPlayPause,
}: RadioPageProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: RadioTab =
    requestedTab === 'jamendo' || requestedTab === 'audiomack' ? requestedTab : 'radio';

  const selectTab = (tab: RadioTab) => {
    setSearchParams(tab === 'radio' ? {} : { tab }, { replace: true });
  };

  return (
    <section className='radio-section'>
      <div className='radio-tabs' role='tablist' aria-label='Radio sources'>
        {RADIO_TABS.map((tab) => (
          <button
            key={tab.id}
            type='button'
            role='tab'
            id={`radio-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`radio-panel-${tab.id}`}
            className={`radio-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            <span className='material-symbols-outlined' aria-hidden='true'>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`radio-panel-${activeTab}`}
        role='tabpanel'
        aria-labelledby={`radio-tab-${activeTab}`}
        className='radio-tab-panel'
      >
        {activeTab === 'radio' && (
          <section className='section-placeholder'>
            <h2>Radio</h2>
            <p>This section is coming soon.</p>
          </section>
        )}
        {activeTab === 'jamendo' && (
          <JamendoPage
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onPlayPause={onPlayPause}
          />
        )}
        {activeTab === 'audiomack' && (
          <AudiomackPage
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            onPlayTrack={onPlayTrack}
            onPlayPause={onPlayPause}
          />
        )}
      </div>
    </section>
  );
};

export default RadioPage;
