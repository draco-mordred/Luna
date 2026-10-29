import React from 'react';
import './AndroidStartupSplash.css';

interface AndroidStartupSplashProps {
  apiLevel: number | null;
  exiting: boolean;
}

const AndroidStartupSplash: React.FC<AndroidStartupSplashProps> = ({ apiLevel, exiting }) => (
  <div
    className={`android-startup-splash ${exiting ? 'exiting' : ''}`}
    data-loader-style={apiLevel !== null && apiLevel < 31 ? 'legacy' : 'modern'}
    role='status'
    aria-label='Starting Luna Music'
  >
    <div className='android-startup-brand'>
      <img src={`${process.env.PUBLIC_URL}/logo512.png`} alt='' />
      <h1>Luna Music</h1>
    </div>
    <div className='android-startup-loader' aria-hidden='true'>
      <span className='android-startup-loader-modern' />
      <span className='android-startup-loader-legacy'>
        <i />
        <i />
        <i />
      </span>
    </div>
  </div>
);

export default AndroidStartupSplash;
