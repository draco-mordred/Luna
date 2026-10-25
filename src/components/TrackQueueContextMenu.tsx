import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Playlist, Track } from '../services/MusicLibrary';
import './QueueContextMenu.css';

interface TrackQueueContextMenuProps {
  tracks: Track[];
  onQueueTracks: (tracks: Track[], playNext: boolean) => void;
  playlists?: Playlist[];
  onAddTracksToPlaylist?: (playlistId: string, tracks: Track[]) => void;
  onEditTrack?: (track: Track) => void;
  children: ReactNode;
}

const TrackQueueContextMenu = ({
  tracks,
  onQueueTracks,
  playlists = [],
  onAddTracksToPlaylist,
  onEditTrack,
  children,
}: TrackQueueContextMenuProps) => {
  const [menu, setMenu] = useState<{ track: Track; x: number; y: number } | null>(null);
  const [playlistSubmenu, setPlaylistSubmenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const playlistTriggerRef = useRef<HTMLButtonElement>(null);
  const playlistSubmenuRef = useRef<HTMLDivElement>(null);
  const submenuCloseTimerRef = useRef<number | null>(null);

  const cancelSubmenuClose = () => {
    if (submenuCloseTimerRef.current !== null) {
      window.clearTimeout(submenuCloseTimerRef.current);
      submenuCloseTimerRef.current = null;
    }
  };

  const scheduleSubmenuClose = () => {
    cancelSubmenuClose();
    submenuCloseTimerRef.current = window.setTimeout(() => {
      setPlaylistSubmenu(null);
      submenuCloseTimerRef.current = null;
    }, 140);
  };

  const openPlaylistSubmenu = () => {
    cancelSubmenuClose();
    const bounds = playlistTriggerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const submenuWidth = 220;
    const x =
      bounds.right + submenuWidth <= window.innerWidth - 8
        ? bounds.right
        : Math.max(8, bounds.left - submenuWidth);
    setPlaylistSubmenu({ x, y: bounds.top });
  };

  useEffect(() => {
    if (!menu) return;
    const pageContent = document.querySelector<HTMLElement>('.page-content');
    if (!pageContent) return;
    const previousOverflow = pageContent.style.overflowY;
    pageContent.style.overflowY = 'hidden';
    const closeMenu = (event: globalThis.MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.track-context-menu')) return;
      setMenu(null);
    };
    document.addEventListener('click', closeMenu);
    return () => {
      cancelSubmenuClose();
      pageContent.style.overflowY = previousOverflow;
      document.removeEventListener('click', closeMenu);
    };
  }, [menu]);

  useLayoutEffect(() => {
    if (!menu || !menuRef.current) return;
    menuRef.current.focus();
    const bounds = menuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8));
    const y = Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8));
    if (x !== menu.x || y !== menu.y) setMenu({ ...menu, x, y });
  }, [menu]);

  useLayoutEffect(() => {
    if (!playlistSubmenu || !playlistSubmenuRef.current) return;
    const bounds = playlistSubmenuRef.current.getBoundingClientRect();
    const x = Math.max(8, Math.min(playlistSubmenu.x, window.innerWidth - bounds.width - 8));
    const y = Math.max(8, Math.min(playlistSubmenu.y, window.innerHeight - bounds.height - 8));
    if (x !== playlistSubmenu.x || y !== playlistSubmenu.y) setPlaylistSubmenu({ x, y });
  }, [playlistSubmenu]);

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('[data-track-id]');
    if (!row) return;
    event.preventDefault();
    const track = tracks.find((item) => item.id === row.dataset.trackId);
    if (!track) return;
    setPlaylistSubmenu(null);
    setMenu({ track, x: event.clientX, y: event.clientY });
  };

  return (
    <div onContextMenu={handleContextMenu}>
      {children}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            className='queue-context-menu track-context-menu'
            role='menu'
            tabIndex={-1}
            aria-label={`Options for ${menu.track.name}`}
            style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 1000 }}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                if (playlistSubmenu) {
                  setPlaylistSubmenu(null);
                  playlistTriggerRef.current?.focus();
                } else {
                  setMenu(null);
                }
              }
            }}
          >
            <button
              type='button'
              className='queue-context-menu-item'
              role='menuitem'
              onClick={() => {
                onQueueTracks([menu.track], true);
                setMenu(null);
              }}
            >
              Play next
            </button>
            {onEditTrack && (
              <button
                type='button'
                className='queue-context-menu-item'
                role='menuitem'
                onClick={() => {
                  onEditTrack(menu.track);
                  setMenu(null);
                }}
              >
                Info
              </button>
            )}
            <button
              type='button'
              className='queue-context-menu-item'
              role='menuitem'
              onClick={() => {
                onQueueTracks([menu.track], false);
                setMenu(null);
              }}
            >
              Add to play queue
            </button>

            {playlists.length > 0 && onAddTracksToPlaylist && (
              <button
                ref={playlistTriggerRef}
                type='button'
                className='queue-context-menu-item queue-context-submenu-trigger'
                role='menuitem'
                aria-haspopup='menu'
                aria-expanded={Boolean(playlistSubmenu)}
                onMouseEnter={openPlaylistSubmenu}
                onMouseLeave={scheduleSubmenuClose}
                onFocus={openPlaylistSubmenu}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    openPlaylistSubmenu();
                    window.requestAnimationFrame(() => {
                      playlistSubmenuRef.current
                        ?.querySelector<HTMLButtonElement>('button')
                        ?.focus();
                    });
                  }
                }}
              >
                <span>Add to playlist</span>
                <span
                  className='material-symbols-outlined queue-context-submenu-arrow'
                  aria-hidden='true'
                >
                  chevron_right
                </span>
              </button>
            )}
          </div>,
          document.body
        )}
      {menu &&
        playlistSubmenu &&
        playlists.length > 0 &&
        onAddTracksToPlaylist &&
        createPortal(
          <div
            ref={playlistSubmenuRef}
            className='queue-context-menu track-context-menu queue-context-submenu'
            role='menu'
            tabIndex={-1}
            aria-label='Choose playlist'
            style={{
              position: 'fixed',
              top: playlistSubmenu.y,
              left: playlistSubmenu.x,
              zIndex: 1001,
            }}
            onMouseEnter={cancelSubmenuClose}
            onMouseLeave={scheduleSubmenuClose}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'ArrowLeft') {
                event.preventDefault();
                setPlaylistSubmenu(null);
                playlistTriggerRef.current?.focus();
              }
            }}
          >
            {playlists.map((playlist) => (
              <button
                type='button'
                className='queue-context-menu-item'
                role='menuitem'
                key={playlist.id}
                onClick={() => {
                  onAddTracksToPlaylist(playlist.id, [menu.track]);
                  setPlaylistSubmenu(null);
                  setMenu(null);
                }}
              >
                {playlist.name}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
};

export default TrackQueueContextMenu;
