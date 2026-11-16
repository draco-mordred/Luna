import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  enumerateAudioOutputDevices,
  isAudioOutputSelectionSupported,
  type AudioOutputCategory,
  type AudioOutputDevice,
} from '../../services/audioOutputDevices';

interface AudioOutputSelectorProps {
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => Promise<void>;
}

const categoryLabel: Record<AudioOutputCategory, string> = {
  internal: 'Built-in',
  wired: 'Wired',
  wireless: 'Wireless',
  other: 'Other',
};

const categoryIcon: Record<AudioOutputCategory, string> = {
  internal: 'speaker',
  wired: 'headphones',
  wireless: 'bluetooth_audio',
  other: 'audio_device',
};

interface MenuPosition {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

const AudioOutputSelector: React.FC<AudioOutputSelectorProps> = ({
  selectedDeviceId,
  onSelectDevice,
}) => {
  const supported = isAudioOutputSelectionSupported();
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(supported);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const menuCloseTimeoutRef = useRef<number | null>(null);

  const refreshDevices = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setDevices([]);
    setIsLoading(true);
    setError('');
    try {
      const nextDevices = await enumerateAudioOutputDevices();
      if (requestId !== requestIdRef.current) return;
      setDevices(nextDevices);
      setError('');
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    if (menuCloseTimeoutRef.current !== null) {
      window.clearTimeout(menuCloseTimeoutRef.current);
    }
    menuCloseTimeoutRef.current = window.setTimeout(() => {
      setIsMenuMounted(false);
      menuCloseTimeoutRef.current = null;
    }, 240);
  }, []);

  const openMenu = () => {
    if (menuCloseTimeoutRef.current !== null) {
      window.clearTimeout(menuCloseTimeoutRef.current);
      menuCloseTimeoutRef.current = null;
    }
    setIsMenuMounted(true);
    setIsOpen(true);
    void refreshDevices();
  };

  useEffect(() => {
    if (!supported) return undefined;
    const requestId = ++requestIdRef.current;
    void enumerateAudioOutputDevices()
      .then((nextDevices) => {
        if (requestId !== requestIdRef.current) return;
        setDevices(nextDevices);
        setError('');
      })
      .catch((loadError: unknown) => {
        if (requestId !== requestIdRef.current) return;
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      })
      .finally(() => {
        if (requestId === requestIdRef.current) setIsLoading(false);
      });
    const mediaDevices = navigator.mediaDevices;
    mediaDevices.addEventListener?.('devicechange', refreshDevices);
    return () => {
      requestIdRef.current += 1;
      mediaDevices.removeEventListener?.('devicechange', refreshDevices);
    };
  }, [refreshDevices, supported]);

  useEffect(() => {
    if (!isMenuMounted) return undefined;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !menuRef.current?.contains(event.target)
      ) {
        closeMenu();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [closeMenu, isMenuMounted]);

  useEffect(
    () => () => {
      if (menuCloseTimeoutRef.current !== null) {
        window.clearTimeout(menuCloseTimeoutRef.current);
      }
    },
    []
  );

  useLayoutEffect(() => {
    if (!isMenuMounted) return undefined;

    const updateMenuPosition = () => {
      const toggle = toggleRef.current;
      const menu = menuRef.current;
      if (!toggle || !menu) return;

      const toggleRect = toggle.getBoundingClientRect();
      const menuWidth = menu.offsetWidth;
      const menuHeight = Math.min(menu.offsetHeight, window.innerHeight - 24);
      const spaceBelow = window.innerHeight - toggleRect.bottom;
      const spaceAbove = toggleRect.top;
      const placeAbove = spaceBelow < menuHeight + 16 && spaceAbove > spaceBelow;
      const left = Math.min(
        Math.max(12, toggleRect.right - menuWidth),
        Math.max(12, window.innerWidth - menuWidth - 12)
      );
      const top = placeAbove
        ? Math.max(12, toggleRect.top - menuHeight - 8)
        : Math.min(toggleRect.bottom + 8, window.innerHeight - menuHeight - 12);

      setMenuPosition({
        top,
        left,
        placement: placeAbove ? 'above' : 'below',
      });
    };

    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [devices, error, isLoading, isMenuMounted]);

  const availableDevices = devices;
  const selectedDevice = availableDevices.find((device) => device.deviceId === selectedDeviceId);
  const selectedLabel =
    selectedDevice?.label ??
    (selectedDeviceId === 'default' ? 'System default' : 'Unavailable output');
  const isDeviceSelected = selectedDeviceId !== 'default' && selectedDevice !== undefined;

  const selectDevice = async (deviceId: string) => {
    try {
      await onSelectDevice(deviceId);
      setError('');
      closeMenu();
    } catch (selectionError) {
      setDevices((available) => available.filter((device) => device.deviceId !== deviceId));
      setError(selectionError instanceof Error ? selectionError.message : String(selectionError));
    }
  };

  return (
    <div className='audio-output-selector' ref={rootRef}>
      <button
        type='button'
        className={`audio-output-selector-toggle${isDeviceSelected ? ' is-connected' : ''}`}
        ref={toggleRef}
        aria-label={`Audio output: ${selectedLabel}`}
        aria-haspopup='dialog'
        aria-expanded={isOpen}
        aria-pressed={isDeviceSelected}
        title={
          supported
            ? `Choose audio output (current: ${selectedLabel})`
            : 'Audio output selection is not supported in this runtime'
        }
        disabled={!supported}
        onClick={() => {
          if (isOpen) closeMenu();
          else openMenu();
        }}
      >
        <span className='material-symbols-outlined' aria-hidden='true'>
          airplay
        </span>
      </button>
      {isMenuMounted &&
        createPortal(
          <div
            ref={menuRef}
            className={`audio-output-selector-menu${isOpen ? ' is-open' : ' is-closing'}`}
            data-placement={menuPosition?.placement ?? 'below'}
            role='dialog'
            aria-label='Choose an audio output'
            aria-hidden={!isOpen}
            style={{
              top: menuPosition?.top ?? 0,
              left: menuPosition?.left ?? 0,
              visibility: menuPosition ? 'visible' : 'hidden',
            }}
          >
            <div className='audio-output-selector-heading'>
              <strong>Audio output</strong>
              <span>{selectedLabel}</span>
            </div>
            {isLoading && (
              <p className='audio-output-selector-empty' role='status'>
                Checking available devices…
              </p>
            )}
            {availableDevices.map((device) => (
              <button
                type='button'
                key={device.deviceId}
                className='audio-output-selector-option'
                aria-pressed={device.deviceId === selectedDeviceId}
                onClick={() => void selectDevice(device.deviceId)}
              >
                <span className='material-symbols-outlined' aria-hidden='true'>
                  {device.deviceId === 'default' ? 'speaker' : categoryIcon[device.category]}
                </span>
                <span className='audio-output-selector-option-copy'>
                  <span>{device.label}</span>
                  <small>
                    {device.deviceId === 'default'
                      ? 'System default'
                      : categoryLabel[device.category]}
                  </small>
                </span>
                {device.deviceId === selectedDeviceId && (
                  <span className='material-symbols-outlined' aria-hidden='true'>
                    check
                  </span>
                )}
              </button>
            ))}
            {availableDevices.length === 0 && !isLoading && !error && (
              <p className='audio-output-selector-empty' role='status'>
                No available audio outputs were found.
              </p>
            )}
            {error && (
              <p className='audio-output-selector-error' role='alert'>
                {error}
              </p>
            )}
          </div>,
          document.body
        )}
      {!isOpen && error && (
        <span className='audio-output-selector-status' role='status'>
          {error}
        </span>
      )}
    </div>
  );
};

export default AudioOutputSelector;
