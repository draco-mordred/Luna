import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Playlist } from '../services/MusicLibrary';
import './PlaylistOptionsMenu.css';

export type PlaylistAction = 'rename' | 'mix-cover-art' | 'delete' | 'play-now' | 'add-to-queue';

interface PlaylistOptionsMenuProps {
  playlist: Playlist;
  className?: string;
  onAction: (playlist: Playlist, action: PlaylistAction) => void;
  children: ReactNode;
}

const MENU_ACTIONS: Array<{ id: PlaylistAction; label: string; icon: string }> = [
  { id: 'rename', label: 'Rename', icon: 'edit' },
  { id: 'mix-cover-art', label: 'Mix Coverart', icon: 'auto_awesome_motion' },
  { id: 'delete', label: 'Delete', icon: 'delete' },
  { id: 'play-now', label: 'Play now', icon: 'play_arrow' },
  { id: 'add-to-queue', label: 'Add to play queue', icon: 'queue_music' },
];

const PlaylistOptionsMenu = ({
  playlist,
  className = '',
  onAction,
  children,
}: PlaylistOptionsMenuProps) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const instanceId = useRef(`${playlist.id}-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    if (!position) return;
    document.dispatchEvent(new CustomEvent('luna-playlist-menu-open', { detail: instanceId }));
    const closeOtherMenu = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== instanceId) setPosition(null);
    };
    const closeOutside = (event: globalThis.MouseEvent) => {
      if (
        event.target instanceof Node
        && (menuRef.current?.contains(event.target) || triggerRef.current?.contains(event.target))
      ) return;
      setPosition(null);
    };
    document.addEventListener('luna-playlist-menu-open', closeOtherMenu);
    document.addEventListener('click', closeOutside);
    return () => {
      document.removeEventListener('luna-playlist-menu-open', closeOtherMenu);
      document.removeEventListener('click', closeOutside);
    };
  }, [instanceId, position]);

  useLayoutEffect(() => {
    if (!position || !menuRef.current) return;
    const bounds = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(position.x, window.innerWidth - bounds.width - 8));
    const y = Math.max(8, Math.min(position.y, window.innerHeight - bounds.height - 8));
    if (x !== position.x || y !== position.y) setPosition({ x, y });
  }, [position]);

  const openAt = (x: number, y: number) => setPosition({ x, y });
  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    openAt(event.clientX, event.clientY);
  };

  return (
    <div className={`playlist-options-host ${className}`} onContextMenu={handleContextMenu}>
      {children}
      <button
        ref={triggerRef}
        type="button"
        className="playlist-options-trigger"
        aria-label={`Options for ${playlist.name}`}
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        title={`Options for ${playlist.name}`}
        onClick={(event) => {
          event.stopPropagation();
          if (position) {
            setPosition(null);
            return;
          }
          const bounds = event.currentTarget.getBoundingClientRect();
          openAt(bounds.right, bounds.bottom + 4);
        }}
      >
        <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
      </button>
      {position && createPortal(
        <div
          ref={menuRef}
          className="playlist-options-popover"
          role="menu"
          aria-label={`Options for ${playlist.name}`}
          style={{ position: 'fixed', top: position.y, left: position.x, zIndex: 1200 }}
          onClick={(event) => event.stopPropagation()}
        >
          {MENU_ACTIONS.map((action) => (
            <button
              type="button"
              className={`playlist-options-item ${action.id === 'delete' ? 'is-destructive' : ''}`}
              role="menuitem"
              key={action.id}
              onClick={() => {
                setPosition(null);
                onAction(playlist, action.id);
              }}
            >
              <span className="material-symbols-outlined" aria-hidden="true">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default PlaylistOptionsMenu;
