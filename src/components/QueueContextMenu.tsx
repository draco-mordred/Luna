import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../services/MusicLibrary';
import './QueueContextMenu.css';

interface QueueContextMenuProps {
  tracks: Track[];
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  children: ReactNode;
  asListItem?: boolean;
  lockPageScroll?: boolean;
}

const QueueContextMenu = ({
  tracks,
  onQueueTracks,
  children,
  asListItem = false,
  lockPageScroll = false,
}: QueueContextMenuProps) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return undefined;
    const closeMenu = () => setPosition(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('luna-close-queue-context-menus', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('luna-close-queue-context-menus', closeMenu);
    };
  }, [position]);

  useEffect(() => {
    if (!position || !lockPageScroll) return;
    const pageContent = document.querySelector<HTMLElement>('.page-content');
    if (!pageContent) return;
    const previousOverflow = pageContent.style.overflowY;
    pageContent.style.overflowY = 'hidden';
    return () => {
      pageContent.style.overflowY = previousOverflow;
    };
  }, [lockPageScroll, position]);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) return;
    const menuBounds = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(position.x, window.innerWidth - menuBounds.width - 8));
    const y = Math.max(8, Math.min(position.y, window.innerHeight - menuBounds.height - 8));
    if (x !== position.x || y !== position.y) setPosition({ x, y });
  }, [position]);

  const handleContextMenu = (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new Event('luna-close-queue-context-menus'));
    setPosition({
      x: event.clientX,
      y: event.clientY,
    });
  };

  const menu =
    position &&
    createPortal(
      <div
        ref={menuRef}
        className='queue-context-menu'
        role='menu'
        aria-label='Queue options'
        style={{
          position: 'fixed',
          top: position.y,
          left: position.x,
          zIndex: 1000,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {[
          { label: 'Add to play queue', playNext: false },
          { label: 'Play next', playNext: true },
        ].map((action) => (
          <button
            key={action.label}
            type='button'
            className='queue-context-menu-item'
            role='menuitem'
            disabled={tracks.length === 0}
            onClick={() => {
              onQueueTracks(tracks, action.playNext);
              setPosition(null);
            }}
          >
            {action.label}
          </button>
        ))}
      </div>,
      document.body
    );

  return asListItem ? (
    <li onContextMenu={handleContextMenu}>
      {children}
      {menu}
    </li>
  ) : (
    <div style={{ display: 'contents' }} onContextMenu={handleContextMenu}>
      {children}
      {menu}
    </div>
  );
};

export default QueueContextMenu;
