import type { FC } from 'react';

type TransportIconName = 'shuffle' | 'previous' | 'next' | 'repeat' | 'repeat_one';

export const TransportIcon: FC<{ name: TransportIconName }> = ({ name }) => (
  <svg className='transport-icon' viewBox='0 0 24 24' aria-hidden='true'>
    {name === 'previous' && (
      <>
        <path
          className='standard-transport-glyph'
          d='M5 5h2v14H5zM20 6.5v11a1 1 0 0 1-1.55.83l-8-5.5a1 1 0 0 1 0-1.66l8-5.5A1 1 0 0 1 20 6.5Z'
        />
        <path
          className='apple-transport-glyph'
          d='M11.2 5.5v13a1 1 0 0 1-1.6.8L2.2 13a1.2 1.2 0 0 1 0-2l7.4-6.3a1 1 0 0 1 1.6.8Zm10.6 0v13a1 1 0 0 1-1.6.8L12.8 13a1.2 1.2 0 0 1 0-2l7.4-6.3a1 1 0 0 1 1.6.8Z'
        />
      </>
    )}
    {name === 'next' && (
      <>
        <path
          className='standard-transport-glyph'
          d='M17 5h2v14h-2zM4 6.5v11a1 1 0 0 0 1.55.83l8-5.5a1 1 0 0 0 0-1.66l-8-5.5A1 1 0 0 0 4 6.5Z'
        />
        <path
          className='apple-transport-glyph'
          d='M2.8 5.5a1 1 0 0 1 1.6-.8l7.4 6.3a1.2 1.2 0 0 1 0 2l-7.4 6.3a1 1 0 0 1-1.6-.8v-13Zm10.6 0a1 1 0 0 1 1.6-.8l7.4 6.3a1.2 1.2 0 0 1 0 2l-7.4 6.3a1 1 0 0 1-1.6-.8v-13Z'
        />
      </>
    )}
    {name === 'shuffle' && (
      <>
        <path
          className='standard-transport-glyph'
          d='M14 4h6v6h-2V7.41l-4.29 4.3-1.42-1.42L16.59 6H14V4ZM4 5h3.5l6.3 6.3-1.42 1.42L6.67 7H4V5Zm12.59 7.59L18 14v-2h2v6h-6v-2h2.59l-4.3-4.29 1.42-1.42L16.59 12.59ZM4 17h2.67l3.71-3.71 1.42 1.42L7.5 19H4v-2Z'
        />
        <g className='apple-transport-glyph'>
          <path d='M3 7h2.5c4.6 0 6.8 10 11.5 10H21m-4-4 4 4-4 4' />
          <path d='M3 17h2.5c2.2 0 3.8-2.8 5.2-5m2.6-4c1-.7 2-1 3.7-1H21m-4-4 4 4-4 4' />
        </g>
      </>
    )}
    {(name === 'repeat' || name === 'repeat_one') && (
      <>
        <path
          className='standard-transport-glyph'
          d='M7 7h11v3l4-4-4-4v3H5v6h2V7Zm10 10H6v-3l-4 4 4 4v-3h13v-6h-2v4Z'
        />
        {name === 'repeat_one' && (
          <text
            className='standard-transport-glyph'
            x='12'
            y='15'
            fill='currentColor'
            fontSize='7'
            fontWeight='700'
            textAnchor='middle'
          >
            1
          </text>
        )}
        <g className='apple-transport-glyph'>
          <path d='M4 10V8a3 3 0 0 1 3-3h13m-3-3 3 3-3 3M20 14v2a3 3 0 0 1-3 3H4m3-3-3 3 3 3' />
          {name === 'repeat_one' && (
            <>
              <circle className='apple-repeat-one-badge' cx='7' cy='7' r='4.5' />
              <text className='apple-repeat-one-label' x='7' y='9.5' textAnchor='middle'>
                1
              </text>
            </>
          )}
        </g>
      </>
    )}
  </svg>
);

export const PlayPauseIcon: FC<{ isPlaying: boolean }> = ({ isPlaying }) => (
  <svg className='play-pause-icon' viewBox='0 0 24 24' aria-hidden='true'>
    {isPlaying ? (
      <path className='pause-icon-glyph' d='M8 6.5v11M16 6.5v11' />
    ) : (
      <>
        <path
          className='play-icon-glyph default-play-icon-glyph'
          d='M8.4 4.6Q7 3.8 7 5.5v13q0 1.7 1.4.9l10.7-6.2q1.9-1.2 0-2.4Z'
        />
        <path className='play-icon-glyph vlc-play-icon-glyph' d='M7 4 20 12 7 20Z' />
      </>
    )}
  </svg>
);
