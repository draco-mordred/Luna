import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Track } from '../services/MusicLibrary';
import './QueueContextMenu.css';

interface CollectionContextMenuProps {
  label: string;
  tracks: Track[];
  children?: ReactNode;
  className?: string;
  isFavorite?: boolean;
  onOpen?: () => void;
  onPlayNow: () => void;
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  onAddToPlaylist?: (tracks: Track[], label: string) => void;
  onToggleFavorite?: () => void;
  onSyncTracks?: (tracks: Track[]) => void;
  renderTrigger?: (
    onClick: (event: MouseEvent<HTMLButtonElement>) => void,
    isOpen: boolean
  ) => ReactNode;
}

const CollectionContextMenu = ({
  label,
  tracks,
  children,
  className = 'collection-context-menu-host',
  isFavorite = false,
  onOpen,
  onPlayNow,
  onQueueTracks,
  onAddToPlaylist,
  onToggleFavorite,
  onSyncTracks,
  renderTrigger,
}: CollectionContextMenuProps) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!position) return undefined;
    const closeMenu = () => setPosition(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    window.addEventListener('click', closeMenu);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('luna-close-collection-context-menus', closeMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('blur', closeMenu);
      window.removeEventListener('luna-close-collection-context-menus', closeMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [position]);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(position.x, window.innerWidth - bounds.width - 8));
    const y = Math.max(8, Math.min(position.y, window.innerHeight - bounds.height - 8));
    if (x !== position.x || y !== position.y) setPosition({ x, y });
  }, [position]);

  const openMenuAt = (x: number, y: number) => {
    window.dispatchEvent(new Event('luna-close-collection-context-menus'));
    setPosition({ x, y });
  };

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    openMenuAt(event.clientX, event.clientY);
  };

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (position) {
      setPosition(null);
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    openMenuAt(bounds.right, bounds.bottom + 8);
  };

  const closeMenu = () => setPosition(null);
  const runAction = (action: () => void) => {
    action();
    closeMenu();
  };

  const menu =
    position &&
    createPortal(
      <div
        ref={menuRef}
        className='queue-context-menu collection-context-menu'
        role='menu'
        tabIndex={-1}
        aria-label={`${label} options`}
        style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 1200 }}
      >
        {onOpen && (
          <button
            type='button'
            className='queue-context-menu-item'
            role='menuitem'
            onClick={() => runAction(onOpen)}
          >
            Open
          </button>
        )}
        <button
          type='button'
          className='queue-context-menu-item'
          role='menuitem'
          disabled={tracks.length === 0}
          onClick={() => runAction(onPlayNow)}
        >
          Play now
        </button>
        <button
          type='button'
          className='queue-context-menu-item'
          role='menuitem'
          disabled={tracks.length === 0}
          onClick={() => runAction(() => onQueueTracks(tracks, false))}
        >
          Add to queue
        </button>
        <button
          type='button'
          className='queue-context-menu-item'
          role='menuitem'
          disabled={tracks.length === 0}
          onClick={() => runAction(() => onQueueTracks(tracks, true))}
        >
          Play next
        </button>
        {onAddToPlaylist && (
          <button
            type='button'
            className='queue-context-menu-item'
            role='menuitem'
            disabled={tracks.length === 0}
            onClick={() => runAction(() => onAddToPlaylist(tracks, label))}
          >
            Add to playlist
          </button>
        )}
        {onToggleFavorite && (
          <button
            type='button'
            className='queue-context-menu-item'
            role='menuitem'
            onClick={() => runAction(onToggleFavorite)}
          >
            {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </button>
        )}
        {onSyncTracks && (
          <button
            type='button'
            className='queue-context-menu-item'
            role='menuitem'
            disabled={tracks.length === 0}
            onClick={() => runAction(() => onSyncTracks(tracks))}
          >
            Add to device
          </button>
        )}
      </div>,
      document.body
    );

  return (
    <div className={className} onContextMenu={handleContextMenu}>
      {children}
      {renderTrigger?.(handleTriggerClick, Boolean(position))}
      {menu}
    </div>
  );
};

export default CollectionContextMenu;
