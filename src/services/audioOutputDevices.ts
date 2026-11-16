export type AudioOutputCategory = 'internal' | 'wired' | 'wireless' | 'other';

export interface AudioOutputDevice {
  deviceId: string;
  label: string;
  category: AudioOutputCategory;
}

interface SinkIdAudioElement extends HTMLAudioElement {
  sinkId?: string;
  setSinkId?: (sinkId: string) => Promise<void>;
}

interface SinkIdAudioContext extends AudioContext {
  sinkId?: string | { type: 'none' };
  setSinkId?: (sinkId: string | { type: 'none' }) => Promise<void>;
}

export const isAudioOutputSelectionSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.enumerateDevices) &&
  typeof window.AudioContext !== 'undefined' &&
  typeof (window.AudioContext.prototype as SinkIdAudioContext).setSinkId === 'function' &&
  typeof (document.createElement('audio') as SinkIdAudioElement).setSinkId === 'function';

const classifyOutput = (label: string): AudioOutputCategory => {
  const normalizedLabel = label.toLowerCase();
  if (/bluetooth|wireless|airpods|airpod|buds|a2dp/.test(normalizedLabel)) return 'wireless';
  if (/wired|headphones|headset|usb|line out|jack/.test(normalizedLabel)) return 'wired';
  if (/built.?in|internal|speakers?|realtek|high definition audio/.test(normalizedLabel)) {
    return 'internal';
  }
  return 'other';
};

export const enumerateAudioOutputDevices = async (): Promise<AudioOutputDevice[]> => {
  if (!navigator.mediaDevices?.enumerateDevices) {
    throw new Error('Audio output device discovery is not available in this app.');
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const outputs = devices
    .filter((device) => device.kind === 'audiooutput')
    .map((device, index) => {
      const label =
        device.label.trim() ||
        (device.deviceId === 'default' ? 'System default' : `Audio output ${index + 1}`);
      return {
        deviceId: device.deviceId,
        label,
        category: classifyOutput(label),
      };
    });
  if (outputs.length === 0) return [];

  const probeContext = new window.AudioContext();
  const workingOutputs: AudioOutputDevice[] = [];
  try {
    for (const device of outputs) {
      try {
        await setAudioContextSinkId(probeContext, device.deviceId);
        workingOutputs.push(device);
      } catch (error) {
        if (
          error instanceof DOMException &&
          ['NotAllowedError', 'NotFoundError', 'NotReadableError'].includes(error.name)
        ) {
          continue;
        }
        throw error;
      }
    }
  } finally {
    if (probeContext.state !== 'closed') await probeContext.close();
  }
  return workingOutputs;
};

const setSinkId = async (audio: HTMLAudioElement, deviceId: string): Promise<void> => {
  const audioWithSinkId = audio as SinkIdAudioElement;
  if (typeof audioWithSinkId.setSinkId !== 'function') {
    throw new Error('This app cannot switch audio output devices in the current runtime.');
  }
  await audioWithSinkId.setSinkId(deviceId);
};

const getSinkId = (audio: HTMLAudioElement): string => {
  const sinkId = (audio as SinkIdAudioElement).sinkId;
  return sinkId || 'default';
};

const setAudioContextSinkId = async (
  audioContext: AudioContext,
  deviceId: string
): Promise<void> => {
  const contextWithSinkId = audioContext as SinkIdAudioContext;
  if (typeof contextWithSinkId.setSinkId !== 'function') {
    throw new Error('This app cannot switch audio output devices in the current runtime.');
  }
  await contextWithSinkId.setSinkId(deviceId);
};

export const setAudioContextOutputDevice = async (
  audioContext: AudioContext,
  deviceId: string
): Promise<void> => {
  await setAudioContextSinkId(audioContext, deviceId);
};

export const setAudioOutputForElements = async (
  audioElements: HTMLAudioElement[],
  deviceId: string,
  audioContext: AudioContext | null
): Promise<void> => {
  if (!deviceId) throw new Error('A valid audio output device is required.');

  const uniqueElements = [...new Set(audioElements)];
  if (uniqueElements.length === 0 && !audioContext) {
    throw new Error('No audio players are available to switch to the selected output.');
  }

  const contextWithSinkId = audioContext as SinkIdAudioContext | null;
  const previousContextDeviceId =
    typeof contextWithSinkId?.sinkId === 'string' ? contextWithSinkId.sinkId : 'default';
  let contextChanged = false;
  const changedElements: Array<{ audio: HTMLAudioElement; previousDeviceId: string }> = [];
  try {
    if (audioContext && typeof contextWithSinkId?.setSinkId === 'function') {
      await setAudioContextSinkId(audioContext, deviceId);
      contextChanged = true;
    }
    for (const audio of uniqueElements) {
      const previousDeviceId = getSinkId(audio);
      await setSinkId(audio, deviceId);
      changedElements.push({ audio, previousDeviceId });
    }
  } catch (error) {
    const rollbackErrors: string[] = [];
    for (const changed of changedElements.reverse()) {
      try {
        await setSinkId(changed.audio, changed.previousDeviceId);
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    }
    if (contextChanged && audioContext) {
      try {
        await setAudioContextSinkId(audioContext, previousContextDeviceId);
      } catch (rollbackError) {
        rollbackErrors.push(
          rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
        );
      }
    }
    if (rollbackErrors.length > 0) {
      throw new Error(
        `Could not switch all players to the selected output, and restoring the previous output also failed: ${rollbackErrors.join('; ')}`
      );
    }
    throw error;
  }
};
