import type { UsbSyncProgress } from '../types/electron';

export const USB_SYNC_INDICATOR_EVENT = 'luna-usb-sync-indicator';

export type UsbSyncIndicator =
  | { status: 'running'; progress: UsbSyncProgress }
  | { status: 'complete'; message: string }
  | { status: 'error'; message: string };

export const publishUsbSyncIndicator = (detail: UsbSyncIndicator) => {
  window.dispatchEvent(new CustomEvent<UsbSyncIndicator>(USB_SYNC_INDICATOR_EVENT, { detail }));
};
