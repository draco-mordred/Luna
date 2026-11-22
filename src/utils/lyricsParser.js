/**
 * @typedef {{ time: number; text: string }} SyncedLyricLine
 * @typedef {{ lyrics: string; syncedLyrics: SyncedLyricLine[] }} ParsedLyrics
 */

/** @param {string} token @returns {number | null} */
const parseTimestampToSeconds = (token) => {
  const normalized = token.trim().replace(/[,]/g, '.');
  const parts = normalized.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const values = parts.map(Number);
  if (values.some((value) => !Number.isFinite(value))) return null;
  if (parts.length === 2) return values[0] * 60 + values[1];
  return values[0] * 3600 + values[1] * 60 + values[2];
};

/** @param {string} rawText @returns {SyncedLyricLine[]} */
const parseSyncedLyrics = (rawText) => {
  if (typeof rawText !== 'string') return [];
  const lines = rawText
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n');
  /** @type {SyncedLyricLine[]} */
  const cues = [];
  let cueStart = null;
  let cueText = [];

  const addCue = (time, text) => {
    const cleanedText = text.trim();
    if (Number.isFinite(time) && cleanedText) cues.push({ time, text: cleanedText });
  };

  const flushBlockCue = () => {
    if (cueStart !== null && cueText.length > 0) addCue(cueStart, cueText.join('\n'));
    cueStart = null;
    cueText = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushBlockCue();
      continue;
    }

    const timestampMatches = [
      ...line.matchAll(/\[(\d{1,2}:\d{2}(?:[.,]\d{1,3})?|\d{1,2}:\d{2}:\d{2}(?:[.,]\d{1,3})?)\]/g),
    ];
    if (timestampMatches.length > 0) {
      flushBlockCue();
      const lastTimestamp = timestampMatches[timestampMatches.length - 1];
      const lyricText = line.slice(lastTimestamp.index + lastTimestamp[0].length).trim();
      for (const match of timestampMatches) {
        addCue(parseTimestampToSeconds(match[1]), lyricText);
      }
      continue;
    }

    const timeRange = line.match(
      /^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})(?:\s+.*)?$/
    );
    if (timeRange) {
      flushBlockCue();
      cueStart = parseTimestampToSeconds(timeRange[1]);
      continue;
    }

    const simpleCue = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3})\s+(.+)$/);
    if (simpleCue) {
      flushBlockCue();
      addCue(parseTimestampToSeconds(simpleCue[1]), simpleCue[2]);
      continue;
    }

    if (/^(?:WEBVTT|NOTE\b|\d+)$/.test(line)) continue;
    if (cueStart !== null) cueText.push(line);
  }
  flushBlockCue();

  return cues.filter((cue) => cue.text).sort((left, right) => left.time - right.time);
};

/** @param {string} rawText @returns {ParsedLyrics} */
const parseLyricsText = (rawText) => {
  const text = typeof rawText === 'string' ? rawText.replace(/^\uFEFF/, '') : '';
  const syncedLyrics = parseSyncedLyrics(text);
  if (syncedLyrics.length === 0) return { lyrics: text.trim(), syncedLyrics };

  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const hasLrcTimestamps = lines.some((line) => /\[\d{1,2}:\d{2}(?:[.,]\d{1,3})?\]/.test(line));
  const lyrics = lines
    .map((rawLine) => {
      const line = rawLine.trim();
      if (
        !line ||
        /^\[(?:ar|al|ti|au|by|re|ve|length|offset|la|tool|id):[^\]]*\]$/i.test(line) ||
        /^(?:WEBVTT|NOTE\b|\d+)$/.test(line) ||
        /^\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}\s*-->/.test(line)
      ) {
        return '';
      }
      return hasLrcTimestamps
        ? line.replace(/\[\d{1,2}:\d{2}(?:[.,]\d{1,3})?\]/g, '').trim()
        : line;
    })
    .filter(Boolean)
    .join('\n');

  return {
    lyrics: lyrics || syncedLyrics.map((cue) => cue.text).join('\n'),
    syncedLyrics,
  };
};

/**
 * @param {string[]} values
 * @returns {{ lyrics: string | undefined; syncedLyrics: SyncedLyricLine[] | undefined }}
 */
const combineLyricsValues = (values) => {
  const parsedValues = values
    .filter((value, index, allValues) => value && allValues.indexOf(value) === index)
    .map((value) => parseLyricsText(value));
  const seenCues = new Set();
  const syncedLyrics = parsedValues
    .flatMap(({ syncedLyrics }) => syncedLyrics)
    .filter((line) => {
      const key = `${line.time.toFixed(3)}\0${line.text}`;
      if (seenCues.has(key)) return false;
      seenCues.add(key);
      return true;
    });
  const plainLyrics = parsedValues
    .filter(({ syncedLyrics }) => syncedLyrics.length === 0)
    .map(({ lyrics }) => lyrics)
    .filter(Boolean)
    .join('\n\n');
  const timestampedPlainLyrics = parsedValues
    .filter(({ syncedLyrics }) => syncedLyrics.length > 0)
    .map(({ lyrics }) => lyrics)
    .filter(Boolean)
    .join('\n\n');

  return {
    lyrics: plainLyrics || timestampedPlainLyrics || undefined,
    syncedLyrics: syncedLyrics.length > 0 ? syncedLyrics : undefined,
  };
};

module.exports = { combineLyricsValues, parseLyricsText, parseSyncedLyrics };
